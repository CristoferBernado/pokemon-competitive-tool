# Documentação Técnica — Bidoof Lab's

> Documentação detalhada de arquitetura, fluxos de dados, componentes e decisões de design do projeto.

---

## Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Camada de Serviço — PokeAPIService](#2-camada-de-serviço--pokeapiservice)
3. [Modelos de Dados](#3-modelos-de-dados)
4. [Rotas e Controllers](#4-rotas-e-controllers)
5. [Sistema de Templates](#5-sistema-de-templates)
6. [Frontend — CSS e Design System](#6-frontend--css-e-design-system)
7. [Frontend — JavaScript](#7-frontend--javascript)
8. [Fluxo de Dados — Busca](#8-fluxo-de-dados--busca)
9. [Fluxo de Dados — Teambuilder](#9-fluxo-de-dados--teambuilder)
10. [Sistema de Cache](#10-sistema-de-cache)
11. [Configuração e Variáveis de Ambiente](#11-configuração-e-variáveis-de-ambiente)
12. [Testes](#12-testes)
13. [Decisões de Design](#13-decisões-de-design)

---

## 1. Visão Geral da Arquitetura

O projeto segue o padrão **MVC adaptado para Flask**:

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Cliente)                 │
│   HTML/CSS/JS — Bootstrap 5.3 + Vanilla CSS/JS      │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP
┌───────────────────────▼─────────────────────────────┐
│              Flask Application (WSGI)                │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │               routes.py (Blueprint)           │   │
│  │  / · /search · /pokemon/<id> · /teambuilder  │   │
│  │  /damage-calculator                          │   │
│  │  /api/pokemon/search · /api/pokemon/autocomplete│  │
│  └──────────────┬───────────────────────────────┘   │
│                 │                                    │
│  ┌──────────────▼───────────────────────────────┐   │
│  │           PokeAPIService                      │   │
│  │  Camada de acesso a dados + cache em memória  │   │
│  └──────────────┬───────────────────────────────┘   │
│                 │                                    │
│  ┌──────────────▼───────────────────────────────┐   │
│  │     Flask-Caching (SimpleCache, TTL 1h)       │   │
│  └──────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼─────────────────────────────┐
│              PokéAPI v2 (pokeapi.co)                 │
│    /pokemon · /type · /ability · /pokemon-species    │
└─────────────────────────────────────────────────────┘
```

### Inicialização da Aplicação

**`run.py`** instancia a app via factory pattern:
```python
from app import create_app
app = create_app()
app.run(debug=True, host='0.0.0.0', port=5000)
```

**`app/__init__.py`** — App Factory:
```python
def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    cache.init_app(app)                  # Flask-Caching
    from .routes import main_bp
    app.register_blueprint(main_bp)      # único Blueprint
    return app
```

---

## 2. Camada de Serviço — PokeAPIService

**Arquivo:** `app/services/pokeapi_service.py`

Único ponto de contato com a PokéAPI externa. Instanciado uma vez como variável de módulo em `routes.py`:
```python
pokeapi = PokeAPIService()
```

### Métodos Públicos

#### `resolve_search_mode(query: str) -> str`
Detecta automaticamente o tipo de busca com base no input do usuário:

```
query.strip().isdigit()          → 'id'
slug in _get_type_slugs()        → 'type'
else                             → 'name'
```

Slugs de tipo são obtidos da PokeAPI (`GET /type?limit=100`) e cacheados na instância.

#### `search_pokemon(query, search_type='auto') -> List[Pokemon]`

| `search_type` | Comportamento |
|---|---|
| `'id'` | `GET /pokemon/<id>` → 1 resultado |
| `'name'` | `GET /pokemon/<slug>` (match exato) → se não encontrar, busca substring em summaries (máx 20) |
| `'type'` | `GET /type/<slug>` → carrega todos os Pokémon do tipo em paralelo |
| `'auto'` | Chama `resolve_search_mode()` e delega |

#### `get_pokemon_by_id(id) -> Optional[Pokemon]`
`GET /pokemon/<id>` e converte para `Pokemon` via `from_api_data()`.

#### `get_pokemon_stats(id) -> Optional[PokemonStats]`
Faz a mesma requisição `GET /pokemon/<id>` (sem cache compartilhado de requisição) e extrai apenas os stats.

> **Nota:** Esta requisição é duplicada em relação ao `get_pokemon_by_id`. Oportunidade de otimização futura.

#### `enrich_pokemon_for_detail(pokemon)`
Chama em sequência:
1. `enrich_pokemon_generation()` — busca a `species_url` e extrai geração
2. `enrich_pokemon_abilities_text()` — para cada habilidade, busca texto em `GET /ability/<slug>`

#### `enrich_pokemon_list_generations(pokemons)`
Usa `ThreadPoolExecutor` (máx 24 workers) para buscar a geração de múltiplos Pokémon em paralelo. Preserva a ordem usando índices.

### Métodos Privados

| Método | Descrição |
|---|---|
| `_make_request(endpoint)` | GET síncrono com Flask context (usa `current_app`) |
| `_get_json_threadsafe(endpoint, timeout)` | GET sem Flask context, para uso dentro de threads |
| `_get_pokemon_summaries()` | Lista completa da Pokédex nacional (nome + URL). Cache na instância |
| `_get_type_slugs()` | Set de slugs oficiais de tipo. Cache na instância |
| `_load_pokemon_list_for_type(entries)` | Carrega Pokémon de uma lista em paralelo, ordena por ID |
| `_fetch_ability_text(slug, timeout)` | Busca texto de habilidade com cache por slug |
| `_species_generation_from_url(url, timeout)` | Segue `species_url` para extrair número da geração |

### Prioridade de Idioma (Habilidades)
```python
_LANG_PRIORITY = ('pt-BR', 'pt', 'es', 'en')
```
A função `_pick_ability_effect_text()` percorre os `effect_entries` preferindo `short_effect` antes de `effect`.

---

## 3. Modelos de Dados

**Arquivo:** `app/models/pokemon.py`

### `Pokemon` (dataclass)

```python
@dataclass
class Pokemon:
    id: int
    name: str                     # Formatado: Title Case com espaços
    types: List[str]              # Slugs: ['fire', 'flying']
    sprite_url: Optional[str]     # URL do sprite frontal padrão
    official_artwork_url: Optional[str]  # URL da arte oficial
    height: float                 # Em metros (dado bruto ÷ 10)
    weight: float                 # Em kg (dado bruto ÷ 10)
    abilities: List[Dict]         # [{name, is_hidden, description}]
    base_experience: int
    hp: int
    attack: int
    species_url: Optional[str]    # URL para /pokemon-species/<id>
    generation: Optional[int]     # 1–9, preenchido por enrich_*

    @property
    def formatted_id(self) -> str: ...   # "Nº 0025"
    @property
    def type_defenses(self): ...         # Dict[type_slug, float]
```

#### `type_defenses` Property

Calcula a efetividade de cada tipo atacante contra este Pokémon, multiplicando os valores do `DEFENSE_CHART` para cada um dos tipos do Pokémon:

```python
defenses = {t: 1.0 for t in ALL_TYPES}
for t in self.types:
    chart = DEFENSE_CHART.get(t, {})
    for attacker in ALL_TYPES:
        defenses[attacker] *= chart.get(attacker, 1.0)
return defenses
```

Isso permite calcular imunidades duplas (ex: Ghost/Normal = imune a Normal E Fighting).

#### `from_api_data(data)` — Factory Method

Mapeia os campos da resposta JSON da PokeAPI para o dataclass:

```
data['sprites']['other']['official-artwork']['front_default'] → official_artwork_url
data['sprites']['front_default']                              → sprite_url
data['name'].replace('-', ' ').title()                        → name
data['types'][*]['type']['name']                              → types
data['species']['url']                                        → species_url
data['stats'][*]                                              → hp, attack
data['abilities'][*]                                          → abilities (sem description)
data['height'] / 10                                           → height
data['weight'] / 10                                           → weight
```

### `PokemonStats` (dataclass)

```python
@dataclass
class PokemonStats:
    hp: int
    attack: int
    defense: int
    special_attack: int    # de 'special-attack'
    special_defense: int   # de 'special-defense'
    speed: int
```

### `type_defenses.py`

```python
ALL_TYPES = ['normal', 'fire', 'water', 'electric', 'grass', 'ice',
             'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
             'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy']

DEFENSE_CHART = {
    'fire': {
        'ground': 2.0, 'rock': 2.0, 'water': 2.0,  # fraquezas
        'bug': 0.5, 'steel': 0.5, 'fire': 0.5,      # resistências
        ...
    },
    ...
}
# Ausência de chave = multiplicador neutro (1.0)
# Valor 0.0 = imunidade
```

---

## 4. Rotas e Controllers

**Arquivo:** `app/routes.py`

### Rotas de Página

#### `GET /`
Renderiza `index.html`. Sem dados dinâmicos.

#### `GET /search?q=<query>&page=<n>`

Fluxo:
1. Obtém `query` e `page` dos query params
2. Chama `pokeapi.resolve_search_mode(query)` para detectar o modo
3. Se `search_type == 'type'`:
   - Carrega todos os Pokémon do tipo
   - Enriquece gerações em paralelo
   - Serializa dados para JSON e passa para o template (paginação frontend)
4. Caso contrário:
   - Fatia `all_pokemons[start:end]` para a página atual
   - Enriquece gerações do slice
   - Constrói objeto `pagination` com window de páginas
   - Passa para o template (paginação server-side)

**Variáveis de template:** `pokemons`, `query`, `search_type`, `pagination`, `type_search_frontend_pagination`, `pokemons_data`, `type_search_total`, `per_page`, `initial_page`

#### `GET /pokemon/<int:pokemon_id>`

Fluxo:
1. `pokeapi.get_pokemon_by_id(id)` → busca dados básicos
2. `pokeapi.get_pokemon_stats(id)` → busca stats (requisição separada)
3. `pokeapi.enrich_pokemon_for_detail(pokemon)` → geração + textos de habilidades
4. Se não encontrado: renderiza `404.html`

#### `GET /teambuilder`

Renderiza `teambuilder.html` passando `ALL_TYPES` e `DEFENSE_CHART` como variáveis de template (injetadas em `<script>` como JSON).

#### `GET /damage-calculator`

Renderiza `damage_calculator.html` injetando arrays locais de Pokémons e Types para alimentar cache. Interface standalone delegada totalmente ao Vanilla JS.

### Rotas de API (JSON)

#### `GET /api/pokemon/search?q=<query>`

Retorna:
```json
{"mode": "name", "total": 1, "results": [{"id": 25, "name": "Pikachu", "types": ["electric"], "sprite_url": "..."}]}
```

#### `GET /api/pokemon/autocomplete?q=<prefix>&limit=<n>`

Busca substring case-insensitive em `get_all_pokemon_names()`.
Retorna: `{"suggestions": ["Pikachu", ...]}`

### Helper — `_pagination_window(page, total_pages, width=7)`

Calcula a janela de páginas visíveis, centralizada na página atual:
```python
half = width // 2
start = max(1, page - half)
end = min(total_pages, start + width - 1)
start = max(1, end - width + 1)
return list(range(start, end + 1))
```

---

## 5. Sistema de Templates

### Hierarquia de Herança

```
base.html                       ← layout raiz
├── index.html
├── search_results.html
│   └── [script: type_search_pagination.js quando busca por tipo]
├── pokemon_detail.html
├── teambuilder.html
│   └── [script: teambuilder.js]
├── damage_calculator.html
│   └── [script: damage_calculator.js]
├── 404.html
└── 500.html
```

### `base.html` — Estrutura HTML

```html
<html data-theme="...">           ← aplicado antes do render via script inline
<head>
  Bootstrap 5.3 CSS (CDN)
  style.css
  favicon.png
  [Script inline: aplica tema do localStorage]
</head>
<body class="pokedex-body">
  #page-loading                   ← overlay de carregamento
  .pokedex-bezel.top              ← bezel vermelho superior (câmera + cutout)
  .pokedex-device-body
    nav.pokedex-navbar            ← navbar vermelha
      .navbar-brand               ← logo centralizado (absolute)
      #theme-toggle               ← Solrock/Lunatone toggle
      .navbar-toggler             ← hamburger
      #navbarNav                  ← menu colapsável (Teambuilder + busca)
    .pokedex-screen
      main.container              ← {% block content %}
    footer.site-footer
  .pokedex-bezel.bottom          ← bezel vermelho inferior (charge-port + cutout)

  Bootstrap 5.3 JS (CDN)
  main.js
  {% block scripts %}            ← scripts específicos de página
</body>
```

### Bloco `content` e `scripts`

- `{% block content %}` — conteúdo principal da página
- `{% block title %}` — título da aba (`<title>`)
- `{% block scripts %}` — scripts carregados antes do `</body>`

---

## 6. Frontend — CSS e Design System

**Arquivo:** `app/static/css/style.css` (~656 linhas)

### Variáveis CSS (Custom Properties)

Definidas em `:root` (dark mode padrão) e sobrescritas em `[data-theme="light"]`:

```css
:root {
    --kalos-red: #e60012;
    --kalos-red-dark: #b71c1c;
    --kalos-teal-dark: #051d1d;
    --kalos-teal-card: rgba(18, 43, 43, 0.70);
    --kalos-cyan: #4dd0e1;
    --kalos-glow: rgba(77, 208, 225, 0.4);
    --bg-color: var(--kalos-teal-dark);
    --text-color: #ffffff;
    --card-bg: var(--kalos-teal-card);
    --border-color: rgba(77, 208, 225, 0.3);
    --muted-text: #a0baba;
}
```

### Backgrounds por Tema

Dark mode usa pseudo-elemento `::before` na `body` com `bg-dark.jpg` e `filter: blur(5px)`.
Light mode sobrescreve com `bg-light.jpg`.

```css
body.pokedex-body::before {
    content: '';
    position: fixed; inset: -5%;
    width: 110%; height: 110%;
    background: url('../img/bg-dark.jpg') no-repeat center / cover;
    filter: blur(5px);
    z-index: -10;
}
```

### Componentes CSS Principais

#### Bezels Pokédex (`.pokedex-bezel`)
```css
.pokedex-bezel { height: 60px; background: var(--kalos-red); }
.cutout-top { border-radius: 0 0 100px 100px; }   /* Semicírculo inferior */
.cutout-bottom { border-radius: 100px 100px 0 0; } /* Semicírculo superior */
```

#### Cards com Glassmorphism
```css
.card {
    background-color: var(--card-bg) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
}
```

#### Type Badge Pills
18 classes `.type-<slug>` com cores fixas via `!important`.
Cores escolhidas para corresponder ao padrão visual dos jogos Pokémon.

#### Loading Overlay
Pokébola animada com `@keyframes rotatePokeball` (rotação) e `@keyframes buttonPulse` (centro pulsando com cor amarela).

#### Theme Toggle (Solrock/Lunatone)
```css
.light-dark-toggle { width: 60px; height: 26px; border-radius: 20px; }
.indicator { width: 32px; height: 32px; background-image: url('...sprite...'); }
/* Transição com cubic-bezier para efeito "elástico" */
transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
```

#### Teambuilder Coverage Tables
```css
.cov-table th, .cov-table td { height: 35px; text-align: center; }
/* Escala de cores para totais */
.scale-weak-1  { background: rgba(220, 53, 69, 0.3); }
.scale-weak-2  { background: rgba(220, 53, 69, 0.6); color: #fff; }
.scale-weak-3  { background: #dc3545; color: #ffeb3b; font-weight: 900; }
.scale-resist-1 { background: rgba(25, 135, 84, 0.3); }
.scale-resist-2 { background: rgba(25, 135, 84, 0.6); color: #fff; }
.scale-resist-3 { background: #198754; color: #ffeb3b; font-weight: 900; }
```

---

## 7. Frontend — JavaScript

### `main.js`

```javascript
// 1. Autocomplete global (qualquer input[name="q"])
//    - Debounce 300ms, mínimo 2 caracteres
//    - GET /api/pokemon/autocomplete?q=...
//    - showSuggestions() (stub — implementação básica via console.log)

// 2. Loading Overlay
//    - form.site-search-form submit → remove classe d-none do #page-loading
//    - pageshow → adiciona d-none de volta (navegação back/forward)

// 3. Theme Toggle
//    - #theme-toggle click → toggle data-theme no <html>
//    - Atualiza também o `data-bs-theme` para sincronizar dropdowns nativos do bootstrap!
//    - localStorage.setItem('theme', newTheme)
//    - updateThemeIcon() — atualiza ícone .theme-icon (se existir)

// 4. fitPokemonNames()
//    - Para cada .pokemon-name:
//        calcula ratio containerWidth / textWidth
//        ajusta font-size para evitar overflow (mínimo 0.8rem)
//    - Executado em DOMContentLoaded e window.resize

// 5. showSuggestions() [Autocomplete Principal]
//    - Renderiza a `ul#search-suggestions` fixada diretamente abaixo do search input (`col-12 col-lg-8`).
//    - Otimizada usando `max-height` restritivos à caixa responsiva que empurra outros slots.
//    - Realiza submit() de form automático ao clicar em sugestão.
```

### `teambuilder.js` (IIFE)

```javascript
const team = [null, null, null, null, null, null];

// Estrutura do objeto de slot:
// { name: string, types: string[], sprite_url: string|null }

// Fluxo de interação:
// input[name] → handleInput() → debounce 300ms
//   → GET /api/pokemon/autocomplete → renderiza tb-suggestions
//   → click na sugestão → loadPokemonData()
//     → GET /api/pokemon/search → popula team[i]
//     → updateCoverage()
//       → updateHeaders()         // sprites nos th.slot-header (clicáveis para interagir com State Inspector)
//       → renderDefensiveTable()  // 18 tipos × 6 slots, calcula mult defensivo
//       → renderOffensiveTable()  // 18 tipos defensores × 6 slots, calcula melhor mult ofensivo

// Máquina de Stats & EVs (State Inspector):
//   → Usuário seleciona o Slot através do `updateHeaders` (o border pisca com var(--type-water) css-bind)
//   → `openInspector(slotIndex)` injeta HTML da box flutuando por cima da tabela
//   → `drawInspectorRadar(slotIndex)` desenha o hexágono SVG comparando TotalStats VS BaseStats usando SVGPolygon.
//   → Mudanças the range/inputs nas caixas do inspector atualizam o payload `team[i].evs` e `team[i].ivs`. Limitadores bloqueiam soma global exceder 510.
//   → O export trigger (botão showdown) encapsula array para modal cru `.txt` pronto para 'CTRL+C' ou 'Export'.
```

**Cálculo defensivo** (por slot `i` e tipo atacante `moveType`):
```javascript
let mult = 1.0;
p.types.forEach(pType => {
    mult *= DEFENSE_CHART[pType]?.[moveType] ?? 1.0;
});
// mult > 1 → fraqueza; mult < 1 → resistência/imunidade
```

**Cálculo ofensivo** (por slot `i` e tipo defensor `defenderType`):
```javascript
let bestMult = 0;
p.types.forEach(attackerType => {
    const mult = DEFENSE_CHART[defenderType]?.[attackerType] ?? 1.0;
    if (mult > bestMult) bestMult = mult;
});
// bestMult > 1 → Pokémon cobre bem esse tipo defensor
```

### `type_search_pagination.js`

```javascript
// Lê JSON do #type-search-bootstrap (injetado pelo template)
const { items, perPage, initialPage, query } = JSON.parse(bootstrap.textContent);

// Renderiza cards HTML (mesmo layout do search_results.html — server-side)
function renderPage(page) { /* gera cards para items[start..end] */ }
function renderPagination(page, totalPages) { /* gera botões de página */ }

// Sem chamadas de API — todos os dados já estão no HTML
```

---

## 8. Fluxo de Dados — Busca

### Busca por Nome

```
Usuário digita "charizard" → submit form
→ GET /search?q=charizard
→ routes.search()
  → resolve_search_mode("charizard") → 'name'
  → search_pokemon("charizard", 'auto')
    → get_pokemon_by_name("charizard")
    → GET https://pokeapi.co/api/v2/pokemon/charizard
    → Pokemon.from_api_data(response_json)
  → enrich_pokemon_list_generations([charizard])
    → ThreadPoolExecutor(1 worker)
    → GET /pokemon-species/6 → generation-i → 1
  → render search_results.html (server-side, 1 resultado)
```

### Busca por Tipo

```
Usuário digita "dragon" → submit form
→ GET /search?q=dragon
→ routes.search()
  → resolve_search_mode("dragon") → 'type' (slug em _type_slugs_cache)
  → search_pokemon("dragon", 'type')
    → GET /type/dragon → {pokemon: [{url: /pokemon/147}, ...]}
    → _load_pokemon_list_for_type(entries)
      → ThreadPoolExecutor(32 workers)
      → GET /pokemon/<id> para cada Pokémon em paralelo
      → ordena por ID
  → enrich_pokemon_list_generations(all_pokemons)  [ThreadPool]
  → serializa para JSON (pokemons_data)
  → render search_results.html
      type_search_frontend_pagination=True
      pokemons_data=[{id, name, types, sprite_url, ...}]
→ Browser carrega type_search_pagination.js
  → lê JSON bootstrap → renderiza página 1
```

---

## 9. Fluxo de Dados — Teambuilder

```
Usuário abre /teambuilder
→ Flask: render teambuilder.html
    ALL_TYPES = [...] (Python list → JSON)
    DEFENSE_CHART = {...} (Python dict → JSON)
→ Browser executa teambuilder.js
  → renderInputs() — cria 6 linhas de input
  → renderDefensiveTable() — 18 linhas, 6 colunas + 2 totais (vazio)
  → renderOffensiveTable() — 18 linhas, 6 colunas + 1 total (vazio)

Usuário digita "bulba" no slot 1
→ handleInput(e, 0)
  → debounce 300ms
  → GET /api/pokemon/autocomplete?q=bulba&limit=10
  → renderiza "Bulbasaur", "Bulbizarre"...
→ usuário clica "Bulbasaur"
  → loadPokemonData("Bulbasaur", 0)
  → GET /api/pokemon/search?q=Bulbasaur
  → team[0] = {name:"Bulbasaur", types:["grass","poison"], sprite_url:"..."}
  → updateCoverage()
    → updateHeaders() — slot 1 mostra sprite + nome
    → renderDefensiveTable()
      → para moveType="fire": mult = DEFENSE_CHART["grass"]["fire"] * DEFENSE_CHART["poison"]["fire"]
                                    = 2.0 * 1.0 = 2.0 → val-2-0 (vermelho)
      → totalWeak++ para fire
    → renderOffensiveTable()
      → para defenderType="fire": bestMult de ["grass","poison"] contra "fire"
                                 = max(DEFENSE_CHART["fire"]["grass"], DEFENSE_CHART["fire"]["poison"])
                                 = max(0.5, 1.0) = 1.0 → neutro
```

---

## 10. Fluxo de Dados — Calculadora de Dano (Gen 9)

```
Usuário abre /damage-calculator
→ Flask renderiza interface 3-Colunas injectando ALL_NAMES e TYPES.
→ JS: initAutocomplete(), initTypeSelects()

Usuário escolhe "Charizard" em P1
→ input trigger → GET /api/v2/pokemon/charizard
→ Auto-Fill Base Stats (HP, Atk, Def, SpA, SpD, Spe)
→ Limpeza das EVs parciais.
→ Popula Dropdown Natures (Modest, Adamant...)
→ Guarda `data.moves` no cache window.cachedMoves['p1']
→ JS re-calcula o STATUS TOTAL utilizando equação da Geração 9 (Nível 100).

Usuário digita golpe no Slot 1
→ Autocomplete varre `window.cachedMoves['p1']` filtrando golpes legais.
→ Usuário fixa "Fire Blast"
→ GET /api/v2/move/fire-blast 
→ JS capta `power` (110) e injeta no form, setando category para "Special".

Engine Matemática dispara simulateStrike('p1', 'p2'):
→ 1. Detecta tipo da colisão (Special puxa SpA contra SpD do P2).
→ 2. Executa função Base_Damage = Floor(((2 * Lvl / 5 + 2) * BP * A/D) / 50) + 2
→ 3. Aplica TYPE_CHART (x2 se grass, x0.5 se water).
→ 4. Aplica STAB (x1.5 se move type == attacker type).
→ 5. Estoca rolagem min (85%) e max (100%).
→ Output projetado no #main-result com color scaling crítico.
```

---

## 11. Sistema de Cache

### Flask-Caching (`SimpleCache`)

- Cache compartilhado em memória por processo Flask
- TTL padrão: 3600 segundos (1 hora)
- Configurado em `config.py` e inicializado em `app/__init__.py`
- **Não usado explicitamente com decorators** no código atual — o caching real está nos atributos de instância do `PokeAPIService`

### Cache de Instância (`PokeAPIService`)

| Atributo | Tipo | Conteúdo | Quando preenchido |
|---|---|---|---|
| `_pokemon_summaries_cache` | `List[Dict]` | Nome + URL de todos os Pokémon | Primeira busca por nome |
| `_type_slugs_cache` | `set[str]` | Slugs oficiais de tipo | Primeira busca por tipo |
| `_ability_text_cache` | `Dict[str, str]` | Texto de habilidade por slug | Primeira visita a detalhes |

> ⚠️ Este cache é perdido ao reiniciar o servidor (não persistido).

---

## 12. Configuração e Variáveis de Ambiente

**Arquivo:** `config.py`

```python
class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-123'
    POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2'
    POKEAPI_TIMEOUT = 10          # segundos
    CACHE_TYPE = 'SimpleCache'
    CACHE_DEFAULT_TIMEOUT = 3600  # 1 hora
    ITEMS_PER_PAGE = 20
    SEARCH_RESULTS_PER_PAGE = 24
    DEBUG = True
    TESTING = False
```

**Arquivo `.env` (opcional):**
```env
SECRET_KEY=sua-chave-secreta-segura
```

---

## 13. Testes

**Diretório:** `tests/`
**Frameworks:** `pytest` 7.4.3 + `pytest-flask` 1.2.0

Para executar:
```bash
pytest tests/ -v
```

**Dependências de teste em `requirements.txt`:**
```
pytest==7.4.3
pytest-flask==1.2.0
```

---

## 14. Decisões de Design

### Por que paginação frontend para buscas por tipo?

A PokéAPI retorna todos os Pokémon de um tipo em uma única resposta (sem paginação própria). Como carregar apenas uma "página" exigiria saber os IDs/URLs com antecedência — e a API não suporta offset por tipo — optou-se por carregar **todos de uma vez com ThreadPoolExecutor** e paginar no frontend. Isso resulta em uma primeira carga mais lenta, mas navegação subsequente instantânea.

### Por que `SimpleCache` em vez de Redis?

O projeto é para uso local/desenvolvimento. `SimpleCache` é em memória, zero configuração. Para produção com múltiplos workers, `RedisCache` seria necessário.

### Por que Vanilla JS em vez de React/Vue?

O projeto tem interatividade moderada (busca, teambuilder, toggle de tema). Adicionar um framework JS aumentaria a complexidade sem benefício proporcional para o escopo atual.

### Por que o tema é aplicado com um script inline no `<head>`?

Para evitar o "flash" de tema incorreto (FOUC — Flash of Unstyled Content). O script lê `localStorage` e aplica `data-theme` ao `<html>` **antes** de qualquer CSS ser renderizado.

### Por que sprites de `PokeAPI/sprites` no toggle em vez de imagens locais?

Os sprites de Solrock e Lunatone são carregados diretamente do CDN do GitHub do PokeAPI para evitar a necessidade de armazenar assets adicionais localmente. O toggle usa as URLs diretas dos sprites dos Pokémon 338 (Solrock) e 337 (Lunatone).

### Por que os textos de habilidades são buscados individualmente e não em lote?

A PokéAPI não oferece endpoint de busca em lote para habilidades. Cada uma exige um request separado para `GET /ability/<slug>`. O `_ability_text_cache` minimiza re-requisições entre visitas na mesma sessão.

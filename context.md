# context.md — Bidoof Lab's

> Este arquivo serve como referência rápida de contexto para agentes de IA, LLMs e desenvolvedores que precisam entender o projeto rapidamente antes de fazer alterações.

---

## Identidade do Projeto

- **Nome:** Bidoof Lab's
- **Tipo:** Web app de análise competitiva de Pokémon
- **Idioma da UI:** Português (pt-BR)
- **Stack:** Python 3 + Flask 3.0 + Vanilla CSS/JS + Bootstrap 5.3
- **Dados:** [PokéAPI v2](https://pokeapi.co/api/v2) (REST, sem autenticação)
- **Repositório:** `d:\Projeto\pokemon-api` (Windows)

---

## Arquitetura Resumida

```
run.py
└── create_app()  [app/__init__.py]
    ├── Flask-Caching (SimpleCache, TTL 1h)
    └── Blueprint 'main'  [app/routes.py]
        ├── PokeAPIService  [app/services/pokeapi_service.py]
        │   ├── _make_request()          — GET síncrono com Flask context
        │   ├── _get_json_threadsafe()   — GET para uso com ThreadPoolExecutor
        │   ├── search_pokemon()         — busca por nome / ID / tipo
        │   ├── resolve_search_mode()    — detecta automaticamente o tipo de busca
        │   ├── enrich_pokemon_list_generations()  — ThreadPool para buscar gerações em paralelo
        │   └── enrich_pokemon_for_detail()        — enriquece geração + textos de habilidades
        ├── Pokemon  [app/models/pokemon.py]
        │   ├── from_api_data(data)     — factory method
        │   ├── formatted_id            — "Nº 0025"
        │   └── type_defenses           — property que calcula efetividade dos 18 tipos
        ├── PokemonStats  [app/models/pokemon.py]
        └── DEFENSE_CHART  [app/models/type_defenses.py]
            └── dict[type_slug -> dict[attacker_slug -> multiplier]]
```

---

## Páginas e Templates

| URL | Template | Descrição |
|-----|----------|-----------|
| `/` | `index.html` | Home com barra de busca e cards de features "Em breve" |
| `/search?q=` | `search_results.html` | Grid de cards de resultado com paginação |
| `/pokemon/<id>` | `pokemon_detail.html` | Artwork + stats + habilidades + type defenses |
| `/teambuilder` | `teambuilder.html` | Inputs de time + tabelas de cobertura defensiva/ofensiva |
| `/damage-calculator`| `damage_calculator.html`| Calculadora de Danos (1v1) tipo Showdown |
| 404 / 500 | `404.html` / `500.html` | Páginas de erro |

Todos herdam de `base.html`, que provê:
- Bezels vermelhos (Pokédex Kalos) no topo e na base
- Navbar vermelha com logo centralizado, toggle de tema e hamburger
- Overlay de loading (pokébola animada)
- Footer com copyright Nintendo
- Bootstrap 5.3 CDN + `style.css` + `main.js`

---

## Variáveis CSS (Design Tokens)

```css
/* Dark mode (padrão, [data-theme="dark"] ou sem atributo) */
--kalos-red: #e60012          /* navbar, bezels, destaque */
--kalos-red-dark: #b71c1c     /* bordas dos bezels */
--kalos-teal-dark: #051d1d   /* background escuro */
--kalos-cyan: #4dd0e1        /* hover, IDs, barras de progresso */
--kalos-glow: rgba(77,208,225,0.4)  /* box-shadow de glow */
--card-bg: rgba(18,43,43,0.70)      /* fundo dos cards com blur */
--border-color: rgba(77,208,225,0.3)
--text-color: #ffffff
--muted-text: #a0baba

/* Light mode ([data-theme="light"]) */
--bg-color: #f0f0f0
--card-bg: rgba(255,255,255,0.65)
--border-color: rgba(0,0,0,0.1)
--text-color: #212529
--muted-text: #6c757d
```

---

## Tema Dark/Light
- Detectado por `data-theme` no `<html>`
- Script inline no `<head>` do `base.html` aplica o tema salvo ANTES do render (sem flash) e força atualizaçao conjunta do atributo do bootstrap `data-bs-theme`
- Toggle no navbar: botão `.light-dark-toggle` com sprites de **Solrock** (luz) e **Lunatone** (escuro)
- Persistência: `localStorage.setItem('theme', newTheme)`
- Fallback: `window.matchMedia('(prefers-color-scheme: dark)')`
- Backgrounds: `img/bg-dark.jpg` (dark) e `img/bg-light.jpg` (light, com `filter: blur(5px)` via pseudo-elemento `::before`)

---

## JavaScript — Arquivos e Responsabilidades

### `main.js`
- Autocomplete global no input de busca (debounce 300ms, mín. 2 chars) via `showSuggestions()`. Renderiza de forma orgânica um box `.list-group` que interage diretamente empurrando layout adjacente.
- Loading overlay (`.page-loading`) ao submeter formulários `.site-search-form`
- Theme toggle (click no `#theme-toggle`)
- `window.fitPokemonNames()` — font scaling dinâmico para `.pokemon-name` que transbordam o card

### `teambuilder.js`
- IIFE com estado `team[0..5]` (array de `{name, types, sprite_url, stats, ivs, evs, level, nature, ability, abilities}`)
- `renderInputs()` — cria 6 linhas `.tb-row` com input + caixa de autocomplete
- `handleInput()` — debounce 300ms → `GET /api/pokemon/autocomplete`
- `loadPokemonData()` — ao selecionar sugestão → `GET /api/pokemon/search` → popula `team[i]`
- `updateCoverage()` → `updateHeaders()` + `renderDefensiveTable()` + `renderOffensiveTable()`
- `renderDefensiveTable()` — para cada tipo ofensivo × 6 slots: calcula multiplicador combinado dos tipos do Pokémon
- `renderOffensiveTable()` — para cada tipo defensor × 6 slots: calcula o melhor multiplicador dos tipos do Pokémon como atacante
- **Stats Inspector API**: Hexágono SVG construído em tempo-real mapeando os vetores XY conforme input level 1-100, Natures e EVs/IVs manipulados (`drawInspectorRadar()`).
- Controles com restrição global de EVs limitada à sintaxe "510" como em batalhas competitivas (`renderStatsConfig()`).
- Exportação nativa copiada para Clipboard mapeando time completo num modal para importar no ambiente virtual Pokémon Showdown (`exportShowdown()`).
- Funções de scale: `getWeakScaleClass()`, `getResistScaleClass()` — mapeiam `count` para classes CSS de cor
- Dados injetados pelo template: `const ALL_TYPES = [...]` e `const DEFENSE_CHART = {...}`

### `damage_calculator.js`
- Responsável pelas fórmulas de dano oficiais restritas da Geração 9 para encontros (1v1).
- Extração de *Base Stats*, preenchimento ativo e re-calculagem baseada em modificadores de Natures EVs e IVs.
- `window.cachedMoves` e `initMoveAutocomplete` fornecem uma janela estrita de sugestões de Ataques lidos da PokeAPI apenas validáveis para a tipagem legal. 
- Transforma Categorias de Dano (Physical/Special) e consulta Hardcoded Chart Constants (`TYPE_CHART`) para ditar resultados fracos, letais ou absurdos em letreiros numéricos formatáveis no Header (`simulateStrike()`).

### `type_search_pagination.js`
- Ativado quando `type_search_frontend_pagination == true` (busca por tipo)
- Lê JSON bootstrap de `#type-search-bootstrap` (todos os Pokémon do tipo)
- Renderiza cards HTML no `#search-results-root` (paginação no navegador)
- Botões de paginação em `#search-pagination-root`

---

## Modelos de Dados

### `Pokemon` (dataclass)
```python
id: int
name: str                      # título, espaços em vez de hífens
types: List[str]               # slugs da PokeAPI (e.g. 'fire', 'water')
sprite_url: Optional[str]      # front_default sprite
official_artwork_url: Optional[str]
height: float                  # em metros (÷ 10)
weight: float                  # em kg (÷ 10)
abilities: List[Dict]          # [{name, is_hidden, description}]
base_experience: int
hp: int
attack: int
species_url: Optional[str]     # URL para buscar geração
generation: Optional[int]      # 1–9, preenchido por enrich_*
```

### `PokemonStats` (dataclass)
```python
hp, attack, defense, special_attack, special_defense, speed: int
```

### `DEFENSE_CHART`
```python
# Exemplo:
DEFENSE_CHART = {
    'fire': {'ground': 2.0, 'water': 2.0, 'fire': 0.5, 'grass': 0.5, ...},
    ...
}
# Ausência de chave = multiplicador 1.0
```

---

## Lógica de Busca (`PokeAPIService`)

```
resolve_search_mode(query):
  - query.isdigit()          → 'id'
  - slug in type_slugs_cache → 'type'
  - else                     → 'name'

search_pokemon(query, 'auto'):
  - 'id'   → get_pokemon_by_id(int(query))
  - 'name' → get_pokemon_by_name(slug) OU busca por substring em summaries (max 20)
  - 'type' → GET type/<slug> → _load_pokemon_list_for_type() com ThreadPoolExecutor
```

---

## Paginação

| Modo de Busca | Estratégia | Local |
|---|---|---|
| nome / id | Server-side | `routes.py` — fatia `all_pokemons[start:end]` |
| tipo | Frontend | `type_search_pagination.js` — todos os dados em JSON no HTML |

Janela de páginas: função `_pagination_window(page, total_pages, width=7)` em `routes.py`.

---

## Caching

- `Flask-Caching` com `CACHE_TYPE = 'SimpleCache'` (em memória, por processo)
- TTL padrão: `3600` segundos (1 hora)
- Cache manual por instância em `PokeAPIService`:
  - `_pokemon_summaries_cache` → lista completa de nomes/URLs da Pokédex
  - `_type_slugs_cache` → set dos slugs oficiais de tipo
  - `_ability_text_cache` → dict `slug → texto` das habilidades

---

## Padrões de Código a Seguir

1. **Novos dados da API** → adicionar método em `PokeAPIService`, nunca diretamente nas routes
2. **Novos campos no Pokémon** → adicionar no dataclass `Pokemon` e em `from_api_data()`
3. **Novos tipos** → atualizar `ALL_TYPES` e `DEFENSE_CHART` em `type_defenses.py`
4. **Novas páginas** → criar template em `templates/`, herdar `base.html`, adicionar rota em `routes.py`
5. **CSS novo** → adicionar em `style.css` usando variáveis CSS existentes (`--kalos-*`, `--card-bg`, etc.)
6. **Novo JS global** → adicionar em `main.js`; JS específico de página → novo arquivo referenciado em `{% block scripts %}`

---

## Problemas Conhecidos / Pontos de Atenção

- A busca por tipo pode ser lenta para tipos comuns (ex: `normal`, `water`) pois carrega centenas de Pokémon em paralelo
- `SimpleCache` não persiste entre reinicializações; para produção usar `RedisCache`
- A busca por nome usa substring matching no cache de summaries (pode retornar resultados inesperados para queries muito curtas)
- Habilidades com textos apenas em inglês são exibidas em inglês (sem tradução automática)
- O `teambuilder.js` usa `DEFENSE_CHART` injetado pelo template (gerado em Python) — não busca do servidor em tempo real

# 🧪 Bidoof Lab's — Pokémon Competitive Tool

> Sua ferramenta completa para análise competitiva de Pokémon, inspirada na Pokédex Kalos.

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-3.0-black?logo=flask)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-purple?logo=bootstrap)
![PokeAPI](https://img.shields.io/badge/Data-PokéAPI-red)
![License](https://img.shields.io/badge/License-Educational-green)

---

## 📋 Sumário

- [Visão Geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Instalação e Execução](#-instalação-e-execução)
- [Rotas da Aplicação](#-rotas-da-aplicação)
- [API Endpoints](#-api-endpoints)
- [Design System](#-design-system)
- [Configuração](#-configuração)

---

## 🌟 Visão Geral

**Bidoof Lab's** é uma aplicação web construída em **Flask** que consome a [PokéAPI](https://pokeapi.co) para fornecer análises competitivas de Pokémon. A interface é inspirada na Pokédex de Kalos, com uma estética premium de glassmorphism, suporte a Dark/Light mode e animações fluidas.

O projeto é voltado para jogadores competitivos que precisam analisar:
- Estatísticas detalhadas de Pokémon
- Fraquezas e resistências de tipo
- Cobertura defensiva e ofensiva de times completos

---

## ✨ Funcionalidades

### 🔍 Busca Inteligente
- Busca por **nome** (ex: `pikachu`, `charmander`)
- Busca por **número da Pokédex** (ex: `25`, `006`)
- Busca por **tipo** (ex: `fire`, `ghost`, `dragon`) — retorna todos os Pokémon daquele tipo
- Detecção automática do modo de busca (`resolve_search_mode`)
- **Autocomplete Interativo** em tempo real via API interna (com drop-down dropdown box contido)

### 📊 Detalhes do Pokémon
- Arte oficial (official artwork) via PokeAPI
- ID formatado (`Nº 0025`)
- Tipos com badges coloridas
- Geração de origem
- Altura e peso
- Experiência base
- **6 estatísticas base** com barras de progresso animadas (HP, ATK, DEF, SpAtk, SpDef, SPE)
- **Habilidades** com descrição (suporte pt-BR → pt → es → en)
- **Tabela de Type Defenses**: efetividade dos 18 tipos contra aquele Pokémon

### 🏆 Teambuilder
- Montagem de times com até **6 Pokémon**
- Autocomplete por nome em cada slot
- Sprites do Pokémon nos cabeçalhos das tabelas
- **Tabela de Cobertura Defensiva**: mostra vulnerabilidades de todo o time a cada tipo ofensivo
- **Tabela de Cobertura Ofensiva**: mostra quais tipos defensores cada Pokémon do time cobre bem
- **Stats Inspector Integrado**: Configuração manual de Level (1-100), EVs (0-252 com limite global de 510) e IVs (0-31), manipulando gráficos SVG Polygon em tempo real usando lógicas matemáticas idênticas a da nintendo.
- **Integração Export-Ready**: Seletor dinâmico de Abilities customizadas e Natures, com motor the clonagem engatilhado via clique (Showdown Format).

### ⚔️ Calculadora de Dano (1v1)
- Lógica focada em simular duelos reais do competitivo (Gen 9 - Scarlet/Violet).
- Interface de 3 colunas baseada no layout do Pokémon Showdown.
- **Integração em tempo real**: busca dados biológicos de HP, IVs, Natures, Base Stats e converte os Totais matematicamente.
- **Smart Movesets**: limita as dicas de auto-completar aos golpes que o personagem pode legalmente aprender.
- **Equação Master de Dano**: resolve automaticamente Base Power, STAB, Type Weakness e a Rolagem RNG resultando nas %.

### 🎨 Interface Visual
- Tema **Pokédex Kalos**: bezels vermelhos no topo e base, navbar vermelha
- Sincronia unificada nativa com formulários (`data-bs-theme`) para input colors readaptadas
- Toggle de tema com sprites animados de **Solrock** (☀️) / **Lunatone** (🌙)
- Cards com **glassmorphism** (backdrop-filter blur)
- Animação de carregamento com **Pokébola giratória**
- Font scaling dinâmico para nomes longos

### 📄 Paginação
- Busca por nome/ID: paginação **server-side** (24 por página)
- Busca por tipo: paginação **frontend** (dados já carregados, navegação via JS)
- Janela de páginas inteligente (máx. 7 páginas visíveis)

---

## 🛠️ Tecnologias

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Backend | Python | 3.10+ |
| Framework | Flask | 3.0.0 |
| Cache | Flask-Caching (SimpleCache) | 2.1.0 |
| HTTP Client | Requests | 2.31.0 |
| Paralelismo | ThreadPoolExecutor (stdlib) | — |
| Templates | Jinja2 (embutido no Flask) | — |
| Frontend CSS | Vanilla CSS + Bootstrap | 5.3.0 |
| Frontend JS | Vanilla JavaScript (ES6+) | — |
| Dados | PokeAPI | v2 |
| Config | python-dotenv | 1.0.0 |
| Testes | pytest + pytest-flask | 7.4.3 / 1.2.0 |

---

## 📁 Estrutura do Projeto

```
pokemon-api/
├── run.py                          # Entry point — inicia o servidor Flask
├── config.py                       # Configurações da aplicação (Config class)
├── requirements.txt                # Dependências Python
├── fetch_types.py                  # Script utilitário para buscar tipos na API
├── tests/                          # Suite de testes automatizados
│
└── app/
    ├── __init__.py                 # App factory — create_app()
    ├── routes.py                   # Blueprint 'main' com todas as rotas HTTP
    │
    ├── models/
    │   ├── pokemon.py              # Dataclasses: Pokemon, PokemonStats
    │   └── type_defenses.py        # ALL_TYPES e DEFENSE_CHART (18 tipos)
    │
    ├── services/
    │   └── pokeapi_service.py      # Camada de acesso à PokeAPI
    │
    ├── templates/                  # Templates Jinja2
    │   ├── base.html               # Layout global (navbar, bezels, footer)
    │   ├── index.html              # Página inicial
    │   ├── search_results.html     # Resultados de busca
    │   ├── pokemon_detail.html     # Detalhe do Pokémon
    │   ├── teambuilder.html        # Ferramenta de montagem de times
    │   ├── damage_calculator.html  # Calculadora Competitiva (1v1)
    │   ├── 404.html                # Página de erro 404
    │   └── 500.html                # Página de erro 500
    │
    └── static/
        ├── css/
        │   └── style.css           # Stylesheet principal (~656 linhas)
        ├── js/
        │   ├── main.js                     # Autocomplete, loading, theme toggle
        │   ├── teambuilder.js              # Lógica completa do teambuilder
        │   ├── damage_calculator.js        # Engine Matemática (Gen 9), API Fetches Automáticos
        │   └── type_search_pagination.js   # Paginação frontend para busca por tipo
        └── img/
            ├── favicon.png
            ├── bidoof_labs_logo.png
            ├── bg-dark.jpg                 # Background dark mode
            └── bg-light.jpg               # Background light mode
```

---

## 🚀 Instalação e Execução

### Pré-requisitos
- Python 3.10 ou superior
- pip

### Passos

```bash
# 1. Clone o repositório
git clone <repo-url>
cd pokemon-api

# 2. Crie e ative o ambiente virtual
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

# 3. Instale as dependências
pip install -r requirements.txt

# 4. Execute a aplicação
python run.py
```

A aplicação estará disponível em: **http://localhost:5000**

### Variáveis de Ambiente (opcional)

Crie um arquivo `.env` na raiz do projeto:

```env
SECRET_KEY=sua-chave-secreta-aqui
```

---

## 🛣️ Rotas da Aplicação

| Rota | Método | Descrição |
|------|--------|-----------|
| `/` | GET | Página inicial com barra de busca |
| `/search?q=<termo>` | GET | Resultados de busca (nome, ID ou tipo) |
| `/search?q=<termo>&page=<n>` | GET | Resultados paginados |
| `/pokemon/<id>` | GET | Página de detalhes do Pokémon |
| `/teambuilder` | GET | Ferramenta de Teambuilder |
| `/damage-calculator` | GET | Calculadora de Dano Dinâmica (One vs One) |

---

## 📡 API Endpoints

### `GET /api/pokemon/search?q=<termo>`

Busca um Pokémon e retorna dados básicos em JSON.

**Resposta:**
```json
{
  "mode": "name",
  "total": 1,
  "results": [
    {
      "id": 25,
      "name": "Pikachu",
      "types": ["electric"],
      "sprite_url": "https://..."
    }
  ]
}
```

---

### `GET /api/pokemon/autocomplete?q=<prefixo>&limit=<n>`

Retorna sugestões de nomes para autocomplete.

**Resposta:**
```json
{
  "suggestions": ["Pikachu", "Pikipek", "Piloswine"]
}
```

---

## 🎨 Design System

### Paleta de Cores

| Variável CSS | Valor | Uso |
|---|---|---|
| `--kalos-red` | `#e60012` | Navbar, bezels, botões primários |
| `--kalos-red-dark` | `#b71c1c` | Bordas dos bezels, hover |
| `--kalos-teal-dark` | `#051d1d` | Background dark mode |
| `--kalos-cyan` | `#4dd0e1` | Destaques, bordas de hover, IDs |
| `--kalos-glow` | `rgba(77,208,225,0.4)` | Box-shadow de glow nos cards |
| `--card-bg` | `rgba(18,43,43,0.70)` | Fundo dos cards (dark) |

### Temas

- **Dark Mode** (padrão): Fundo escuro com imagem `bg-dark.jpg`
- **Light Mode**: Fundo claro com `bg-light.jpg` (filtro blur de 5px)
- Persistência via `localStorage` com fallback para `prefers-color-scheme`

### Type Badges

Cada tipo Pokémon tem cor própria definida via classes CSS:

| Tipo | Cor de Fundo | Cor do Texto |
|---|---|---|
| `grass` | `#9bcc50` | `#212529` (escuro) |
| `fire` | `#fd7d24` | `#fff` |
| `water` | `#4592c4` | `#fff` |
| `electric` | `#eed535` | `#212529` |
| `psychic` | `#f366b9` | `#fff` |
| `ghost` | `#7b62a3` | `#fff` |
| `dragon` | `#f16e57` | `#fff` |
| *(18 tipos no total)* | | |

### Escala de Cores para Type Defenses

| Classe | Multiplicador | Cor |
|---|---|---|
| `val-0-0` | Imune (0×) | Cinza neutro |
| `val-0-25` | ¼× | Verde intenso |
| `val-0-5` | ½× | Verde claro |
| *(neutro)* | 1× | Sem cor |
| `val-2-0` | 2× | Vermelho |
| `val-4-0` | 4× | Vermelho fundo sólido + texto amarelo |

---

## ⚙️ Configuração

Arquivo `config.py`:

| Chave | Padrão | Descrição |
|---|---|---|
| `SECRET_KEY` | `'dev-key-123'` | Chave secreta Flask |
| `POKEAPI_BASE_URL` | `https://pokeapi.co/api/v2` | URL base da PokeAPI |
| `POKEAPI_TIMEOUT` | `10` | Timeout das requisições (segundos) |
| `CACHE_TYPE` | `SimpleCache` | Tipo de cache (em memória) |
| `CACHE_DEFAULT_TIMEOUT` | `3600` | TTL do cache em segundos (1 hora) |
| `ITEMS_PER_PAGE` | `20` | Itens por página (geral) |
| `SEARCH_RESULTS_PER_PAGE` | `24` | Resultados por página na busca |

---

## 📝 Notas de Desenvolvimento

- A busca por tipo carrega **todos os Pokémon do tipo** de uma vez (paralelismo com `ThreadPoolExecutor`) e delega a paginação ao frontend via `type_search_pagination.js`
- A busca por nome/ID usa paginação server-side
- A descrição de habilidades é obtida dinamicamente com fallback multilíngue: `pt-BR → pt → es → en`
- O cache `SimpleCache` é em memória (reinicia ao reiniciar o servidor). Para produção, considere `RedisCache`

---

## 📄 Licença

Este projeto é de uso educacional. Pokémon, nomes de Pokémon, personagens e imagens são propriedade de © 1995-2024 Nintendo, Creatures Inc., GAME FREAK inc.

Os dados são fornecidos pela [PokéAPI](https://pokeapi.co) (MIT License).

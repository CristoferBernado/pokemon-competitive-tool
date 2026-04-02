import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional
from flask import current_app
from ..models.pokemon import Pokemon, PokemonStats, generation_name_to_number


_LANG_PRIORITY = ('pt-BR', 'pt', 'es', 'en')


def _pick_ability_effect_text(effect_entries: List[Dict[str, Any]], target_lang: str = 'pt') -> str:
    fallback = 'Descrição não disponível.' if target_lang == 'pt' else 'Description not available.'
    if not effect_entries:
        return fallback
    
    if target_lang == 'en':
        priority = ('en',)
    else:
        priority = ('pt-BR', 'pt', 'es', 'en')

    for lang in priority:
        for entry in effect_entries:
            if (entry.get('language') or {}).get('name') == lang:
                text = (entry.get('short_effect') or entry.get('effect') or '').strip()
                if text:
                    return text.replace('\n', ' ')
                    
    entry = effect_entries[0]
    text = (entry.get('short_effect') or entry.get('effect') or '').strip()
    return text.replace('\n', ' ') if text else fallback


class PokeAPIService:
    """Serviço para interagir com a PokeAPI"""

    def __init__(self):
        self.base_url = 'https://pokeapi.co/api/v2'
        self._pokemon_summaries_cache: Optional[List[Dict[str, Any]]] = None
        self._type_slugs_cache: Optional[set[str]] = None
        self._ability_text_cache: Dict[str, str] = {}
    
    def _make_request(self, endpoint: str, *, silent_404: bool = False) -> Optional[Dict]:
        """Faz requisição para a API."""
        try:
            response = requests.get(
                f"{self.base_url}/{endpoint}",
                timeout=current_app.config.get('POKEAPI_TIMEOUT', 10)
            )
            if silent_404 and response.status_code == 404:
                return None
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            current_app.logger.error(f"Erro na requisição: {e}")
            return None

    def _get_json_threadsafe(
        self, endpoint: str, timeout: float, *, silent_404: bool = False
    ) -> Optional[Dict]:
        try:
            response = requests.get(
                f'{self.base_url}/{endpoint}',
                timeout=timeout,
            )
            if silent_404 and response.status_code == 404:
                return None
            response.raise_for_status()
            return response.json()
        except requests.RequestException:
            return None

    @staticmethod
    def _endpoint_from_url(full_url: Optional[str]) -> Optional[str]:
        if not full_url or '/api/v2/' not in full_url:
            return None
        return full_url.split('/api/v2/', 1)[1].rstrip('/')

    def _species_generation_from_url(
        self, species_url: Optional[str], timeout: float
    ) -> Optional[int]:
        ep = self._endpoint_from_url(species_url)
        if not ep:
            return None
        species = self._get_json_threadsafe(ep, timeout)
        if not species:
            return None
        gen = (species.get('generation') or {}).get('name')
        return generation_name_to_number(gen)

    def _species_generation(self, species_url: Optional[str]) -> Optional[int]:
        timeout = float(current_app.config.get('POKEAPI_TIMEOUT', 10))
        return self._species_generation_from_url(species_url, timeout)

    def _fetch_ability_text(self, slug: str, timeout: float, lang: str = 'pt') -> str:
        cache_key = f"{slug}_{lang}"
        if cache_key in self._ability_text_cache:
            return self._ability_text_cache[cache_key]
        data = self._get_json_threadsafe(f'ability/{slug}', timeout, silent_404=True)
        if not data:
            text = 'Descrição não disponível.' if lang == 'pt' else 'Description not available.'
        else:
            text = _pick_ability_effect_text(data.get('effect_entries') or [], lang)
        self._ability_text_cache[cache_key] = text
        return text

    def enrich_pokemon_generation(self, pokemon: Pokemon) -> None:
        if pokemon.generation is not None or not pokemon.species_url:
            return
        pokemon.generation = self._species_generation(pokemon.species_url)

    def enrich_pokemon_abilities_text(self, pokemon: Pokemon, lang: str = 'pt') -> None:
        timeout = float(current_app.config.get('POKEAPI_TIMEOUT', 10))
        for row in pokemon.abilities:
            slug = row.get('name', '')
            if slug:
                row['description'] = self._fetch_ability_text(slug, timeout, lang)

    def enrich_pokemon_list_generations(self, pokemons: List[Pokemon]) -> None:
        if not pokemons:
            return
        timeout = float(current_app.config.get('POKEAPI_TIMEOUT', 10))

        def work(p: Pokemon) -> tuple[Pokemon, Optional[int]]:
            return p, self._species_generation_from_url(p.species_url, timeout)

        max_workers = min(24, max(4, len(pokemons)))
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            pairs = list(pool.map(work, pokemons))
        for p, gen in pairs:
            p.generation = gen

    def enrich_pokemon_for_detail(self, pokemon: Pokemon, lang: str = 'pt') -> None:
        self.enrich_pokemon_generation(pokemon)
        self.enrich_pokemon_abilities_text(pokemon, lang)

    def get_pokemon_by_id(self, pokemon_id: int) -> Optional[Pokemon]:
        """Busca Pokémon pelo ID"""
        data = self._make_request(f"pokemon/{pokemon_id}")
        if data:
            return Pokemon.from_api_data(data)
        return None
    
    def get_pokemon_by_name(self, name: str) -> Optional[Pokemon]:
        """Busca Pokémon pelo nome"""
        data = self._make_request(f"pokemon/{name.lower()}", silent_404=True)
        if data:
            return Pokemon.from_api_data(data)
        return None
    
    def get_pokemon_stats(self, pokemon_id: int) -> Optional[PokemonStats]:
        """Busca estatísticas do Pokémon"""
        data = self._make_request(f"pokemon/{pokemon_id}")
        if data:
            return PokemonStats.from_api_data(data)
        return None

    def _get_type_slugs(self) -> set[str]:
        """Slugs oficiais de tipo na PokeAPI (cache)."""
        if self._type_slugs_cache is not None:
            return self._type_slugs_cache
        data = self._make_request('type?limit=100')
        if not data or 'results' not in data:
            self._type_slugs_cache = set()
            return self._type_slugs_cache
        self._type_slugs_cache = {t['name'] for t in data['results']}
        return self._type_slugs_cache

    def resolve_search_mode(self, query: str) -> str:
        """Define modo de busca: id (só dígitos), type (slug conhecido), multi_type ou name."""
        q = query.strip()
        if not q:
            return 'name'
        if q.isdigit():
            return 'id'
            
        if ',' in q:
            parts = [p.strip().lower().replace(' ', '-') for p in q.split(',')]
            slugs = self._get_type_slugs()
            # If all comma-separated parts are valid type slugs, this is a multi-type search
            if parts and all(p in slugs for p in parts if p):
                return 'multi_type'

        slug = q.lower().replace(' ', '-')
        if slug in self._get_type_slugs():
            return 'type'
        return 'name'

    def search_pokemon(self, query: str, search_type: str = 'auto') -> List[Pokemon]:
        """
        Busca por nome, número ou tipo.
        ``search_type='auto'`` infere pelo texto (número → id; slug de tipo → tipo; senão nome).
        """
        results: List[Pokemon] = []
        if search_type == 'auto':
            search_type = self.resolve_search_mode(query)

        if search_type == 'id':
            if query.isdigit():
                pokemon = self.get_pokemon_by_id(int(query))
                if pokemon:
                    results.append(pokemon)

        elif search_type == 'name':
            q = query.strip().lower().replace(' ', '-')
            if not q:
                return results
            pokemon = self.get_pokemon_by_name(q)
            if pokemon:
                results.append(pokemon)
            else:
                summaries = self._get_pokemon_summaries()
                matching = [s for s in summaries if q in s['name']]
                for s in matching[:20]:
                    url = s['url'].rstrip('/')
                    pokemon_id = int(url.split('/')[-1])
                    p = self.get_pokemon_by_id(pokemon_id)
                    if p:
                        results.append(p)

        elif search_type == 'type':
            type_slug = query.strip().lower().replace(' ', '-')
            data = self._make_request(f'type/{type_slug}')
            if data and 'pokemon' in data:
                results = self._load_pokemon_list_for_type(data['pokemon'])
                
        elif search_type == 'multi_type':
            types = [t.strip().lower().replace(' ', '-') for t in query.split(',')]
            sets_of_urls = []
            for t_slug in types[:2]:  # Limit hardcoded to 2 for performance scaling
                data = self._make_request(f'type/{t_slug}')
                if data and 'pokemon' in data:
                    t_urls = {entry['pokemon']['url'].rstrip('/') for entry in data['pokemon']}
                    sets_of_urls.append(t_urls)
            
            if sets_of_urls:
                # Intersect to find elements that appear in ALL queried types (AND logic)
                intersected_urls = set.intersection(*sets_of_urls)
                # Reconstruct payload required by the list loader
                entries = [{'pokemon': {'url': u}} for u in intersected_urls]
                results = self._load_pokemon_list_for_type(entries)

        return results

    def _load_pokemon_list_for_type(
        self, pokemon_entries: List[Dict[str, Any]]
    ) -> List[Pokemon]:
        """Carrega todos os Pokémon de uma resposta type/* (sem limite artificial)."""
        timeout = current_app.config.get('POKEAPI_TIMEOUT', 10)
        base = self.base_url
        max_workers = min(32, max(4, (len(pokemon_entries) + 3) // 4))

        ids_ordered: List[int] = []
        seen: set[int] = set()
        for entry in pokemon_entries:
            url = entry['pokemon']['url'].rstrip('/')
            pokemon_id = int(url.split('/')[-1])
            if pokemon_id not in seen:
                seen.add(pokemon_id)
                ids_ordered.append(pokemon_id)

        def load_one(pokemon_id: int) -> Optional[Pokemon]:
            try:
                response = requests.get(
                    f'{base}/pokemon/{pokemon_id}',
                    timeout=timeout,
                )
                response.raise_for_status()
                return Pokemon.from_api_data(response.json())
            except (requests.RequestException, KeyError, TypeError, ValueError):
                return None

        loaded: List[Optional[Pokemon]] = [None] * len(ids_ordered)
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            future_to_index = {
                pool.submit(load_one, pid): i
                for i, pid in enumerate(ids_ordered)
            }
            for future in as_completed(future_to_index):
                idx = future_to_index[future]
                loaded[idx] = future.result()

        out = [p for p in loaded if p is not None]
        out.sort(key=lambda p: p.id)
        return out

    def _get_pokemon_summaries(self) -> List[Dict[str, Any]]:
        """Lista completa da Pokédex nacional (nome + URL); cache na instância."""
        if self._pokemon_summaries_cache is not None:
            return self._pokemon_summaries_cache
        meta = self._make_request('pokemon?limit=1')
        if not meta:
            return []
        total = meta.get('count') or 0
        data = self._make_request(f'pokemon?limit={total}')
        if not data or 'results' not in data:
            return []
        self._pokemon_summaries_cache = data['results']
        return self._pokemon_summaries_cache

    def get_all_pokemon_names(self, limit: Optional[int] = None) -> List[str]:
        """Nomes para autocomplete (toda a Pokédex, salvo ``limit``)."""
        summaries = self._get_pokemon_summaries()
        names = [p['name'].capitalize() for p in summaries]
        if limit is not None:
            return names[:limit]
        return names
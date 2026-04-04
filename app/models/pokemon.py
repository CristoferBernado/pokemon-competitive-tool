from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


_GEN_ROMAN = {
    'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
    'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9,
}


def generation_name_to_number(name: Optional[str]) -> Optional[int]:
    if not name or not name.startswith('generation-'):
        return None
    key = name.replace('generation-', '').lower()
    return _GEN_ROMAN.get(key)


@dataclass
class Pokemon:
    id: int
    name: str
    types: List[str]
    sprite_url: Optional[str]
    official_artwork_url: Optional[str]
    height: int
    weight: int
    abilities: List[Dict[str, Any]]
    base_experience: int
    moves: List[Dict[str, str]] = field(default_factory=list)
    hp: int = 0
    attack: int = 0
    species_url: Optional[str] = None
    generation: Optional[int] = None
    
    @property
    def formatted_id(self) -> str:
        return f"Nº {self.id:04d}"

    @property
    def type_defenses(self) -> Dict[str, float]:
        from .type_defenses import ALL_TYPES, DEFENSE_CHART
        defenses = {t: 1.0 for t in ALL_TYPES}
        for t in self.types:
            chart = DEFENSE_CHART.get(t, {})
            for attacker in ALL_TYPES:
                defenses[attacker] *= chart.get(attacker, 1.0)
        return defenses

    @classmethod
    def from_api_data(cls, data: Dict[str, Any]) -> 'Pokemon':
        sprites = data.get('sprites') or {}
        other = sprites.get('other') or {}
        official = (other.get('official-artwork') or {}).get('front_default')
        showdown = (other.get('showdown') or {}).get('front_default')
        home = (other.get('home') or {}).get('front_default')
        front = sprites.get('front_default')
        species = data.get('species') or {}
        
        # Fallback for newer mons / megas that might not have a simple front_default sprite
        sprite_fallback = front or showdown or official or home
        
        # Stats extraction
        stats_dict = {
            s['stat']['name']: s['base_stat']
            for s in data.get('stats') or []
        }
        
        ability_rows = []
        for a in data.get('abilities') or []:
            ab = a.get('ability') or {}
            ability_rows.append({
                'name': ab.get('name', ''),
                'is_hidden': bool(a.get('is_hidden')),
                'description': '',
            })
            
        moves_data = []
        for m in data.get('moves') or []:
            move_info = m.get('move', {})
            slug = move_info.get('name', '')
            if slug:
                moves_data.append({
                    'name': slug.replace('-', ' ').title(),
                    'slug': slug
                })
        # Sort by name
        moves_data.sort(key=lambda x: x['name'])
        
        return cls(
            id=data['id'],
            name=data['name'].replace('-', ' ').title(),
            types=[t['type']['name'] for t in data.get('types') or []],
            sprite_url=sprite_fallback,
            official_artwork_url=official or front,
            height=(data.get('height') or 0) / 10,
            weight=(data.get('weight') or 0) / 10,
            abilities=ability_rows,
            base_experience=data.get('base_experience') or 0,
            moves=moves_data,
            hp=stats_dict.get('hp', 0),
            attack=stats_dict.get('attack', 0),
            species_url=species.get('url'),
            generation=None,
        )


@dataclass
class PokemonStats:
    hp: int
    attack: int
    defense: int
    special_attack: int
    special_defense: int
    speed: int

    @classmethod
    def from_api_data(cls, data: Dict[str, Any]) -> 'PokemonStats':
        stats_dict = {
            stat['stat']['name']: stat['base_stat']
            for stat in data.get('stats') or []
        }
        return cls(
            hp=stats_dict.get('hp', 0),
            attack=stats_dict.get('attack', 0),
            defense=stats_dict.get('defense', 0),
            special_attack=stats_dict.get('special-attack', 0),
            special_defense=stats_dict.get('special-defense', 0),
            speed=stats_dict.get('speed', 0),
        )

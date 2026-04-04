from flask import Blueprint, render_template, request, jsonify, current_app, url_for, g, make_response, redirect
from .services.pokeapi_service import PokeAPIService
from .models.type_defenses import ALL_TYPES, DEFENSE_CHART
from .translations import UI_TRANSLATIONS

main_bp = Blueprint('main', __name__)
pokeapi = PokeAPIService()

@main_bp.before_request
def load_language():
    g.lang = request.cookies.get('lang', 'pt')

@main_bp.context_processor
def inject_translator():
    def t(key):
        lang = getattr(g, 'lang', 'pt')
        return UI_TRANSLATIONS.get(lang, UI_TRANSLATIONS['pt']).get(key, key)
    return dict(t=t)

@main_bp.route('/set_language/<lang>')
def set_language(lang):
    if lang not in ['pt', 'en']:
        lang = 'pt'
    resp = make_response(redirect(request.referrer or url_for('main.index')))
    resp.set_cookie('lang', lang, max_age=30*24*60*60)
    return resp



def _pagination_window(page: int, total_pages: int, width: int = 7) -> list[int]:
    if total_pages <= 0:
        return []
    half = width // 2
    start = max(1, page - half)
    end = min(total_pages, start + width - 1)
    start = max(1, end - width + 1)
    return list(range(start, end + 1))


@main_bp.route('/')
def index():
    return render_template('landing.html')

@main_bp.route('/pokedex')
def pokedex():
    return render_template('index.html')


@main_bp.route('/search')
def search():
    query = request.args.get('q', '').strip()
    search_type = 'name'
    if query:
        search_type = pokeapi.resolve_search_mode(query)

    if not query:
        return render_template(
            'search_results.html',
            pokemons=[],
            query='',
            search_type=search_type,
            pagination=None,
            type_search_frontend_pagination=False,
            pokemons_data=None,
            type_search_total=0,
            per_page=int(current_app.config.get('SEARCH_RESULTS_PER_PAGE', 24)),
            initial_page=1,
        )

    all_pokemons = pokeapi.search_pokemon(query, 'auto')
    total = len(all_pokemons)
    per_page = int(current_app.config.get('SEARCH_RESULTS_PER_PAGE', 24))

    if search_type == 'type' and total > 0:
        pokeapi.enrich_pokemon_list_generations(all_pokemons)
        total_pages = max(1, (total + per_page - 1) // per_page)
        initial_page = request.args.get('page', 1, type=int) or 1
        initial_page = max(1, min(initial_page, total_pages))
        pokemons_data = [
            {
                'id': p.id,
                'name': p.name,
                'types': p.types,
                'sprite_url': p.sprite_url,
                'official_artwork_url': p.official_artwork_url,
                'generation': p.generation,
                'hp': p.hp,
                'attack': p.attack,
                'detail_url': url_for('main.pokemon_detail', pokemon_id=p.id),
            }
            for p in all_pokemons
        ]
        return render_template(
            'search_results.html',
            pokemons=[],
            query=query,
            search_type=search_type,
            pagination=None,
            type_search_frontend_pagination=True,
            pokemons_data=pokemons_data,
            type_search_total=total,
            per_page=per_page,
            initial_page=initial_page,
        )

    total_pages = max(1, (total + per_page - 1) // per_page) if total else 0

    page = request.args.get('page', 1, type=int) or 1
    if page < 1:
        page = 1
    if total_pages and page > total_pages:
        page = total_pages

    start = (page - 1) * per_page
    pokemons = all_pokemons[start:start + per_page]
    pokeapi.enrich_pokemon_list_generations(pokemons)

    pagination = None
    if total > 0:
        pagination = {
            'page': page,
            'per_page': per_page,
            'total': total,
            'total_pages': total_pages,
            'has_prev': page > 1,
            'has_next': page < total_pages,
            'prev_num': page - 1,
            'next_num': page + 1,
            'page_numbers': _pagination_window(page, total_pages),
        }

    return render_template(
        'search_results.html',
        pokemons=pokemons,
        query=query,
        search_type=search_type,
        pagination=pagination,
        type_search_frontend_pagination=False,
        pokemons_data=None,
        type_search_total=0,
        per_page=per_page,
        initial_page=1,
    )


@main_bp.route('/pokemon/<int:pokemon_id>')
def pokemon_detail(pokemon_id):
    pokemon = pokeapi.get_pokemon_by_id(pokemon_id)
    stats = pokeapi.get_pokemon_stats(pokemon_id)

    if not pokemon:
        return render_template('404.html'), 404

    pokeapi.enrich_pokemon_for_detail(pokemon, getattr(g, 'lang', 'pt'))

    return render_template(
        'pokemon_detail.html',
        pokemon=pokemon,
        stats=stats,
    )


@main_bp.route('/teambuilder')
def teambuilder():
    return render_template(
        'teambuilder.html',
        all_types=ALL_TYPES,
        defense_chart=DEFENSE_CHART,
    )

@main_bp.route('/damage-calculator')
def damage_calculator():
    # Pass all pokemon names for the autocomplete scripts on the UI
    service = PokeAPIService()
    all_names = service.get_all_pokemon_names()
    return render_template(
        'damage_calculator.html',
        all_pokemon_names=all_names,
        all_types=ALL_TYPES,
        defense_chart=DEFENSE_CHART,
    )


@main_bp.route('/api/pokemon/search')
def api_search():
    query = request.args.get('q', '').strip()

    if not query:
        return jsonify({'error': 'Query parameter required'}), 400

    mode = pokeapi.resolve_search_mode(query)
    pokemons = pokeapi.search_pokemon(query, 'auto')

    return jsonify({
        'mode': mode,
        'total': len(pokemons),
        'results': [{
            'id': p.id,
            'name': p.name,
            'types': p.types,
            'sprite_url': p.sprite_url,
            'hp': p.hp,
            'attack': p.attack,
            'defense': p.defense,
            'sp_atk': p.sp_atk,
            'sp_def': p.sp_def,
            'speed': p.speed
        } for p in pokemons],
    })


@main_bp.route('/api/pokemon/autocomplete')
def api_autocomplete():
    query = request.args.get('q', '').lower()
    limit = request.args.get('limit', 20, type=int)

    all_names = pokeapi.get_all_pokemon_names()
    suggestions = [name for name in all_names if query in name.lower()][:limit]

    return jsonify({'suggestions': suggestions})


@main_bp.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404


@main_bp.errorhandler(500)
def internal_error(error):
    return render_template('500.html'), 500

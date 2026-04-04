// Autocomplete para busca
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.querySelector('input[name="q"]');

    if (searchInput) {
        let debounceTimer;

        searchInput.addEventListener('input', function(e) {
            clearTimeout(debounceTimer);
            const query = e.target.value;

            if (query.length < 2) return;

            debounceTimer = setTimeout(() => {
                fetchAutocomplete(query);
            }, 300);
        });
    }

    const loadingEl = document.getElementById('page-loading');
    document.querySelectorAll('form.site-search-form').forEach(function(form) {
        form.addEventListener('submit', function() {
            const input = form.querySelector('input[name="q"]');
            const q = input ? input.value.trim() : '';
            if (!q || !loadingEl) return;
            loadingEl.classList.remove('d-none');
            loadingEl.setAttribute('aria-busy', 'true');
        });
    });

    window.addEventListener('pageshow', function() {
        if (!loadingEl) return;
        loadingEl.classList.add('d-none');
        loadingEl.setAttribute('aria-busy', 'false');
    });

    // Theme Toggle Logic
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            document.documentElement.setAttribute('data-bs-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        });

        const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        updateThemeIcon(savedTheme);
    }

    function updateThemeIcon(theme) {
        const icon = themeToggle.querySelector('.theme-icon');
        if (icon) {
            icon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    }
});

async function fetchAutocomplete(query) {
    try {
        const response = await fetch(`/api/pokemon/autocomplete?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.suggestions && data.suggestions.length > 0) {
            showSuggestions(data.suggestions);
        }
    } catch (error) {
        console.error('Erro no autocomplete:', error);
    }
}

function showSuggestions(suggestions) {
    console.log('Sugestões:', suggestions);
}

document.querySelectorAll('.pokemon-card').forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'scale(1.05)';
    });

    card.addEventListener('mouseleave', function() {
        this.style.transform = 'scale(1)';
    });
});

window.fitPokemonNames = function() {
    document.querySelectorAll('.pokemon-name').forEach(el => {
        el.style.fontSize = ''; // Redefine para testar o tamanho original de 1.6rem
        const containerWidth = el.parentElement.clientWidth;
        const textWidth = el.scrollWidth;

        if (textWidth > containerWidth && containerWidth > 0) {
            const ratio = containerWidth / textWidth;
            let newSize = 1.6 * ratio * 0.95;
            if (newSize < 0.8) newSize = 0.8; // limite minimo legivel
            el.style.fontSize = newSize + 'rem';
        }
    });
};

document.addEventListener('DOMContentLoaded', window.fitPokemonNames);
window.addEventListener('resize', window.fitPokemonNames);

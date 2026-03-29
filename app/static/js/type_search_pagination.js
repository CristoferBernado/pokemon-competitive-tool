(function () {
    const el = document.getElementById('type-search-bootstrap');
    const root = document.getElementById('search-results-root');
    const navRoot = document.getElementById('search-pagination-root');
    const summaryEl = document.getElementById('search-pagination-summary');
    if (!el || !root || !navRoot || !summaryEl) return;

    let bootstrap;
    try {
        bootstrap = JSON.parse(el.textContent);
    } catch (e) {
        console.error('type-search-bootstrap JSON inválido', e);
        return;
    }

    const items = bootstrap.items || [];
    const perPage = Math.max(1, parseInt(bootstrap.perPage, 10) || 24);
    const query = bootstrap.query || '';
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));

    let currentPage = Math.max(1, Math.min(parseInt(bootstrap.initialPage, 10) || 1, totalPages));

    function esc(text) {
        const d = document.createElement('div');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }

    function capitalize(s) {
        if (!s) return '';
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function pageWindow(page, totalP, width) {
        width = width || 7;
        if (totalP <= 0) return [];
        const half = Math.floor(width / 2);
        let start = Math.max(1, page - half);
        let end = Math.min(totalP, start + width - 1);
        start = Math.max(1, end - width + 1);
        const out = [];
        for (let i = start; i <= end; i++) out.push(i);
        return out;
    }

    function syncUrl() {
        const url = new URL(window.location.href);
        url.searchParams.set('q', query);
        if (currentPage <= 1) {
            url.searchParams.delete('page');
        } else {
            url.searchParams.set('page', String(currentPage));
        }
        window.history.replaceState({}, '', url);
    }

    function readPageFromUrl() {
        const raw = new URLSearchParams(window.location.search).get('page');
        const p = parseInt(raw || '1', 10);
        if (isNaN(p) || p < 1) return 1;
        return Math.min(p, totalPages);
    }

    function attachCardEffects(container) {
        container.querySelectorAll('.pokemon-card').forEach(function (card) {
            card.addEventListener('mouseenter', function () {
                this.style.transform = 'scale(1.05)';
            });
            card.addEventListener('mouseleave', function () {
                this.style.transform = '';
            });
        });
    }

    function formatId(id) {
        return 'Nº ' + String(id).padStart(4, '0');
    }

    function renderCards() {
        root.innerHTML = '';
        const start = (currentPage - 1) * perPage;
        const slice = items.slice(start, start + perPage);

        slice.forEach(function (p) {
            const col = document.createElement('div');
            col.className = 'col-12 col-sm-6 col-lg-4 col-xl-3 mb-4';

            const imgUrl = p.official_artwork_url || p.sprite_url;
            const imgHtml = imgUrl
                ? '<img src="' + esc(imgUrl) + '" alt="' + esc(p.name) + '">'
                : '<div class="d-flex align-items-center justify-content-center text-muted">?</div>';

            const typesHtml = (p.types || [])
                .map(function (t) {
                    return '<span class="type-badge-pill type-' + esc(t.toLowerCase()) + '">' + esc(capitalize(t)) + '</span>';
                })
                .join('');

            col.innerHTML =
                '<a href="' + esc(p.detail_url) + '" id="pokemon-' + p.id + '" class="pokemon-card">' +
                '<div class="card h-100">' +
                '<div class="card-decoration-diamond"></div>' +
                '<div class="pokemon-portrait-wrapper">' + imgHtml + '</div>' +
                '<div class="card-body">' +
                '<div class="pokemon-id">' + formatId(p.id) + '</div>' +
                '<h2 class="pokemon-name text-truncate">' + esc(p.name) + '</h2>' +
                '<div class="pokemon-types-container">' + typesHtml + '</div>' +
                '</div></div></a>';

            root.appendChild(col);
        });

        attachCardEffects(root);
    }

    function renderPagination() {
        if (totalPages <= 1) {
            navRoot.classList.add('d-none');
            summaryEl.classList.add('d-none');
            return;
        }

        navRoot.classList.remove('d-none');
        summaryEl.classList.remove('d-none');

        const nums = pageWindow(currentPage, totalPages);
        let html =
            '<ul class="pagination flex-wrap justify-content-center mb-0">' +
            '<li class="page-item' + (currentPage <= 1 ? ' disabled' : '') + '">' +
            (currentPage > 1
                ? '<a class="page-link type-search-page" href="#" data-page="' + (currentPage - 1) + '">Anterior</a>'
                : '<span class="page-link">Anterior</span>') +
            '</li>';

        nums.forEach(function (n) {
            const active = n === currentPage ? ' active' : '';
            html +=
                '<li class="page-item' + active + '">' +
                '<a class="page-link type-search-page" href="#" data-page="' + n + '">' + n + '</a>' +
                '</li>';
        });

        html +=
            '<li class="page-item' + (currentPage >= totalPages ? ' disabled' : '') + '">' +
            (currentPage < totalPages
                ? '<a class="page-link type-search-page" href="#" data-page="' + (currentPage + 1) + '">Próxima</a>'
                : '<span class="page-link">Próxima</span>') +
            '</li></ul>';

        navRoot.innerHTML = html;
        summaryEl.textContent =
            'Página ' + currentPage + ' de ' + totalPages + ' (' + perPage + ' por página) — troca de página só no navegador, sem novo carregamento completo.';

        navRoot.querySelectorAll('a.type-search-page').forEach(function (a) {
            a.addEventListener('click', function (ev) {
                ev.preventDefault();
                const np = parseInt(a.getAttribute('data-page'), 10);
                if (isNaN(np)) return;
                currentPage = Math.max(1, Math.min(np, totalPages));
                syncUrl();
                renderCards();
                renderPagination();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    function goToPageFromUrl() {
        currentPage = readPageFromUrl();
        renderCards();
        renderPagination();
    }

    window.addEventListener('popstate', function () {
        goToPageFromUrl();
    });

    syncUrl();
    renderCards();
    renderPagination();
})();

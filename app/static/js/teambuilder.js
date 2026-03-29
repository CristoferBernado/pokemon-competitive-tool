(function() {
    const team = [null, null, null, null, null, null];
    let autocompleteTimeout = null;

    function init() {
        renderInputs();
        renderDefensiveTable();
        renderOffensiveTable();
    }

    function renderInputs() {
        const container = document.getElementById('team-inputs-container');
        container.innerHTML = '';

        for (let i = 0; i < 6; i++) {
            const row = document.createElement('div');
            row.className = 'tb-row';

            const header = document.createElement('div');
            header.className = 'tb-col-header';
            header.textContent = `Pokémon ${i + 1}:`;

            const inputCol = document.createElement('div');
            inputCol.className = 'tb-col-input';

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-control form-control-sm';
            input.placeholder = 'Input Pokémon';
            input.dataset.slot = i;

            const suggestionsBox = document.createElement('div');
            suggestionsBox.className = 'tb-suggestions';
            suggestionsBox.id = `suggestions-${i}`;

            input.addEventListener('input', (e) => handleInput(e, i));
            input.addEventListener('focus', (e) => handleInput(e, i));
            input.addEventListener('blur', () => setTimeout(() => { suggestionsBox.style.display = 'none'; }, 200));

            inputCol.appendChild(input);
            inputCol.appendChild(suggestionsBox);
            row.appendChild(header);
            row.appendChild(inputCol);
            container.appendChild(row);
        }
    }

    function handleInput(e, slotIndex) {
        const query = e.target.value.trim();
        const suggestionsBox = document.getElementById(`suggestions-${slotIndex}`);
        
        if (query.length < 2) {
            suggestionsBox.style.display = 'none';
            if (query.length === 0 && team[slotIndex] !== null) {
                team[slotIndex] = null;
                updateCoverage();
            }
            return;
        }

        clearTimeout(autocompleteTimeout);
        autocompleteTimeout = setTimeout(() => {
            fetch(`/api/pokemon/autocomplete?q=${encodeURIComponent(query)}&limit=10`)
                .then(res => res.json())
                .then(data => {
                    if (data.suggestions && data.suggestions.length > 0) {
                        suggestionsBox.innerHTML = '';
                        data.suggestions.forEach(name => {
                            const item = document.createElement('div');
                            item.className = 'tb-suggestion-item';
                            item.textContent = name;
                            item.addEventListener('click', () => {
                                e.target.value = name;
                                suggestionsBox.style.display = 'none';
                                loadPokemonData(name, slotIndex);
                            });
                            suggestionsBox.appendChild(item);
                        });
                        suggestionsBox.style.display = 'block';
                    } else {
                        suggestionsBox.style.display = 'none';
                    }
                });
        }, 300);
    }

    function loadPokemonData(name, slotIndex) {
        fetch(`/api/pokemon/search?q=${encodeURIComponent(name)}`)
            .then(res => res.json())
            .then(data => {
                if (data.results && data.results.length > 0) {
                    // Only get properties we need
                    const p = data.results[0];
                    team[slotIndex] = {
                        name: p.name,
                        types: p.types,
                        sprite_url: p.sprite_url
                    };
                    updateCoverage();
                }
            });
    }

    function updateCoverage() {
        updateHeaders();
        renderDefensiveTable();
        renderOffensiveTable();
    }

    function updateHeaders() {
        const defHeaders = document.querySelectorAll('#defensive-table thead th.slot-header');
        const offHeaders = document.querySelectorAll('#offensive-table thead th.slot-header');
        
        for (let i = 0; i < 6; i++) {
            const p = team[i];
            let content = `${i + 1}`;
            
            if (p && p.sprite_url) {
                content = `<div class="d-flex flex-column align-items-center justify-content-end" style="height: 60px;">
                    <img src="${p.sprite_url}" alt="${p.name}" style="max-height: 40px; width: auto; object-fit: contain;">
                    <span style="font-size: 0.75rem; font-weight: normal; margin-top: 2px; line-height: 1;">${p.name}</span>
                </div>`;
            } else if (p && !p.sprite_url) {
                content = `<div class="d-flex flex-column align-items-center justify-content-end" style="height: 60px;">
                    <span style="font-size: 0.75rem; font-weight: normal; margin-top: auto; line-height: 1;">${p.name}</span>
                </div>`;
            } else {
                content = `<div class="d-flex align-items-center justify-content-center" style="height: 60px;">${i + 1}</div>`;
            }
            
            if (defHeaders[i]) defHeaders[i].innerHTML = content;
            if (offHeaders[i]) offHeaders[i].innerHTML = content;
        }
    }

    function getMultiplierDisplay(val) {
        if (val === 0.5) return '&frac12;';
        if (val === 0.25) return '&frac14;';
        if (val === 0) return '<span>imune</span>';
        if (val === 1) return '';
        if (val === 2) return '2x';
        if (val === 4) return '4x';
        return val;
    }

    function getMultiplierClass(val) {
        if (val === 0) return 'val-0-0';
        if (val === 0.25) return 'val-0-25';
        if (val === 0.5) return 'val-0-5';
        if (val === 2) return 'val-2-0';
        if (val === 4) return 'val-4-0';
        return '';
    }

    function renderDefensiveTable() {
        const tbody = document.querySelector('#defensive-table tbody');
        tbody.innerHTML = '';

        ALL_TYPES.forEach(moveType => {
            const tr = document.createElement('tr');
            
            // Type header
            const th = document.createElement('td');
            th.innerHTML = `<span class="type-badge-pill type-${moveType}">${moveType.substring(0,3).toUpperCase()}</span>`;
            tr.appendChild(th);

            let totalWeak = 0;
            let totalResist = 0;

            for (let i = 0; i < 6; i++) {
                const td = document.createElement('td');
                const p = team[i];
                if (p) {
                    let mult = 1.0;
                    p.types.forEach(pType => {
                        const chart = DEFENSE_CHART[pType] || {};
                        mult *= (chart[moveType] !== undefined ? chart[moveType] : 1.0);
                    });

                    td.innerHTML = getMultiplierDisplay(mult);
                    td.className = getMultiplierClass(mult);

                    if (mult > 1) totalWeak++;
                    if (mult < 1) totalResist++;
                }
                tr.appendChild(td);
            }

            // Totals
            const tdWeak = document.createElement('td');
            tdWeak.className = 'total-weak';
            tdWeak.textContent = totalWeak > 0 ? totalWeak : '';
            tr.appendChild(tdWeak);

            const tdResist = document.createElement('td');
            tdResist.className = 'total-resist';
            tdResist.textContent = totalResist > 0 ? totalResist : '';
            tr.appendChild(tdResist);

            tbody.appendChild(tr);
        });
    }

    function renderOffensiveTable() {
        const tbody = document.querySelector('#offensive-table tbody');
        tbody.innerHTML = '';

        ALL_TYPES.forEach(defenderType => {
            const tr = document.createElement('tr');
            
            // Type header
            const th = document.createElement('td');
            th.innerHTML = `<span class="type-badge-pill type-${defenderType}">${defenderType.substring(0,3).toUpperCase()}</span>`;
            tr.appendChild(th);

            let totalStrong = 0;

            for (let i = 0; i < 6; i++) {
                const td = document.createElement('td');
                const p = team[i];
                if (p) {
                    let bestMult = 0;
                    p.types.forEach(attackerType => {
                        const chart = DEFENSE_CHART[defenderType] || {};
                        const mult = chart[attackerType] !== undefined ? chart[attackerType] : 1.0;
                        if (mult > bestMult) bestMult = mult;
                    });

                    if (bestMult > 1) {
                        td.innerHTML = getMultiplierDisplay(bestMult);
                        td.className = getMultiplierClass(bestMult);
                        totalStrong++;
                    } else if (bestMult === 0) {
                        td.innerHTML = '0';
                        td.className = 'val-0-0'; // immune
                    } else if (bestMult < 1) {
                        td.innerHTML = getMultiplierDisplay(bestMult);
                        td.className = getMultiplierClass(bestMult);
                    }
                }
                tr.appendChild(td);
            }

            // Totals
            const tdStrong = document.createElement('td');
            tdStrong.className = 'total-strong';
            tdStrong.textContent = totalStrong > 0 ? totalStrong : '';
            tr.appendChild(tdStrong);

            tbody.appendChild(tr);
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();

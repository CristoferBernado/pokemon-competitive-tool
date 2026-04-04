(function() {
    const team = [null, null, null, null, null, null];
    let autocompleteTimeout = null;

    function init() {
        renderInputs();
        initInspector();
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
                    const p = data.results[0];
                    team[slotIndex] = {
                        name: p.name,
                        types: p.types,
                        sprite_url: p.sprite_url,
                        stats: {
                            hp: p.hp,
                            attack: p.attack,
                            defense: p.defense,
                            sp_atk: p.sp_atk,
                            sp_def: p.sp_def,
                            speed: p.speed
                        },
                        level: 100,
                        nature: 'Serious',
                        ivs: { hp: 31, attack: 31, defense: 31, sp_atk: 31, sp_def: 31, speed: 31 },
                        evs: { hp: 0, attack: 0, defense: 0, sp_atk: 0, sp_def: 0, speed: 0 }
                    };
                    updateCoverage();
                }
            });
    }

    function updateCoverage() {
        updateHeaders();
        updateVisualBar();
        renderDefensiveTable();
        renderOffensiveTable();
    }

    let activeInspectorSlot = null;

    const NATURES = {
        'Hardy': { up: null, down: null },
        'Lonely': { up: 'attack', down: 'defense' },
        'Brave': { up: 'attack', down: 'speed' },
        'Adamant': { up: 'attack', down: 'sp_atk' },
        'Naughty': { up: 'attack', down: 'sp_def' },
        'Bold': { up: 'defense', down: 'attack' },
        'Docile': { up: null, down: null },
        'Relaxed': { up: 'defense', down: 'speed' },
        'Impish': { up: 'defense', down: 'sp_atk' },
        'Lax': { up: 'defense', down: 'sp_def' },
        'Timid': { up: 'speed', down: 'attack' },
        'Hasty': { up: 'speed', down: 'defense' },
        'Serious': { up: null, down: null },
        'Jolly': { up: 'speed', down: 'sp_atk' },
        'Naive': { up: 'speed', down: 'sp_def' },
        'Modest': { up: 'sp_atk', down: 'attack' },
        'Mild': { up: 'sp_atk', down: 'defense' },
        'Quiet': { up: 'sp_atk', down: 'speed' },
        'Bashful': { up: null, down: null },
        'Rash': { up: 'sp_atk', down: 'sp_def' },
        'Calm': { up: 'sp_def', down: 'attack' },
        'Gentle': { up: 'sp_def', down: 'defense' },
        'Sassy': { up: 'sp_def', down: 'speed' },
        'Careful': { up: 'sp_def', down: 'sp_atk' },
        'Quirky': { up: null, down: null }
    };
    const STAT_LABELS = {
        'hp': 'HP',
        'attack': 'Attack',
        'defense': 'Defense',
        'sp_atk': 'Sp. Atk',
        'sp_def': 'Sp. Def',
        'speed': 'Speed'
    };
    
    function initInspector() {
        const select = document.getElementById('nature-selector');
        if (select) {
            for (const n in NATURES) {
                select.add(new Option(n, n));
            }
            select.addEventListener('change', (e) => {
                if (activeInspectorSlot !== null && team[activeInspectorSlot]) {
                    team[activeInspectorSlot].nature = e.target.value;
                    drawInspectorRadar(activeInspectorSlot);
                }
            });
        }
    }

    function updateVisualBar() {
        const bar = document.getElementById('team-visual-bar');
        if (!bar) return;
        
        bar.innerHTML = '';
        
        for (let i = 0; i < 6; i++) {
            const p = team[i];
            const div = document.createElement('div');
            
            if (p && p.sprite_url) {
                const isActive = activeInspectorSlot === i;
                div.className = "d-flex justify-content-center align-items-center tb-visual-slot-active";
                div.style.cssText = `width: 50px; height: 50px; border-radius: 12px; background-color: rgba(128, 128, 128, 0.15); border: 2px solid ${isActive ? 'var(--type-water, #3498db)' : 'rgba(128, 128, 128, 0.2)'}; box-shadow: inset 0 0 10px rgba(0,0,0,0.2); cursor: pointer; transition: 0.2s;`;
                div.innerHTML = `<img src="${p.sprite_url}" alt="${p.name}" style="width: 125%; height: 125%; object-fit: contain; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5));">`;
                
                div.addEventListener('click', () => {
                    if (activeInspectorSlot !== i) {
                        activeInspectorSlot = i;
                        document.getElementById('nature-selector').value = 'Serious';
                    }
                    openInspector(i);
                    updateVisualBar();
                });
            } else {
                div.className = "d-flex justify-content-center align-items-center";
                div.style.cssText = "width: 50px; height: 50px; border-radius: 12px; background-color: rgba(128, 128, 128, 0.1); border: 2px dashed rgba(128, 128, 128, 0.3);";
            }
            bar.appendChild(div);
        }
        
        if (activeInspectorSlot !== null && !team[activeInspectorSlot]) {
            document.getElementById('stats-inspector-card').style.display = 'none';
            activeInspectorSlot = null;
        }
    }

    function openInspector(slotIndex) {
        const p = team[slotIndex];
        if (!p) return;
        const card = document.getElementById('stats-inspector-card');
        card.style.display = 'block';
        document.getElementById('inspector-name').textContent = p.name;
        document.getElementById('inspector-sprite').src = p.sprite_url;
        document.getElementById('nature-selector').value = p.nature || 'Serious';
        
        renderStatsConfig();
        drawInspectorRadar(slotIndex);
    }

    function calculateTotalEvs(slotIndex) {
        let evs = team[slotIndex].evs;
        return Object.values(evs).reduce((a, b) => a + b, 0);
    }

    function renderStatsConfig() {
        const p = team[activeInspectorSlot];
        if (!p) return;
        
        const container = document.getElementById('stats-sliders-container');
        const levelInput = document.getElementById('level-input');
        levelInput.value = p.level || 100;
        levelInput.onchange = (e) => {
            let val = parseInt(e.target.value);
            if(isNaN(val) || val < 1) val = 1;
            if(val > 100) val = 100;
            e.target.value = val;
            p.level = val;
            drawInspectorRadar(activeInspectorSlot);
        };
        
        container.innerHTML = '';
        const order = ['hp', 'attack', 'defense', 'sp_atk', 'sp_def', 'speed'];
        
        order.forEach(stat => {
            const row = document.createElement('div');
            row.className = 'd-flex justify-content-between align-items-center text-secondary p-1 rounded mb-1';
            row.style.backgroundColor = 'rgba(128,128,128,0.15)';
            
            const nameEl = document.createElement('span');
            nameEl.style.width = '42px';
            nameEl.style.fontSize = '0.85rem';
            nameEl.textContent = STAT_LABELS[stat];
            
            const evInp = document.createElement('input');
            evInp.type = 'number';
            evInp.min = 0; evInp.max = 252;
            evInp.value = p.evs[stat];
            evInp.className = 'form-control form-control-sm text-center p-0 mx-1';
            evInp.style.width = '45px';
            
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = 0; slider.max = 252;
            slider.value = p.evs[stat];
            slider.className = 'form-range mx-2';
            slider.style.flexGrow = '1';
            
            const updateEv = (newVal) => {
                let val = parseInt(newVal);
                if(isNaN(val)) val = 0;
                if(val < 0) val = 0;
                if(val > 252) val = 252;
                
                let oldVal = p.evs[stat];
                let currentTotal = calculateTotalEvs(activeInspectorSlot) - oldVal;
                
                if (currentTotal + val > 510) {
                    val = 510 - currentTotal;
                }
                
                p.evs[stat] = val;
                evInp.value = val;
                slider.value = val;
                
                document.getElementById('ev-total-text').innerHTML = `Total: ${calculateTotalEvs(activeInspectorSlot)}/510`;
                drawInspectorRadar(activeInspectorSlot);
            };
            
            evInp.oninput = (e) => updateEv(e.target.value);
            slider.oninput = (e) => updateEv(e.target.value);
            
            const ivInp = document.createElement('input');
            ivInp.type = 'number';
            ivInp.min = 0; ivInp.max = 31;
            ivInp.value = p.ivs[stat];
            ivInp.className = 'form-control form-control-sm text-center p-0 mx-1';
            ivInp.style.width = '45px';
            ivInp.onchange = (e) => {
                let val = parseInt(e.target.value);
                if(isNaN(val) || val < 0) val = 0;
                if(val > 31) val = 31;
                e.target.value = val;
                p.ivs[stat] = val;
                drawInspectorRadar(activeInspectorSlot);
            };
            
            row.appendChild(nameEl);
            row.appendChild(evInp);
            row.appendChild(slider);
            row.appendChild(ivInp);
            
            container.appendChild(row);
        });
        
        document.getElementById('ev-total-text').innerHTML = `Total: ${calculateTotalEvs(activeInspectorSlot)}/510`;
    }

    function drawInspectorRadar(slotIndex) {
        const p = team[slotIndex];
        if (!p || !p.stats) return;
        
        const natureName = document.getElementById('nature-selector').value;
        const nature = NATURES[natureName];
        
        let finalStats = {};
        for (let statName in p.stats) {
            let base = p.stats[statName];
            let ev = p.evs[statName];
            let iv = p.ivs[statName];
            let level = p.level || 100;
            
            let val = Math.floor(0.01 * (2 * base + iv + Math.floor(ev / 4)) * level);
            
            if (statName === 'hp') {
                if (base === 1) val = 1; // Shedinja wrapper
                else val = val + level + 10;
            } else {
                val = val + 5;
                if (nature.up === statName) val = Math.floor(val * 1.1);
                if (nature.down === statName) val = Math.floor(val * 0.9);
            }
            finalStats[statName] = val;
        }
        
        const container = document.getElementById('inspector-radar-container');
        const W = 320, H = 320, CX = 160, CY = 160, R = 110; 
        const order = ['hp', 'attack', 'defense', 'speed', 'sp_def', 'sp_atk'];
        
        // Dynamically frame polygon boundaries to scale perfectly on Level N
        let MAX_STAT = Math.floor((Math.floor(0.01 * (2 * 255 + 31 + 63) * p.level) + 5) * 1.1);
        let MAX_HP = Math.floor(0.01 * (2 * 255 + 31 + 63) * p.level) + p.level + 10;
        if (MAX_HP > MAX_STAT) MAX_STAT = MAX_HP;
        
        let polyPoints = [];
        let labelsHtml = '';
        const bgPolyPoints = [];
        const midPolyPoints = [];
        
        for (let i = 0; i < 6; i++) {
            const stat = order[i];
            const angle = (i * 60 - 90) * (Math.PI / 180);
            const val = finalStats[stat];
            const frac = Math.max(0.05, Math.min(val / MAX_STAT, 1));
            
            const px = CX + (R * frac) * Math.cos(angle);
            const py = CY + (R * frac) * Math.sin(angle);
            polyPoints.push(`${px},${py}`);
            
            const bx = CX + R * Math.cos(angle);
            const by = CY + R * Math.sin(angle);
            bgPolyPoints.push(`${bx},${by}`);
            
            const mx = CX + (R/2) * Math.cos(angle);
            const my = CY + (R/2) * Math.sin(angle);
            midPolyPoints.push(`${mx},${my}`);
            
            let colorStr = 'color: white;';
            let arrowUp = ''; let arrowDown = '';
            if (nature.up === stat) { colorStr = 'color: #70a1ff;'; arrowUp = '<span style="color: #70a1ff; font-size: 14px;">⬆</span>'; }
            if (nature.down === stat) { colorStr = 'color: #ff6b81;'; arrowDown = '<span style="color: #ff6b81; font-size: 14px;">⬇</span>'; }
            
            let label = STAT_LABELS[stat];
            if (stat === 'attack' || stat === 'defense' || stat === 'speed') label += ' ' + (arrowUp || arrowDown);
            if (stat === 'sp_atk' || stat === 'sp_def') label = (arrowUp || arrowDown) + ' ' + label;
            
            const lx = CX + (R + 32) * Math.cos(angle);
            const ly = CY + (R + 32) * Math.sin(angle);
            
            let mxAdj = -30;
            let myAdj = -15;
            if(i===0) { mxAdj = -30; myAdj=-30;} 
            if(i===3) { mxAdj = -30; myAdj=-5;} 
            
            labelsHtml += `<div style="position: absolute; left: ${lx + mxAdj}px; top: ${ly + myAdj}px; text-align: center; font-size: 12px; font-weight: bold; ${colorStr} text-shadow: 1px 1px 2px #000; width: 60px;">
                ${label}<br/>
                <span style="font-weight: normal; font-size: 14px;">${val}</span>
            </div>`;
        }
        
        const svgStr = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position: absolute; left: 0; top: 0;">
            <!-- Web BG -->
            <polygon points="${bgPolyPoints.join(' ')}" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
            <polygon points="${midPolyPoints.join(' ')}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
            <!-- Axes -->
            ${bgPolyPoints.map(p => `<line x1="${CX}" y1="${CY}" x2="${p.split(',')[0]}" y2="${p.split(',')[1]}" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>`).join('')}
            <!-- Colored Radar Data -->
            <polygon points="${polyPoints.join(' ')}" fill="rgba(192, 222, 114, 0.85)" stroke="#c0de72" stroke-width="1"/>
        </svg>`;
        
        container.innerHTML = svgStr + labelsHtml;
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

    function getWeakScaleClass(count) {
        if (count >= 3) return 'scale-weak-3';
        if (count === 2) return 'scale-weak-2';
        if (count === 1) return 'scale-weak-1';
        return '';
    }

    function getResistScaleClass(count) {
        if (count >= 3) return 'scale-resist-3';
        if (count === 2) return 'scale-resist-2';
        if (count === 1) return 'scale-resist-1';
        return '';
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
            tdWeak.className = 'total-weak ' + getWeakScaleClass(totalWeak);
            tdWeak.textContent = totalWeak > 0 ? totalWeak : '';
            tr.appendChild(tdWeak);

            const tdResist = document.createElement('td');
            tdResist.className = 'total-resist ' + getResistScaleClass(totalResist);
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
            tdStrong.className = 'total-strong ' + getResistScaleClass(totalStrong);
            tdStrong.textContent = totalStrong > 0 ? totalStrong : '';
            tr.appendChild(tdStrong);

            tbody.appendChild(tr);
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();

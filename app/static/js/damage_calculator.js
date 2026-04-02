// damage_calculator.js

window.cachedMoves = { 'p1': [], 'p2': [] };

const STAT_MAPPING_API = {
    'hp': 'HP',
    'attack': 'Atk',
    'defense': 'Def',
    'special-attack': 'SpA',
    'special-defense': 'SpD',
    'speed': 'Spe'
};

const NATURE_MULTS = {
    "Hardy":   { 'Atk': 1.0, 'Def': 1.0, 'SpA': 1.0, 'SpD': 1.0, 'Spe': 1.0 },
    "Lonely":  { 'Atk': 1.1, 'Def': 0.9, 'SpA': 1.0, 'SpD': 1.0, 'Spe': 1.0 },
    "Brave":   { 'Atk': 1.1, 'Def': 1.0, 'SpA': 1.0, 'SpD': 1.0, 'Spe': 0.9 },
    "Adamant": { 'Atk': 1.1, 'Def': 1.0, 'SpA': 0.9, 'SpD': 1.0, 'Spe': 1.0 },
    "Naughty": { 'Atk': 1.1, 'Def': 1.0, 'SpA': 1.0, 'SpD': 0.9, 'Spe': 1.0 },
    "Bold":    { 'Atk': 0.9, 'Def': 1.1, 'SpA': 1.0, 'SpD': 1.0, 'Spe': 1.0 },
    "Docile":  { 'Atk': 1.0, 'Def': 1.0, 'SpA': 1.0, 'SpD': 1.0, 'Spe': 1.0 },
    "Relaxed": { 'Atk': 1.0, 'Def': 1.1, 'SpA': 1.0, 'SpD': 1.0, 'Spe': 0.9 },
    "Impish":  { 'Atk': 1.0, 'Def': 1.1, 'SpA': 0.9, 'SpD': 1.0, 'Spe': 1.0 },
    "Lax":     { 'Atk': 1.0, 'Def': 1.1, 'SpA': 1.0, 'SpD': 0.9, 'Spe': 1.0 },
    "Timid":   { 'Atk': 0.9, 'Def': 1.0, 'SpA': 1.0, 'SpD': 1.0, 'Spe': 1.1 },
    "Hasty":   { 'Atk': 1.0, 'Def': 0.9, 'SpA': 1.0, 'SpD': 1.0, 'Spe': 1.1 },
    "Serious": { 'Atk': 1.0, 'Def': 1.0, 'SpA': 1.0, 'SpD': 1.0, 'Spe': 1.0 },
    "Jolly":   { 'Atk': 1.0, 'Def': 1.0, 'SpA': 1.0, 'SpD': 1.0, 'Spe': 1.1 },
    "Naive":   { 'Atk': 1.0, 'Def': 1.0, 'SpA': 1.0, 'SpD': 0.9, 'Spe': 1.1 },
    "Modest":  { 'Atk': 0.9, 'Def': 1.0, 'SpA': 1.1, 'SpD': 1.0, 'Spe': 1.0 },
    "Mild":    { 'Atk': 1.0, 'Def': 0.9, 'SpA': 1.1, 'SpD': 1.0, 'Spe': 1.0 },
    "Quiet":   { 'Atk': 1.0, 'Def': 1.0, 'SpA': 1.1, 'SpD': 1.0, 'Spe': 0.9 },
    "Bashful": { 'Atk': 1.0, 'Def': 1.0, 'SpA': 1.0, 'SpD': 1.0, 'Spe': 1.0 },
    "Rash":    { 'Atk': 1.0, 'Def': 1.0, 'SpA': 1.1, 'SpD': 0.9, 'Spe': 1.0 },
    "Calm":    { 'Atk': 0.9, 'Def': 1.0, 'SpA': 1.0, 'SpD': 1.1, 'Spe': 1.0 },
    "Gentle":  { 'Atk': 1.0, 'Def': 0.9, 'SpA': 1.0, 'SpD': 1.1, 'Spe': 1.0 },
    "Sassy":   { 'Atk': 1.0, 'Def': 1.0, 'SpA': 1.0, 'SpD': 1.1, 'Spe': 0.9 },
    "Careful": { 'Atk': 1.0, 'Def': 1.0, 'SpA': 0.9, 'SpD': 1.1, 'Spe': 1.0 },
    "Quirky":  { 'Atk': 1.0, 'Def': 1.0, 'SpA': 1.0, 'SpD': 1.0, 'Spe': 1.0 }
};

const TYPE_CHART = {
    normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
    fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
    water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
    grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
    electric: { water: 2, grass: 0.5, electric: 0.5, ground: 0, flying: 2, dragon: 0.5 },
    ice:      { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
    fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
    poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
    ground:   { fire: 2, water: 1, grass: 0.5, electric: 2, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
    flying:   { grass: 2, electric: 0.5, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
    psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
    bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
    rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
    ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
    dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
    dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
    steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
    fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
};

document.addEventListener("DOMContentLoaded", () => {
    initAutocomplete('p1');
    initAutocomplete('p2');
    initTypeSelects('p1');
    initTypeSelects('p2');
    bindStatRecalculation('p1');
    bindStatRecalculation('p2');

    // Attach Move Selectors for 4 slots
    for (let i = 1; i <= 4; i++) {
        initMoveAutocomplete('p1', i);
        initMoveAutocomplete('p2', i);
    }

    // Run first calculation
    calculateTotals('p1');
    calculateTotals('p2');
});

// Populate Type selects
function initTypeSelects(player) {
    const types = window.calcData.types;
    
    // Pokémon Main Types
    ['type1', 'type2'].forEach(t => {
        const sel = document.getElementById(`${player}-${t}`);
        if(sel && Array.isArray(types)) {
            types.forEach(typeVal => {
                const opt = document.createElement('option');
                opt.value = typeVal;
                opt.textContent = typeVal.charAt(0).toUpperCase() + typeVal.slice(1);
                sel.appendChild(opt);
            });
        }
    });

    // Moveset Types (Slots 1 to 4)
    for (let i = 1; i <= 4; i++) {
        const moveSel = document.getElementById(`${player}-move${i}-type`);
        if(moveSel && Array.isArray(types)) {
            types.forEach(typeVal => {
                const opt = document.createElement('option');
                opt.value = typeVal;
                opt.textContent = typeVal.charAt(0).toUpperCase() + typeVal.slice(1);
                moveSel.appendChild(opt);
            });
        }
    }
}

// Attach listeners to input fields
function bindStatRecalculation(player) {
    const fieldsToWatch = ['nature'];
    Object.values(STAT_MAPPING_API).forEach(stat => {
        fieldsToWatch.push(`base-${stat}`);
        fieldsToWatch.push(`iv-${stat}`);
        fieldsToWatch.push(`ev-${stat}`);
    });

    fieldsToWatch.forEach(f => {
        const el = document.getElementById(`${player}-${f}`);
        if(el) {
            el.addEventListener('input', () => calculateTotals(player));
            el.addEventListener('change', () => calculateTotals(player));
        }
    });
    // Liga recalcule quando moves mudare também
    for(let i=1; i<=4; i++) {
        ['name', 'bp', 'type', 'cat'].forEach(mf => {
            const el = document.getElementById(`${player}-move${i}-${mf}`);
            if(el) {
                el.addEventListener('input', () => calculateTotals(player));
                el.addEventListener('change', () => calculateTotals(player));
            }
        });
    }
}

// Gen 9 Base Stat Math Logic
function calculateTotals(player) {
    const level = 100; // Fixed for 1v1
    const natureSel = document.getElementById(`${player}-nature`);
    let nature = natureSel ? natureSel.value : 'Hardy';
    const mults = NATURE_MULTS[nature] || NATURE_MULTS['Hardy'];

    Object.values(STAT_MAPPING_API).forEach(stat => {
        const baseEl = document.getElementById(`${player}-base-${stat}`);
        const ivEl = document.getElementById(`${player}-iv-${stat}`);
        const evEl = document.getElementById(`${player}-ev-${stat}`);
        const totalEl = document.getElementById(`${player}-total-${stat}`);

        if (!baseEl || !ivEl || !evEl || !totalEl) return;

        const base = parseInt(baseEl.value) || 0;
        let iv = parseInt(ivEl.value) || 0;
        let ev = parseInt(evEl.value) || 0;

        // Limita inputs numéricos nativamente
        if (iv > 31) { iv = 31; ivEl.value = 31; }
        if (ev > 252) { ev = 252; evEl.value = 252; }

        let total = 0;
        if (stat === 'HP') {
            if (base === 1) { 
                total = 1; // Shedinja special rule
            } else {
                total = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
            }
        } else {
            const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
            total = Math.floor(raw * mults[stat]);
        }

        totalEl.textContent = total;
    });

    evaluateDamageCluster();
}

// O Núcleo do Motor de Dano (Gen 9 Oficial)
function evaluateDamageCluster() {
    simulateStrike('p1', 'p2'); 
    simulateStrike('p2', 'p1');
}

function getStatNum(player, statNameAPI) {
    const el = document.getElementById(`${player}-total-${STAT_MAPPING_API[statNameAPI]}`);
    return el ? parseInt(el.textContent) || 0 : 0;
}

function simulateStrike(attackerStr, defenderStr) {
    // Para simplificar a verificação, assumiremos sempre que o Move 1 é o selecionado para a análise do Letreiro.
    // Usuários geralmente manipulam o Slot 1 para ver danos diretos no Showdown.
    
    const moveCat = document.getElementById(`${attackerStr}-move1-cat`);
    const moveType = document.getElementById(`${attackerStr}-move1-type`);
    const moveBP = document.getElementById(`${attackerStr}-move1-bp`);
    
    if(!moveBP || parseInt(moveBP.value) <= 0) return;

    const bp = parseInt(moveBP.value);
    const category = moveCat ? moveCat.value : 'Special'; // Fysical/Special
    const mType = moveType ? moveType.value : 'normal';

    if (category === 'Status') return; // Golpes como Toxic/Swords Dance não rolam danos matemáticos

    // Resgata variáveis de Batalha (Attack/SpA VS Def/SpD dependendo da Categoria)
    const attackVal = category === 'Physical' ? getStatNum(attackerStr, 'attack') : getStatNum(attackerStr, 'special-attack');
    const defendVal = category === 'Physical' ? getStatNum(defenderStr, 'defense') : getStatNum(defenderStr, 'special-defense');

    // Equação Oficial Pura
    const level = 100;
    const baseDamage = Math.floor(Math.floor(Math.floor((2 * level / 5) + 2) * bp * attackVal / defendVal) / 50) + 2;

    // Multiplicadores
    let modifier = 1.0;

    // 1. STAB (Same Type Attack Bonus)
    const attackerT1 = document.getElementById(`${attackerStr}-type1`)?.value || '';
    const attackerT2 = document.getElementById(`${attackerStr}-type2`)?.value || '';
    if (mType === attackerT1 || mType === attackerT2) {
        modifier *= 1.5;
    }

    // 2. Type Effectiveness do Defensor
    const defenderT1 = document.getElementById(`${defenderStr}-type1`)?.value || '';
    const defenderT2 = document.getElementById(`${defenderStr}-type2`)?.value || '';
    let typeMod = 1.0;
    
    if(TYPE_CHART[mType]) {
        if(defenderT1 && TYPE_CHART[mType][defenderT1] !== undefined) typeMod *= TYPE_CHART[mType][defenderT1];
        if(defenderT2 && defenderT2 !== defenderT1 && TYPE_CHART[mType][defenderT2] !== undefined) typeMod *= TYPE_CHART[mType][defenderT2];
    }
    modifier *= typeMod;

    // Output Ranges
    const minRoll = Math.floor(baseDamage * modifier * 0.85);
    const maxRoll = Math.floor(baseDamage * modifier * 1.00);

    const defenderHP = getStatNum(defenderStr, 'hp');
    if (defenderHP <= 0) return;

    const minPct = ((minRoll / defenderHP) * 100).toFixed(1);
    const maxPct = ((maxRoll / defenderHP) * 100).toFixed(1);

    const dmgText = document.getElementById('main-result');
    const attackerName = document.getElementById(`${attackerStr}-name`).value || 'Attacker';
    const defenderName = document.getElementById(`${defenderStr}-name`).value || 'Defender';
    const moveName = document.getElementById(`${attackerStr}-move1-name`).value || 'Ataque';

    // Imprime na tela apenas do P1 por enquanto de modo limpo para facilitar rastreabilidade UI
    if(attackerStr === 'p1') {
        if(typeMod === 0) {
            dmgText.textContent = `${defenderName} is immune to ${attackerName}'s ${moveName}.`;
        } else {
            dmgText.textContent = `${minPct}% - ${maxPct}% em ${defenderName} (${minRoll} - ${maxRoll} de Dano Real)`;
            // Estilização condicional
            if(maxPct >= 100) dmgText.style.color = '#ff4444'; // KO (Vermelho Sangue)
            else if(maxPct >= 50) dmgText.style.color = '#ffc107'; // 2HKO (Dourado)
            else dmgText.style.color = '#fff'; // Dano pífio
        }
    }
}

// Autocomplete Core
function initAutocomplete(player) {
    const input = document.getElementById(`${player}-name`);
    if (!input) return;

    let suggestionBox = document.createElement('div');
    suggestionBox.className = 'tb-suggestions';
    input.parentNode.style.position = 'relative';
    input.parentNode.appendChild(suggestionBox);

    input.addEventListener('input', function() {
        const val = this.value.toLowerCase().trim();
        suggestionBox.innerHTML = '';
        suggestionBox.style.display = 'none';

        if (!val) return;

        const matches = window.calcData.all_names.filter(n => n.toLowerCase().includes(val)).slice(0, 8);
        
        if (matches.length > 0) {
            matches.forEach(match => {
                const item = document.createElement('div');
                item.className = 'tb-suggestion-item';
                item.textContent = match;
                
                item.addEventListener('click', function() {
                    input.value = this.textContent;
                    suggestionBox.style.display = 'none';
                    fetchPokemonData(player, this.textContent);
                });
                suggestionBox.appendChild(item);
            });
            suggestionBox.style.display = 'block';
        }
    });

    // Close when clicking outside
    document.addEventListener('click', function(e) {
        if (e.target !== input) {
            suggestionBox.style.display = 'none';
        }
    });
}

async function fetchPokemonData(player, pokemonName) {
    const lowerName = pokemonName.toLowerCase().replace(/ /g, '-');
    
    // Set feedback text safely on main header
    const mainResult = document.getElementById('main-result');
    if(mainResult) mainResult.textContent = `Buscando dados biológicos de ${pokemonName}...`;

    try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${lowerName}`);
        if (!response.ok) throw new Error("Not found");
        
        const data = await response.json();

        // Popula os Base Stats
        data.stats.forEach(s => {
            const domName = STAT_MAPPING_API[s.stat.name];
            if (domName) {
                const el = document.getElementById(`${player}-base-${domName}`);
                if (el) el.value = s.base_stat;
            }
        });

        // Popula as Tipagens
        const t1 = document.getElementById(`${player}-type1`);
        const t2 = document.getElementById(`${player}-type2`);
        
        if(t1) t1.value = data.types[0] ? data.types[0].type.name : '';
        if(t2) t2.value = data.types[1] ? data.types[1].type.name : '';

        // Traz EVs para 0 e recalcula Base
        Object.values(STAT_MAPPING_API).forEach(stat => {
            const evEl = document.getElementById(`${player}-ev-${stat}`);
            if (evEl) evEl.value = stat.includes('SpA') ? 252 : 0; // Just default a value to show calc works
        });

        // Store legal moves into cache block for sub-autocomplete
        window.cachedMoves[player] = data.moves.map(m => m.move.name.replace(/-/g, ' '));

        // Trigger math
        calculateTotals(player);
        if(mainResult) mainResult.textContent = `Stats e Lista Legal de Movimentos carregados.`;

    } catch (e) {
        console.log("Error fetching API:", e);
        if(mainResult) mainResult.textContent = `Erro ao localizar ${pokemonName} na PokeAPI.`;
    }
}

// -------------------------------------------------------------------
// Move Sub-Autocomplete & Data Ingestion
// -------------------------------------------------------------------

function initMoveAutocomplete(player, slotNumber) {
    const input = document.getElementById(`${player}-move${slotNumber}-name`);
    if (!input) return;

    let suggestionBox = document.createElement('div');
    suggestionBox.className = 'tb-suggestions';
    input.parentNode.style.position = 'relative';
    input.parentNode.appendChild(suggestionBox);

    input.addEventListener('input', function() {
        const val = this.value.toLowerCase().trim();
        suggestionBox.innerHTML = '';
        suggestionBox.style.display = 'none';

        if (!val) return;

        // Limita ao cache individual para obedecer biologia
        const legalMoves = window.cachedMoves[player] || [];
        const matches = legalMoves.filter(m => m.toLowerCase().includes(val)).slice(0, 10);
        
        if (matches.length > 0) {
            matches.forEach(match => {
                const item = document.createElement('div');
                item.className = 'tb-suggestion-item';
                // Capitaliza nome do move
                item.textContent = match.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                
                item.addEventListener('click', function() {
                    input.value = this.textContent;
                    suggestionBox.style.display = 'none';
                    // Dispara puxada inteligente dos Metadata do ataque
                    fetchMoveData(player, slotNumber, this.textContent);
                });
                suggestionBox.appendChild(item);
            });
            suggestionBox.style.display = 'block';
        }
    });

    document.addEventListener('click', function(e) {
        if (e.target !== input) {
            suggestionBox.style.display = 'none';
        }
    });
}

async function fetchMoveData(player, slotNumber, moveNameRaw) {
    const lowerName = moveNameRaw.toLowerCase().replace(/ /g, '-');
    
    try {
        const response = await fetch(`https://pokeapi.co/api/v2/move/${lowerName}`);
        if (!response.ok) throw new Error("Move API fail");
        const data = await response.json();
        
        // Auto-fill BP (0 se null/undefined, p. ex: Swords Dance, Protect)
        const bpInput = document.getElementById(`${player}-move${slotNumber}-bp`);
        if (bpInput) bpInput.value = data.power || 0;
        
        // Auto-fill Type Selector (precisa coincidir com lowercase standard dict)
        const typeSelect = document.getElementById(`${player}-move${slotNumber}-type`);
        if (typeSelect && data.type) typeSelect.value = data.type.name;
        
        // Auto-fill Category Modifiers (physical/special/status)
        const catSelect = document.getElementById(`${player}-move${slotNumber}-cat`);
        if (catSelect && data.damage_class) {
            const cls = data.damage_class.name; 
            catSelect.value = cls.charAt(0).toUpperCase() + cls.slice(1);
        }
        
    } catch (e) {
        console.log(`Failed to fetch info for move ${moveNameRaw}`, e);
    }
}

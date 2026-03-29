import requests
import json

def fetch_defenses():
    types = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"]
    defender_chart = {}
    
    for t in types:
        print(f"Fetching {t}...")
        resp = requests.get(f"https://pokeapi.co/api/v2/type/{t}").json()
        dmg_rels = resp['damage_relations']
        
        multiplier = {}
        for x in dmg_rels['double_damage_from']:
            multiplier[x['name']] = 2.0
        for x in dmg_rels['half_damage_from']:
            multiplier[x['name']] = 0.5
        for x in dmg_rels['no_damage_from']:
            multiplier[x['name']] = 0.0
            
        defender_chart[t] = multiplier

    with open("app/models/type_defenses.py", "w") as f:
        f.write("ALL_TYPES = " + str(types) + "\n\n")
        f.write("DEFENSE_CHART = {\n")
        for k, v in defender_chart.items():
            f.write(f"    '{k}': {v},\n")
        f.write("}\n")

    print("Done")

if __name__ == "__main__":
    fetch_defenses()

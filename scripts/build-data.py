"""Regenerate the pinned, local geography assets (Python 3 standard library only).

Natural Earth is public domain. mledoze/countries is ODbL 1.0; attribution in
README.md. Review capital overrides when updating either upstream snapshot.
"""
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NE_REV = "ca96624a56bd078437bca8184e78163e5039ad19"
COUNTRIES_REV = "c8015eebdd94c533358406b0d709f441389e1f2e"
NE_URL = f"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{NE_REV}/geojson/ne_50m_admin_0_countries.geojson"
COUNTRIES_URL = f"https://raw.githubusercontent.com/mledoze/countries/{COUNTRIES_REV}/countries.json"


def read_json(url):
    with urllib.request.urlopen(url) as response:
        return json.load(response)


def round_coords(value):
    if isinstance(value, (float, int)):
        return round(value, 4)
    return [round_coords(v) for v in value]


def main():
    source = read_json(COUNTRIES_URL)
    natural_earth = read_json(NE_URL)
    original = json.loads((ROOT / "data" / "legacy-tiers.json").read_text())

    # The source marks Holy See as a UN member. Its 194 marked entries are
    # the 193 UN members plus the Holy See; Palestine is added explicitly.
    selected = [c for c in source if c["unMember"] or c["cca3"] == "PSE"]
    assert len(selected) == 195
    codes = {c["cca3"] for c in selected}
    assert len(codes) == 195 and {"VAT", "PSE"} <= codes

    capital_overrides = {
        "ZAF": ("Pretoria · Kaapstad · Bloemfontein", "Pretoria · Cape Town · Bloemfontein"),
        "LKA": ("Sri Jayawardenepura Kotte", "Sri Jayawardenepura Kotte"),
        "BOL": ("Sucre · La Paz (regeringszetel)", "Sucre · La Paz (seat of government)"),
        "SWZ": ("Mbabane · Lobamba", "Mbabane · Lobamba"),
        "BEN": ("Porto-Novo · Cotonou (regeringszetel)", "Porto-Novo · Cotonou (seat of government)"),
        "MYS": ("Kuala Lumpur · Putrajaya (bestuurszetel)", "Kuala Lumpur · Putrajaya (administrative centre)"),
        "PSE": ("Ramallah (bestuurszetel)", "Ramallah (administrative seat)"),
        "NRU": ("Yaren (de facto; geen officiële hoofdstad)", "Yaren (de facto; no official capital)"),
        "CHE": ("Bern (federale stad)", "Bern (federal city)"),
        "NLD": ("Amsterdam · Den Haag (regeringszetel)", "Amsterdam · The Hague (seat of government)"),
        # Presidential decree 1/2026, January 2; source in README.
        "GNQ": ("Ciudad de la Paz", "Ciudad de la Paz"),
    }
    # Natural Earth has explicit non-ISO IDs for some de facto areas.
    # Match the game country's territory where suitable; leave Kosovo and
    # other contested/territorial features neutral rather than silently assign.
    aliases = {"CYN": "CYP", "SOL": "SOM"}
    features = []
    focus = {}
    markers = set()
    for feature in natural_earth["features"]:
        p = feature["properties"]
        code = p["ADM0_A3"]
        iso = p["ISO_A3"]
        game_id = aliases.get(code, iso if iso in codes else code if code in codes else None)
        if game_id in codes and game_id not in focus:
            focus[game_id] = [round(p["LABEL_Y"], 4), round(p["LABEL_X"], 4)]
        if game_id in codes and p["TINY"] != -99:
            markers.add(game_id)
        features.append({
            "type": "Feature",
            "properties": {"id": game_id, "name": p["ADMIN"]},
            "geometry": {"type": feature["geometry"]["type"],
                         "coordinates": round_coords(feature["geometry"]["coordinates"])},
        })

    assert codes <= focus.keys(), f"Missing shapes: {codes - focus.keys()}"
    # Tiny polygon markers use the polygon's actual label point. Even where a
    # tiny feature contains geometry, the polygon alone is too small to tap.
    result = []
    for c in selected:
        code = c["cca3"]
        en = c["name"]["common"]
        nl = c["translations"].get("nld", {}).get("common", en)
        if code in original:
            nl = original[code]["nl"]
        nl = {"GBR": "Verenigd Koninkrijk", "SWZ": "Eswatini", "TLS": "Oost-Timor"}.get(code, nl)
        if code == "VAT":
            nl, en = "Vaticaanstad", "Vatican City"
        if code == "PSE":
            nl, en = "Palestina", "Palestine"
        capital = c["capital"][0] if c["capital"] else ""
        previous = original.get(code, {})
        cap_nl, cap_en = capital_overrides.get(code, (previous.get("capital_nl", capital), previous.get("capital_en", capital)))
        assert cap_nl and cap_en, code
        result.append({
            "iso2": c["cca2"].lower(), "iso3": code,
            "name": {"nl": nl, "en": en},
            "capital": {"nl": cap_nl, "en": cap_en},
            "continent": c["region"],
            "difficulty": original.get(code, {}).get("difficulty", 3),
            "areaKm2": c["area"],
            "focus": focus[code], "marker": code in markers,
        })
    result.sort(key=lambda c: c["iso3"])
    (ROOT / "data" / "countries.json").write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
    (ROOT / "data" / "world-50m.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"{len(result)} countries, {len(features)} map features, {len(markers)} small-country markers")


if __name__ == "__main__":
    main()

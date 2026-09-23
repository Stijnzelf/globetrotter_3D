# Globetrotter 3D

Static geography game for GitHub Pages. Serve the repository root over HTTP
(for example `python -m http.server 8000`) and open `index.html`. File URLs do
not support the local JSON fetches. There is no backend.

## Scope and rules

The quiz covers 195 states: 193 UN members and the two UN observer states,
the Holy See and Palestine. Each game has ten different questions. Easy draws
from tier 1; Medium from tiers 1 and 2; Hard and Exam draw from all three tiers.
Scores and the top ten are stored on this device per mode and difficulty.
The Learn all 195 mode stores seen, correct and wrong counts locally, favouring
unseen and missed countries in later sessions. Its results are not ranked.

The map uses Natural Earth 50m polygons plus larger clickable markers for the
33 very small states flagged by Natural Earth. Tap or click a marker for a
small country; zoom in when neighbouring markers overlap. Geographic focus
coordinates are label points for camera movement, not capital coordinates.
The base map follows Natural Earth's de facto boundary policy. Northern Cyprus
is mapped to Cyprus and Somaliland to Somalia for quiz answers; Kosovo and
other features without a country in the 195-country set remain unranked.

## Data and maintenance

`data/countries.json` is the game catalogue. `data/world-50m.geojson` is the
locally bundled and rounded map. `data/legacy-tiers.json` preserves original
difficulty assignments and Dutch labels. `python scripts/build-data.py`
regenerates the first two from pinned upstream revisions. Review country names,
capitals and the explicit overrides in that script before changing revisions.

- Natural Earth Admin-0 50m, public domain, snapshot
  `ca96624a56bd078437bca8184e78163e5039ad19`:
  <https://github.com/nvkelso/natural-earth-vector>.
- `mledoze/countries`, ODbL 1.0, snapshot
  `c8015eebdd94c533358406b0d709f441389e1f2e`:
  <https://github.com/mledoze/countries>. `data/countries.json` contains an
  adapted subset and is shared under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) with that attribution.
- The 195-country selection follows the [United Nations membership and
  observer-state lists](https://www.un.org/en/about-us/member-states).
- The 2026 Ciudad de la Paz change follows [Equatorial Guinea's presidential
  decree](https://www.guineaecuatorialpress.com/noticias/decreto_ley_por_el_que_se_declara_la_ciudad_de_la_paz_djibloho_capital_de_la_republica_de_guinea_ecuatorial).

Run `npm test` before publishing. The tests check count, codes, translations,
geometric coverage, tiny-country markers, tiers and scoring. The map is about
1.9 MB uncompressed; its first load and rendering still depend on the device.
The Earth texture, UI libraries and 3D renderer currently load from CDNs, so
the game is not fully offline. Country flags use Unicode emoji rather than
remote images. Public online leaderboards need a separately configured and
server-validated backend.

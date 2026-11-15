# Spherical south-polar release: method and final local evidence

Current working-tree snapshot, 2026-11-15, `.audit/final-integration`. **Globe View is the default representation**, not a complete global Moon model. Terrain View retains the planar South Pole Overview and three native 80 m exploratory patches. This document supersedes [POLAR_OVERVIEW.md](POLAR_OVERVIEW.md) for the current default; that document records the earlier planar stage. Existing FINAL/bootstrap reports and earlier pushed polar-stage CI results are historical, not verification of these uncommitted changes.

## Scientific method: question, construction, checks, limits

**Question.** Can reviewed LOLA radial heights be displayed on a physically curved south-polar cap without inventing terrain, exaggerating relief, changing the frozen API contracts, or turning incomplete regional estimates into confirmed visibility?

**Construction.** `data-pipeline/terrain_mesh/build_spherical_cap.py` reuses the source sample selection from `build_overview.py`, then maps each actual native pixel-centre height onto the reviewed reference sphere. `scripts/release_assets.py` publishes and binds both planar overview and spherical assets to the source and proof receipt. Frontend spherical mapping validates those proofs before geographic picking.

**Checks.** Python tests check projection round trips, pole/dateline handling, radial height, physical sag, every emitted source mapping, normals/winding, deterministic publication and tamper rejection. Frontend tests cover mapping, picking/surface safeguards, catalog/state handling, analysis semantics and the separate display edge. Playwright exercises real local GLBs, controls and selected live NASA/DEM paths; explicitly intercepted fixtures test state/layout/failure behavior. Results and limitations are separated below.

**Conclusion.** The local evidence supports a source-derived spherical visualization and regional assessment workflow. It does not establish complete visibility, landing suitability, physical DEM error bounds, GPU performance or public deployment readiness.

## Exact geometry and provenance

- Reference radius **R = 1,737,400 m**; radial height **h**, radius **r = R + h**, reviewed source frame **MOON_ME/DE421**.
- For south-polar stereographic easting `e` and northing `n`: `rho = hypot(e,n)`, `latitude = 2 atan2(rho,2R) − π/2`, `longitude = atan2(e,n)`.
- Moon-fixed Cartesian coordinates are `MoonX = r cos(latitude) cos(longitude)`, `MoonY = r cos(latitude) sin(longitude)`, `MoonZ = r sin(latitude)`.
- Exact scene transform in metres: **`[MoonY, -MoonZ - R, -MoonX]`** (`sceneAxes = Y,-Z-R,-X`). The local origin is the **reference-sphere South Pole**, not the Moon centre. At the pole a radial height `h` gives scene `y=h`; the Moon centre is at scene `[0,-R,0]`.
- This is a physical **10° angular-radius cap**, from 90°S toward 80°S, not exaggerated curvature. At 80°S, reference-sphere sag below the pole tangent plane is `R(1−cos(10°)) ≈ 26.395 km`. Actual terrain adds its radial height. **Height exaggeration = 1; curvature exaggeration = 1.**

Source: official `data/raw/LDEM_80S_80MPP_ADJ.TIF`, **189,158,392 bytes**, local SHA-256 `82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a`. Provenance: [PGDA product 90](https://pgda.gsfc.nasa.gov/products/90), [Barker/NTRS](https://ntrs.nasa.gov/citations/20230014419), [PDS LOLA label](https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/FLOAT_IMG/LDEM_80S_80M_FLOAT.LBL). Heights mean radial distance minus R, not arbitrary display elevations.

The nominal 80–90°S domain is the **intersection** of the polar circle (`latitude ≤ −80°`, projected radius `2R tan(5°)`) with the actual raster sample-centre square, easting/northing **[−303960,+303960] m**. It is not a promise of a complete analytical circle: the raster clips near cardinal directions. RasterPixelIsArea tiepoint is `(−304000,+304000)`, pixel size 80 m; sampling uses `column+0.5,row+0.5`. One central sample plus **100 rings × 400 sectors** snaps to native sample centres; boundaries retreat inward, with no extrapolation or interpolated source heights. The emitted edge is a coarse inscribed triangulation, not the exact coverage boundary.

| Asset | Vertices | Triangles | GLB bytes |
| --- | ---: | ---: | ---: |
| Planar overview | 40,001 | 79,600 | 2,236,672 |
| Spherical cap | **40,001** | **79,304** | **2,233,140** |

The cap removes **296 degenerate faces** after mapping to the actual stored float32 positions; it does not add synthetic fill. Normals and outward winding derive from those emitted triangles. Published `.validation/runtime-assets/metadata/globe-map.json` records cap SHA-256 **`07ab3c5c833d2535c4c2fd2aba73285060f0debe552cb3dbcf8b121bc8c80a51`**. This and the source SHA are **local identity hashes, not publisher checksums**. Native sample proof and spherical-coordinate proof are distinct. Browser rendering loads the roughly 2.23 MB GLB, not the 189 MB TIFF.

## DisplayPlinth is not scientific terrain

`frontend/src/features/explorer/components/DisplayPlinth.tsx` creates a separate decorative mesh through `scene/displayPlinth.ts`; it is not baked into the cap GLB. The reviewed real-cap test records **800 vertices / 800 triangles**, derived only from the 400-edge outer ring. The 592 internal boundary edges caused by removed degenerate faces are not treated as display edges.

The flat lower edge (there is no bottom disk) is **5 km below the lowest actual boundary vertex** (`min(boundary.y)−5000`), not a model of a constant-depth lunar layer. Label: **“Display edge · not lunar interior”**. It is nonpickable (no-op raycast), excluded from the scientific terrain surface/bounds, and supplies no heights, source proof, horizon or analysis data. It is a team presentation device, **not NASA terrain or a lunar-interior product**.

## Representation, selection and lighting

Globe is the default; Terrain offers planar overview and explicit `connecting-ridge`, `near-shackleton`, `near-de-gerlache` native patches. Each native patch has 15,876 vertices / 31,250 triangles. Switching representation preserves shared A/B coordinates, cached analysis and selected UTC; selecting a different patch remains an explicit location action. This is **manual coarse-to-native LOD**, not continuous streaming, zoom-triggered refinement or a global high-resolution tile pyramid.

Picking uses reviewed actual GLB triangles and matching asset identity, with spherical inverse mapping on Globe. Missing/unverified assets fail closed for picks; manual coordinate analysis remains possible. Surface markers follow the loaded terrain. Triangle-interpolated picked heights may differ from backend bilinear heights between native samples; displayed decimal digits are not physical accuracy.

**Exploration Lighting** is neutral illustrative fill. **Scientific Sun Lighting is unavailable on Globe for scientific safety**: a cached local topocentric direction is not a global Moon-fixed solar vector. On reviewed Terrain only, an exact matching cached sample at **A** may drive approximate local lighting through the projection Jacobian; it does not independently light B scientifically. UTC scrubbing uses cached samples, not new per-frame NASA calls. `/api/v1/ephemeris` remains unavailable (503). Graphic shadows never establish visibility, power, temperature or radio-link conditions. Acquired/georeferenced NAC does not overlap the native patches; no real site photograph/texture is claimed.

## Three-level analysis and uncertainty

`frontend/src/features/analysis/AnalysisPanel.tsx` separates:

1. **Astronomical Position** — local Sun/Earth sky directions, compass **North 0° / East 90°**, not global 3D vectors. Selected UTC must match an actual sample; positions are not interpolated.
2. **Regional Terrain Assessment** — sampled nearby horizon and clearance, not a complete visibility solution. Model scope remains **20 km**, azimuth step **1°**, radial step **80 m**. Positive clearance is above the sampled skyline; negative clearance is at/below it. **Positive clearance cannot confirm visibility without distant-terrain coverage. Negative clearance suggests nearby obstruction, but confirmed blockage requires validated sampling/error bounds, which are not yet established.**
3. **Confirmed Visibility** — API visibility is authoritative; `null` means Unknown. Current regional responses retain `visible=null`, null summaries, `status=partial`, global `quality.terrainApplied=false`. Null duration/percent is **not zero**, and clearance must not substitute for a visibility boolean.

Altitude/clearance charts use adaptive scales that always include zero, explicit zero reference, missing-data gaps and exact-sample tooltips. Lines are visual connections, not newly computed interpolated scientific samples. Two samples are labelled a snapshot; a 12–24 h request is a manual choice, not an automatic network expansion. Technical metadata and human-readable quality warnings remain in expandable details, alongside samples/horizon. The reviewed 1 mm coordinate consistency tolerance is numerical agreement, **not DEM physical accuracy**. No validated uncertainty bound permits a negative-clearance ⇒ confirmed-blocked inference.

## Frozen contracts and publication

Existing frozen OpenAPI/DTO/scene contracts remain unchanged. `sphericalCap` is a **top-level static metadata extension**, accompanied by spherical mesh proof; it is not an API response-shape change or a replacement of the existing planar `render.sceneTransform` contract. The frontend explicitly validates spherical metadata before using it.

The release publisher generates **both overview and globe**, their static metadata/catalog and the hidden bound review receipt. Runtime validation rechecks source identity and regenerated assets/proofs rather than trusting a metadata boolean. Source/mesh tampering must not inherit approval. Generated binaries/receipts remain ignored. Exact DEM bytes/geotags/same-open-handle identity and **1962-01-01 ≤ UTC < 2650-01-01** datum gate remain separate from map/picking approval.

## Reproduction

From `.audit/final-integration`, with Python 3.9+, Node 22/npm and stable **.NET 10**:

```sh
npm ci --prefix frontend
dotnet restore backend/LunarNavigator.sln
python3 scripts/asset-setup.py --capture-docs --acquire-nac --prepare-runtime --write-launch-env
python3 scripts/run-local.py
```

Initial restore/acquisition requires network and disk space; manual source download is unnecessary. With full source data already available, offline preparation regenerates native candidates and publishes **both** representations as release publisher:

```sh
python3 scripts/asset-setup.py --offline --prepare-runtime --write-launch-env
```

Then **one command**, `python3 scripts/run-local.py`, launches frontend 5173, API 5080 and static 5081 with proof/health checks. Offline asset preparation does not make NASA analysis offline. See [deployment](DEPLOYMENT.md) for platform/security details. Source regeneration is an integrity/startup cost; old planar-stage ~30 s observations are not a measured current spherical startup benchmark.

Validation commands (recorded results below; not rerun by this documentation task):

```sh
npm test --prefix frontend
npm run test:contracts --prefix frontend
npm run build --prefix frontend
python3 -m unittest discover -s scripts -p test_spherical_cap.py
python3 -m unittest discover -s scripts -p test_overview.py
python3 -m unittest discover -s scripts -p test_runtime_assets.py
python3 -m unittest discover -s scripts -p test_data_acquisition.py
python3 -m unittest discover -s scripts -p test_repository_guard.py
LUNAR_REVIEWED_E2E=1 LUNAR_RUN_LIVE_E2E=1 npm run test:e2e --prefix frontend
```

Playwright normally owns its launcher. **Only if deliberately reusing existing user-owned servers**, add `LUNAR_E2E_REUSE_SERVER=1` to that browser command. The recorded local final browser session used reviewed/live opt-ins and existing servers; it is not evidence that user servers were stopped. Do not start duplicate services or stop user-owned ones as a documentation step.

## Actual final local test evidence

These are inspected `.validation/globe-*` logs and current implementation, **not new executions by this documentation task**. The final browser log takes precedence over the earlier `globe-browser.log`.

| Evidence | Recorded result | Interpretation |
| --- | --- | --- |
| `globe-unit.log` | **107 passed / 16 files** | Includes real-cap display-edge geometry assertion, mapping, analysis/UI and contracts. |
| `globe-contract.log` | **6 passed** | Separate contract rerun; also included in the 107, not six extra unique tests. |
| `globe-browser-final.log` | **27 passed**, 2.0 min | Real local API/static/WebGL assets, reviewed/native and live NASA cases plus explicit intercepted fixtures/errors/layout cases; not 27 live scientific requests. |
| `globe-python-cap.log` | **4 passed**, 359.817 s | Physical frame/curvature, real source mapping and deterministic publication/tamper checks. |
| `globe-python-overview.log` | **5 passed**, 295.711 s | Planar overview regression. |
| `globe-python-runtime.log` | **4 passed**, 2.023 s | Runtime asset checks. |
| `globe-python-acquisition.log` | **13 passed**, 8.143 s | Local acquisition transport cases, not publisher checksum certification. |
| `globe-python-guard.log` | **7 passed**, 0.377 s | Tracked-file secret/artifact guard regressions. |
| `globe-build.log` | **Build passed**, 6.43 s | TypeScript + Vite production build; large-chunk warning remains. |

Python total: **4 + 5 + 4 + 13 + 7 = 33 local tests**. Test elapsed times are not rendering or startup benchmarks.

**Actual versus intercepted browser evidence.** The default Globe case fetches the actual GLB and picks A/B on its surface. Reviewed native cases exercise real geometry, live DEM regional profile and Horizons cached Terrain lighting. Globe representation/state round-trip uses an **intercepted synthetic analysis response**, checking preservation and no extra API requests; it is not another live NASA analysis. Missing-GLB/overview and NASA/network-error cases deliberately intercept failures. Post-analysis layout/graph cases use labelled synthetic responses. Globe control containment runs at **390/768/1024/1440 px**; native/overview and other UX checks have their own widths. Software SwiftShader WebGL is functional browser evidence, not hardware GPU benchmarking.

**Measured build artifacts:** main JS **271.79 kB / 85.80 kB gzip**; deferred explorer JS **987.63 kB / 271.27 kB gzip**; main CSS **13.06 / 3.60 kB gzip**, explorer CSS **12.01 / 3.02 kB gzip**, index HTML **0.36 / 0.26 kB gzip** (`globe-build.log`). The >500 kB chunk warning is real. No GPU-memory measurement, FPS benchmark or device performance guarantee exists. **WebGL context-loss/recovery was not actually tested**; do not describe it as passed.

## Pending coordinator gates

- **Final .NET 10 backend rerun passed: 203 tests, zero failed/skipped**, `.validation/globe-backend-live.log`, with actual DEM/mesh/live opt-ins. SDK10 restore and Release build also passed; actual HTTP response schemas passed **12/12**. These are not 203 live NASA requests.
- Current spherical implementation is **uncommitted**; final Git SHA, push and GitHub CI for these changes are pending. Earlier planar-stage pushed checks do not cover this working tree. No commit or push was performed by this docs task.
- Docker runtime/public deployment, external/mobile hardware performance and context-loss recovery are not established here. Human release/merge/submission decisions remain separate.

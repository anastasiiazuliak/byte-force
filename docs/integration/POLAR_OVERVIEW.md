# Source-derived south-pole overview

Current implementation snapshot: 2026-11-15, `.audit/final-integration`. This document supplements, rather than rewrites, historical FINAL/bootstrap/release-stage reports. Implementation `804167d3632ef704dd8f1111dbe7c19655f1e243` is pushed to the existing PR15 and passed **8/8 GitHub checks**: [PR workflow](https://github.com/anastasiiazuliak/byte-force/actions/runs/43710649359) and [push workflow](https://github.com/anastasiiazuliak/byte-force/actions/runs/43710644845). Subsequent documentation-only updates have their own checks; PR remains open. UI attribution and selective integration are documented separately in [POLAR_UI_AUDIT.md](POLAR_UI_AUDIT.md).

## Source, coverage and geometry

The reviewed catalog makes **South Pole Overview** the default explorer view when validated overview metadata is available. It is real, downsampled LOLA relief, not a procedural surface, photograph, curved lunar globe or landing-site assessment. Three exploratory native-resolution patches remain available through explicit selection.

- Source: official `data/raw/LDEM_80S_80MPP_ADJ.TIF`, 189,158,392 bytes; local SHA-256 `82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a`. This is local identity evidence, not a publisher checksum.
- Provenance: [PGDA product 90](https://pgda.gsfc.nasa.gov/products/90), [Barker/NTRS](https://ntrs.nasa.gov/citations/20230014419), and [PDS LOLA label](https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/FLOAT_IMG/LDEM_80S_80M_FLOAT.LBL). Heights are radial distance minus **1,737,400 m**, with reviewed **MOON_ME/DE421** source framing.
- Projection: `+proj=stere +lat_0=-90 +lon_0=0 +R=1737400 +units=m +no_defs`.
- Precise target coverage is the **intersection** of the latitude ≤ 80°S polar circle with the raster's sample-centre square: easting and northing each **[-303960, +303960] m**. The 80°S projected radius is `2 × 1737400 × tan(5°)`; the raster clips the circle near the cardinal directions. The bounding square does not imply populated corners or complete circular coverage.
- TIFF registration is RasterPixelIsArea: 80 m pixels, tiepoint `(-304000, +304000)`. Samples use `column + 0.5`, `row + 0.5`, not pixel corners. The first centre is `(-303960, +303960)` m.
- `data-pipeline/terrain_mesh/build_overview.py` implements `native-pixel-centre-polar-rings-v1`: one central sample plus **100 rings × 400 sectors**, snapped to actual native pixel centres. Boundary samples retreat inward if needed; no extrapolation, interpolated source heights or synthetic fill. Nonfinite/nodata vertices and their incident triangles are omitted. The actual edge is an inscribed coarse triangulation, limited by 400 sectors and 80 m pixels—not the exact analytical boundary.
- Current generated GLB: **40,001 vertices, 79,600 triangles, 2,236,672 bytes** (about 2.2 MB decimal). Normals are computed from the emitted triangles; the proof hashes ordered source column/row and emitted coordinates.

Scene coordinates are **(easting, radial height, -northing)** in metres, with overview origin `(0,0,0)`. This is planar east/up/-north relief: **no globe curvature** is applied to overview geometry. Native patches use their reviewed local origins. Backend geodetic horizon calculations are a separate model and must not be inferred from the planar drawing.

## Detail transitions, camera and picking

`frontend/src/app/siteCatalog.ts` validates the catalog against reviewed API metadata, expected source/projection/datum, bounds, transform and asset paths. `Application.tsx` selects the overview after successful validation. Missing/unreviewed metadata does not acquire approval merely by appearing in a static catalog.

The user manually switches from coarse overview to `connecting-ridge`, `near-shackleton` or `near-de-gerlache`, and back with **South Pole Overview**. Each patch has 15,876 native vertices / 31,250 triangles at 80 m source spacing. This is **manual coarse-to-native patch switching**, not automated continuous adaptive refinement, a global high-resolution tile pyramid, or zoom-triggered streaming. `minZoom=maxZoom=0` and null terrain/surface/hillshade templates are deliberate current metadata.

The camera fits loaded geometry using its bounds and viewport aspect ratio, animates between fits, and adjusts clipping and orbit-distance limits for overview versus patch scale. Reset/Fit and top-down operate on the current terrain; orbit/pan/zoom and keyboard fit controls are available. Pan target is constrained to loaded bounds; reduced-motion preference completes animations immediately. Mobile camera controls wrap into a two-column toolbar; final browser assertions verify that each button stays inside the viewer. The circular overview fit uses its disc radius rather than a square-box diagonal, making the polar region larger without clipping its boundary.

Picking raycasts actual loaded GLB triangles, requires reviewed geographic metadata and a matching asset key, and rejects stale/unverified/out-of-bounds mappings. Drag gestures are not clicks. A/B markers sample the loaded surface; sky and uncovered regions have no terrain to pick. Triangle-interpolated picked heights are coarse visualization values in the overview and can differ from backend bilinear DEM heights. Decimal coordinate display is not subpixel physical accuracy. Picking does not automatically load a native patch at an arbitrary location.

## Sun and scientific limits

After analysis, a matching cached UTC sample supplies topocentric Sun azimuth/elevation at **A**, transformed using the local projection Jacobian. The label is **“Sun at A · approximate map lighting · not visibility”**. Applying that direction across the overview is approximate local lighting, **not global Moon-fixed illumination**. Without a validated local sample, lighting is illustrative. The Moon-fixed ephemeris endpoint remains unavailable (503); changing the timeline selects cached samples, not per-frame NASA requests.

Graphic shadows are not terrain visibility, power, thermal conditions or communications predictions. Global visibility and summaries remain unknown/null, `status=partial`, `quality.terrainApplied=false`; unproved far-field terrain and discretization remain limitations. No real site texture is claimed: the acquired georeferenced NAC does not overlap the three patches.

## Publication, security and startup tradeoff

`scripts/release_assets.py` binds the source identity, native patch proofs, overview, catalog and manifests in `.validation/runtime-assets/.release-review.json`. Publication verifies native patch coordinates and generates `/static/overview/terrain.glb` plus `metadata/overview-map.json` and `static/metadata/explorer-sites.json`.

Runtime validation does **not** trust receipt booleans: it rechecks the source bytes/hash, regenerates the overview from that source in a temporary directory, compares the complete GLB bytes, and checks exact expected proof/metadata/catalog. Published mesh symlinks or paths escaping the runtime directory are rejected. This prevents a changed overview from inheriting approval through edited metadata alone. Current source-derived validation costs roughly **30 seconds at startup**: an integrity-versus-startup-performance tradeoff, not a browser rendering benchmark.

The browser fetches the approximately **2.2 MB overview GLB**, not the 189 MB TIFF. Existing browser observations include **no pageerrors**. No GPU-memory benchmark was performed and no measured FPS or cross-device performance guarantee is claimed. Adaptive DPR and lazy 3D loading are implementation measures, not benchmark results; software WebGL test rendering is not hardware GPU performance evidence.

## Reproduction

Run from `.audit/final-integration`; prerequisites and network/disk implications are in [deployment](DEPLOYMENT.md). Initial acquisition/preparation:

```sh
npm ci --prefix frontend
dotnet restore backend/LunarNavigator.sln
python3 scripts/asset-setup.py --capture-docs --acquire-nac --prepare-runtime --write-launch-env
```

With source data already present, regenerate native candidates and publish the overview offline, or republish from existing candidates, then independently validate:

```sh
python3 scripts/asset-setup.py --offline --prepare-runtime --write-launch-env
python3 scripts/release_assets.py
python3 scripts/release_assets.py --check
npm run build --prefix frontend
python3 -m unittest discover -s scripts -p test_overview.py
npm test --prefix frontend
```

The overview module is called by `release_assets.py`; it is not a standalone CLI. `--check` regenerates geometry and can take substantial time. For a fresh local session, use `python3 scripts/run-local.py`; do not start a duplicate when the user's servers are already running.

For the current browser session, explicitly **reuse the already user-running local API/static/frontend servers at 5080/5081/5173**:

```sh
LUNAR_E2E_REUSE_SERVER=1 LUNAR_REVIEWED_E2E=1 LUNAR_RUN_LIVE_E2E=1 npm run test:e2e --prefix frontend
```

This opts Playwright into reusing the existing server. Those user-owned servers were **not stopped** by this documentation task; this is not a launcher-cleanup test.

## Existing test evidence and pending gates

These are inspected existing logs, not tests rerun by this documentation task:

| Log | Recorded result | Scope / caveat |
| --- | --- | --- |
| `.validation/polar-browser-final.log` | **20 passed** | Local API/static/WebGL, actual Horizons/DEM and explicitly intercepted synthetic/error/layout cases; reused existing servers with `LUNAR_E2E_REUSE_SERVER=1`. Includes mobile toolbar containment and a delayed-catalog race regression. |
| `.validation/polar-backend.log` | **203 passed** | Backend suite; not proof of complete global visibility. |
| `.validation/polar-unit.log` | **78 passed / 12 files** | Frontend unit/contract coverage, not a browser layout benchmark. |
| `.validation/polar-overview-tests.log` | **5 passed**, 202.654 s | Source-derived overview validation tests; elapsed test time is not startup or FPS measurement. |

The separate [UI audit](POLAR_UI_AUDIT.md) records teammate attribution, selective ports and its own validation limits. Earlier FINAL/bootstrap and release reports retain their historical-stage meaning. Implementation push/CI and the post-toolbar browser rerun are completed; merge, release and external deployment remain separate human decisions. Browser testing exposed and fixed a real race: a late default-overview catalog must never override an explicit user patch choice.

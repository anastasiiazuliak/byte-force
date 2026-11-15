# Lunar Navigator

**Explore the Moon. Compare south-polar sites. See what the data can—and cannot—tell you.**

Lunar Navigator combines an interactive lunar globe with real south-polar terrain and a typed NASA/JPL Horizons integration. Choose a location and UTC period, inspect Sun/Earth angles and the sampled regional skyline, and compare two scenarios without confusing attractive rendering with scientific certainty.

## What is available

- React/TypeScript mission dashboard, Three.js / React Three Fiber globe, regional terrain views, site selection, timeline, charts, comparison and export controls.
- Full-globe **visual context**, not full-globe verified terrain. Reviewed geometry comes from the 80 m LOLA source for **80–90°S**, with three native-resolution local patches and derived regional overview/spherical assets.
- ASP.NET Core **.NET 10** API, typed Horizons client, request validation and explicit quality/provenance warnings.
- Finite-range DEM horizon and regional clearance for the identity-checked source and supported epochs. **Global visibility remains unknown**: real-data results are partial, visibility values and global summaries are null. This is not a landing certification, power model or communications link budget.
- Default runtime preparation adds verified **2048 × 2048 RGBA polar cartographic relief**, built from averaged native DEM heights and gradients—not a photograph or geometry displacement. Muted whole-globe SVS imagery supplies context, not verified polar photography.
- Camera-anchored Sun/Earth ornaments are removed. **Before Analyze, no sky bodies are shown.** Globe direction markers require a real, exact cached Analyze sample, verified Globe geometry, JPL provenance and finite observer height. They use airless apparent angles at the shared UTC and optional Site A/B reference; their world directions do not follow the camera. The canonical API supplies no real orbital distances: endpoints at **8R** and symbol radii are display-only, not actual celestial positions, phase or scale. Bodies may be offscreen or occluded; short arrows at the selected site indicate actual bearing. TerrainView uses a compass and cached Sun lighting, not global vector endpoints. None of these visuals establishes scientific visibility.

## Run locally

Install **Node.js 22**, **Python 3.11+** with `venv`/pip support, and a stable **.NET 10 SDK** compatible with [global.json](global.json). Install these runtimes using official installers/package managers; the launcher does not install SDKs. Default texture generation requires **NumPy 2.4.6 and Pillow 12.3.0**, pinned in [requirements-polar.txt](data-pipeline/terrain_mesh/requirements-polar.txt).

From the repository root, create a private Python environment first. **Linux (including Fedora/PEP 668):**

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r data-pipeline/terrain_mesh/requirements-polar.txt
```

Then one command installs locked frontend dependencies, downloads/validates the regional DEM, generates proof-checked runtime assets including polar relief, and launches all three services:

```sh
npm ci --prefix frontend && .venv/bin/python scripts/asset-setup.py --prepare-runtime && .venv/bin/python scripts/run-local.py
```

**Windows Command Prompt:** use the environment's executable directly; activation and PowerShell execution-policy changes are unnecessary.

```bat
py -3 -m venv .venv
.venv\Scripts\python.exe -m pip install -r data-pipeline/terrain_mesh/requirements-polar.txt
npm ci --prefix frontend && .venv\Scripts\python.exe scripts/asset-setup.py --prepare-runtime && .venv\Scripts\python.exe scripts/run-local.py
```

The `&&` chains also work in PowerShell 7. Do not install into Fedora's externally managed system Python or bypass PEP 668 with system pip. First use needs PyPI, npm/NuGet and NASA network access and downloads a 189 MB DEM, not a global lunar raster. Subsequent setup can reuse validated downloads. Raw data and generated assets stay in ignored local directories.

Open **http://127.0.0.1:5173**. The API is at http://127.0.0.1:5080/api/v1/health and the local asset server at http://127.0.0.1:5081. Vite proxies API/static requests. Ports 5173, 5080 and 5081 must be free.

After setup, Windows PowerShell users can also run `.\scripts\run-local.ps1`. This wrapper selects the checkout's `.venv` Python (or local portable Python under `.validation/python`) and optional portable Node under `.validation/node`. It forwards launcher arguments, for example `.\scripts\run-local.ps1 --smoke`.

**Stop:** press Ctrl+C in the launcher terminal; it shuts down its child services. **Quick restart:** `.venv/bin/python scripts/run-local.py` on Linux, or `.venv\Scripts\python.exe scripts/run-local.py` on Windows. It rechecks reviewed runtime assets and independently rebuilds comparison artifacts to verify their identity; it does not download replacement datasets or republish assets. These integrity checks can take a few minutes before the servers start; progress and elapsed time are printed. An occupied port is reported immediately rather than silently starting another instance. Append `--smoke` for a bounded startup check.

**Offline regeneration** with the full DEM already present:

```sh
.venv/bin/python scripts/asset-setup.py --offline --prepare-runtime
.venv/bin/python scripts/run-local.py
```

On Windows replace `.venv/bin/python` with `.venv\Scripts\python.exe`. Offline regeneration requires the texture packages already installed; launching also requires frontend dependencies and .NET restore/build dependencies to be cached. To explicitly omit the optional cartographic visual, add `--no-polar-texture` to `--prepare-runtime`; neutral mesh-normal rendering remains, without changing science semantics. Without the DEM, run the venv Python with `scripts/run-local.py --fallback-assets` for the visibly unverified bundled preview with picking disabled. See [asset acquisition](docs/science/ASSET_ACQUISITION.md) for relief identity and provenance.

## Documentation

- [Challenge workflow, readiness and validation](docs/CHALLENGE_READINESS.md)
- [Architecture and implemented scope](docs/ARCHITECTURE.md)
- [Development, verification and deployment boundaries](docs/DEVELOPMENT.md)
- [Data, attribution and scientific limits](docs/DATA_AND_SCIENCE.md)
- [Coordinates and scene transforms](docs/COORDINATES_AND_TILES.md)
- [Horizons client](docs/horizons.md)
- [API conventions](docs/API_CONTRACT.md), [canonical OpenAPI](contracts/openapi.yaml), [shared types](contracts/api-types.ts) and [scene contracts](contracts/scene/)

## License and attribution

Repository code is covered by [LICENSE](LICENSE). NASA/JPL, LOLA/PGDA, Barker et al. and LROC source acknowledgements and scientific provenance are retained in [data and science](docs/DATA_AND_SCIENCE.md). Source data and imagery have their own terms; the code license does not replace them. Git history remains the record of contributions.

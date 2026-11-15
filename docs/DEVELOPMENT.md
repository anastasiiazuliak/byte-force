# Development

Use Node.js 22, Python 3.11+ and stable .NET 10. Run the [README quick start](../README.md#run-locally) from the repository root. Create the `.venv` and install [pinned polar requirements](../data-pipeline/terrain_mesh/requirements-polar.txt) as shown there: default `--prepare-runtime` needs NumPy 2.4.6 and Pillow 12.3.0. Use `.venv/bin/python` on Linux or `.venv\Scripts\python.exe` on Windows for asset tools and the launcher; do not use system pip on PEP 668-managed distributions. Asset setup downloads source data and regenerates local runtime assets, including the default DEM cartographic relief; the launcher only validates/selects existing assets and starts services. No API key is required for Horizons, but live requests send the requested site/time to NASA and are subject to service availability and usage guidance.

## Frontend

Run from `frontend/`:

```sh
npm ci
npm run build
npm test
npm run test:contracts
```

The build includes TypeScript checking. `npm test` runs frontend source tests; `test:contracts` targets OpenAPI, fixture schemas and DTO compatibility, not live NASA verification.

## Backend and actual HTTP contracts

Run from `backend/`:

```sh
dotnet restore LunarNavigator.sln
dotnet build LunarNavigator.sln --configuration Release --no-restore
dotnet test LunarNavigator.sln --configuration Release --no-build
npm ci --prefix tests/LunarNavigator.Api.Tests/Contracts
npm --prefix tests/LunarNavigator.Api.Tests/Contracts test -- ../bin/Release/net10.0/ContractResponses
```

The final command validates payloads written by backend tests, so run the .NET tests first. NuGet/npm access is needed on first restore. Real-DEM tests may require separately acquired local source assets; synthetic/unit fixtures do not establish physical ground truth.

## Repository and asset regression checks

Run from the repository root:

```sh
.venv/bin/python scripts/check-repository.py
.venv/bin/python scripts/test_repository_guard.py
.venv/bin/python scripts/test_data_acquisition.py
.venv/bin/python scripts/test_runtime_assets.py
.venv/bin/python scripts/test_overview.py
.venv/bin/python scripts/test_spherical_cap.py
git --no-pager diff --check
```

On Windows replace `.venv/bin/python` with `.venv\Scripts\python.exe`.

The [polar texture tests](../data-pipeline/terrain_mesh/test_polar_texture.py) use standard-library **unittest**, with the same pinned NumPy/Pillow environment as the texture builder. No pytest installation is required:

```sh
.venv/bin/python data-pipeline/terrain_mesh/test_polar_texture.py
```

This documents how to run the check, not a new pass claim or CI coverage claim. `--no-polar-texture` explicitly skips the optional runtime visual; running the texture tests still requires their NumPy/Pillow dependencies.

These cover tracked-file security/size policy, safe acquisition and runtime geometry/proof behavior. They do not certify NASA availability, global skyline completeness or landing suitability.

## Browser tests

Run from `frontend/` after installing frontend dependencies:

```sh
npx playwright install --with-deps chromium
npm run test:e2e
```

Browser tests use a real local API and explicitly intercepted science fixtures, not live NASA measurements. The Playwright browser installation may require Linux system packages and administrative permission. Test configuration controls service startup; avoid conflicting launcher instances on the same ports.

## CI and status

[CI](../.github/workflows/ci.yml) runs frontend build/unit/contracts, backend build/tests/HTTP-schema validation, repository/Python regressions and browser tests as separate jobs. Refer to the current run for results: test counts and pass/fail status are intentionally not frozen in documentation.

## Deployment boundaries

[Dockerfile](../Dockerfile), [compose.yaml](../compose.yaml) and [infra](../infra/) provide deployment configuration, not evidence of an externally tested deployment. A deployment must provision and validate the exact source/runtime assets, preserve proof-bound transforms and URLs, configure API/static routing, and check the deployed payloads. Do not publish raw DEMs, local receipts, secrets or development servers as a production service by accident. Review source terms before redistribution.

Treat approved DEMs as immutable; replace atomically and restart the reader process after a change. Alternate/repacked files are not automatically scientifically approved even if they have a familiar name.

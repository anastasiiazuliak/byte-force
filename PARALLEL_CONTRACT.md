# PARALLEL CONTRACT v2 — frozen starting point

**Status:** team-proposed implementation contract, not verified NASA measurements. **Rule:** all five agents read this BEFORE editing code. This file is authoritative for *field names and inter-module interfaces* during the first parallel round. `TEAM_SPEC.md` remains the source for product requirements; where earlier illustrative JSON differs, the present v2 schema wins. Do not silently change these files in independent branches.

## What is pre-decided (so nobody waits for person #5)

- REST base `/api/v1`; JSON uses camelCase; timestamps in ISO-8601 UTC with `Z`; latitude `[-90,-80]` degrees; longitude normalized to `[-180,180]`; azimuth `[0,360)` degrees; height in **meters** relative to the actual DEM's stated vertical reference; intervals `[startUtc,endUtc)`; comparison deltas `B - A`.
- `GET /health`, `/config`, `/landing-sites`, `/map/metadata`; `POST /analyze`, `/compare`, optional `/ephemeris`.
- Static: `/terrain/{z}/{x}/{y}.glb`, `/tiles/{layer}/{z}/{x}/{y}.webp`; fallback single demo mesh via map metadata.
- `visible` must be `null` if terrain visibility is indeterminate; don't claim illuminated/communicating status for unknown input. `quality.terrainApplied=false` must never be presented as reliable terrain-based visibility.
- `sun/elevationDeg` and `earth/elevationDeg` are **astronomical altitudes**; `horizonDeg` is terrain horizon; `clearanceDeg` is their difference; view uses no terrestrial refraction. Graphic shadows are illustrative; backend performs science.
- API JSON schemas: `contracts/openapi.yaml`; canonical example `contracts/fixtures/analyze-partial.json`.
- Shared frontend types: `contracts/api-types.ts` (copy/re-export from the app, don't redefine). Scene/types: `contracts/scene/scene-types.ts` and `contracts/scene/TRANSFORM.md`.

## What is NOT faked

The exact Moon DEM's CRS, vertical datum, projected bounds, precise longitude conventions and verified scene transform require inspecting actual dataset metadata; these are **runtime metadata**, not magic constants supplied here. The data lane publishes validated values in `/map/metadata`. The 3D lane reads it dynamically and uses a demo-only local plane/mesh until valid tiles arrive. The science lane refuses verified terrain visibility when datum alignment isn't checked. No arbitrary fake Sun direction in production.

## Non-overlap ownership for simultaneous agents

| Lane | Owner of writable directories | Forbidden edits in first parallel round |
|---|---|---|
| #1 3D | `frontend/src/features/explorer/**`, `docs/3d/**` | frontend app shell, API types, backend, contracts |
| #2 UI | `frontend/src/features/{scenario-form,analysis,timeline,compare,methodology,export}/**`, `frontend/src/components/**`, `frontend/src/styles/**`, `frontend/src/app/**` | 3D internals, API types, backend, contracts |
| #3 Backend | `backend/LunarNavigator.Api/**`, `backend/LunarNavigator.Core/{Ephemeris,Analysis,Comparison,Map}/**`, tests in `backend/tests/LunarNavigator.Api.Tests/**` | Terrain/Horizon internals, contracts, frontend |
| #4 Data | `data-pipeline/**`, `public-assets/**`, `backend/LunarNavigator.Core/{Terrain,Horizon}/**`, `backend/tests/LunarNavigator.Core.Tests/Terrain/**`, `docs/science/**` | API controller/Program.cs, frontend, contracts |
| #5 Integrator | `frontend/src/api/**`, `frontend/src/mocks/**`, `frontend/src/integration/**`, `frontend/e2e/**`, `infra/**`, `.github/**`, `scripts/**`, `docs/integration/**` | FEUI app shell, 3D internals, backend services, frozen contracts |

Each lane starts in its own **git worktree/branch** from the same scaffold commit. No common working directory and no simultaneous edits to the same files. A branch may include *interface adapters/stubs in its owned zone*, but must not modify frozen shared contracts in its first wave. Put proposed contract corrections in `docs/<lane>/contract-change-request.md`, then merge only after review.

## Compilers and import boundaries

- #1 exposes `LunarTerrainViewer` and typed scene commands/events matching `scene-types.ts`, without importing #2's components. Show fallback until tile manifest exists.
- #2 renders UI using `api-types.ts` and a `LunarApiClient` facade; may use fixtures via mock client; it does **not** depend on real backend/3D code to render.
- #3 depends on `ITerrainHeightProvider` and `IHorizonProfileProvider` interfaces in `backend/LunarNavigator.Core/Analysis` (or equivalent own-owned C# files); default adapters report unavailable/partial when data lane not connected. Never return fabricated P0 physical measurements.
- #4 exposes Terrain/Horizon provider implementations in its own namespace and writes terrain-asset manifest JSON. No modification to #3 Program.cs; #3/#5 wires providers at final merge.
- #5 owns client facade/mocks/CI/integration tests and a separate demo harness; the actual app composition is one **short final integration step** after branches merge, not a start blocker.

## Parallel vs complete

All five **start coding now**. Within each lane its subtasks may have an internal order. A live end-to-end result, production deploy and final scientific validation inherently require merging the lanes, so those are deliberately the *end* stage. `HUM-*` actions needing account access, data use review, secrets or NASA submission remain human-owned.

## Current repository startup (interface schema unchanged)

Lane implementation starts only after the architecture PR merges into `main`, from one agreed full `origin/main` SHA. See [current start](START_ALL_5.md) and [team workflow](docs/integration/team-workflow.md). Existing Horizons and merged HUM-02 are preserved contributions, not work to recreate.

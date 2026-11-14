# Людина №3 — BE-01 → BE-02 → BE-06 → BE-03 → BE-04 → BE-05

Дата перевірки: 2026-11-14. Гілка: `codex/lane-3-backend`.
Це звіт про реалізований код і фактичні перевірки, а не твердження про готовність непідключених наукових даних.

| Порядок / task | Реалізована частина | Залишок фінальної інтеграції |
|---|---|---|
| 1 · BE-01 | health/config/catalog; frozen error codes; UTC converter; configured CORS GET/POST; limits; cancellation/deadline; catalog validation | Незалежний review |
| 2 · BE-02 | IEphemerisService поверх незміненого Horizons client; series, exact-key bounded cache, retry/backoff, timeout/cancellation, angle normalization; live smoke | Наукові crosschecks із DATA-05; performance/batching великих cold periods |
| 3 · BE-06 | GET metadata, versioned local manifest adapter, validation of Moon CRS/frame/transform/bounds, local deployment asset checks, base-URL restrictions | DATA-03 production manifest/GLB і review handoff envelope; зараз чесний 503 |
| 4 · BE-03 | POST analyze, verified datum adapter boundary, cyclic horizon interpolation, visibility, linear crossings, intervals, summaries, partial/null, bounded horizon cache, optional DATA-01 adapter | DATA-02 actual horizon, reviewed dataset frame/datum alignment; без них production partial |
| 5 · BE-04 | POST compare, complete A/B responses, deterministic A/B order, B−A, identical-request reuse, different-duration warnings, controlled failure/null | Реальні terrain-driven comparisons після DATA-02; бізнес-логіка протестована на synthetic test providers |
| 6 · BE-05 | POST ephemeris, typed independently-verified provider boundary, exact timeline checks, safe vector normalization, frame gates and tests | Actual validated MOON_ME provider/control vectors + DATA/FE3D scene mapping; default 503, feature=false |

## Що змінено

- `Api/Controllers/`: analysis, comparison, ephemeris, map routes.
- `Api/Foundation/`, `Contracts/ErrorDetail.cs`, `Program.cs`, `appsettings.json`: frozen-compatible errors,
  UTC Z, fixed two-scenario contract, settings, feature flags, composition and request deadlines.
- `Api/Infrastructure/Horizons/`: retry/cache/HTTP wrapper around the existing client.
- `Api/Infrastructure/Map/`: local manifest adapter, without generating or serving terrain assets.
- `Api/Infrastructure/Terrain/`: optional wrapper for existing DATA-01; no unreviewed datum-alignment claim or internal-path leaks.
- `Core/{Ephemeris,Analysis,Comparison,Map}/`: DTOs, interfaces and services.
- `tests/LunarNavigator.Api.Tests/`: validation, calculation, parser-adapter/cache/retry, endpoint, manifest, comparison,
  timeout, Moon-fixed gating and actual HTTP-payload schema tests.
- API README, this handoff and integration proposals.

Frozen `contracts/**`, frontend, Horizons scientific client, Models, Terrain/Horizon implementations,
data acquisition and pipeline were not changed. Default providers never create fake NASA observations.
Production does not contain the synthetic scientific providers used by the tests.

## Фактично виконані перевірки

1. Debug build: successful, zero warnings/errors.

   ```sh
   dotnet build backend/LunarNavigator.sln --no-restore --disable-build-servers -m:1 -p:MSBuildEnableWorkloadResolver=false -p:UseSharedCompilation=false
   ```

2. Normal VSTest/xUnit Debug suite: **106 passed, 0 failed, 1 opt-in live test skipped**.
   Api.Tests=74 passed+1 skipped; Core.Tests=8; Horizons.Tests=19; Models.Tests=5.
   The sandbox blocks testhost IPC; the successful normal run used approved execution outside the sandbox.

   ```sh
   dotnet test backend/LunarNavigator.sln --no-build --no-restore -m:1 --logger "console;verbosity=minimal"
   ```

3. Separately opted-in live Horizons smoke: **1 passed**, two actual UTC instants, Sun+Earth (four NASA calls).
   PowerShell setup: `$env:LUNAR_RUN_LIVE_HORIZONS = '1'`; remove the variable after the run.

   ```sh
   dotnet test backend/tests/LunarNavigator.Api.Tests/LunarNavigator.Api.Tests.csproj --no-build --no-restore --filter FullyQualifiedName~LiveHorizonsTests
   ```

4. **12/12 actual HTTP response payloads passed Ajv 2020 validation against unchanged frozen OpenAPI 3.1**.
   Covers foundation, complete/partial analysis, comparison, metadata, vector response and typed errors.
   Scientific payloads in these contract tests are explicitly labelled SYNTHETIC TEST ONLY.
   Reproduction: [Contracts README](../../tests/LunarNavigator.Api.Tests/Contracts/README.md).

5. Actual local production API, launched temporarily at localhost:5097, checked through `curl.exe`:
   health/config/landing-sites → **200**, missing map manifest → **503**, actual Horizons-backed analyze → **200 partial**,
   two samples, terrainApplied=false, visible=null. Temporary server was stopped.

6. `git diff --check`: passed. No live NASA dependency in the normal offline suite.

Release validation completed successfully as required by the lane instructions:

```sh
dotnet build backend/LunarNavigator.sln --configuration Release --no-restore --disable-build-servers -m:1 -p:MSBuildEnableWorkloadResolver=false -p:UseSharedCompilation=false
dotnet test backend/LunarNavigator.sln --configuration Release --no-build --no-restore -m:1 --logger "console;verbosity=minimal"
```

Release build: **0 warnings, 0 errors**. Release tests: **106 passed, 0 failed, 1 opt-in live test skipped**.
Release exported HTTP payloads: **12/12 passed** frozen OpenAPI schema validation.

## Live observation evidence, not DEM/visibility ground truth

Observer: latitude −89°, east longitude 25°, altitude **0 km above the Horizons 1737.4 km reference sphere**.
This is the explicitly warned geometric approximation, not a measured DEM elevation.

| UTC | Sun azimuth ° | Sun elevation ° | Earth azimuth ° | Earth elevation ° |
|---|---:|---:|---:|---:|
| 2026-11-14T00:00:00Z | 101.642372961 | 1.355010881 | 333.803184381 | −3.751378178 |
| 2026-11-14T01:00:00Z | 101.134625584 | 1.363710763 | 333.745227325 | −3.709630431 |

These are observed API outputs from the live smoke, not independent scientific control vectors.
Horizons uses `OBSERVER`, `coord@301`, Sun=10/Earth=399, quantity 4, airless apparent target centers.
Sources: [NASA/JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html),
[Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html).

## Межі готовності

- There are no verified DEM/GLB/manifest files in this checkout; DATA-01 reader source exists, but its default metadata
  is not sufficient frame/datum evidence. `Terrain__DemPath` is opt-in; the wrapper exposes available heights with
  DatumAlignmentVerified=false until reviewed integration replaces the gate.
- DATA-02 horizon implementation is absent. Unit tests exercise real analysis logic with test-only terrain profiles,
  including 0/100% visibility, exact-zero clearance, north-wrap, partial data, interval intersections and invalid horizons.
- Missing/unverified map data produces a typed error, never a made-up CRS or URL. Manifest producer format requires DATA review.
- No local ENU angle is advertised as a global Moon-fixed vector. BE-05 successful production vectors require independent
  frame/rotation verification and control data; normalization alone is not such verification.
- Sampling includes the terminal boundary; intervals integrate linearly interpolated clearance. Coarse steps and terrain
  resolution limit accuracy. This is not a continuous-geometry event solver or a guarantee of power/radio performance.
- Profiles have a 60s bounded cache because the frozen interface has no data revision token. No cross-request full-analysis cache.
- Comparison uses existing periods/percentages and warnings for unequal durations; no frozen fields added.

Detailed impacted-owner proposals: [contract-change-request.md](contract-change-request.md).
No commit, push, merge, deploy, GitHub issue assignment or external messages were performed.

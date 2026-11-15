# Lunar Navigator API

ASP.NET Core / .NET 10 application with base path `/api/v1`, camelCase JSON and UTC timestamps. [Canonical OpenAPI](../../contracts/openapi.yaml) defines request/response schemas; [API conventions](../../docs/API_CONTRACT.md) explains units and uncertainty.

| Route | Behavior |
|---|---|
| `GET /health` | HTTP liveness/version, not a NASA/DEM readiness check |
| `GET /config` | Configured limits and capabilities |
| `GET /landing-sites` | Validated local catalog; explicit demo labels are not scientific site approval |
| `GET /map/metadata` | Validated deployment metadata; unavailable assets/manifest produce an error |
| `POST /analyze` | Horizons Sun/Earth angles plus eligible regional DEM horizon/clearance |
| `POST /compare` | Scenario A/B analyses and differences B − A, preserving unknown values |
| `POST /ephemeris` | Verified Moon-fixed provider required; unavailable by default |

## Run

Use the [root launcher](../../README.md#run-locally) for prepared data, static serving and frontend proxies. API-only development from the repository root:

```sh
dotnet run --project backend/LunarNavigator.Api --no-launch-profile --urls http://127.0.0.1:5080
```

Health/config/catalog do not require live NASA access. Analyze/compare use the typed Horizons client and may need network access; no API key is required. Map metadata depends on deployment assets. No endpoint fabricates measurements to replace unavailable capabilities.

## Configuration

`appsettings.json` provides defaults; environment overrides use double underscores. Relative API paths resolve against the API content root, not an arbitrary shell directory.

- `Api__MinStepMinutes`, `Api__MaxStepMinutes`, `Api__MaxSamples`: sampling limits. Requests validate finite supported lunar coordinates, UTC, increasing periods and sample budgets. The terminal end sample is included, while reported time intervals describe `[start,end)`.
- `Api__RequestTimeoutSeconds`: request deadline; caller cancellation is preserved.
- `Api__AllowedOrigins__0` and subsequent entries: exact CORS origins, no credentials. Defaults are empty; prefer the local frontend proxy for normal development.
- `Api__CatalogPath`: local catalog JSON. Invalid/missing data produces a structured error rather than an invented catalog.
- `Ephemeris__HttpTimeoutSeconds`, `MaxAttempts`, `RetryDelayMilliseconds`, `CacheSeconds`: bounded upstream behavior. Failed responses are not successful cached observations; a long cold analysis can exceed its deadline.
- `Terrain__DemPath`: source DEM path. The source factory also supports existing environment/default lookup. The launcher supplies the reviewed deployment source path; setting a path manually does not approve its contents.
- `MapManifest__ManifestPath`, `AssetRootPath`, `AssetBaseUrl`: deployment manifest, local asset root and optional external HTTPS base. The API returns metadata; the static server serves asset bytes.
- `MapManifest__MetadataReviewConfirmed`: deployment attestation, not a DEM approval override. Do not enable merely to suppress missing/unreviewed asset errors. The local launcher verifies bound runtime proofs before enabling reviewed map configuration.

Treat the reviewed source as immutable. Replace atomically and restart readers after source/deployment changes; do not reuse cached data or receipts as approval for different bytes.

## Interpretation and failure behavior

Horizons quantity 4 provides airless apparent disc-center angles, not terrain visibility. The known DEM's identity/geotags and radial datum must pass checks; reviewed applicability is 1962-01-01 ≤ UTC < 2650-01-01, with conservative unknown handling at the upper boundary and exact pole.

Valid complete **regional sampled** profiles can expose horizon points, `horizonDeg` and `clearanceDeg`. Finite range and discretization do not certify the full skyline: production real-source `visible` values and global summaries remain **null**, results remain partial and `quality.terrainApplied=false`. That quality flag does not mean no DEM samples were used. Unsupported, clipped, NoData or timed-out profiles cannot supply trusted interpolated clearance.

Do not interpret synthetic trusted-provider tests that exercise complete results as approval for real-source global visibility. Graphic shadows, cartographic relief and local cached solar lighting are display features, not power, thermal, landing or communications certification.

See [scientific reference](../../docs/science/TERRAIN_SCIENCE_REVIEW.md) for source identities and model policy, [asset acquisition](../../docs/science/ASSET_ACQUISITION.md) for preparation, and [HTTP response schema checks](../tests/LunarNavigator.Api.Tests/Contracts/README.md) for offline contract regression commands.

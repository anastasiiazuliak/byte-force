# Lunar Navigator backend

The .NET 10 solution is `backend/LunarNavigator.sln`. Root and backend `global.json` select stable 10.0.100 with `latestFeature` roll-forward; all projects target `net10.0`.

| Project | Responsibility |
|---|---|
| `LunarNavigator.Api` | HTTP endpoints, validation, configuration and provider composition |
| `LunarNavigator.Core` | Analysis, comparison, coordinates, terrain and regional horizon services |
| `LunarNavigator.Horizons` | Typed NASA/JPL Horizons requests and response parsing |
| `LunarNavigator.Models` | Shared observer/observation models |
| `tests/` | API, Core, Horizons and Models regression suites |
| `samples/LunarNavigator.Horizons.Sample` | Deliberate live NASA query |

## Build and test

From the repository root:

```sh
dotnet restore backend/LunarNavigator.sln
dotnet build backend/LunarNavigator.sln --configuration Release --no-restore
dotnet test backend/LunarNavigator.sln --configuration Release --no-build
```

For the complete local application, use the [root setup and launcher](../README.md#run-locally), which prepares proof-bound data and configures API/static paths. For API-only development:

```sh
dotnet run --project backend/LunarNavigator.Api --no-launch-profile --urls http://127.0.0.1:5080
```

API-only startup does not provision static assets or approve arbitrary terrain. Health checks server liveness, not NASA availability or scientific readiness. Analyze/compare use Horizons; requests need upstream network access unless served by a cache or a test substitute.

## Scientific boundary

The configured terrain adapter recognizes only the exact reviewed DEM identity/geotags and supported epoch range. Valid samples may supply regional horizon and clearance; real-source global visibility and summaries remain unknown and results partial. Missing, unreviewed or unsupported terrain does not become synthetic science.

The optional Moon-fixed endpoint requires a verified provider; the default provider is unavailable. Local solar-angle display lighting is not proof that this global-vector capability exists.

- [API operations and configuration](LunarNavigator.Api/README.md)
- [API conventions](../docs/API_CONTRACT.md) and [canonical OpenAPI](../contracts/openapi.yaml)
- [Development and HTTP-schema validation](../docs/DEVELOPMENT.md)
- [Horizons client and live sample](../docs/horizons.md)
- [Scientific source and quality policy](../docs/DATA_AND_SCIENCE.md)

Unit/contract fixtures do not certify physical accuracy. Current results belong to the current test run; this guide does not freeze test counts or claim an externally validated deployment.

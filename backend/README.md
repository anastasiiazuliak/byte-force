# Backend scaffold (.NET 8)

From this directory:

```sh
dotnet restore LunarNavigator.sln
dotnet build LunarNavigator.sln --no-restore
dotnet test LunarNavigator.sln --no-build
dotnet run --project LunarNavigator.Api --urls http://localhost:5080
```

From the repository root, `./scripts/dev.sh` starts the API. `GET http://localhost:5080/api/v1/health` returns liveness JSON; it does not certify scientific provider readiness. No analysis, comparison, ephemeris, or map business logic is implemented.

## Lane 4 provider handoff

Implement `LunarNavigator.Core.Analysis.ITerrainHeightProvider.GetHeightAsync` and `IHorizonProfileProvider.GetProfileAsync` in the lane-owned `Terrain/` and `Horizon/` directories. Both take `TerrainLocation` (latitude/longitude degrees) and a cancellation token. Signatures and result records are in `LunarNavigator.Core/Analysis/TerrainProviders.cs`; these are internal C# boundaries, not changes to frozen HTTP contracts.

Height results carry nullable meters, source, vertical reference, resolution, datum verification, and warnings. Horizon results carry azimuth/elevation points in degrees, `TerrainApplied`, source, resolution, and warnings. Unknown heights must remain null; unavailable horizons must not become a fabricated flat horizon. Default providers return null/empty data, false verification/application flags, and explicit warnings. No visibility determination occurs here. Dataset metadata and alignment must be verified before providers report reliable terrain application. Final integration replaces DI defaults in Program.cs with real implementations; data lane need not edit the entry point.

`LunarNavigator.Tests/Api/` is API-owned; `LunarNavigator.Tests/Terrain/` is data-owned. Both compile under one xUnit project. Coordinate shared project dependency changes rather than editing it concurrently.

CI also requires the parent-owned frontend lockfile and `build`, `test`, and `test:contracts` npm scripts; backend scaffolding does not create these.

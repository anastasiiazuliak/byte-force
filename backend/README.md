# Backend scaffold (.NET 8)

From this directory:

```sh
dotnet restore LunarNavigator.sln
dotnet build LunarNavigator.sln --no-restore
dotnet test LunarNavigator.sln --no-build
dotnet run --project LunarNavigator.Api --urls http://localhost:5080
```

From the repository root:

```sh
dotnet restore backend/LunarNavigator.sln
dotnet build backend/LunarNavigator.sln --no-restore
dotnet test backend/LunarNavigator.sln --no-build --no-restore
dotnet run --project backend/LunarNavigator.Api --urls http://localhost:5080
```

`backend/LunarNavigator.sln` is the canonical solution; the former root `ByteForce.slnx` has been removed. Root `global.json` and `backend/global.json` select stable .NET 8 SDKs with the same `8.0.100` / `latestFeature` policy.

`GET http://localhost:5080/api/v1/health` returns liveness JSON; it does not certify scientific provider readiness. No analysis, comparison, ephemeris, or map business logic is implemented.

## Preserved Horizons projects

- `backend/ByteForce.Horizons/`: standalone Horizons HTTP client, not wired into the API.
- `backend/ByteForce.Horizons.Tests/`: existing offline protocol and parser tests.
- `backend/samples/Horizons.Sample/`: standalone live NASA sample.

All three projects target `net8.0` and are included alongside the API, Core, and scaffold tests in the canonical solution. Existing Horizons C# source files are preserved byte-for-byte; only project metadata and references changed.

Run the offline client tests or live sample from the repository root:

```sh
dotnet test backend/ByteForce.Horizons.Tests --no-build --no-restore
dotnet run --project backend/samples/Horizons.Sample
```

Only the sample contacts NASA. It requires network access and is not part of offline tests. The API does not register or invoke `IHorizonsClient`; default terrain/horizon providers remain explicitly unavailable. No scientific service implementation was added.

Existing scientific caveats remain in [docs/horizons.md](../docs/horizons.md). That parent-owned document is unchanged and its legacy paths/framework/solution commands await the parent documentation update; use the paths and .NET 8 commands above.

## Lane 4 provider handoff

Implement `LunarNavigator.Core.Analysis.ITerrainHeightProvider.GetHeightAsync` and `IHorizonProfileProvider.GetProfileAsync` in the lane-owned `Terrain/` and `Horizon/` directories. Both take `TerrainLocation` (latitude/longitude degrees) and a cancellation token. Signatures and result records are in `LunarNavigator.Core/Analysis/TerrainProviders.cs`; these are internal C# boundaries, not changes to frozen HTTP contracts.

Height results carry nullable meters, source, vertical reference, resolution, datum verification, and warnings. Horizon results carry azimuth/elevation points in degrees, `TerrainApplied`, source, resolution, and warnings. Unknown heights must remain null; unavailable horizons must not become a fabricated flat horizon. Default providers return null/empty data, false verification/application flags, and explicit warnings. No visibility determination occurs here. Dataset metadata and alignment must be verified before providers report reliable terrain application. Final integration replaces DI defaults in Program.cs with real implementations; data lane need not edit the entry point.

`LunarNavigator.Tests/Api/` is API-owned; `LunarNavigator.Tests/Terrain/` is data-owned. Both compile under one xUnit project. Coordinate shared project dependency changes rather than editing it concurrently.

CI also requires the parent-owned frontend lockfile and `build`, `test`, and `test:contracts` npm scripts; backend scaffolding does not create these.

# Data Lane 4 Tests (Terrain & LOLA DEM)

Lane 4 owns tests in this directory. Target framework: **.NET 8 (`net8.0`)**.

## Test Suites

* **`LunarProjectionTests.cs`**:
  * South Polar Stereographic projection forward and inverse transformations.
  * Exact handling of the South Pole singularity ($-90.0^\circ$).
  * Round-trip validation for NASA Artemis candidate landing sites (Connecting Ridge, Shackleton, Malapert, Faustini, Haworth, Amundsen).
  * Longitude normalization and wrap-around ($[-180, 180]$, $[0, 360]$).
  * Mapping elevation in meters to kilometers for JPL Horizons ephemeris `SITE_COORD` (`heightKm = elevationM / 1000.0`).

* **`LolaTiffReaderTests.cs`**:
  * Low-level BigTIFF / Cloud-Optimized GeoTIFF reader parsing and random-access reads.
  * Predictor 3 (horizontal floating-point differencing) decoding.
  * In-memory LRU tile caching.
  * Thread-safety during concurrent multi-threaded reads.
  * Resource cleanup on `Dispose()`.

* **`LolaTerrainServiceTests.cs`**:
  * Graceful handling when the primary 180 MB NASA DEM is not downloaded (returns typed result with clear diagnostic warnings; does not crash `/health` or throw unhandled exceptions).
  * Out-of-bounds latitude validation (beyond $[-90^\circ, -80^\circ]$).
  * Elevation extraction and window analysis (`GetWindowAsync`).
  * Dependency-injection-free factory instantiation (`TerrainFactory`).

## Running Tests

```powershell
dotnet test backend/LunarNavigator.Tests/LunarNavigator.Tests.csproj --filter "FullyQualifiedName~Terrain"
```

# Terrain and horizon regression tests

These tests belong to the .NET 10 `LunarNavigator.Core.Tests` project and cover raster decoding, coordinate/datum handling, bilinear sampling, spherical/geodesic horizon construction, NoData and partial-result behavior. Coordinate controls also live in the project's `Coordinates/` directory. API middleware and provider registration are tested separately in `LunarNavigator.Api.Tests`.

From the repository root:

```sh
dotnet test backend/tests/LunarNavigator.Core.Tests
```

Synthetic fixtures isolate mathematical and error-handling behavior; they do not certify physical accuracy. Real DEM/native mesh checks require the exact source/assets and explicit test inputs described in the [scientific reference](../../../../docs/science/TERRAIN_SCIENCE_REVIEW.md#reproducible-scientific-controls). Native vertex consistency is not an independent measurement or global skyline guarantee.

See [data setup](../../../../data/README.md) and [development](../../../../docs/DEVELOPMENT.md) for prerequisites and broader checks. Current results determine pass/skip status.

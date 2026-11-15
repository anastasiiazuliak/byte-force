# NASA/JPL Horizons client

`backend/LunarNavigator.Horizons` is a typed .NET 10 library using `HttpClient` and shared `LunarObserver` / `LunarObservation` models. No API key or third-party runtime package is required. Reuse the HTTP client; the library does not dispose an injected client.

## Inputs and outputs

- Latitude: −90…+90°; longitude east-positive in −180…180° or 0…360°.
- Observer altitude: **kilometres above the 1737.4 km reference sphere**, not metres and not height above local terrain. The reviewed terrain adapter supplies the appropriate height separately.
- UTC instants from 1962, millisecond precision; finer precision is rejected rather than silently rounded. NASA coverage also limits availability.
- Azimuth: north 0°, east 90°, south 180°, west 270°. Negative elevations are preserved.

Each observation issues sequential Sun (`COMMAND=10`) and Earth (`COMMAND=399`) requests to `coord@301`, with `COORD_TYPE=GEODETIC` and `SITE_COORD=longitude,latitude,altitude`. `QUANTITIES=4`, `APPARENT=AIRLESS` and `ELEV_CUT=-90` request apparent center angles without atmospheric refraction or a below-horizon cutoff.

The client validates the JSON wrapper, supported API version (1.2/1.3), CSV columns, UTC and angle ranges between the response markers. No partial observation is returned if either target fails. `HorizonsException` denotes API/format failures; HTTP errors, cancellation and timeouts use normal .NET exceptions. Requests are serialized within a process; multi-process deployments need separate rate coordination.

## Scientific boundary

Airless apparent directions include light-time and other astronomical corrections. They are not uncorrected instantaneous vectors and do not include terrain obstruction. A positive elevation is not proof of local visibility. Lunar mean-Earth orientation and the exact DEM radial-height definition must agree before terrain clearance is meaningful; see [data and science](DATA_AND_SCIENCE.md).

## Commands

From the repository root:

```sh
dotnet build backend/LunarNavigator.sln
dotnet test backend/LunarNavigator.sln
```

Unit tests use substituted HTTP responses. To deliberately make live requests to NASA:

```sh
dotnet run --project backend/samples/LunarNavigator.Horizons.Sample
```

Live calls require network access and send site/time parameters to NASA. They are not part of an offline test guarantee.

References: [Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html), [observer coordinates and quantity definitions](https://ssd.jpl.nasa.gov/horizons/manual.html).

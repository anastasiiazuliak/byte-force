# API and interoperability conventions

The canonical schemas are [OpenAPI](../contracts/openapi.yaml), [TypeScript DTOs](../contracts/api-types.ts), and [scene interfaces](../contracts/scene/scene-types.ts). Keep consumers compatible with these definitions; do not introduce competing DTO copies.

## HTTP interface

API prefix: `/api/v1`.

- `GET /health`
- `GET /config`
- `GET /landing-sites`
- `GET /map/metadata`
- `POST /analyze`
- `POST /compare`
- `POST /ephemeris` — capability-dependent; an unavailable response is not a successful scientific result.

Static terrain and map resources are addressed through map metadata. Legacy routes include `/terrain/{z}/{x}/{y}.glb` and `/tiles/{layer}/{z}/{x}/{y}.webp`. Local generated resources also use `/static/`.

## Values and units

- JSON property names use camelCase.
- Times use ISO 8601 UTC with `Z`; intervals are half-open: `[startUtc, endUtc)`.
- Lunar latitude is in degrees, restricted to `[-90, -80]` for analysis.
- Longitude is east-positive, in `[-180, 180]` degrees.
- Azimuth is clockwise from local north, in `[0, 360)` degrees.
- Terrain heights are metres relative to the reviewed source datum. Horizons observer altitude uses kilometres; conversion belongs at the provider boundary.
- Sun/Earth `elevationDeg` is astronomical altitude, not terrain elevation.
- `horizonDeg` is the sampled local skyline; `clearanceDeg` is astronomical altitude minus that skyline.
- Comparison differences are `B − A`.

## Uncertainty

Unknown visibility is `null`, not `false`. Unknown duration is `null`, not zero. `quality.terrainApplied=false` must not be presented as a confirmed terrain-based visibility solution. Graphical shadows, cartographic hillshade, decorative sky objects and global context imagery do not establish visibility or communications availability.

Coordinates and transforms require source-derived validation. No terrestrial WGS84/Web Mercator assumptions are permitted. The projected terrain convention is east/up/negative north relative to its local origin; the spherical representation uses a separately validated Moon-fixed rotation and pole-relative origin. See [coordinates](COORDINATES_AND_TILES.md) and [data and science](DATA_AND_SCIENCE.md).

## Boundaries

The UI owns one shared site/time state. The HTTP client owns serialization, cancellation and structured errors. Scene components emit geographic selections only for verified loaded surfaces. Backend analysis consumes terrain and horizon interfaces rather than rendering state. Asset preparation runs offline and publishes metadata together with identity-checked geometry.

The terrain/horizon provider interfaces have no dataset revision token. Horizon profiles are cached for at most 60 seconds, not whole analyses; invalidate caches or restart the service when replacing a dataset rather than relying on hot replacement.

Local map manifests use `schemaVersion=1`, canonical map `metadata`, and `requiredAssets` for deployment checks. Missing or unverified resources must produce structured errors, not invented CRS or asset URLs. Consumers must handle capability/dependency failures, including HTTP 503/504 where applicable, without treating them as successful scientific results.

For unequal comparison durations, use the existing periods, analysis percentages and quality warnings. The canonical comparison response provides three hour deltas; do not add undeclared duration or percentage-delta fields.

Changes to shared schemas require coordinated consumer updates and contract regression tests. Synthetic fixtures remain explicitly labelled and isolated from real-data execution.

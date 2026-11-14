# Lane 3 integration requests — BE-01/02/06/03/04/05

These are proposals for impacted owners, not edits to frozen contracts.

1. **DATA-02 / height datum:** implement `IObserverAltitudeResolver` for the actual DEM-to-Horizons transformation,
   or return heights already aligned to `HORIZONS_LUNAR_REFERENCE_SPHERE_1737400M` with `DatumAlignmentVerified=true`.
   A boolean and an arbitrary vertical-reference label do not specify a safe conversion. The default adapter
   uses a clearly warned reference-sphere geometric approximation and disables terrain visibility.
2. **DATA-02 / cache revision:** the frozen terrain/horizon interfaces expose source, resolution and datum, but no
   dataset version. Current bounded profile cache has a 60s TTL and keys on location/height/source/datum/resolution;
   new data deployment requires cache invalidation/restart. Propose a reviewed version token before hot data updates.
3. **DATA-03 / manifest:** review the local handoff envelope `schemaVersion=1`, `metadata` exactly matching frozen
   MapMetadataResponse, `requiredAssets` listing local-deployment relative URLs for template/root-asset checks.
   Configure ManifestPath, AssetRootPath and optional AssetBaseUrl. No producer format is silently imposed on
   another lane: adapt the file reader after the data lane publishes its actual manifest. Never fake verified CRS/assets.
4. **ARC-02 / error responses:** add missing HTTP 503/504 response declarations to map/compare/analyze routes as
   appropriate. Implementation uses only existing frozen error codes, with optional object details omitted when absent.
   Unknown routing/method errors use VALIDATION_ERROR. Catalog unavailable uses INTERNAL_ERROR with HTTP 503.
5. **BE-04 / unequal durations:** frozen CompareResponse has only three hour deltas. Existing response periods,
   analysis percentages and explicit quality warnings are used; no undeclared duration/percentage-delta fields added.
6. **DATA + FE3D / BE-05:** provide independently validated Moon-fixed `MOON_ME` provider and control vectors with
   frame axes, origin, epoch/rotation source and scene mapping evidence. The typed boundary, timestamp checks and
   normalization are implemented; production remains 503 with moonFixedEphemeris=false until that evidence exists.
7. **Integration / feature flags:** comparison is implemented and advertised. Terrain/horizon flags remain false
   with unavailable default data providers; enable them during reviewed integration of actual verified providers.

No NASA measurements, DEMs, GLBs, secrets or changes to `contracts/**` are included in these proposals.

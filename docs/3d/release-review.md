# PR15 explorer release review

## UI wiring

Export from `frontend/src/features/explorer/index.ts`:

```ts
solarSceneDirection(
  metadata: MapMetadataResponse | null,
  location: Coordinates | null,
  sun: { azimuthDeg: number; elevationDeg: number } | null,
): [number, number, number] | null
```

Use actual AnalyzeBodyPosition Sun azimuth/elevation for the selected site/time. Added optional local `LunarTerrainViewerProps`:

```ts
sunDirectionScene?: [number, number, number] | null;
sunlightLabel?: string;
```

Recommended label: **Local solar direction · graphical shadows only**. Null uses artistic lighting. Legacy `sunDirectionMoonFixed` is accepted for compatibility but never drives lighting. Shared contracts and global ephemeris endpoint are unchanged; 503 remains legitimate.

## Mapping and trust boundary

Picking requires the loaded asset identity to match current metadata, metadataVerified, validated finite scene origin, compatible spherical south-polar stereographic CRS, finite ordered bounds and exact vertical reference `HORIZONS_LUNAR_REFERENCE_SPHERE_1737400M`. Synthetic fallback, failed replacement and in-flight replacement cannot emit picks. Previous GLB remains visible during replacement but is not pickable. World intersections preserve GLB transforms: east = X + origin east; north = -Z + origin north; height = Y + vertical origin. Inclusive bounds allow only 0.00001 m numerical tolerance.

Frontend trusts launcher-verified metadata; it does not independently authenticate publisher provenance or hash downloaded GLBs. Launcher must verify pinned bytes and preserved transforms before publishing approved metadata. Source DEM SHA `82030d…` is local identity, not publisher authentication. Science approval is limited to the three exact generated meshes and reviewed projected-coordinate/height mapping, not blanket terrain approval.

## Local solar and rendering

North = [sin(longitude), 0, -cos(longitude)], east = [cos(longitude), 0, sin(longitude)], up = [0, 1, 0]. Azimuth increases north through east. Horizontal components include stereographic scale sec²(colatitude/2), while heights stay metres; output is normalized. Pole, unsupported/out-of-bounds site, nonfinite inputs and incompatible metadata return null. Negative elevation stays negative Y. This is a local topocentric lighting approximation, not global Moon-fixed ephemeris or terrain visibility.

Lighting smooths cached vectors with useFrame, no React frame updates or network calls, and respects reduced motion. Initial camera fit uses actual transformed GLB bounds, aspect/FOV, adjusted frustum and patch-sized orbit limits. DPR has a tighter coarse-pointer budget and uses R3F AdaptiveDpr. GLB geometry/material/texture resources are disposed on replacement, cancelled-load completion and unmount. No arbitrary LROC texture: acquired imagery does not overlap these source patches.

Graphical shadows do not establish illumination/visibility. Regional horizons remain partial; unknown far-field all-visible values remain null. Parent owns launcher and browser/E2E validation. UI wrapper owns premium controls and passes local solar props.

## Validation

`npx vitest run src/features/explorer`: 4 files, 20 tests passed. Final full frontend `npx vitest run src`: 9 files, 55 tests passed. `npx tsc -b --pretty false`: passed. Picking tests cover centre/corners/pole, coordinate signs and translated height origin, stale identity, invalid points and bounds. Solar tests cover cardinals, longitude rotation, below-horizon elevation, local scale and metadata guards. Browser interaction and release byte-proof validation remain parent responsibilities.

## P0 follow-up: native surface marker/focus anchoring

Markers no longer assume absolute elevation zero. `scene/surface.ts` probes the actual loaded GLB triangles with a downward Three.js Raycaster at the selected projected XY. It requires current verified asset-key identity and published bounds, retains loaded node/world transforms, and returns null for missing surface or no triangle hit. Both manually entered and picked coordinates use this probe. SiteMarkers receives resolved scene positions only; missing/out-of-mesh markers are hidden. Beacon height is 300 m and default orb radius 50 m for the approximately 10 km patches.

Marker focus and viewer imperative `flyTo` use the same actual-height probe. No hit means no flight, rather than targeting an invented elevation. Asset replacement invalidates the surface while the previous display remains visible.

Viewer roots expose diagnostic attributes for E2E: `data-sunlight-source` (`horizons-local` for a finite nonzero supplied local vector, otherwise `illustrative`), `data-solar-direction` (JSON supplied vector when valid), `data-time-utc`, and `data-selected-asset-key` (current verified metadata identity). These reflect rendered input props, not independent scientific verification or a new global ephemeris claim. Lighting continues to smooth via useFrame, without API calls per frame.

Follow-up validation: focused explorer tests and full frontend suite passed; full run **11 files / 68 tests**. TypeScript build passed. Added sampler tests use sloped synthetic native-height triangles, translated/rotated GLB nodes and a 1900 m vertical frame offset, plus stale/missing/unverified meshes, triangle gaps, invalid coordinates and outside coverage. Parent retains actual runtime/browser and launcher-proof validation ownership.

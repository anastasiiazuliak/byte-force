# Coordinates, raster samples and scene transforms

Interface definitions remain in [scene contracts](../contracts/scene/), [tile schema](../contracts/tiles.schema.json) and [coordinate controls](../contracts/fixtures/coordinate-control-points.json). Runtime scientific approval is narrower than a schema-valid transform.

## Lunar projection

Use a sphere of radius `R=1737400 m`, south-polar stereographic, central meridian 0°, pole scale 1, zero false easting/northing. Latitude is south-negative; longitude is east-positive. With angles in radians:

```text
theta = pi/2 + latitude
rho = 2 R tan(theta/2)
easting = rho sin(longitude)
northing = rho cos(longitude)
latitude = 2 atan(hypot(easting,northing)/(2R)) - pi/2
longitude = atan2(easting,northing)
```

At the exact pole a longitude of zero is a coordinate convention, not an approved azimuth-dependent scientific result. Do not substitute Earth Web Mercator, WGS84 or a terrestrial geoid.

## Native reviewed raster

The 7600 × 7600 Float32 raster uses 80 m spacing, corner tiepoint `(-304000,+304000)` metres and PixelIsArea. Native sample centers are:

```text
easting  = -304000 + 80 (column + 0.5)
northing =  304000 - 80 (row + 0.5)
```

The footprint is not the same as the domain of interpolable sample centers. Bilinear sampling requires every positively weighted sample to be finite and does not extrapolate the outer half-pixel margin. Native height is radial metres above the reference sphere; Horizons altitude is height divided by 1000 kilometres.

## Scene placement

Projected patch meshes use east/up/south axes. With the manifest's projected/vertical origin:

```text
sceneX = easting - originEastingM
sceneY = radialHeightM - verticalOriginM
sceneZ = -(northing - originNorthingM)
```

Restore the origin before mapping a picked triangle back to geographic coordinates. Picking approval is tied to exact source/mesh identity, real triangles and preserved transforms, not a fallback plane. Spherical-cap geometry has its own declared axes/transform; do not apply the planar patch transform to it. Full-globe background geometry does not extend reviewed DEM coverage.

## Sky direction markers

Camera-anchored Sun/Earth ornaments are removed. Before Analyze, no sky bodies are shown. A Globe marker requires a real, exact cached Analyze sample at the shared UTC and optional Site A/B reference, verified Globe geometry, JPL provenance and finite observer height. Do not substitute a nearby time, stale scenario or fabricated observer height.

For airless apparent azimuth `a` (north through east) and elevation `h`, the unit ENU direction is `(cos(h) sin(a), cos(h) cos(a), sin(h))`. Rotate this local direction using the reference site's east/north/up basis into Moon_ME, then map Moon_ME `(X, Y, Z)` to scene `(Y, -Z, -X)`. These are world-direction markers, not camera-relative ornaments. Short arrows at the selected site indicate actual bearing.

The canonical API supplies no real orbital distances. Endpoint distance **8R** (with `R` the scene lunar radius) and symbol radii are display-only, not actual celestial positions, phase or physical scale. Markers can be offscreen or occluded; never force always-onscreen placement. TerrainView uses a compass and cached Sun lighting, not global vector endpoints. Direction rendering and lighting do not establish terrain clearance or visibility; global science visibility remains unknown.

Tile URL and schema interfaces describe supported interchange, not proof that a complete multi-LOD regional pyramid or co-registered image texture is deployed. Current reviewed local publication includes three native patches plus derived overview and spherical assets. See [data and science](DATA_AND_SCIENCE.md) for scope and [scientific reference](science/TERRAIN_SCIENCE_REVIEW.md) for exact identities and model limitations.

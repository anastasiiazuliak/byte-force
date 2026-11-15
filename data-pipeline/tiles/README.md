# Offline terrain tile utility

`build_tiles.py` builds a bounded XYZ pyramid of projected GLB terrain meshes and analytical hillshade textures from a local LOLA DEM or an HTTP Range source. It is an optional offline utility, not an active continuous-streaming service or the default runtime asset preparation path. For normal setup, use the [pipeline workflow](../README.md).

## Usage

Run from the repository root with Python 3:

```sh
python3 data-pipeline/tiles/build_tiles.py --source-file data/raw/LDEM_80S_80MPP_ADJ.TIF --lat -89.45 --lon -137.31 --radius-km 5 --min-zoom 0 --max-zoom 2 --segments 32 --output-dir .validation/tile-assets --real-metadata-out .validation/tile-assets/map-manifest.json
```

Use `--source-url` instead of `--source-file` for HTTP Range input. `--dry-run` substitutes synthetic elevations for exercising output generation; it is not scientific validation. Always choose explicit output and metadata paths to avoid overwriting tracked assets or contract fixtures.

The utility reuses the standard-library BigTIFF reader, projection helpers and GLB serializer in `terrain_mesh/build_mesh.py`. Hillshade encoding uses `cwebp` when available; otherwise it writes PGM files, not WebP. Outputs include `terrain/{z}/{x}/{y}.glb`, hillshade tiles, `metadata/lod-tileset.json`, and the requested map manifest. Without `cwebp`, the declared WebP template does not identify generated textures; inspect actual files before publishing.

## Geometry and validation limits

Tiles share a projected origin and reference elevation across zoom levels. Same-level boundaries use common sampling coordinates; perimeter skirts hide gaps between levels. Default zooms are 0–2, with 32 segments per tile edge and 80 m skirts. These construction choices do not certify source-frame alignment, deployed coverage, or scientific visibility. Hillshade is cartography, not a visibility mask.

Implementation details are in `build_tiles.py`, especially `sample_bilinear`, `build_tile_geometry`, and `run_tile_pipeline`. There is no dedicated tile-pyramid test module in this directory. Related source tests in `scripts/test_overview.py`, `scripts/test_spherical_cap.py`, and `scripts/test_runtime_assets.py` cover other geometry/runtime workflows, not a certification of this utility. Validate generated assets and metadata against the [coordinate conventions](../../docs/COORDINATES_AND_TILES.md) and [tile schema](../../contracts/tiles.schema.json) before use.

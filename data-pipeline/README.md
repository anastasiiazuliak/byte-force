# Offline terrain and cartography pipeline

These tools prepare lunar assets outside HTTP requests. For normal local setup, use `scripts/asset-setup.py` at the repository root.

## Supported local workflow

From the repository root:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r data-pipeline/terrain_mesh/requirements-polar.txt
.venv/bin/python scripts/asset-setup.py --prepare-runtime
```

On Windows use `py -3 -m venv .venv`, then `.venv\Scripts\python.exe` in place of `.venv/bin/python`. No activation or system pip installation is needed. Default texture generation requires **NumPy 2.4.6 and Pillow 12.3.0**; core acquisition/native mesh processing uses the standard library.

The setup tool downloads/reuses the identity-checked regional DEM under `data/raw/`, generates candidate assets under `.validation/release-assets/`, and publishes the bound local runtime set under `.validation/runtime-assets/`. Do not overwrite tracked `public-assets/` with generated output.

```sh
# Rebuild from the complete local source without acquisition.
.venv/bin/python scripts/asset-setup.py --offline --prepare-runtime

# Explicitly omit optional polar cartography.
.venv/bin/python scripts/asset-setup.py --offline --prepare-runtime --no-polar-texture
```

Offline regeneration still needs the source and any selected visual-build dependencies installed. The launcher does not acquire or regenerate assets; see the [root quick start](../README.md#run-locally).

## Main modules

| Module | Purpose |
|---|---|
| `terrain_mesh/build_mesh.py` | Native BigTIFF Float32/Deflate sampling and projected GLB patches with recorded origins |
| `terrain_mesh/build_overview.py` | Derived regional overview geometry |
| `terrain_mesh/build_spherical_cap.py` | Derived spherical-cap geometry with separate axes/transform |
| `terrain_mesh/build_polar_texture.py` | Native-sample averaging and gradient-based cartographic relief |
| `tiles/`, `highres/`, `illumination/` | Additional offline processing tools; their presence does not certify deployed coverage or scientific visibility |

Projected patches use east/up/negative-north relative to a recorded projected/vertical origin. Preserve those origins, source identities and real triangle bounds when publishing or picking. A direct mesh build is not runtime scientific approval.

Default polar relief is a **2048² RGBA PNG**, served at `/static/polar/relief.png`, with 296.875 m projected cells. It is averaged DEM cartography, not photography, measured reflectance, geometry displacement or a visibility mask. Exact source/output hashes and sizes are in [asset acquisition](../docs/science/ASSET_ACQUISITION.md#default-polar-cartographic-relief).

## Texture unit tests

With the same NumPy/Pillow venv dependencies installed:

```sh
.venv/bin/python data-pipeline/terrain_mesh/test_polar_texture.py
```

These tests use standard-library **unittest**; pytest is not required. Synthetic/mocked tests do not establish physical accuracy. See [development](../docs/DEVELOPMENT.md) for the other regression commands; no pass count or CI coverage is implied here.

## Scientific and interface references

- [Source data and attribution](../data/README.md)
- [Coordinates and sampling](../docs/COORDINATES_AND_TILES.md)
- [Data and scientific limits](../docs/DATA_AND_SCIENCE.md)
- [Terrain scientific reference](../docs/science/TERRAIN_SCIENCE_REVIEW.md)
- [Tile schema](../contracts/tiles.schema.json)

The source is NASA PGDA product 90 / Barker et al. (2023), not arbitrary lunar imagery. Finite-range terrain analysis remains regional-only; global visibility is unknown even when regional clearance is numeric.

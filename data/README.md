# Lunar source data

`data/raw/` holds local, ignored source rasters and acquisition receipts. Do not commit raw DEMs, downloaded imagery or generated assets. Use the repository-root setup tool rather than manually copying a raster into tracked assets.

## Prepare data and runtime assets

From the repository root, after installing Node.js 22 and stable .NET 10:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r data-pipeline/terrain_mesh/requirements-polar.txt
.venv/bin/python scripts/asset-setup.py --prepare-runtime
```

On Windows create the environment with `py -3 -m venv .venv` and replace `.venv/bin/python` with `.venv\Scripts\python.exe`. No activation is required. Use the venv, not system pip, on Fedora/PEP 668-managed systems.

Setup acquires/reuses and validates the full regional DEM, creates native patches and derived overview/spherical assets, and publishes proof-bound files under ignored `.validation/runtime-assets/`. Default polar relief generation requires the pinned NumPy/Pillow packages. Add `--no-polar-texture` to explicitly omit that optional visual. With the complete source and dependencies already present, add `--offline` for regeneration without acquisition.

See the [root quick start](../README.md#run-locally) for frontend installation, launching, ports and restarting, and [asset acquisition](../docs/science/ASSET_ACQUISITION.md) for detailed integrity checks and optional NAC acquisition.

## Source identity and interpretation

The reviewed source is `LDEM_80S_80MPP_ADJ.TIF`: 80 m LOLA radial heights for 80–90°S, 7600² Float32 samples in a spherical south-polar stereographic projection, MOON_ME/DE421 frame. Its length is **189,158,392 bytes** and local SHA-256 is `82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a`. This is an identity hash, not a publisher checksum. A familiar filename does not approve another source.

Heights are metres above the 1,737,400 m reference sphere. The runtime launcher supplies the reviewed source path to the API; direct API configuration uses `Terrain__DemPath`. Do not assume a manually configured path alone establishes scientific approval.

The default polar PNG is DEM-derived cartographic relief, not photography or new geometry. Optional acquired LROC NAC imagery does not overlap the three native patches and is not their texture. Regional horizon/clearance does not certify global visibility, landing suitability, power or a radio link.

## Attribution and references

- NASA Goddard PGDA [product 90](https://pgda.gsfc.nasa.gov/products/90), *A New View of the Lunar South Pole from LOLA*.
- Barker et al. (2023), *The Planetary Science Journal* 4, 183, [doi:10.3847/PSJ/acf3e1](https://doi.org/10.3847/PSJ/acf3e1).
- Data DOI: [10.60903/gsfcpgda-lola-spole](https://doi.org/10.60903/gsfcpgda-lola-spole).
- [Data and science](../docs/DATA_AND_SCIENCE.md), [coordinate conventions](../docs/COORDINATES_AND_TILES.md), and [identity-bound scientific reference](../docs/science/TERRAIN_SCIENCE_REVIEW.md).

Retain provider acknowledgements and check source-specific redistribution terms; the repository code license does not relicense third-party data.

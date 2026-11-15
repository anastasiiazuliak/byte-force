# Asset acquisition and regeneration

Run commands from the repository root using the private Python environment created in the [README setup](../../README.md#run-locally). Acquisition/core mesh tools use the standard library, but **default `--prepare-runtime` now also builds polar relief and requires NumPy 2.4.6 and Pillow 12.3.0**, pinned in [requirements-polar.txt](../../data-pipeline/terrain_mesh/requirements-polar.txt). No global lunar raster is downloaded.

Linux dependency setup (safe for Fedora/PEP 668):

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r data-pipeline/terrain_mesh/requirements-polar.txt
```

On Windows use `py -3 -m venv .venv`, then `.venv\Scripts\python.exe -m pip install -r data-pipeline/terrain_mesh/requirements-polar.txt`. Replace `.venv/bin/python` below with `.venv\Scripts\python.exe`; no activation or execution-policy change is needed.

## Prepare local reviewed runtime assets

```sh
.venv/bin/python scripts/asset-setup.py --prepare-runtime
.venv/bin/python scripts/run-local.py
```

The first command acquires/reuses the complete regional DEM, validates it, builds regional/native assets and publishes the identity-bound runtime set under `.validation/runtime-assets`. The second validates/selects existing assets and launches local services; it does not acquire them.

Offline regeneration requires the complete source already present and the Python texture dependencies installed:

```sh
.venv/bin/python scripts/asset-setup.py --offline --prepare-runtime
```

To explicitly omit optional cartographic relief, add `--no-polar-texture` to `--prepare-runtime` (online or offline). This skips the NumPy/Pillow-dependent visual build and uses neutral mesh-normal rendering; it does not change DEM analysis or visibility policy.

Optional evidence capture and the separate small NAC image:

```sh
.venv/bin/python scripts/asset-setup.py --capture-docs --acquire-nac --write-launch-env
.venv/bin/python scripts/validate-data.py
.venv/bin/python scripts/test_data_acquisition.py
```

`--dem` selects a local source. `--output` is restricted to the ignored `.validation/` tree. Candidate path files are not automatically loaded configuration or scientific approval. `--prepare-runtime` performs the separate exact-identity publication checks; it cannot approve an arbitrary DEM or mesh.

## Download integrity

Acquisition probes length and ETag/Last-Modified, then uses bounded parallel range requests. Responses require exact 206 status, Content-Range, length and matching object identity. Strong ETag is preferred for If-Range; weak ETags are not cryptographic checksums. Retries and socket timeouts are bounded per operation, not by a single total-download deadline.

Resume sidecars bind partial bytes to the source identity. Legacy prefixes are compared in full against remote ranges before reuse. Incompatible bytes are preserved and rejected, not concatenated. Ordered writes and atomic finalization prevent treating an incomplete file as complete. Finalization requires length, any supplied official checksum and TIFF validation; a computed local SHA-256 is not a publisher checksum.

The regional validator checks BigTIFF pointers, cycles, tile extents, Deflate decoded lengths, 7600² Float32 samples, 80 m scale, tiepoint, spherical south-polar geokeys, metres and NoData. Runtime publication additionally binds source/mesh identities and transforms to the [scientific reference](TERRAIN_SCIENCE_REVIEW.md).

## Sources and outputs

Official source: [PGDA product 90](https://pgda.gsfc.nasa.gov/products/90), [regional DEM](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF). Cite Barker et al. (2023), [doi:10.3847/PSJ/acf3e1](https://doi.org/10.3847/PSJ/acf3e1), data DOI `10.60903/gsfcpgda-lola-spole`. [Product 81](https://pgda.gsfc.nasa.gov/products/81) describes a separate higher-resolution mosaic, not this downloaded source.

The DEM is 189,158,392 bytes; its local identity SHA-256 is `82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a`. No official publisher checksum is asserted.

Each of the three native patches contains 15,876 vertices and 31,250 triangles from a 126² native sample window, using pixel centers and a recorded projected/vertical origin. No synthetic filling is performed; NoData/nonfinite source samples fail the build. Derived overview and spherical assets have separate proof metadata and are not native-resolution terrain everywhere.

The optional [NAC image](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/M1188426614LE_20MPP.TIF) is a genuine map-projected I/F image, not the similarly named simulated MODEL product. It has 20 m spacing, dimensions 856 × 4380 and projected footprint easting `[40240.8582,57360.8582]`, northing `[81615.1333,169215.1333]` metres. It does **not** overlap the generated patches, so it is not used as their texture. [LROC downloads](https://lroc.im-ldi.com/images/downloads) are not silently acquired or assumed co-registered.

## Default polar cartographic relief

`--prepare-runtime` builds and verifies `.validation/runtime-assets/static/polar/relief.png`, served at **`/static/polar/relief.png`**:

| Property | Current artifact |
|---|---|
| Encoding | 2048 × 2048 RGBA PNG |
| Projected cell spacing | 296.875 m |
| PNG length | 1,802,787 bytes |
| PNG SHA-256 | `e078d2f169ef03b367ac0cf06257010e776c68e9846bee5e9c582216e2b08523` |
| Source length | 189,158,392 bytes |
| Source SHA-256 | `82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a` |

The texture averages actual native DEM samples and derives cartographic tonal relief from height gradients. Transparent pixels exclude unsupported coverage/NoData and missing gradient support; there is no invented fill. It is **not photography**, measured reflectance, additional geometry displacement, a time-dependent illumination mask or scientific visibility evidence. The polar cap uses the DEM cartographic material; muted whole-globe SVS context is not verified polar imagery. These local artifact hashes bind reproducibility, not publisher authenticity or ground-truth accuracy.

Texture tests use standard-library unittest with the same pinned NumPy/Pillow dependencies; no pytest installation is needed. Run the venv Python with `data-pipeline/terrain_mesh/test_polar_texture.py`; see [development](../DEVELOPMENT.md#repository-and-asset-regression-checks). No test pass or CI coverage is implied by this reproduction guide.

## Local provenance

Ignored outputs include `.validation/release-assets/` source receipts, per-patch manifests and mesh-validation records; `.validation/runtime-assets/` contains the published set and its bound review receipt. Optional official-page captures and URL/header/hash records live under `.validation/official-docs/`; raw transport sidecars live alongside `data/raw/` sources.

Receipts establish local transport identity, structure and geometry/source consistency, not independent physical accuracy, landing suitability or global skyline completeness. A new machine regenerates these files. Source acknowledgements and limitations remain in [data and science](../DATA_AND_SCIENCE.md).

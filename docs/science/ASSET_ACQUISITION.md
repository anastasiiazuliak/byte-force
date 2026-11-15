# Regional asset acquisition and science-review handoff

All commands below run from the `feature/final-integration` worktree root.
No global lunar raster is automatically downloaded. No application configuration,
tracked GLB, or scientific approval is changed. Python stdlib is sufficient.

## Reproduce

```sh
python scripts/asset-setup.py --capture-docs --acquire-nac --write-launch-env
python scripts/validate-data.py
python scripts/test_data_acquisition.py
```

To rebuild without network access:

```sh
python scripts/asset-setup.py --offline --write-launch-env
```

`--dem` selects the local regional source. `--output` must remain under this
worktree's ignored `.validation/` tree. The optional `candidate-paths.env` is only
a path handoff, not an automatically loaded application configuration. Runtime
promotion and scientific approval are separate human/integration decisions.
Existing downloader flags remain available, e.g.
`python data/scripts/download_data.py --download --dem-only`.
The optional hillshade is a DEM-derived visualization, not camera imagery.

## Download safeguards

`data/scripts/acquisition.py` probes expected object length and ETag/Last-Modified,
then uses four concurrent 256 KiB range requests. Each response must be 206 with
exact Content-Range, Content-Length, body length, and matching validators.
Strong ETag is preferred for If-Range; a weak ETag is not used as a strong
validator, so Last-Modified is used instead while both headers are checked.
Missing validators, ignored ranges, changed identity, and short/oversized ranges
fail closed. Retries are bounded (four attempts, exponential 1/2/4 second sleeps,
capped at eight seconds); socket timeout is 35 seconds by default. These are
per-operation bounds, not a total-download deadline. Interrupted runs can be
repeated to make meaningful progress.

An unreceipted legacy source/partial is compared **in its entirety** against
remote byte ranges before reuse. Incompatible bytes are preserved and rejected,
never concatenated. Resume sidecars bind the partial to URL, size, ETag and
Last-Modified. Ordered, flushed and fsynced writes leave a contiguous partial
when a later request fails. Workers buffer only a small batch, not the full DEM.
The final `.part` is atomically renamed after length, optional official checksum,
and supplied TIFF validator pass. Local SHA-256 is explicitly **not** a publisher
checksum. Previously completed objects can be reused after remote header identity,
local SHA-256 and structural validation checks.

`data/scripts/validation.py` checks the BigTIFF header, bounded IFD/tag pointers,
IFD cycles, every indexed tile's file extent, complete Deflate streams and decoded
lengths across all overview levels. The regional validator additionally checks
7,600 × 7,600 Float32 single-band samples, 80 m scale, tiepoint, lunar spherical
south-polar stereographic geokeys, metres, and explicit NoData. This does not
constitute independent scientific or publisher-checksum approval.

## Actual acquisition on 2026-11-15

Official catalog: <https://pgda.gsfc.nasa.gov/products/90>, *A New View of the Lunar
South Pole from LOLA*. Product 81 documents the separate 5 m/pixel 87–90 S mosaic;
it was consulted, not downloaded. Cite Barker et al. (2023), Planet. Sci. J. 4,
183, DOI `10.3847/PSJ/acf3e1`; data DOI `10.60903/gsfcpgda-lola-spole`.

The existing 7,340,032-byte regional DEM prefix was remotely compared before
reuse. The first large-range bounded attempt was slow; smaller parallel ranges
then completed the **entire 189,158,392-byte regional product**. No selective COG
fallback or global download was necessary.

| Resource | Actual bytes | Worktree-relative location |
|---|---:|---|
| Full official regional DEM, 80–90 S | 189,158,392 | `data/raw/LDEM_80S_80MPP_ADJ.TIF` |
| Map-projected official LROC NAC science image | 1,411,548 | `data/raw/M1188426614LE_20MPP.TIF` |
| Connecting Ridge mesh | 884,556 | `.validation/release-assets/connecting-ridge/terrain.glb` |
| Near-Shackleton mesh | 884,516 | `.validation/release-assets/near-shackleton/terrain.glb` |
| Near-de-Gerlache mesh | 884,556 | `.validation/release-assets/near-de-gerlache/terrain.glb` |

DEM local SHA-256:
`82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a`.
Server ETag: `W/"b4653f8-189326141f0"`.
Last-Modified: `Fri, 07 Jul 2023 22:03:02 GMT`.
No official reference checksum was found in the consulted catalogs; an ETag is
not treated as a cryptographic publisher checksum.

### LROC limitation

The curated LROC page <https://lroc.im-ldi.com/images/downloads> offers very large
polar/global mosaics and a regional annotated map archive; neither was silently
downloaded or assumed to be a georeferenced texture. The small NAC product above
is explicitly linked by the PGDA product 90 catalog as an actual NAC I/F image
map-projected on the 20 m DEM, not the similarly named simulated MODEL image.
Its official URL is
<https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/M1188426614LE_20MPP.TIF>.

Its TIFF geokeys match the DEM CRS, scale is 20 m, dimensions are 856 × 4,380,
and footprint is easting `[40240.8582, 57360.8582]`, northing
`[81615.1333, 169215.1333]` metres. It does **not** overlap the generated sites.
It is retained as a georeferenced scientific image with its own receipt, but no
texture/photos are invented or applied. Verified overlapping site texture remains
**unavailable** in this acquisition.

## Exact review receipts (ignored)

- `.validation/dem-receipt.json`: standalone full DEM validation.
- `.validation/release-assets/dem-receipt.json`: source geotags, NoData, validated
  overview/tile counts, local SHA-256, URL, acquisition ETag and Last-Modified.
- `.validation/release-assets/lroc-receipt.json`: actual NAC geotags, matching CRS,
  bounds, NoData, compressed-block validation, URL/validators/hash and usage limit.
- `.validation/release-assets/asset-receipt.json`: mesh paths, sizes, hashes,
  individual projected origins and bounds.
- `.validation/release-assets/{connecting-ridge,near-shackleton,near-de-gerlache}/terrain-manifest.json`:
  geographic/footprint bounds, actual sample bounds, projected origin including
  vertical reference elevation, axes, source receipt/hash, and no-texture reason.
- Each site also has `mesh-validation.json`: GLB chunk/buffer/index checks and
  every vertex matched back to its native DEM sample and pixel-centre position
  within 1 mm Float32 tolerance (not independent scientific validation).
- The corresponding `map-manifest.json` files are **candidate** runtime manifests;
  `validated`, `metadataVerified`, and scientific review are not auto-approved.
- `data/raw/*.acquisition.json`: transport identity receipts beside raw products.
- `.validation/official-docs/sources.json`: URLs, response headers, capture times
  and local HTML hashes. `0.html`/`0.txt` = product 90; `1.html`/`1.txt` = product
  81; `2.html`/`2.txt` = LROC curated downloads. Text is extracted from captured
  official HTML, not paraphrased scientific claims.

Each mesh contains 15,876 vertices and 31,250 triangles from a 126 × 126 native
sample window. No resampling, scientific-value adjustment, or synthetic filling
is performed. Source NoData/nonfinite samples cause a build failure. The TIFF's
RasterPixelIsArea convention puts samples half a pixel from the corner tiepoint;
mesh positions use those centres. Footprint bounds and sample-position bounds
are explicitly distinguished. Scene axes are east/up/south and height is rebased
by the recorded reference elevation; raw science values remain unchanged.

## Validation scope

`test_data_acquisition.py` uses a loopback HTTP stub only: range success, safe
legacy reuse, incompatible-prefix preservation, unreceipted partial resume,
changed identity, ignored/malformed/truncated responses, bounded retry/backoff,
checksum mismatch, and validation-before-finalization. Local BigTIFF fixtures
exercise block corruption and out-of-file pointers; mesh tests cover rebasing
and NoData rejection. No tests depend on NASA availability.

Full-source validation (310 Deflate tiles over five IFD levels), three real-data
pipeline builds, and all-vertex GLB/source comparisons passed locally.
Scientific accuracy, source-frame interpretation, landing-site suitability,
texture co-registration and runtime promotion remain for science/integration
review. Every generated science-review flag remains false.

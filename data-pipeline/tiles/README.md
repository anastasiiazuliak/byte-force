# LOD Tile Pyramid Pipeline (`data-pipeline/tiles/`) — DATA-04

Generates a multi-zoom **XYZ** pyramid of watertight 3D `.glb` terrain meshes and co-registered `.webp` analytical hillshade textures from the NASA LOLA South Polar DEM (`LDEM_80S_80MPP_ADJ.TIF`).

## Design & Guarantees (ARC-03 / DATA-04)

1. **LOD Levels & Spacing (Default `z = 0..2`, `segments = 32`):**
   - `z = 0` (`1×1` tile): ~315 m vertex spacing (overview)
   - `z = 1` (`2×2` tiles): ~157.5 m vertex spacing
   - `z = 2` (`4×4` tiles): ~78.75 m vertex spacing (matches full 80 m/px LOLA DEM resolution)
2. **Watertight Seams & Zero Vertical Jump:**
   - All zoom levels share the exact same `referenceElevationMeters` and `meshLocalOrigin`, preventing vertical popping during zoom transitions.
   - Adjacent tiles at the same zoom sample identical boundary coordinates via unified bilinear interpolation.
   - Every tile includes an **80 m vertical perimeter skirt** (`--skirt-depth 80`) to mask T-junction cracks between `z` and `z+1`.
3. **LROC Imagery Coverage & Fallback:**
   - LROC NAC/WAC satellite imagery is **not bundled** in the demo pyramid (`lrocImageryAvailable: false`, `surfaceTemplate: null`).
   - Instead, co-registered analytical Horn hillshade `.webp` tiles (`/tiles/hillshade/{z}/{x}/{y}.webp`) are generated directly from the LOLA DEM without substituting synthetic imagery.
   - Missing tiles in partial coverage fall back to the parent zoom level (`z-1`) or neutral material.
4. **Git & Static Hosting Policy:**
   - Only the root demo tile (`public-assets/terrain/0/0/0.glb`) and metadata manifests (`public-assets/metadata/lod-tileset.json`, `contracts/fixtures/map-metadata-real.json`) are tracked in Git.
   - Generated zoom `1..N` `.glb` and `.webp` tiles are gitignored and served via static hosting / Nginx.

## CLI Usage

```bash
# Generate z=0..2 GLB + WebP hillshade pyramid from remote NASA LOLA DEM
python data-pipeline/tiles/build_tiles.py \
  --source-url https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF \
  --lat -89.45 --lon -137.31 --radius-km 5 \
  --min-zoom 0 --max-zoom 2 \
  --output-dir public-assets \
  --real-metadata-out contracts/fixtures/map-metadata-real.json

# Dry-run with synthetic grid (CI/offline verification)
python data-pipeline/tiles/build_tiles.py --dry-run --output-dir /tmp/tiles-test
```

## Static Hosting / Nginx Cache Headers

```nginx
location ~* ^/(terrain|tiles)/.+\.(glb|webp)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    add_header Access-Control-Allow-Origin "*";
    types {
        model/gltf-binary glb;
        image/webp webp;
    }
}
```

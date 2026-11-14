# Data Pipeline (`data-pipeline/`)

Offline geospatial processing scripts for the **Byte Force — Lunar Landing Site Navigator** (NASA Space Apps 2026).

## `terrain_mesh/build_mesh.py` (DATA-03)

Generates a 3D terrain mesh in binary glTF 2.0 (`.glb`) format and an accompanying JSON manifest directly from the NASA LOLA South Polar DEM (`LDEM_80S_80MPP_ADJ.TIF`, BigTIFF Float32, 80 m/px, South Polar Stereographic `R = 1,737,400 m`).

Uses only Python 3.8+ standard library (`struct`, `zlib`, `urllib.request`, `json`) — **no GDAL, numpy, or pip packages required**.

### Features

- Reads both local BigTIFF/GeoTIFF files (`--source-file`) and remote files via HTTP `Range` requests (`--source-url`), fetching only the tiles intersecting the requested window.
- Decodes TIFF Compression `8` (Deflate/ZLib) and Predictor `3` (IEEE-754 floating-point horizontal differencing, TIFF Tech Note 3).
- Maps coordinates using the locked **ARC-03** South Polar Stereographic & Three.js scene transform:
  - `sceneX = projectedX - localOriginX` (East)
  - `sceneY = elevationMeters - referenceElevationMeters` (Up)
  - `sceneZ = -(projectedY - localOriginY)` (South)
- Computes smooth finite-difference vertex normals (`+Y` up), UV texture coordinates, and CCW triangle indices.
- Writes a valid glTF 2.0 binary `.glb` with `POSITION`, `NORMAL`, `TEXCOORD_0`, and `INDICES` accessors plus `extras.byteForce` metadata.
- Writes `terrain-manifest.json` with projected bounds, geographic bounds, `meshLocalOrigin`, `referenceElevationMeters`, CRS, and NASA attribution.

### Usage

#### 1. Dry-run (no DEM download required)

```bash
python data-pipeline/terrain_mesh/build_mesh.py --dry-run --verbose
```

#### 2. From remote NASA LOLA DEM via HTTP Range requests

```bash
python data-pipeline/terrain_mesh/build_mesh.py \
  --source-url https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF \
  --lat -89.45 \
  --lon -137.31 \
  --radius-km 5 \
  --output public-assets/terrain/0/0/0.glb \
  --manifest public-assets/metadata/terrain-manifest.json \
  --verbose
```

#### 3. From a local DEM file

```bash
python data-pipeline/scripts/download_data.py  # or data/scripts/download_data.py
python data-pipeline/terrain_mesh/build_mesh.py \
  --source-file data/raw/LDEM_80S_80MPP_ADJ.TIF \
  --lat -89.45 \
  --lon -137.31 \
  --radius-km 5 \
  --output public-assets/terrain/0/0/0.glb \
  --manifest public-assets/metadata/terrain-manifest.json \
  --verbose
```

### Three.js / React Three Fiber Loading Example

```ts
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const manifest = await fetch("/metadata/terrain-manifest.json").then((r) => r.json());
const loader = new GLTFLoader();
const gltf = await loader.loadAsync("/terrain/0/0/0.glb");
scene.add(gltf.scene);

// Recover projected (X, Y) from a Three.js world/mesh point (x, y, z):
const [originX, originY] = manifest.meshLocalOrigin;
const projectedX = x + originX;
const projectedY = originY - z;
const elevationMeters = y + manifest.referenceElevationMeters;
```

### Related Contracts & Docs

- [COORDINATES_AND_TILES.md](../docs/COORDINATES_AND_TILES.md)
- [DATA_SOURCES.md](../docs/DATA_SOURCES.md)
- [contracts/tiles.schema.json](../contracts/tiles.schema.json)

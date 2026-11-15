"""Display-only DEM cartography, not photography, reflectance or solar measurement.
Optional dependencies: pip install -r data-pipeline/terrain_mesh/requirements-polar.txt
Native pixel centres are binned into projected display cells; no void filling.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
except ImportError as error:
    raise RuntimeError('Polar texture requested: install data-pipeline/terrain_mesh/requirements-polar.txt (numpy and Pillow)') from error

SIZE = 2048
BOUND = 304000
RADIUS = 1737400
SOURCE_SHA = '82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a'


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1048576), b''):
            h.update(block)
    return h.hexdigest()


def projected_uv(east, north):
    return ((east + BOUND)/(2*BOUND), (north + BOUND)/(2*BOUND))


def shade(heights, valid, spacing):
    # Central differences require real neighbours: no artificial cliffs at voids.
    safe = valid.copy()
    safe[[0, -1], :] = False
    safe[:, [0, -1]] = False
    for axis in (0, 1):
        safe &= np.roll(valid, 1, axis) & np.roll(valid, -1, axis)
    south, east = np.gradient(heights, spacing)
    length = np.sqrt(1 + east*east + south*south)
    illumination = np.zeros_like(heights, dtype=np.float64)
    # Fixed multidirectional cartographic illumination, unrelated to scenario Sun.
    for azimuth in (315, 45, 135, 225):
        angle = math.radians(azimuth)
        illumination += np.maximum(0, (-east*math.sin(angle) + south*math.cos(angle) + 1)/ (math.sqrt(2)*length)) / 4
    # Dominant NW direction retains crater readability without invented detail.
    dominant = np.maximum(0, (east/math.sqrt(2) + south/math.sqrt(2) + 1)/(math.sqrt(2)*length))
    tone = np.clip(0.18 + 0.62*(0.4*illumination + 0.6*dominant), 0, 1)
    rgba = np.zeros((*heights.shape, 4), dtype=np.uint8)
    rgba[:, :, :3] = np.round(tone[:, :, None]*255).astype(np.uint8)
    rgba[:, :, 3] = safe.astype(np.uint8)*255
    rgba[~safe] = 0
    return rgba


def generate(dem, output):
    dem, output = Path(dem), Path(output)
    source_hash = digest(dem)
    if source_hash != SOURCE_SHA:
        raise ValueError('Polar texture source differs from reviewed DEM')
    spec = importlib.util.spec_from_file_location('polar_texture_mesh', Path(__file__).with_name('build_mesh.py'))
    mesh = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mesh)
    sums = np.zeros(SIZE*SIZE, dtype=np.float64)
    counts = np.zeros(SIZE*SIZE, dtype=np.int32)
    rejected = np.zeros(SIZE*SIZE, dtype=bool)
    tiles = 0
    with mesh.BigTiffReader(dem) as source:
        if list(source.tags[33550][:2]) != [80, 80] or list(source.tags[33922]) != [0, 0, 0, -BOUND, BOUND, 0] or (source._cols, source._rows) != (7600, 7600):
            raise ValueError('Unexpected source bounds/pixel-area registration')
        if not source._tiled or source._tiles_across*source._tiles_down > 225:
            raise ValueError('Expected at most 225 native TIFF tiles')
        nodata = source.tags.get(42113)
        if isinstance(nodata, (list, tuple)):
            nodata = nodata[0]
        if isinstance(nodata, bytes):
            nodata = nodata.decode().rstrip('\x00')
        nodata = float(nodata) if nodata is not None else None
        for row in range(0, source._rows, source._tile_height):
            for col in range(0, source._cols, source._tile_width):
                w, h = min(source._tile_width, source._cols-col), min(source._tile_height, source._rows-row)
                grid = np.asarray(source.read_window(col, row, w, h), dtype=np.float64)
                rr, cc = np.arange(row, row+h), np.arange(col, col+w)
                bins = ((rr[:, None]+.5)*SIZE/7600).astype(int)*SIZE + ((cc[None, :]+.5)*SIZE/7600).astype(int)
                valid = np.isfinite(grid) & (grid != nodata)
                sums += np.bincount(bins[valid], weights=grid[valid], minlength=SIZE*SIZE)
                counts += np.bincount(bins[valid], minlength=SIZE*SIZE).astype(np.int32)
                rejected[bins[~valid]] = True
                tiles += 1
    heights = (sums/np.maximum(counts, 1)).reshape(SIZE, SIZE)
    axis = -BOUND + (np.arange(SIZE)+.5)*2*BOUND/SIZE
    radius = 2*RADIUS*math.tan(math.radians(5))
    valid = ((counts > 0) & ~rejected).reshape(SIZE, SIZE)
    valid &= axis[:, None]**2 + axis[None, :]**2 <= radius**2
    rgba = shade(heights, valid, 2*BOUND/SIZE)
    output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba).save(output, format='PNG', compress_level=9)
    info = {'algorithm':'native-centre-bin-mean-multidirectional-hillshade-v1', 'usage':'Display-only cartographic relief; not photography, reflectance, illumination measurement or geometry',
            'sourceLocalSha256':source_hash, 'sourceBytes':dem.stat().st_size, 'sourceResolutionMeters':80,
            'boundsProjectedMeters':[-BOUND,-BOUND,BOUND,BOUND], 'pixelRegistration':'area; north at image top',
            'textureFlipY':True, 'uv':'u=(easting+304000)/608000; v=(northing+304000)/608000',
            'width':SIZE,'height':SIZE,'displayResolutionMeters':2*BOUND/SIZE,'tilesRead':tiles,
            'alpha':'zero outside latitude <= -80, native NoData, or missing gradient neighbours; no fill',
            'textureLocalSha256':digest(output),'textureBytes':output.stat().st_size}
    output.with_suffix('.json').write_text(json.dumps(info, indent=2)+'\n')
    return info


def verify(dem, published, expected):
    """Recompute from source, rather than trusting editable receipt hashes."""
    import tempfile
    published = Path(published)
    with tempfile.TemporaryDirectory() as temporary:
        proof = generate(dem, Path(temporary)/'relief.png')
        if published.is_symlink() or proof != expected or digest(published) != proof['textureLocalSha256'] or json.loads(published.with_suffix('.json').read_text()) != proof:
            raise ValueError('Polar texture differs from source-derived cartography')
    return proof


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dem', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(generate(args.dem, args.output), indent=2))

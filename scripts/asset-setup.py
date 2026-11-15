#!/usr/bin/env python3
"""Acquire and validate regional NASA data, then build ignored release candidates."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import math
import struct
from html.parser import HTMLParser

import json
from pathlib import Path
import subprocess
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'data/scripts'))
from acquisition import acquire, sha256
from validation import validate_dem, URL, EXPECTED

DOCS = ['https://pgda.gsfc.nasa.gov/products/90', 'https://pgda.gsfc.nasa.gov/products/81',
        'https://lroc.im-ldi.com/images/downloads']
NAC_URL = 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/M1188426614LE_20MPP.TIF'


class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
    def handle_data(self, data):
        if data.strip():
            self.parts.append(data.strip())


def capture_docs(directory):
    directory.mkdir(parents=True, exist_ok=True)
    receipts = []
    for index, url in enumerate(DOCS):
        with urllib.request.urlopen(url, timeout=30) as response:
            body = response.read(4*1024*1024)
            headers = dict(response.headers)
        html = directory/f'{index}.html'
        html.write_bytes(body)
        text = Text()
        text.feed(body.decode('utf-8'))
        output = directory/f'{index}.txt'
        output.write_text('\n'.join(text.parts)+'\n')
        receipts.append({'url':url, 'html':str(html), 'text':str(output), 'headers':headers,
                         'local_sha256':hashlib.sha256(body).hexdigest(),
                         'captured_utc':datetime.now(timezone.utc).isoformat()})
    (directory/'sources.json').write_text(json.dumps(receipts, indent=2)+'\n')


def verify_mesh(path, manifest, dem_path):
    """Check GLB structure and every vertex against source samples and geotags."""
    blob = path.read_bytes()
    if struct.unpack_from('<III', blob) != (0x46546c67, 2, len(blob)):
        raise ValueError('Invalid GLB header/length')
    json_length, kind = struct.unpack_from('<II', blob, 12)
    if kind != 0x4e4f534a:
        raise ValueError('Missing GLB JSON')
    gltf = json.loads(blob[20:20+json_length])
    binary_header = 20+json_length
    length, kind = struct.unpack_from('<II', blob, binary_header)
    base = binary_header+8
    if kind != 0x004e4942 or base+length != len(blob):
        raise ValueError('Invalid GLB binary chunk')
    for view in gltf['bufferViews']:
        if view.get('byteOffset',0)+view['byteLength'] > length:
            raise ValueError('GLB buffer view outside binary')
    primitive = gltf['meshes'][0]['primitives'][0]
    accessor = gltf['accessors'][primitive['attributes']['POSITION']]
    view = gltf['bufferViews'][accessor['bufferView']]
    position_offset = base+view.get('byteOffset',0)+accessor.get('byteOffset',0)
    spec = importlib.util.spec_from_file_location('mesh_validation',ROOT/'data-pipeline/terrain_mesh/build_mesh.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    col,row,width,height,_ = module.compute_window(manifest['centerLatDeg'],manifest['centerLonDeg'],5,80)
    with module.BigTiffReader(dem_path) as source:
        grid = source.read_window(col,row,width,height)
    if accessor['count'] != width*height:
        raise ValueError('Mesh vertex count differs from native window')
    origin = manifest['meshLocalOrigin']
    for r in range(height):
        for c in range(width):
            actual = struct.unpack_from('<3f',blob,position_offset+12*(r*width+c))
            x,y = module.pixel_to_proj(col+c+0.5,row+r+0.5)
            expected = (x-origin[0],grid[r][c]-origin[2],-(y-origin[1]))
            if any(not math.isfinite(a) or abs(a-b)>0.001 for a,b in zip(actual,expected)):
                raise ValueError('Mesh position/elevation differs from native source')
    index_accessor = gltf['accessors'][primitive['indices']]
    index_view = gltf['bufferViews'][index_accessor['bufferView']]
    index_offset = base+index_view.get('byteOffset',0)+index_accessor.get('byteOffset',0)
    indices = struct.unpack_from('<'+str(index_accessor['count'])+'I',blob,index_offset)
    if max(indices) >= width*height or len(indices) != (width-1)*(height-1)*6:
        raise ValueError('Invalid mesh indices')
    return {'glb_structure_passed':True,'all_vertices_match_native_samples':True,
            'vertex_count':width*height,'triangle_count':len(indices)//3,
            'float32_tolerance_m':0.001,'scientific_review_confirmed':False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dem', type=Path, default=ROOT/'data/raw/LDEM_80S_80MPP_ADJ.TIF')
    parser.add_argument('--output', type=Path, default=ROOT/'.validation/release-assets')
    parser.add_argument('--prepare-runtime', action='store_true', help='Publish only the identity-bound reviewed meshes for the local launcher')
    parser.add_argument('--offline', action='store_true', help='Validate/build existing data without network')
    parser.add_argument('--capture-docs', action='store_true')
    parser.add_argument('--acquire-nac', action='store_true', help='Small georeferenced official LROC NAC example; not a texture for these mesh sites')
    parser.add_argument('--write-launch-env', action='store_true', help='Write candidate paths inside output only; never edit app configuration')
    args = parser.parse_args()
    output = args.output.resolve()
    # Protect tracked runtime assets/configuration even when invoked with custom paths.
    if not output.is_relative_to(ROOT/'.validation'):
        parser.error('--output must be under this worktree .validation directory')
    output.mkdir(parents=True, exist_ok=True)
    if args.capture_docs and not args.offline:
        capture_docs(ROOT/'.validation/official-docs')
    if not args.offline:
        acquire(URL, args.dem, EXPECTED, validate=validate_dem)
    receipt = validate_dem(args.dem)
    acquisition = args.dem.with_name(args.dem.name+'.acquisition.json')
    if acquisition.exists():
        receipt['acquisition'] = json.loads(acquisition.read_text())
    (output/'dem-receipt.json').write_text(json.dumps(receipt, indent=2)+'\n')
    nac = args.dem.parent/'M1188426614LE_20MPP.TIF'
    if args.acquire_nac and not args.offline:
        acquire(NAC_URL, nac, 1411548,
                validate=lambda path: validate_dem(path,1411548,False,NAC_URL))
    if nac.exists():
        nac_receipt = validate_dem(nac,1411548,False,NAC_URL)
        tags = nac_receipt['levels'][0]['tags']
        dem_tags = receipt['levels'][0]['tags']
        if any(tags.get(key) != dem_tags.get(key) for key in ('34735','34736','34737')):
            raise ValueError('NAC CRS differs from DEM; cannot assert shared projected footprint')
        nac_receipt['crs_matches_dem_geokeys'] = True
        x, y = tags['33922'][3:5]
        sx, sy = tags['33550'][:2]
        width, height = tags['256'][0], tags['257'][0]
        nac_receipt['bounds_projected_m'] = [x,y-height*sy,x+width*sx,y]
        nac_receipt['usage'] = 'Georeferenced NAC I/F science image, not RGB. Does not overlap generated mesh sites; no texture applied.'
        nac_receipt['acquisition'] = json.loads(nac.with_name(nac.name+'.acquisition.json').read_text())
        (output/'lroc-receipt.json').write_text(json.dumps(nac_receipt, indent=2)+'\n')
    meshes = []
    for name, lat, lon in [('connecting-ridge',-89.45,-137.31), ('near-shackleton',-89.9,0), ('near-de-gerlache',-88.7,-68)]:
        folder = output/name
        command = [sys.executable,str(ROOT/'data-pipeline/terrain_mesh/build_mesh.py'),
                   '--source-file',str(args.dem), '--lat',str(lat),'--lon',str(lon),'--radius-km','5',
                   '--output',str(folder/'terrain.glb'),'--manifest',str(folder/'terrain-manifest.json'),
                   '--map-manifest',str(folder/'map-manifest.json'),'--demo-url',f'/{name}/terrain.glb','--verbose']
        subprocess.run(command, check=True, timeout=120, cwd=ROOT)
        manifest_path = folder/'terrain-manifest.json'
        manifest = json.loads(manifest_path.read_text())
        mesh_validation = verify_mesh(folder/'terrain.glb',manifest,args.dem)
        (folder/'mesh-validation.json').write_text(json.dumps(mesh_validation,indent=2)+'\n')
        manifest.update(meshValidation=mesh_validation,sourceProvenanceReceipt=str(output/'dem-receipt.json'),
                        sourceLocalSha256=receipt['local_sha256'], texture=None,
                        textureUnavailableReason='No verified overlapping LROC raster acquired',
                        meshLocalSha256=sha256(folder/'terrain.glb'))
        manifest_path.write_text(json.dumps(manifest, indent=2)+'\n')
        meshes.append({'site':name,'mesh':str(folder/'terrain.glb'), 'manifest':str(manifest_path),
                       'actual_bytes':(folder/'terrain.glb').stat().st_size,
                       'local_sha256':manifest['meshLocalSha256'],
                       'origin':manifest['meshLocalOrigin'],'bounds':manifest['boundsProjectedMeters']})
    summary = {'dem_receipt':str(output/'dem-receipt.json'), 'meshes':meshes,
               'scientific_review_confirmed':False, 'generated_utc':datetime.now(timezone.utc).isoformat()}
    (output/'asset-receipt.json').write_text(json.dumps(summary, indent=2)+'\n')
    if args.write_launch_env:
        (output/'candidate-paths.env').write_text(f'LUNAR_DEM_PATH={args.dem.resolve()}\nLUNAR_CANDIDATE_ASSETS={output}\n')
    if args.prepare_runtime:
        from release_assets import prepare_runtime
        runtime = prepare_runtime(args.dem, output)
        summary['reviewedRuntimeRoot'] = str(runtime)
        (output/'asset-receipt.json').write_text(json.dumps(summary, indent=2)+'\n')
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())

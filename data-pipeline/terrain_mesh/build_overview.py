"""Deterministic native-sample polar overview; no interpolation or synthetic fill."""
import hashlib
import importlib.util
import math
from pathlib import Path
import struct

spec = importlib.util.spec_from_file_location('overview_mesh', Path(__file__).with_name('build_mesh.py'))
mesh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mesh)
RINGS = 100
SECTORS = 400


def geometry(source, rings=RINGS, sectors=SECTORS):
    if rings < 2 or sectors < 8:
        raise ValueError('Insufficient overview resolution')
    scale = source.tags[33550]
    tie = source.tags[33922]
    if list(scale[:2]) != [80, 80] or list(tie) != [0, 0, 0, -304000, 304000, 0]:
        raise ValueError('Unexpected source pixel registration')
    radius = mesh.latlon_to_proj(-80, 0)[1]
    xmin, ymax = mesh.pixel_to_proj(.5, .5)
    xmax, ymin = mesh.pixel_to_proj(source._cols-.5, source._rows-.5)
    pixels = []
    # A single centre plus concentric rings avoids the staircase edge of a masked square.
    for ring in range(rings+1):
        for sector in range(1 if ring == 0 else sectors):
            angle = 2*math.pi*sector/sectors
            sx, sy = math.sin(angle), math.cos(angle)
            limit = radius
            for direction, low, high in ((sx,xmin,xmax),(sy,ymin,ymax)):
                if abs(direction) > 1e-12:
                    limit = min(limit, (high if direction > 0 else low)/direction)
            distance = limit*ring/rings
            while True:
                col, row = mesh.proj_to_pixel(distance*sx, distance*sy)
                col, row = math.floor(col), math.floor(row)
                x,y = mesh.pixel_to_proj(col+.5,row+.5)
                if 0 <= col < source._cols and 0 <= row < source._rows and math.hypot(x,y) <= radius:
                    break
                distance -= 40
            pixels.append((col,row))
    # Decode each touched TIFF tile once, not once per vertex or full-raster load.
    groups = {}
    bw = source._tile_width if source._tiled else source._cols
    bh = source._tile_height if source._tiled else source._rows_per_strip
    for index,(col,row) in enumerate(pixels):
        groups.setdefault((col//bw,row//bh),[]).append((index,col,row))
    heights = [None]*len(pixels)
    nodata = source.tags.get(42113)
    if isinstance(nodata, (list,tuple)):
        nodata = nodata[0]
    if isinstance(nodata, bytes):
        nodata = nodata.decode().rstrip('\x00')
    nodata = float(nodata) if nodata is not None else None
    for (tc,tr), samples in sorted(groups.items()):
        c0,r0 = tc*bw,tr*bh
        grid = source.read_window(c0,r0,min(bw,source._cols-c0),min(bh,source._rows-r0))
        for index,col,row in samples:
            value = grid[row-r0][col-c0]
            if math.isfinite(value) and value != nodata:
                heights[index] = value
    positions, uvs, mapping = [], [], {}
    proof = hashlib.sha256()
    for i,((col,row),height) in enumerate(zip(pixels,heights)):
        if height is None:
            continue
        x,y = mesh.pixel_to_proj(col+.5,row+.5)
        mapping[i] = len(positions)
        positions.append((x,height,-y))
        uvs.append(((x-xmin)/(xmax-xmin),(y-ymin)/(ymax-ymin)))
        proof.update(struct.pack('<II3f',col,row,x,height,-y))
    indices = []
    def triangle(a,b,c):
        if all(i in mapping for i in (a,b,c)):
            indices.extend(mapping[i] for i in (a,b,c))
    for s in range(sectors):
        triangle(0,1+(s+1)%sectors,1+s)
    for ring in range(1,rings):
        a = 1+(ring-1)*sectors
        b = a+sectors
        for s in range(sectors):
            t = (s+1)%sectors
            triangle(a+s,b+t,b+s)
            triangle(a+s,a+t,b+t)
    if not indices:
        raise ValueError('No valid overview triangles')
    normals = [[0.,0.,0.] for _ in positions]
    for offset in range(0,len(indices),3):
        a,b,c = (positions[indices[offset+j]] for j in range(3))
        u,v = ([b[j]-a[j] for j in range(3)],[c[j]-a[j] for j in range(3)])
        n = (u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
        for index in indices[offset:offset+3]:
            for j in range(3):
                normals[index][j] += n[j]
    normals = [tuple(v/(math.sqrt(sum(x*x for x in n)) or 1) for v in n) for n in normals]
    bounds = dict(minX=min(p[0] for p in positions),maxX=max(p[0] for p in positions),minY=min(-p[2] for p in positions),maxY=max(-p[2] for p in positions))
    info = {'algorithm':'native-pixel-centre-polar-rings-v1','rings':rings,'sectors':sectors,
            'vertexCount':len(positions),'triangleCount':len(indices)//3,'rejectedNodataSamples':sum(h is None for h in heights),
            'vertexSampleSha256':proof.hexdigest(),'boundsProjectedMeters':bounds,'meshLocalOrigin':[0,0,0],
            'requestedLatitudeMaxDeg':-80,'requestedRadiusMeters':radius,
            'rasterSampleBoundsMeters':dict(minX=xmin,minY=ymin,maxX=xmax,maxY=ymax),
            'coverage':'Inscribed coarse triangulation of latitude <= -80 intersected with raster sample-centre coverage; no extrapolation. Edge discretization is limited by 400 sectors and 80 m source pixels.',
            'sampleProofEncoding':'SHA256 of ordered <II3f little-endian column,row,easting,height,-northing for every emitted vertex'}
    return positions,normals,uvs,indices,info


def generate(dem, output):
    with mesh.BigTiffReader(dem) as source:
        positions,normals,uvs,indices,info = geometry(source)
    mesh._write_glb(output,positions,normals,uvs,indices,info)
    info['meshLocalSha256'] = hashlib.sha256(Path(output).read_bytes()).hexdigest()
    info['meshBytes'] = Path(output).stat().st_size
    return info

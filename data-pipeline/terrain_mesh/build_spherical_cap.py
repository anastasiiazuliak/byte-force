"""Deterministic physical LOLA cap, with no skirts or synthetic geometry."""
import hashlib
import importlib.util
import math
from pathlib import Path
import struct

spec = importlib.util.spec_from_file_location('cap_overview', Path(__file__).with_name('build_overview.py'))
overview = importlib.util.module_from_spec(spec)
spec.loader.exec_module(overview)
RADIUS = 1737400


def projected_to_latlon(easting, northing):
    colat = 2 * math.atan2(math.hypot(easting, northing), 2 * RADIUS)
    return colat - math.pi / 2, math.atan2(easting, northing)


def scene_position(easting, height, northing):
    lat, lon = projected_to_latlon(easting, northing)
    r = RADIUS + height
    x = r * math.cos(lat) * math.cos(lon)
    y = r * math.cos(lat) * math.sin(lon)
    z = r * math.sin(lat)
    return y, -z - RADIUS, -x


def cross(a, b, c):
    u = [b[j]-a[j] for j in range(3)]
    v = [c[j]-a[j] for j in range(3)]
    return (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])


def geometry(source, rings=overview.RINGS, sectors=overview.SECTORS):
    planar, _, uvs, indices, native = overview.geometry(source, rings, sectors)
    # Compute normals from the actual float32 positions stored in the GLB.
    positions = [struct.unpack('<3f', struct.pack('<3f', *scene_position(e,h,-z))) for e,h,z in planar]
    proof = hashlib.sha256()
    for (e,h,z), position in zip(planar, positions):
        col,row = overview.mesh.proj_to_pixel(e,-z)
        proof.update(struct.pack('<II6f', math.floor(col), math.floor(row), e,h,z,*position))
    normals = [[0.,0.,0.] for _ in positions]
    valid_indices = []
    for offset in range(0,len(indices),3):
        ids = indices[offset:offset+3]
        a,b,c = [positions[i] for i in ids]
        n = cross(a,b,c)
        if not any(n):
            continue
        outward = [sum(p[j] for p in (a,b,c))/3 + (RADIUS if j == 1 else 0) for j in range(3)]
        if sum(n[j]*outward[j] for j in range(3)) < 0:
            indices[offset+1],indices[offset+2] = indices[offset+2],indices[offset+1]
            n = tuple(-v for v in n)
        valid_indices.extend(indices[offset:offset+3])
        for i in ids:
            for j in range(3):
                normals[i][j] += n[j]
    indices = valid_indices
    normals = [tuple(v/(math.sqrt(sum(x*x for x in n)) or 1) for v in n) for n in normals]
    info = {**native, 'algorithm':'native-pixel-centre-spherical-cap-v1',
            'nativeVertexSampleSha256':native['vertexSampleSha256'],
            'vertexSampleSha256':proof.hexdigest(),
            'sampleProofEncoding':'SHA256 of ordered <II6f little-endian column,row,easting,height,-northing,sceneX,sceneY,sceneZ for every emitted vertex',
            'triangleCount':len(indices)//3, 'omittedDegenerateTriangles':native['triangleCount']-len(indices)//3,
                        'radiusMeters':RADIUS, 'frame':'MOON_ME_DE421', 'sceneAxes':'Y,-Z-R,-X',
            'heightExaggeration':1, 'decorativeWalls':False}
    return positions,normals,uvs,indices,info


def generate(dem, output):
    with overview.mesh.BigTiffReader(dem) as source:
        positions,normals,uvs,indices,info = geometry(source)
    digest = hashlib.sha256()
    with Path(dem).open('rb') as stream:
        for block in iter(lambda: stream.read(1024*1024), b''):
            digest.update(block)
    info['sourceLocalSha256'] = digest.hexdigest()
    info['sourceBytes'] = Path(dem).stat().st_size
    overview.mesh._write_glb(output,positions,normals,uvs,indices,info)
    info['meshLocalSha256'] = hashlib.sha256(Path(output).read_bytes()).hexdigest()
    info['meshBytes'] = Path(output).stat().st_size
    return info

"""Physical frame, source geometry and publication tamper regressions."""
import json
import math
from pathlib import Path
import tempfile
import unittest
import release_assets as release

ROOT = Path(__file__).resolve().parents[1]
cap = release.spherical_builder()


class FrameTests(unittest.TestCase):
    def test_projection_roundtrip_pole_and_dateline(self):
        for lat in (-90,-89.999999,-85,-80):
            for lon in (-180,-179.999,0,90,179.999,180):
                rho = 2*cap.RADIUS*math.tan(math.radians(lat+90)/2)
                e,n = rho*math.sin(math.radians(lon)),rho*math.cos(math.radians(lon))
                actual_lat,actual_lon = cap.projected_to_latlon(e,n)
                self.assertAlmostEqual(math.degrees(actual_lat),lat,places=10)
                if rho:
                    self.assertAlmostEqual(math.sin(actual_lon),math.sin(math.radians(lon)),places=12)
                    self.assertAlmostEqual(math.cos(actual_lon),math.cos(math.radians(lon)),places=12)

    def test_physical_curvature_and_radial_height(self):
        self.assertAlmostEqual(cap.scene_position(0,123,0)[1],123)
        rho = 2*cap.RADIUS*math.tan(math.radians(10)/2)
        x,y,z = cap.scene_position(0,0,rho)
        self.assertAlmostEqual(y,cap.RADIUS*(math.cos(math.radians(10))-1),places=8)
        self.assertAlmostEqual(z,-cap.RADIUS*math.sin(math.radians(10)),places=8)
        p = cap.scene_position(rho,250,0)
        self.assertAlmostEqual(math.sqrt(p[0]**2+(p[1]+cap.RADIUS)**2+p[2]**2),cap.RADIUS+250)
        # The linear frame rotation has determinant +1, not a reflection.
        self.assertEqual(cap.cross((0,0,0),(0,0,-1),(1,0,0)),(0,-1,0))


@unittest.skipUnless((ROOT/'data/raw/LDEM_80S_80MPP_ADJ.TIF').is_file(),'Real NASA DEM required')
class RealCapTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dem = release.checked_dem(ROOT/'data/raw/LDEM_80S_80MPP_ADJ.TIF')

    def test_every_vertex_source_mapping_normals_and_winding(self):
        with cap.overview.mesh.BigTiffReader(self.dem) as source:
            planar,_,_,_,native = cap.overview.geometry(source)
            positions,normals,_,indices,proof = cap.geometry(source)
        self.assertEqual(len(positions),40001)
        self.assertEqual(len(indices)//3,79600-proof['omittedDegenerateTriangles'])
        self.assertGreater(len(indices)//3,79000)
        self.assertEqual(proof['nativeVertexSampleSha256'],native['vertexSampleSha256'])
        import struct
        for original,p,n in zip(planar,positions,normals):
            e,h,z = original
            self.assertEqual(p,struct.unpack('<3f',struct.pack('<3f',*cap.scene_position(e,h,-z))))
            self.assertAlmostEqual(sum(v*v for v in n),1,places=10)
            self.assertGreater(sum(n[j]*(p[j]+(cap.RADIUS if j==1 else 0)) for j in range(3)),0)
        for offset in range(0,len(indices),3):
            a,b,c = [positions[i] for i in indices[offset:offset+3]]
            n = cap.cross(a,b,c)
            self.assertGreater(sum(n[j]*(a[j]+(cap.RADIUS if j==1 else 0)) for j in range(3)),0)

    def test_determinism_schema_and_tamper(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'.validation') as temporary:
            output = Path(temporary)/'runtime'
            release.prepare_runtime(self.dem,output=output)
            receipt_path = output/'.release-review.json'
            receipt = json.loads(receipt_path.read_text())
            globe = release.catalog(receipt['overview'],receipt['sphericalMesh'])['globe']
            self.assertEqual(globe['id'],'south-pole-globe')
            self.assertEqual(globe['metadata']['assets']['demoMeshUrl'],'/static/globe/terrain.glb')
            self.assertEqual(globe['metadata']['sphericalCap'],dict(validated=True,radiusMeters=1737400,frame='MOON_ME_DE421',sceneAxes='Y,-Z-R,-X',heightExaggeration=1))
            mesh = output/'static/globe/terrain.glb'
            original = mesh.read_bytes()
            mesh.write_bytes(original[:-1]+bytes([original[-1]^1]))
            with self.assertRaisesRegex(ValueError,'Spherical mesh'):
                release.validate_runtime(output)
            mesh.write_bytes(original)
            receipt['sphericalMesh']['vertexSampleSha256'] = '0'*64
            receipt['sphericalMesh']['validated'] = True
            receipt_path.write_bytes(release.encoded(receipt))
            with self.assertRaisesRegex(ValueError,'Spherical metadata/proof'):
                release.validate_runtime(output)
            receipt['sourceLocalSha256'] = '0'*64
            receipt_path.write_bytes(release.encoded(receipt))
            with self.assertRaisesRegex(ValueError,'Runtime approval receipt'):
                release.validate_runtime(output)


if __name__ == '__main__':
    unittest.main()

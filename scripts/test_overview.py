"""Offline overview source, topology, determinism and publication regressions."""
import json
import math
from pathlib import Path

import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import release_assets as release


@unittest.skipUnless((ROOT/'data/raw/LDEM_80S_80MPP_ADJ.TIF').is_file(),
                     'Real NASA DEM opt-in: run asset-setup.py first; CI never fabricates terrain.')
class OverviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dem = release.checked_dem(ROOT/'data/raw/LDEM_80S_80MPP_ADJ.TIF')
        cls.builder = release.overview_builder()

    def test_real_samples_circle_registration_topology_and_normals(self):
        with self.builder.mesh.BigTiffReader(self.dem) as source:
            positions,normals,uvs,indices,info = self.builder.geometry(source,4,16)
            for x,h,z in positions:
                self.assertLessEqual(math.hypot(x,z),info['requestedRadiusMeters'])
                c,r = self.builder.mesh.proj_to_pixel(x,-z)
                self.assertAlmostEqual(c%1,.5)
                self.assertAlmostEqual(r%1,.5)
                self.assertEqual(h,source.read_window(int(c),int(r),1,1)[0][0])
        self.assertEqual(len(positions),65)
        self.assertEqual(len(indices)//3,112)
        self.assertTrue(all(n[1]>0 for n in normals))
        self.assertEqual(set(indices),set(range(len(positions))))
        self.assertEqual(info['meshLocalOrigin'],[0,0,0])

    def test_nodata_is_not_synthetic_geometry(self):
        with self.builder.mesh.BigTiffReader(self.dem) as source:
            source.read_window = lambda c,r,w,h: [[float('nan')]*w for _ in range(h)]
            with self.assertRaisesRegex(ValueError,'No valid overview triangles'):
                self.builder.geometry(source,2,8)

    def test_nodata_hole_removes_incident_triangles(self):
        with self.builder.mesh.BigTiffReader(self.dem) as source:
            original = source.read_window
            def hole(c,r,w,h):
                grid = original(c,r,w,h)
                if c <= 3800 < c+w and r <= 3800 < r+h:
                    grid[3800-r][3800-c] = float('nan')
                return grid
            source.read_window = hole
            positions,_,_,indices,info = self.builder.geometry(source,2,8)
        self.assertEqual(info['rejectedNodataSamples'],1)
        self.assertEqual(len(positions),16)
        self.assertEqual(len(indices)//3,16)
        self.assertTrue(all(i < len(positions) for i in indices))

    def test_deterministic_full_source_proof_and_catalog(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'.validation') as folder:
            a,b = Path(folder)/'a.glb',Path(folder)/'b.glb'
            first = self.builder.generate(self.dem,a)
            second = self.builder.generate(self.dem,b)
            self.assertEqual(first,second)
            self.assertEqual(a.read_bytes(),b.read_bytes())
            self.assertEqual(first['vertexCount'],40001)
            self.assertLess(first['meshBytes'],3_000_000)
            catalog = release.catalog(first)
            self.assertEqual(len(catalog['sites']),3)
            self.assertEqual(catalog['overview']['metadata']['render']['sceneTransform']['verticalOriginM'],0)
            self.assertEqual(catalog['overview']['metadata']['assets']['demoMeshUrl'],'/static/overview/terrain.glb')

    def test_runtime_rejects_mesh_metadata_and_boolean_proof_tampering(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'.validation') as folder:
            output = Path(folder)/'runtime'
            release.prepare_runtime(self.dem,output=output)
            mesh = output/'static/overview/terrain.glb'
            original = mesh.read_bytes()
            mesh.write_bytes(original[:-1]+bytes([original[-1]^1]))
            with self.assertRaisesRegex(ValueError,'Overview mesh'):
                release.validate_runtime(output)
            mesh.write_bytes(original)
            receipt_path = output/'.release-review.json'
            receipt = json.loads(receipt_path.read_text())
            receipt['overview']['vertexSampleSha256'] = '0'*64
            receipt['overview']['validated'] = True
            receipt_path.write_bytes(release.encoded(receipt))
            with self.assertRaisesRegex(ValueError,'Overview metadata/proof'):
                release.validate_runtime(output)


if __name__ == '__main__':
    unittest.main()

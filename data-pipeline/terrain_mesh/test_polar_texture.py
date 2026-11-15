"""Synthetic cartography unit tests; mocked regeneration is not physical validation."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import numpy as np

spec = importlib.util.spec_from_file_location('polar_texture_tested', Path(__file__).with_name('build_polar_texture.py'))
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)


class PolarTextureTests(unittest.TestCase):
    def test_pixel_area_bounds_orientation(self):
        self.assertEqual(p.projected_uv(-304000, -304000), (0, 0))
        self.assertEqual(p.projected_uv(304000, 304000), (1, 1))
        self.assertGreater(p.projected_uv(0, 304000)[1], p.projected_uv(0, -304000)[1])

    def test_nodata_and_gradient_neighbours_remain_transparent(self):
        heights = np.zeros((9, 9))
        valid = np.ones((9, 9), dtype=bool)
        valid[4, 4] = False
        result = p.shade(heights, valid, 296.875)
        for row, col in ((4, 4), (3, 4), (5, 4), (4, 3), (4, 5), (0, 3)):
            with self.subTest(row=row, col=col):
                self.assertEqual(result[row, col, 3], 0)
        self.assertEqual(result[2, 2, 3], 255)
        self.assertTrue(np.all(result[result[:, :, 3] == 0] == 0))

    def test_native_slopes_change_cartographic_tone(self):
        flat = np.zeros((9, 9))
        ramp = np.indices((9, 9))[1]*200
        valid = np.ones((9, 9), dtype=bool)
        self.assertNotEqual(p.shade(flat, valid, 80)[4, 4, 0], p.shade(ramp, valid, 80)[4, 4, 0])

    def test_wrong_source_identity_fails(self):
        with tempfile.TemporaryDirectory() as temporary:
            tmp_path = Path(temporary)
            source = tmp_path/'wrong.tif'
            source.write_bytes(b'not the reviewed DEM')
            with self.assertRaisesRegex(ValueError, 'reviewed DEM'):
                p.generate(source, tmp_path/'relief.png')

    def test_recomputed_identity_rejects_tampering(self):
        for tamper in ('png', 'receipt', 'sidecar'):
            with self.subTest(tamper=tamper), tempfile.TemporaryDirectory() as temporary:
                texture = Path(temporary)/'relief.png'
                texture.write_bytes(b'expected image')
                proof = {'textureLocalSha256':p.digest(texture), 'sourceLocalSha256':p.SOURCE_SHA}
                texture.with_suffix('.json').write_text(json.dumps(proof))
                receipt = dict(proof)
                if tamper == 'png':
                    texture.write_bytes(b'arbitrary replacement')
                    receipt['textureLocalSha256'] = p.digest(texture)
                elif tamper == 'receipt':
                    receipt['sourceLocalSha256'] = 'wrong'
                else:
                    texture.with_suffix('.json').write_text('{}')
                with patch.object(p, 'generate', return_value=proof):
                    with self.assertRaisesRegex(ValueError, 'source-derived'):
                        p.verify('reviewed source', texture, receipt)


if __name__ == '__main__':
    unittest.main()

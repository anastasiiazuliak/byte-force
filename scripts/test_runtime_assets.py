"""Offline static-server and review-boundary regressions; no external NASA requests."""
import functools
import http.server
import importlib.util
from pathlib import Path
import sys
import tempfile
import threading
import unittest
import urllib.request
import urllib.error

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from release_assets import metadata, checked_dem
spec=importlib.util.spec_from_file_location('local_runtime',ROOT/'scripts/run-local.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class StaticSecurityTests(unittest.TestCase):
    def setUp(self):
        (ROOT/'.validation').mkdir(exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=ROOT/'.validation')
        self.base=Path(self.temp.name);self.root=self.base/'assets';(self.root/'terrain').mkdir(parents=True)
        (self.root/'terrain/sample.glb').write_bytes(b'glTF'+b'fixture')
        (self.base/'private.txt').write_text('test-only private data')
        (self.root/'terrain/.env.json').write_text('test-only hidden data')
        (self.root/'terrain/link.json').symlink_to(self.base/'private.txt')
        class Quiet(module.Assets):
            def log_message(self,*args):pass
        self.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(self.root)))
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        self.url=f'http://127.0.0.1:{self.server.server_port}'
    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.thread.join();self.temp.cleanup()
    def test_launcher_rejects_an_existing_service_before_asset_validation(self):
        with self.assertRaisesRegex(RuntimeError, 'Stop the existing launcher'):
            module.require_free_ports((self.server.server_port,))

    def test_glb_mime_and_nosniff(self):
        with urllib.request.urlopen(self.url+'/terrain/sample.glb') as r:
            self.assertEqual(r.headers.get_content_type(),'model/gltf-binary')
            self.assertEqual(r.headers['X-Content-Type-Options'],'nosniff')
            self.assertEqual(r.read(4),b'glTF')
    def test_traversal_directory_and_private_files_are_rejected(self):
        for path in ['/','/terrain/','/.release-review.json','/terrain/../private.txt','/terrain/%2e%2e/private.txt','/terrain/%252e%252e/private.txt','/terrain/link.json','/terrain/%00.glb','/terrain/.env.json']:
            with self.subTest(path=path),self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(self.url+path)
            self.assertEqual(error.exception.code,404)
            error.exception.close()
    def test_wrong_dataset_cannot_be_approved_by_filename(self):
        path=self.base/'LDEM_80S_80MPP_ADJ.TIF';path.write_bytes(b'not a reviewed dataset')
        with self.assertRaises(ValueError):checked_dem(path)
    def test_metadata_excludes_unmeshed_half_pixel_border(self):
        m=metadata('connecting-ridge')
        self.assertEqual(m['render']['boundsMeters'],{'minX':-16280,'minY':-17240,'maxX':-6280,'maxY':-7240})
        self.assertIsNone(m['assets']['surfaceTemplate'])
        self.assertIsNone(m['assets']['hillshadeTemplate'])

if __name__=='__main__':unittest.main()

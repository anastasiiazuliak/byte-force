#!/usr/bin/env python3
"""Offline acquisition tests: no requests to NASA or other external services."""
import contextlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import importlib.util
import struct
import zlib
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'data/scripts'))
from acquisition import acquire, sha256
from validation import validate_dem

BODY = bytes(range(256))*40


@contextlib.contextmanager
def server(mode='normal'):
    class Handler(BaseHTTPRequestHandler):
        calls = 0
        def log_message(self, *args):
            pass
        def do_HEAD(self):
            self.send_response(200)
            self.send_header('Content-Length', str(len(BODY)))
            if mode != 'last-only':
                self.send_header('ETag', 'W/"version1"' if mode == 'weak' else '"version1"')
            self.send_header('Last-Modified', 'Fri, 07 Jul 2023 22:03:02 GMT')
            self.end_headers()
        def do_GET(self):
            Handler.calls += 1
            expected_validator = 'Fri, 07 Jul 2023 22:03:02 GMT' if mode in ('weak','last-only') else '"version1"'
            if self.headers.get('If-Range') != expected_validator:
                self.send_error(412)
                return
            start, end = map(int, self.headers['Range'][6:].split('-'))
            data = BODY[start:end+1]
            if mode == 'retry' and Handler.calls == 1:
                self.send_error(503)
                return
            self.send_response(200 if mode == 'ignore' else 206)
            self.send_header('Content-Range', f'bytes {start+1 if mode == "range" else start}-{end}/{len(BODY)}')
            self.send_header('Content-Length', str(len(data)+1 if mode == 'length' else len(data)))
            if mode != 'last-only':
                self.send_header('ETag', '"version2"' if mode == 'changed' else 'W/"version1"' if mode == 'weak' else '"version1"')
            self.send_header('Last-Modified', 'Sat, 08 Jul 2023 22:03:02 GMT' if mode == 'modified' else 'Fri, 07 Jul 2023 22:03:02 GMT')
            self.end_headers()
            self.wfile.write(data[:-1] if mode == 'truncated' else data)
    http = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=http.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{http.server_port}/dem', Handler
    finally:
        http.shutdown()
        http.server_close()
        thread.join()


class AcquisitionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)/'dem.tif'

    def acquire(self, url, **kwargs):
        return acquire(url, self.path, len(BODY), chunk_size=1024, workers=3, attempts=1, **kwargs)

    def test_ranges_and_receipt_and_idempotence(self):
        with server() as (url, handler):
            receipt = self.acquire(url)
            count = handler.calls
            self.acquire(url)
            self.assertEqual(count, handler.calls)
        self.assertEqual(self.path.read_bytes(), BODY)
        self.assertEqual(receipt['local_sha256'], sha256(self.path))
        self.assertFalse(receipt['scientific_review_confirmed'])
        self.assertIsNone(receipt['publisher_sha256'])

    def test_weak_etag_and_last_modified_only(self):
        for mode in ('weak','last-only'):
            with self.subTest(mode=mode), server(mode) as (url, _):
                self.acquire(url)
                self.assertEqual(self.path.read_bytes(),BODY)
                self.path.unlink()
                self.path.with_name('dem.tif.acquisition.json').unlink()

    def test_reuse_legacy_prefix(self):
        self.path.write_bytes(BODY[:2301])
        with server() as (url, _):
            self.acquire(url)
        self.assertEqual(self.path.read_bytes(), BODY)

    def test_reject_incompatible_prefix_preserves_original(self):
        self.path.write_bytes(b'incompatible')
        with server() as (url, _):
            with self.assertRaises(ValueError):
                self.acquire(url)
        self.assertEqual(self.path.read_bytes(), b'incompatible')

    def test_resume_unreceipted_part(self):
        part = self.path.with_name('dem.tif.part')
        part.write_bytes(BODY[:3001])
        with server() as (url, _):
            self.acquire(url)
        self.assertEqual(self.path.read_bytes(), BODY)

    def test_unsafe_responses_never_finalize(self):
        for mode in ('ignore', 'range', 'length', 'changed', 'modified', 'truncated'):
            with self.subTest(mode=mode), server(mode) as (url, _):
                with self.assertRaises(Exception):
                    self.acquire(url)
                self.assertFalse(self.path.exists())
                for path in self.path.parent.glob('*.part*'):
                    path.unlink()

    def test_retry_backoff(self):
        with server('retry') as (url, handler), patch('acquisition.time.sleep') as sleep:
            acquire(url, self.path, len(BODY), attempts=2, chunk_size=1024)
            sleep.assert_called_once_with(1)
            self.assertGreater(handler.calls, 10)

    def test_checksum_failure_preserves_part(self):
        with server() as (url, _):
            with self.assertRaisesRegex(ValueError, 'checksum'):
                self.acquire(url, publisher_sha256='0'*64)
        self.assertFalse(self.path.exists())
        self.assertEqual(self.path.with_name('dem.tif.part').read_bytes(), BODY)

    def test_validation_before_finalize(self):
        def fail(path):
            raise ValueError('Invalid TIFF')
        with server() as (url, _):
            with self.assertRaisesRegex(ValueError, 'Invalid TIFF'):
                self.acquire(url, validate=fail)
        self.assertFalse(self.path.exists())

    def test_changed_resume_identity(self):
        self.path.with_name('dem.tif.part').write_bytes(BODY[:1024])
        self.path.with_name('dem.tif.part.json').write_text(json.dumps({'identity': {'etag':'old'}}))
        with server() as (url, _):
            with self.assertRaisesRegex(ValueError, 'identity'):
                self.acquire(url)
        self.assertFalse(self.path.exists())

    def test_invalid_tiff(self):
        self.path.write_bytes(BODY)
        with self.assertRaisesRegex(ValueError, 'BigTIFF'):
            validate_dem(self.path, len(BODY))


class TiffAndMeshTests(unittest.TestCase):
    def test_compressed_tile_validation(self):
        # Minimal BigTIFF fixture, entirely local; two-by-two Float32 tile.
        payload = zlib.compress(struct.pack('<4f', 1., 2., 3., 4.))
        tags = {256:(4,[2]),257:(4,[2]),258:(3,[32]),259:(3,[8]),277:(3,[1]),
                317:(3,[1]),322:(4,[2]),323:(4,[2]),324:(16,[0]),325:(16,[len(payload)]),
                339:(3,[3]),34735:(3,[1]),42113:(2,b'nan\0')}
        tile_offset = 16+8+20*len(tags)+8
        tags[324] = (16,[tile_offset])
        header = b'II'+struct.pack('<HHHQ',43,8,0,16)
        entries = b''
        for tag,(kind,values) in sorted(tags.items()):
            raw = values if kind == 2 else struct.pack('<'+str(len(values))+{3:'H',4:'I',16:'Q'}[kind],*values)
            entries += struct.pack('<HHQ',tag,kind,len(values))+raw.ljust(8,b'\0')
        data = header+struct.pack('<Q',len(tags))+entries+struct.pack('<Q',0)+payload
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'fixture.tif'
            path.write_bytes(data)
            receipt = validate_dem(path,len(data),False,'local-test')
            self.assertTrue(receipt['all_deflate_tiles_validated'])
            path.write_bytes(data[:-1]+bytes([data[-1]^255]))
            with self.assertRaises((ValueError,zlib.error)):
                validate_dem(path,len(data),False,'local-test')
            for tag, value in [(322, 65536), (323, 0), (325, 16*1024*1024+1)]:
                with self.subTest(unsafe_tag=tag):
                    broken = bytearray(data)
                    entry = 24 + sorted(tags).index(tag)*20
                    kind = tags[tag][0]
                    raw = struct.pack('<'+{4:'I',16:'Q'}[kind], value)
                    broken[entry+12:entry+20] = raw.ljust(8, b'\0')
                    path.write_bytes(broken)
                    with patch('validation.zlib.decompressobj') as decoder:
                        with self.assertRaisesRegex(ValueError, 'Unsafe|Excessive'):
                            validate_dem(path,len(data),False,'local-test')
                        decoder.assert_not_called()
            broken = bytearray(data)
            broken[8:16] = struct.pack('<Q',len(data)+100)
            path.write_bytes(broken)
            with self.assertRaisesRegex(ValueError,'outside'):
                validate_dem(path,len(data),False,'local-test')

    def test_mesh_rebase_and_nodata_rejection(self):
        spec = importlib.util.spec_from_file_location('mesh', ROOT/'data-pipeline/terrain_mesh/build_mesh.py')
        mesh = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mesh)
        positions, _, _, indices = mesh.build_mesh_from_grid([[10.,11.],[12.,13.]],80,40,40,10,0,0)
        self.assertEqual(positions[0],(40,0,-40))
        self.assertEqual(positions[-1],(120,3,40))
        self.assertEqual(len(indices),6)
        with self.assertRaisesRegex(ValueError,'NoData'):
            mesh.build_mesh_from_grid([[float('nan'),1.],[2.,3.]],80,0,0)


if __name__ == '__main__':
    unittest.main()

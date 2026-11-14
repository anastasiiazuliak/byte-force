#!/usr/bin/env python3
"""Local API + Vite + assets; --smoke exits after bounded HTTP checks."""
import argparse
import functools
import http.server
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]

class Assets(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.glb': 'model/gltf-binary', '.webp': 'image/webp'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--smoke', action='store_true')
    parser.add_argument('--timeout', type=float, default=120, help='startup deadline in seconds')
    parser.add_argument('--assets', type=Path, default=ROOT / 'public-assets')
    parser.add_argument('--dem', type=Path, help='optional actual DEM; never confirms scientific review')
    args = parser.parse_args()
    if args.timeout <= 0:
        parser.error('--timeout must be positive')
    assets = args.assets.resolve(strict=True)
    env = os.environ.copy()
    env.update(API_PROXY_TARGET='http://127.0.0.1:5080',
               STATIC_PROXY_TARGET='http://127.0.0.1:5081',
               ASPNETCORE_URLS='http://127.0.0.1:5080')
    env.setdefault('MapManifest__ManifestPath', str(assets / 'metadata/map-manifest.json'))
    env.setdefault('MapManifest__AssetRootPath', str(assets))
    if args.dem:
        env['Terrain__DemPath'] = str(args.dem.resolve(strict=True))
    children = []
    server = None
    def stop(signum, frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        # Refuse occupied ports instead of accidentally smoke-testing another process.
        for port in (5080, 5081, 5173):
            with socket.socket() as probe:
                probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                probe.bind(('127.0.0.1', port))
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 5081),
            functools.partial(Assets, directory=str(assets)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        for command, cwd in [
            (['dotnet', 'run', '--no-launch-profile', '--project',
              str(ROOT / 'backend/LunarNavigator.Api/LunarNavigator.Api.csproj')], ROOT),
            (['npm', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], ROOT / 'frontend')]:
            children.append(subprocess.Popen(command, cwd=cwd, env=env, start_new_session=True))
        deadline = time.monotonic() + args.timeout
        pending = {
            'http://127.0.0.1:5080/api/v1/health': 'application/json',
            'http://127.0.0.1:5173/api/v1/health': 'application/json',
            'http://127.0.0.1:5080/api/v1/map/metadata': None,
            'http://127.0.0.1:5173/': 'text/html',
            'http://127.0.0.1:5081/terrain/0/0/0.glb': 'model/gltf-binary',
            'http://127.0.0.1:5173/terrain/0/0/0.glb': 'model/gltf-binary',
        }
        while pending:
            if any(p.poll() is not None for p in children):
                raise RuntimeError('API or frontend exited during startup')
            if time.monotonic() >= deadline:
                raise RuntimeError('Startup timed out: ' + ', '.join(pending))
            for url, mime in list(pending.items()):
                try:
                    try:
                        response = urllib.request.urlopen(url, timeout=min(2, max(.1, deadline-time.monotonic())))
                    except urllib.error.HTTPError as error:
                        if mime is None and error.code == 503:
                            print('API ready; map metadata unavailable (503), NOT scientifically verified', flush=True)
                            error.close()
                            del pending[url]
                            continue
                        raise
                    with response:
                        if mime and response.headers.get_content_type() != mime:
                            continue
                        if mime == 'model/gltf-binary' and response.read(4) != b'glTF':
                            continue
                    del pending[url]
                except (OSError, urllib.error.URLError):
                    pass
            time.sleep(.2)
        print('Ready: http://127.0.0.1:5173 (API 5080, static assets 5081)', flush=True)
        if args.smoke:
            print('SMOKE PASS: HTTP readiness and GLB MIME/signature; not a browser/science test', flush=True)
            return 0
        while all(p.poll() is None for p in children):
            time.sleep(.5)
        raise RuntimeError('API or frontend exited')
    except KeyboardInterrupt:
        return 0
    finally:
        for child in children:
            if child.poll() is None:
                os.killpg(child.pid, signal.SIGTERM)
        if server:
            server.shutdown()
            server.server_close()
        for child in children:
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGKILL)
                child.wait(timeout=5)

if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, RuntimeError) as error:
        print(f'Launch failed: {error}', file=sys.stderr)
        sys.exit(1)

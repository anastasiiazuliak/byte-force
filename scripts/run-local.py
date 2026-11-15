#!/usr/bin/env python3
"""Local API + Vite + assets; --smoke exits after bounded HTTP checks."""
import argparse
import functools
import http.server
import json
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
from urllib.parse import unquote, urlsplit
from release_assets import validate_runtime

ROOT = Path(__file__).resolve().parents[1]

class Assets(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.glb': 'model/gltf-binary', '.webp': 'image/webp'}

    def safe_asset(self):
        try:
            path = unquote(urlsplit(self.path).path)
        except ValueError:
            return False
        if '%' in path or '\\' in path or any(part.startswith('.') for part in path.split('/') if part):
            return False
        if not path.startswith(('/terrain/', '/tiles/', '/metadata/', '/illumination/', '/static/')):
            return False
        root = Path(self.directory).resolve()
        try:
            candidate = (root / path.lstrip('/')).resolve()
            return candidate.is_relative_to(root) and candidate.is_file() and candidate.suffix.lower() in {'.glb', '.webp', '.json', '.png'} and not any(part.startswith('.') for part in candidate.relative_to(root).parts)
        except (OSError, ValueError):
            return False

    def do_GET(self):
        if not self.safe_asset():
            self.send_error(404, 'Asset not available')
            return
        try:
            super().do_GET()
        except (BrokenPipeError, ConnectionResetError):
            pass  # Clients may cancel a GLB download or read only its signature.

    def do_HEAD(self):
        if not self.safe_asset():
            self.send_error(404, 'Asset not available')
            return
        super().do_HEAD()

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--smoke', action='store_true')
    parser.add_argument('--timeout', type=float, default=120, help='startup deadline in seconds')
    parser.add_argument('--assets', type=Path, help='Asset root; defaults to verified runtime assets when available, otherwise unreviewed public-assets')
    parser.add_argument('--fallback-assets', action='store_true', help='Use the visibly unverified bundled preview, even if reviewed local assets exist')
    parser.add_argument('--dem', type=Path, help='optional actual DEM; never confirms scientific review')
    args = parser.parse_args()
    if args.timeout <= 0:
        parser.error('--timeout must be positive')
    sdk = subprocess.check_output(['dotnet', '--version'], cwd=ROOT, text=True).strip()
    if not sdk.startswith('10.'):
        parser.error('Stable .NET 10 SDK is required; selected SDK: ' + sdk)
    print('Using .NET SDK ' + sdk, flush=True)
    reviewed = ROOT / '.validation/runtime-assets'
    selected = args.assets or (ROOT/'public-assets' if args.fallback_assets else reviewed if reviewed.exists() else ROOT/'public-assets')
    assets = selected.resolve(strict=True)
    receipt = validate_runtime(assets) if (assets/'.release-review.json').exists() else None
    if receipt:
        print('Reviewed native LOLA asset proof verified; regional/global visibility remains unknown.', flush=True)
    else:
        print('Unverified preview assets: picking disabled. Run scripts/asset-setup.py --prepare-runtime for reviewed data.', flush=True)
    env = os.environ.copy()
    env.update(API_PROXY_TARGET='http://127.0.0.1:5080',
               STATIC_PROXY_TARGET='http://127.0.0.1:5081',
               ASPNETCORE_URLS='http://127.0.0.1:5080')
    env.setdefault('MapManifest__ManifestPath', str(assets / 'metadata/map-manifest.json'))
    env.setdefault('MapManifest__AssetRootPath', str(assets))
    if args.dem:
        env['Terrain__DemPath'] = str(args.dem.resolve(strict=True))
    elif receipt:
        env.setdefault('Terrain__DemPath', receipt['demPath'])
    if receipt:
        if Path(env['MapManifest__ManifestPath']).resolve() != assets/'metadata/map-manifest.json' or Path(env['MapManifest__AssetRootPath']).resolve() != assets:
            parser.error('Reviewed map/static roots must refer to the same proof-checked deployment')
        env.setdefault('MapManifest__MetadataReviewConfirmed', 'true')
    elif env.get('MapManifest__MetadataReviewConfirmed', '').lower() == 'true':
        parser.error('Refusing reviewed-map approval without bound native asset proof')
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
        deadline = time.monotonic() + args.timeout
        for index, (command, cwd) in enumerate([
            (['dotnet', 'run', '--no-launch-profile', '--project',
              str(ROOT / 'backend/LunarNavigator.Api/LunarNavigator.Api.csproj')], ROOT),
            (['npm', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], ROOT / 'frontend')]):
            children.append(subprocess.Popen(command, cwd=cwd, env=env, start_new_session=True))
            if index == 0:
                # Avoid announcing an interactive frontend while its real API is still starting.
                while True:
                    if children[0].poll() is not None:
                        raise RuntimeError('API exited before health readiness')
                    if time.monotonic() >= deadline:
                        raise RuntimeError('API startup timed out')
                    try:
                        with urllib.request.urlopen('http://127.0.0.1:5080/api/v1/health', timeout=2) as response:
                            if json.load(response).get('status') == 'ok':
                                break
                    except urllib.error.HTTPError as error:
                        error.close()
                    except (OSError, ValueError):
                        pass
                    time.sleep(.2)
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
                        if mime is None and error.code == 503 and (not receipt or env.get('MapManifest__MetadataReviewConfirmed', '').lower() != 'true'):
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

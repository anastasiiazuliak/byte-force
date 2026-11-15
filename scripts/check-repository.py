#!/usr/bin/env python3
"""Fast tracked-file guard, not a replacement for GitHub secret scanning."""
from pathlib import Path
import re
import hashlib
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
files = subprocess.check_output(['git', '-C', str(root), 'ls-files', '-z']).decode().split('\0')
# Reviewed, small synthetic test input already in the team history; never a raw NASA DEM.
approved_raster_fixtures = {
    'backend/LunarNavigator.Tests/Terrain/Fixtures/synthetic_lola_sample.tif':
        '82de3a1b5d4c7e73ee4eca19ffff38179f1e072504bb6fd1425a5d4a0fc86f63',
}
patterns = [
    re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    re.compile(rb'gh[pousr]_[A-Za-z0-9]{30,}'),
    re.compile(rb'github_pat_[A-Za-z0-9_]{50,}'),
    re.compile(rb'AKIA[0-9A-Z]{16}'),
]
errors = []
for name in filter(None, files):
    path = root / name
    if not path.is_file():
        continue
    if path.stat().st_size > 5 * 1024 * 1024:
        errors.append(f'{name}: exceeds 5 MiB; publish large assets outside Git')
        continue
    content = path.read_bytes()
    approved_raster = name in approved_raster_fixtures and hashlib.sha256(content).hexdigest() == approved_raster_fixtures[name]
    if (path.name.startswith('.env') and path.name != '.env.example') or (path.suffix.lower() in {'.tif', '.tiff', '.grd', '.pem', '.key', '.pfx'} and not approved_raster):
        errors.append(f'{name}: secret environment/key or raw DEM file must not be tracked')
    if any(part in {'node_modules', 'bin', 'obj', 'dist', '__pycache__'} for part in path.parts):
        errors.append(f'{name}: generated dependency/build directory must not be tracked')
    if any(pattern.search(content) for pattern in patterns):
        errors.append(f'{name}: possible secret detected (value intentionally not printed)')
if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print('Tracked-file guard passed: no oversized files, raw DEM, secret env/key files or recognized token patterns.')
print('Limited pattern scan only; enable GitHub secret scanning/push protection and review changes manually.')

"""Offline regression checks; isolated Git repositories live only in ignored .validation."""
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = 'backend/tests/LunarNavigator.Core.Tests/Terrain/Fixtures/synthetic_lola_sample.tif'

class RepositoryGuardTests(unittest.TestCase):
    def setUp(self):
        (ROOT / '.validation').mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / '.validation')
        self.root = Path(self.temp.name)
        subprocess.run(['git', '-C', str(self.root), 'init', '--quiet'], check=True)
        (self.root / 'scripts').mkdir()
        shutil.copyfile(ROOT / 'scripts/check-repository.py', self.root / 'scripts/check-repository.py')

    def tearDown(self):
        self.temp.cleanup()

    def run_guard(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        subprocess.run(['git', '-C', str(self.root), 'add', '.'], check=True)
        return subprocess.run([sys.executable, str(self.root / 'scripts/check-repository.py')], capture_output=True)

    def test_reviewed_fixture_passes(self):
        self.assertEqual(self.run_guard(FIXTURE, (ROOT / FIXTURE).read_bytes()).returncode, 0)

    def test_modified_fixture_fails(self):
        self.assertNotEqual(self.run_guard(FIXTURE, (ROOT / FIXTURE).read_bytes() + b'modified').returncode, 0)

    def test_other_raw_dem_fails(self):
        self.assertNotEqual(self.run_guard('data/other.tif', b'not approved').returncode, 0)

    def test_secret_env_fails(self):
        self.assertNotEqual(self.run_guard('.env.local', b'not a real secret').returncode, 0)

    def test_recognized_token_fails(self):
        self.assertNotEqual(self.run_guard('config.txt', b'ghp_' + b'A' * 36).returncode, 0)

    def test_generated_artifact_fails(self):
        self.assertNotEqual(self.run_guard('backend/bin/output.txt', b'build artifact').returncode, 0)

    def test_large_file_fails(self):
        self.assertNotEqual(self.run_guard('asset.dat', b'x' * (5 * 1024 * 1024 + 1)).returncode, 0)

if __name__ == '__main__':
    unittest.main()

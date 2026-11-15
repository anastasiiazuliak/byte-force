"""Process orchestration checks without starting or stopping real services."""
import importlib.util
from pathlib import Path
import signal
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location('launcher', Path(__file__).with_name('run-local.py'))
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


class LocalLauncherTests(unittest.TestCase):
    def test_windows_npm_uses_cmd_and_new_process_group(self):
        with patch.object(launcher.os, 'name', 'nt'), \
             patch.object(launcher.shutil, 'which', return_value=r'C:\Node Tools\npm.cmd'), \
             patch.object(launcher.subprocess, 'CREATE_NEW_PROCESS_GROUP', 512, create=True), \
             patch.object(launcher.subprocess, 'Popen') as popen:
            launcher.start_service(['npm', 'run', 'dev'], 'frontend', {'COMSPEC': 'cmd.exe'})
            command = popen.call_args.args[0]
            self.assertEqual(command[:4], ['cmd.exe', '/d', '/s', '/c'])
            self.assertEqual(command[4], '"C:\\Node Tools\\npm.cmd" run dev')
            self.assertEqual(popen.call_args.kwargs['creationflags'], 512)

    def test_missing_windows_npm_reports_actionable_error(self):
        with patch.object(launcher.os, 'name', 'nt'), \
             patch.object(launcher.shutil, 'which', return_value=None):
            with self.assertRaisesRegex(RuntimeError, 'npm.cmd not found'):
                launcher.start_service(['npm', 'run', 'dev'], 'frontend', {})

    def test_windows_cleanup_targets_only_owned_process_tree(self):
        with patch.object(launcher.os, 'name', 'nt'), \
             patch.object(launcher.subprocess, 'run') as run:
            launcher.stop_service(Mock(pid=1234), force=True)
            self.assertEqual(run.call_args.args[0], ['taskkill', '/PID', '1234', '/T', '/F'])

    def test_unix_uses_separate_session_and_group_shutdown(self):
        with patch.object(launcher.os, 'name', 'posix'), \
             patch.object(launcher.subprocess, 'Popen') as popen, \
             patch.object(launcher.os, 'killpg', create=True) as killpg:
            launcher.start_service(['npm', 'run', 'dev'], 'frontend', {})
            self.assertTrue(popen.call_args.kwargs['start_new_session'])
            launcher.stop_service(Mock(pid=4321))
            killpg.assert_called_once_with(4321, signal.SIGTERM)


if __name__ == '__main__':
    unittest.main()

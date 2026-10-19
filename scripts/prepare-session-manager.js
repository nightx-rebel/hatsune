import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'temp', 'wa-multi-socket-build');
const installedPackage = path.join(root, 'node_modules', 'wa-multi-socket');
const pinnedCommit = '2243c6e2f8e147d6ae85fda02f248ae38b46696b';
const repository = 'https://github.com/nightx-rebel/wa-multi-socket.git';

if (existsSync(path.join(installedPackage, 'dist', 'index.js'))) {
  process.exit(0);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

rmSync(buildDir, { recursive: true, force: true });
mkdirSync(buildDir, { recursive: true });

execFileSync('git', ['init', buildDir], { stdio: 'inherit' });
execFileSync('git', ['-C', buildDir, 'fetch', '--depth=1', repository, pinnedCommit], {
  stdio: 'inherit',
});
execFileSync('git', ['-C', buildDir, 'checkout', '--detach', 'FETCH_HEAD'], {
  stdio: 'inherit',
});
execFileSync(npmCommand, ['ci', '--include=dev', '--ignore-scripts', '--no-audit', '--no-fund'], {
  cwd: buildDir,
  stdio: 'inherit',
});
execFileSync(npmCommand, ['run', 'build'], { cwd: buildDir, stdio: 'inherit' });

cpSync(path.join(buildDir, 'dist'), path.join(installedPackage, 'dist'), {
  recursive: true,
});

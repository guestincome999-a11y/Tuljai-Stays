import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'linux' || process.arch !== 'x64') {
  process.exit(0);
}

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(appDirectory, '..', '..');

installLinuxBinary(repositoryRoot, '1.27.0');
installLinuxBinary(resolve(repositoryRoot, 'node_modules', 'lightningcss'), '1.33.0');

function installLinuxBinary(prefix, version) {
  const result = spawnSync(
    'npm',
    [
      'install',
      '--no-save',
      '--ignore-scripts',
      '--force',
      '--package-lock=false',
      '--prefix',
      prefix,
      `lightningcss-linux-x64-gnu@${version}`,
    ],
    { encoding: 'utf8', stdio: 'inherit' },
  );

  if (result.status !== 0) {
    throw new Error(`Unable to install lightningcss Linux binary ${version}`);
  }
}

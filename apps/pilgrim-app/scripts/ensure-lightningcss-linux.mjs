import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'linux' || process.arch !== 'x64') {
  process.exit(0);
}

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(appDirectory, '..', '..');
const rootModules = resolve(repositoryRoot, 'node_modules');
const lightningcssDirectory = resolve(rootModules, 'lightningcss');

installLinuxBinary(rootModules, '1.27.0');

if (existsSync(lightningcssDirectory)) {
  installLinuxBinary(resolve(lightningcssDirectory, 'node_modules'), '1.33.0');
}

// Extracts the binary straight into node_modules instead of running
// `npm install`. An install here re-resolves the whole tree without the
// lockfile, which moves hoisted packages such as babel-preset-expo out of the
// root node_modules and breaks the Metro bundle step on EAS.
function installLinuxBinary(modulesDirectory, version) {
  const packageName = 'lightningcss-linux-x64-gnu';
  const targetDirectory = join(modulesDirectory, packageName);
  const workDirectory = mkdtempSync(join(tmpdir(), 'lightningcss-'));

  try {
    run('npm', ['pack', `${packageName}@${version}`, '--ignore-scripts'], workDirectory);
    mkdirSync(targetDirectory, { recursive: true });
    run(
      'tar',
      [
        '-xzf',
        join(workDirectory, `${packageName}-${version}.tgz`),
        '-C',
        targetDirectory,
        '--strip-components=1',
      ],
      workDirectory,
    );
  } catch (error) {
    throw new Error(`Unable to install lightningcss Linux binary ${version}: ${error.message}`);
  } finally {
    rmSync(workDirectory, { recursive: true, force: true });
  }
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: 'inherit' });

  if (result.status !== 0) {
    throw new Error(`${command} ${args[0]} exited with status ${result.status}`);
  }
}

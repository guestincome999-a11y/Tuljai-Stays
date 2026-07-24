import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const tscPath = require.resolve('typescript/bin/tsc');
const mainPath = resolve(backendRoot, 'dist/backend/src/main.js');

let apiProcess;
let compilerOutput = '';
let stopping = false;

const compilerProcess = spawn(
  process.execPath,
  [tscPath, '-p', 'tsconfig.json', '--watch', '--preserveWatchOutput'],
  {
    cwd: backendRoot,
    stdio: ['inherit', 'pipe', 'pipe'],
  },
);

function handleCompilerOutput(chunk, outputStream) {
  outputStream.write(chunk);
  compilerOutput = `${compilerOutput}${chunk.toString()}`.slice(-8_192);

  if (!apiProcess && /Found 0 errors?\. Watching for file changes\./u.test(compilerOutput)) {
    startApi();
  }
}

compilerProcess.stdout.on('data', (chunk) => {
  handleCompilerOutput(chunk, process.stdout);
});
compilerProcess.stderr.on('data', (chunk) => {
  handleCompilerOutput(chunk, process.stderr);
});

compilerProcess.on('exit', (code) => {
  if (!stopping) {
    console.error(`TypeScript watch process exited with code ${code ?? 1}.`);
    shutdown(code ?? 1);
  }
});

function startApi() {
  apiProcess = spawn(process.execPath, ['--watch', '--watch-preserve-output', mainPath], {
    cwd: backendRoot,
    stdio: 'inherit',
  });

  apiProcess.on('exit', (code) => {
    if (!stopping && code !== 0) {
      console.error(`API watch process exited with code ${code ?? 1}.`);
      apiProcess = undefined;
    }
  });
}

function shutdown(code = 0) {
  if (stopping) {
    return;
  }

  stopping = true;
  apiProcess?.kill();
  compilerProcess.kill();

  setTimeout(() => {
    process.exit(code);
  }, 250).unref();
}

process.once('SIGINT', () => shutdown());
process.once('SIGTERM', () => shutdown());

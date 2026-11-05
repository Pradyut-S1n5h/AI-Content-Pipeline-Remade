import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pythonCandidates = process.platform === 'win32'
  ? [['py', ['-3.11']], ['python', []]]
  : [['python3.11', []], ['python3', []]];

function pythonVersion(command, prefix) {
  const result = spawnSync(command, [...prefix, '--version'], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  const version = `${result.stdout}${result.stderr}`.match(/Python (\d+)\.(\d+)/);
  return version ? { major: Number(version[1]), minor: Number(version[2]) } : null;
}

const selected = pythonCandidates
  .map(([command, prefix]) => ({ command, prefix, version: pythonVersion(command, prefix) }))
  .find((candidate) => candidate.version?.major === 3 && candidate.version.minor === 11);

if (!selected) {
  console.error('Local image/video inference requires Python 3.11. Install Python 3.11, then rerun `npm run setup:local-ai`.');
  process.exit(1);
}

const venv = path.join(root, '.venv-ai');
const python = path.join(venv, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
if (!existsSync(python)) {
  const create = spawnSync(selected.command, [...selected.prefix, '-m', 'venv', venv], { stdio: 'inherit', cwd: root });
  if (create.status !== 0) process.exit(create.status || 1);
}

const install = spawnSync(python, ['-m', 'pip', 'install', '--upgrade', 'pip'], { stdio: 'inherit', cwd: root });
if (install.status !== 0) process.exit(install.status || 1);
const hasNvidiaGpu = spawnSync(
  'nvidia-smi',
  ['--query-gpu=name', '--format=csv,noheader'],
  { stdio: 'ignore' },
).status === 0;
const torchIndex = process.platform === 'darwin'
  ? undefined
  : hasNvidiaGpu ? undefined : 'https://download.pytorch.org/whl/cpu';
const torchInstall = spawnSync(
  python,
  ['-m', 'pip', 'install', 'torch==2.6.0', ...(torchIndex ? ['--index-url', torchIndex] : [])],
  { stdio: 'inherit', cwd: root },
);
if (torchInstall.status !== 0) process.exit(torchInstall.status || 1);
const requirements = spawnSync(python, ['-m', 'pip', 'install', '-r', path.join(root, 'requirements-local.txt')], {
  stdio: 'inherit',
  cwd: root,
});
if (requirements.status !== 0) process.exit(requirements.status || 1);

const ollama = spawnSync('ollama', ['--version'], { encoding: 'utf8' });
if (ollama.status !== 0) {
  console.warn('Ollama was not found. Install Ollama from https://ollama.com/download and start it before using writing generation.');
} else {
  console.log('Ollama is installed. The app can pull the writing model from Model Setup.');
}

console.log('Local media runtime installed. Launch with `npm run dev`, then install models from Model Setup.');

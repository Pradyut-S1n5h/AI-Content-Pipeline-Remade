/**
 * Express API and Vite host. All generation requests stay on this machine:
 * text uses Ollama on loopback; image and video use the local Diffusers worker.
 */

import express, { NextFunction, Request, Response as ExpressResponse } from 'express';
import path from 'node:path';
import os from 'node:os';
import { spawn, ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const root = path.dirname(fileURLToPath(import.meta.url));
const modelConfig = JSON.parse(readFileSync(path.join(root, 'local-models.json'), 'utf8')) as Record<string, {
  label: string; runtime: string; model: string; storage: string; storageBytes: number; license: string;
  repository: string; minimum: string; tasks: string[];
  hardware: { minRamMb: number; minCpuRamMb?: number; minAvailableRamMb?: number; minVramMb?: number; cuda?: boolean };
}>;
const app = express();
const port = Number(process.env.PORT || 3000);
const workerUrl = 'http://127.0.0.1:8765';
const ollamaUrl = 'http://127.0.0.1:11434';
const outputDir = path.join(root, '.local-ai', 'outputs');
const workerPython = path.join(
  root,
  '.venv-ai',
  process.platform === 'win32' ? 'Scripts' : 'bin',
  process.platform === 'win32' ? 'python.exe' : 'python',
);
let workerProcess: ChildProcess | undefined;

interface LocalJob {
  id: string;
  kind: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  error?: string;
  output?: string;
  mimeType?: string;
}

const localJobs = new Map<string, LocalJob>();
const activeGenerations = new Set<string>();
let textGenerationActive = false;

app.use(express.json({ limit: '2mb' }));
app.use('/generated', express.static(outputDir, { fallthrough: false, maxAge: '1d' }));

function sendError(res: ExpressResponse, error: unknown) {
  const message = error instanceof Error ? error.message : 'Local generation failed.';
  const status = /already active|already being installed|already running|cannot be cancelled/i.test(message) ? 409
    : /not installed|not running|not meet|needs a CUDA|needs at least|not available/i.test(message)
    ? 503
    : /needs .*(RAM|VRAM|CUDA)|disabled on this hardware/i.test(message) ? 503
    : /out of memory/i.test(message) ? 507 : 500;
  return res.status(status).json({ success: false, error: message });
}

function validatePrompt(prompt: unknown, maximum = 4000): prompt is string {
  return typeof prompt === 'string' && prompt.trim().length > 0 && prompt.length <= maximum;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function localFetch(url: string, init?: RequestInit): Promise<globalThis.Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new Error('The local inference runtime is not running. Follow the setup instructions in README.md; no remote provider will be used.');
  }
}

async function getOllamaModels(): Promise<string[]> {
  const response = await localFetch(`${ollamaUrl}/api/tags`);
  if (!response.ok) throw new Error('Ollama did not return its local model list.');
  const payload = await response.json() as { models?: Array<{ name?: string }> };
  return (payload.models || []).flatMap((model) => model.name ? [model.name] : []);
}

function isOllamaModelInstalled(names: string[]) {
  const expected = modelConfig.writing.model;
  return names.some((name) => name === expected || name.startsWith(`${expected}:`) || name.startsWith(`${expected.split(':')[0]}:`) && name.includes(expected.split(':')[1]));
}

async function generateText(prompt: string, options: { system?: string; json?: boolean; tokens?: number } = {}) {
  if (textGenerationActive) throw new Error('A writing generation is already active. Wait for it to finish.');
  textGenerationActive = true;
  try {
    const requirements = modelConfig.writing.hardware;
    if (os.totalmem() < requirements.minRamMb * 1_000_000 ||
        os.freemem() < (requirements.minAvailableRamMb || 0) * 1_000_000) {
      throw new Error(`The writing model needs ${modelConfig.writing.minimum}. Close other workloads or use a larger machine.`);
    }
    const names = await getOllamaModels();
    if (!isOllamaModelInstalled(names)) {
      throw new Error(`The default writing model (${modelConfig.writing.model}) is not installed. Open Model Setup and install it.`);
    }
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelConfig.writing.model,
        stream: false,
        ...(options.json ? { format: 'json' } : {}),
        messages: [
          ...(options.system ? [{ role: 'system', content: options.system }] : []),
          { role: 'user', content: prompt },
        ],
        options: { num_predict: options.tokens || 2048, temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(10 * 60_000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Local text generation failed (${response.status}): ${body.slice(0, 400) || 'Ollama returned an error.'}`);
    }
    const result = await response.json() as { message?: { content?: string }; error?: string };
    if (result.error) throw new Error(`Local text generation failed: ${result.error}`);
    if (typeof result.message?.content !== 'string' || !result.message.content.trim()) {
      throw new Error('The local model returned an empty response.');
    }
    return result.message.content.trim();
  } finally {
    textGenerationActive = false;
  }
}

async function generateJson<T>(prompt: string, system: string, required: string[]): Promise<T> {
  const content = await generateText(prompt, { system, json: true, tokens: 4096 });
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new Error('The local model returned invalid JSON. Please retry with a shorter prompt.');
  }
  if (!value || typeof value !== 'object' || required.some((key) => !(key in value))) {
    throw new Error('The local model response did not contain the required fields. Please retry.');
  }
  return value as T;
}

async function workerRequest(route: string, init?: RequestInit) {
  try {
    const response = await fetch(`${workerUrl}${route}`, {
      ...init,
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    const result = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'The local media worker returned an error.');
    return result;
  } catch (error) {
    if (error instanceof Error && error.message !== 'fetch failed' && !error.name.includes('Timeout')) throw error;
    throw new Error('The local image/video worker is unavailable. Use Python 3.11 and run `npm run setup:local-ai`; no remote service will be used.');
  }
}

async function getLocalStatus() {
  const [ollama, worker] = await Promise.allSettled([
    getOllamaModels(),
    workerRequest('/status'),
  ]);
  const names = ollama.status === 'fulfilled' ? ollama.value : [];
  const workerData = worker.status === 'fulfilled' ? worker.value as {
    hardware?: Record<string, unknown>;
    models?: Record<string, Record<string, unknown>>;
  } : {};
  const hardware = workerData.hardware || {
    os: `${os.platform()} ${os.release()}`,
    python: 'worker unavailable',
    cpuCores: os.cpus().length,
    ramMb: Math.floor(os.totalmem() / 1024 / 1024),
    availableRamMb: 0,
    gpu: null,
    vramMb: 0,
    cuda: false,
    diskFreeMb: 0,
  };
  const workerModels = workerData.models || {};
  const mediaRuntimeRunning = worker.status === 'fulfilled' && hardware.torchAvailable === true;
  const writingInstalled = isOllamaModelInstalled(names);
  const writingRuntimeRunning = ollama.status === 'fulfilled';
  const writingResourceError = !writingRuntimeRunning ? 'Ollama is not running on this machine.'
    : os.totalmem() < modelConfig.writing.hardware.minRamMb * 1_000_000 ||
      os.freemem() < (modelConfig.writing.hardware.minAvailableRamMb || 0) * 1_000_000
      ? `The writing model needs ${modelConfig.writing.minimum}.` : undefined;
  return {
    hardware,
    models: {
      writing: {
        ...modelConfig.writing,
        installed: writingInstalled,
        ready: writingInstalled && writingRuntimeRunning && !writingResourceError,
        runtimeRunning: writingRuntimeRunning,
        resourceError: writingResourceError,
      },
      image: {
        ...modelConfig.image,
        ...(workerModels.image || {}),
        installed: workerModels.image?.installed === true,
        ready: workerModels.image?.ready === true,
        runtimeRunning: mediaRuntimeRunning,
      },
      video: {
        ...modelConfig.video,
        ...(workerModels.video || {}),
        installed: workerModels.video?.installed === true,
        ready: workerModels.video?.ready === true,
        runtimeRunning: mediaRuntimeRunning,
      },
    },
  };
}

function startTextModelInstall(): string {
  const existing = [...localJobs.values()].find((job) => job.kind === 'writing' && ['queued', 'running'].includes(job.status));
  if (existing) throw new Error('The writing model is already being installed.');
  const id = randomUUID();
  const job: LocalJob = { id, kind: 'writing', status: 'queued', progress: 0, message: 'Connecting to local Ollama' };
  localJobs.set(id, job);
  void (async () => {
    try {
      const response = await fetch(`${ollamaUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelConfig.writing.model, stream: true }),
      });
      if (!response.ok || !response.body) {
        throw new Error('Ollama could not start the model download. Check that the local Ollama runtime is running.');
      }
      job.status = 'running';
      job.message = 'Downloading writing model';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const progress = JSON.parse(line) as { status?: string; completed?: number; total?: number; error?: string };
          if (progress.error) throw new Error(progress.error);
          job.message = progress.status || job.message;
          if (progress.total) job.progress = Math.min(99, Math.floor((progress.completed || 0) * 100 / progress.total));
        }
      }
      job.status = 'completed';
      job.progress = 100;
      job.message = 'Writing model installed';
    } catch (error) {
      job.status = 'failed';
      job.message = 'Model installation failed';
      job.error = error instanceof Error ? error.message : 'Could not install the local model.';
    }
  })();
  return id;
}

app.get('/api/health', async (_req: Request, res: ExpressResponse) => {
  const status = await getLocalStatus();
  res.json({
    status: 'ok',
    localInference: true,
    modelsReady: Object.values(status.models).filter((model) => model.ready).length,
    models: status.models,
    hardware: status.hardware,
  });
});

app.get('/api/local/status', async (_req: Request, res: ExpressResponse) => {
  res.json({ success: true, data: await getLocalStatus() });
});

app.post('/api/local/install/:kind', async (req: Request, res: ExpressResponse) => {
  const kind = req.params.kind;
  if (!(kind in modelConfig)) return res.status(404).json({ success: false, error: 'Unknown local model.' });
  try {
    const id = kind === 'writing'
      ? startTextModelInstall()
      : String((await workerRequest(`/install/${kind}`, { method: 'POST', body: '{}' })).id);
    return res.status(202).json({ success: true, data: { id } });
  } catch (error) {
    return sendError(res, error);
  }
});

app.get('/api/local/jobs/:id', async (req: Request, res: ExpressResponse) => {
  const localJob = localJobs.get(req.params.id);
  if (localJob) return res.json({ success: true, data: localJob });
  try {
    const job = await workerRequest(`/jobs/${encodeURIComponent(req.params.id)}`);
    return res.json({ success: true, data: job });
  } catch (error) {
    return sendError(res, error);
  }
});

app.post('/api/local/jobs/:id/cancel', async (req: Request, res: ExpressResponse) => {
  const job = localJobs.get(req.params.id);
  if (job?.kind === 'writing') {
    return res.status(409).json({ success: false, error: 'Ollama model downloads cannot be cancelled by this application.' });
  }
  try {
    await workerRequest(`/jobs/${encodeURIComponent(req.params.id)}/cancel`, { method: 'POST', body: '{}' });
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

app.post('/api/local/generate/:kind', async (req: Request, res: ExpressResponse) => {
  const kind = req.params.kind;
  if (kind !== 'image' && kind !== 'video') {
    return res.status(404).json({ success: false, error: 'Choose image or video generation.' });
  }
  const key = `${kind}`;
  if (activeGenerations.has(key)) {
    return res.status(409).json({ success: false, error: `A ${kind} generation is already active.` });
  }
  if (!validatePrompt(req.body?.prompt)) {
    return res.status(400).json({ success: false, error: 'Prompt must contain 1–4,000 characters.' });
  }
  const options: unknown = req.body.options;
  if (options !== undefined && !isRecord(options)) {
    return res.status(400).json({ success: false, error: 'Generation options must be an object.' });
  }
  if (kind === 'image' && options !== undefined) {
    const { width, height } = options;
    if (width !== undefined && (typeof width !== 'number' || !Number.isInteger(width) || width < 256 || width > 768 || width % 8) ||
        height !== undefined && (typeof height !== 'number' || !Number.isInteger(height) || height < 256 || height > 768 || height % 8)) {
      return res.status(400).json({ success: false, error: 'Image dimensions must be multiples of 8 between 256 and 768.' });
    }
  }
  if (kind === 'video' && options?.duration !== undefined &&
      (typeof options.duration !== 'number' || !Number.isInteger(options.duration) || options.duration < 2 || options.duration > 6)) {
    return res.status(400).json({ success: false, error: 'Video duration must be an integer from 2 to 6 seconds.' });
  }
  activeGenerations.add(key);
  try {
    const result = await workerRequest(`/generate/${kind}`, {
      method: 'POST',
      body: JSON.stringify({ prompt: req.body.prompt, options: req.body.options || {} }),
    });
    return res.status(202).json({ success: true, data: result });
  } catch (error) {
    return sendError(res, error);
  } finally {
    activeGenerations.delete(key);
  }
});

app.post('/api/generate/writing', async (req: Request, res: ExpressResponse) => {
  if (!validatePrompt(req.body?.prompt, 10_000)) {
    return res.status(400).json({ success: false, error: 'Prompt must contain 1–10,000 characters.' });
  }
  try {
    const text = await generateText(req.body.prompt, { tokens: 2048 });
    return res.json({ success: true, data: { text, model: modelConfig.writing.label } });
  } catch (error) {
    return sendError(res, error);
  }
});

app.post('/api/ai/script', async (req: Request, res: ExpressResponse) => {
  const { idea, title, contentType, tone, targetAudience, durationMinutes, language, visualStyle } = req.body || {};
  if (!validatePrompt(idea, 20_000)) return res.status(400).json({ success: false, error: 'Project idea must contain text and be 20,000 characters or fewer.' });
  try {
    const data = await generateJson(
      `Create a complete script for this idea:\n${idea}\nTitle: ${title || 'Untitled'}\nContent type: ${contentType || 'short film'}\nTone: ${tone || 'cinematic'}\nAudience: ${targetAudience || 'general'}\nDuration: ${durationMinutes || 3} minutes\nLanguage: ${language || 'English'}\nVisual style: ${visualStyle || 'cinematic'}\nReturn title, logline, synopsis, fullScript, and targetAudienceNotes.`,
      'You are a professional screenwriter. Return one JSON object. The fullScript must be a useful screenplay, not an outline.',
      ['title', 'logline', 'synopsis', 'fullScript'],
    );
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

app.post('/api/ai/regenerate-section', async (req: Request, res: ExpressResponse) => {
  const { sectionType, currentScript, projectIdea, instructions } = req.body || {};
  if (!['title', 'logline', 'synopsis', 'fullScript'].includes(sectionType) || !currentScript ||
      !validatePrompt(projectIdea, 20_000) || typeof instructions !== 'string' || instructions.length > 4_000) {
    return res.status(400).json({ success: false, error: 'Provide a valid screenplay section, project idea, and instructions.' });
  }
  try {
    const content = await generateText(
      `Rewrite only the ${sectionType}.\nProject idea: ${projectIdea}\nCurrent script: ${JSON.stringify(currentScript)}\nInstructions: ${instructions || 'Make it more compelling and cinematic.'}`,
      { system: 'You are a screenwriter. Return only the revised content with no commentary.' },
    );
    return res.json({ success: true, data: { sectionType, content } });
  } catch (error) {
    return sendError(res, error);
  }
});

app.post('/api/ai/bible', async (req: Request, res: ExpressResponse) => {
  const { script, title, contentType } = req.body || {};
  if (!validatePrompt(script, 100_000)) return res.status(400).json({ success: false, error: 'A screenplay of 100,000 characters or fewer is required.' });
  try {
    const bible = await generateJson(
      `Extract the visual world from this screenplay.\nTitle: ${title || ''}\nType: ${contentType || ''}\nScreenplay:\n${script}\nReturn visualTheme, characters (name, role, description, appearance, personality, clothing, visualMarkers), locations (name, description, environment, visualCharacteristics, timeAndLighting), and props (name, description, visualDetails).`,
      'You are a production designer. Return accurate visual details in one JSON object.',
      ['visualTheme', 'characters', 'locations'],
    ) as { visualTheme: string; characters: Array<Record<string, unknown>>; locations: Array<Record<string, unknown>>; props?: Array<Record<string, unknown>> };
    bible.characters = (bible.characters || []).map((character, index) => ({ id: character.id || `char-${index + 1}`, ...character }));
    bible.locations = (bible.locations || []).map((location, index) => ({ id: location.id || `loc-${index + 1}`, ...location }));
    bible.props = (bible.props || []).map((prop, index) => ({ id: prop.id || `prop-${index + 1}`, ...prop }));
    return res.json({ success: true, data: bible });
  } catch (error) {
    return sendError(res, error);
  }
});

app.post('/api/ai/scenes', async (req: Request, res: ExpressResponse) => {
  const { script, title, contentType, durationMinutes, bible } = req.body || {};
  if (!validatePrompt(script, 100_000)) return res.status(400).json({ success: false, error: 'A screenplay of 100,000 characters or fewer is required.' });
  try {
    const result = await generateJson<{ scenes: Array<Record<string, unknown>> }>(
      `Break this screenplay into a concise sequence of 1–8 scenes (max 8 for resource limits). Title: ${title || ''}; type: ${contentType || ''}; duration: ${durationMinutes || 1} minutes. World reference: ${JSON.stringify(bible || {})}\nScreenplay:\n${script}\nReturn JSON with a "scenes" array; each scene has title, description, setting, timeOfDay, characters, actions, dialogue, cameraDirection, mood, visualStyle, durationSeconds, imagePrompt, videoPrompt.`,
      'You are a film director and storyboard artist. Return valid JSON. Preserve character/location details and keep visual prompts useful.',
      ['scenes'],
    );
    const scenes = result.scenes;
    const data = scenes.map((scene, index) => ({
      id: randomUUID(),
      sceneNumber: index + 1,
      title: scene.title || `Scene ${index + 1}`,
      description: scene.description || '',
      setting: scene.setting || '',
      timeOfDay: scene.timeOfDay || 'day',
      characters: Array.isArray(scene.characters) ? scene.characters : [],
      actions: scene.actions || '',
      dialogue: scene.dialogue || '',
      cameraDirection: scene.cameraDirection || '',
      mood: scene.mood || '',
      visualStyle: scene.visualStyle || '',
      durationSeconds: Number(scene.durationSeconds) || 10,
      imagePrompt: scene.imagePrompt || scene.description || '',
      videoPrompt: scene.videoPrompt || '',
    }));
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

app.post('/api/ai/visual-prompts', async (req: Request, res: ExpressResponse) => {
  const { scene, bible, visualStyle } = req.body || {};
  if (!scene || typeof scene !== 'object') return res.status(400).json({ success: false, error: 'A scene is required.' });
  try {
    const prompt = await generateText(
      `Create one detailed image prompt for this scene. Scene: ${JSON.stringify(scene)}. Character/location reference: ${JSON.stringify(bible || {})}. Style: ${visualStyle || ''}.`,
      { system: 'You are a visual prompt writer. Return only the prompt.' },
    );
    return res.json({ success: true, data: { prompt } });
  } catch (error) {
    return sendError(res, error);
  }
});

app.post('/api/ai/generate-image', (_req, res) => res.status(410).json({
  success: false,
  error: 'Use POST /api/local/generate/image. Image generation runs asynchronously with the local model.',
}));

app.post('/api/ai/audio-tts', (_req, res) => res.status(410).json({
  success: false,
  error: 'Cloud text-to-speech has been removed. Existing audio remains playable; no external AI service is used.',
}));

app.use((error: unknown, _req: Request, res: ExpressResponse, next: NextFunction) => {
  if (res.headersSent) return next(error);
  const typed = error as { type?: string };
  const status = typed.type === 'entity.parse.failed' ? 400 : typed.type === 'entity.too.large' ? 413 : 500;
  return res.status(status).json({
    success: false,
    error: status === 400 ? 'Request body must contain valid JSON.' : status === 413 ? 'Request body is too large.' : 'The server could not process this request.',
  });
});

async function startServer() {
  const python = existsSync(workerPython)
    ? workerPython
    : process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  workerProcess = spawn(python, [path.join(root, 'local_ai_worker.py')], {
    cwd: root,
    stdio: 'ignore',
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });
  workerProcess.on('error', (error) => console.error(`[Local AI] Media worker could not start: ${error.message}`));
  workerProcess.on('exit', (code) => {
    if (code !== null && code !== 0) console.error(`[Local AI] Media worker exited with code ${code}.`);
    workerProcess = undefined;
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(root, 'dist')));
    app.get('*', (_req, res) => res.sendFile(path.resolve(root, 'dist', 'index.html')));
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  app.listen(port, '0.0.0.0', () => {
    console.log(`[SceneCraft] Local AI studio active on http://0.0.0.0:${port}`);
    console.log('[SceneCraft] Generation uses localhost-only inference runtimes; no hosted AI APIs are configured.');
  });
}

function stopWorker() {
  workerProcess?.kill();
}
process.on('SIGINT', stopWorker);
process.on('SIGTERM', stopWorker);
void startServer();

import {
  ScriptGenerationRequest,
  SectionRegenerationRequest,
  BibleExtractionRequest,
  SceneBreakdownRequest,
  VisualPromptGenerationRequest,
  ImageGenerationRequest,
  ScriptSection,
  WorldBible,
  Scene,
  ApiResponse,
} from '../types';

export type ModelKind = 'writing' | 'image' | 'video';

export interface LocalModel {
  label: string;
  runtime: string;
  model: string;
  storage: string;
  storageBytes: number;
  license: string;
  repository: string;
  minimum: string;
  tasks: string[];
  installed: boolean;
  ready: boolean;
  runtimeRunning: boolean;
  resourceError?: string;
}

export interface LocalStatus {
  hardware: {
    os: string;
    python: string;
    cpuCores: number;
    ramMb: number;
    availableRamMb: number;
    gpu: string | null;
    vramMb: number;
    cuda: boolean;
    diskFreeMb: number;
  };
  models: Record<ModelKind, LocalModel>;
}

export interface LocalJob {
  id: string;
  kind: ModelKind | 'image' | 'video';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  error?: string;
  output?: string;
  mimeType?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function decode<T>(response: Response): Promise<ApiResponse<T>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { success: false, error: 'The server returned an invalid response.' };
  }
  if (!isRecord(payload) || typeof payload.success !== 'boolean') {
    return { success: false, error: 'The server returned an unexpected response.' };
  }
  if (!response.ok || !payload.success) {
    return { success: false, error: typeof payload.error === 'string' ? payload.error : `Server error (${response.status})` };
  }
  return {
    success: true,
    ...(payload.data !== undefined ? { data: payload.data as T } : {}),
    ...(typeof payload.message === 'string' ? { message: payload.message } : {}),
  };
}

async function postJson<T>(url: string, body: unknown): Promise<ApiResponse<T>> {
  try {
    return await decode<T>(await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Network request failed.' };
  }
}

export async function checkServerHealth(): Promise<{ status: string; localInference: boolean; modelsReady: number }> {
  try {
    const response = await fetch('/api/health');
    const value: unknown = await response.json();
    if (response.ok && isRecord(value)) {
      return {
        status: typeof value.status === 'string' ? value.status : 'offline',
        localInference: value.localInference === true,
        modelsReady: typeof value.modelsReady === 'number' ? value.modelsReady : 0,
      };
    }
  } catch {
    return { status: 'offline', localInference: true, modelsReady: 0 };
  }
  return { status: 'offline', localInference: true, modelsReady: 0 };
}

export async function getLocalStatus(): Promise<ApiResponse<LocalStatus>> {
  try {
    return await decode<LocalStatus>(await fetch('/api/local/status'));
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Could not load local model status.' };
  }
}

export async function installLocalModel(kind: ModelKind): Promise<ApiResponse<{ id: string }>> {
  try {
    return await decode<{ id: string }>(await fetch(`/api/local/install/${kind}`, { method: 'POST' }));
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Could not start model installation.' };
  }
}

export async function getLocalJob(id: string): Promise<ApiResponse<LocalJob>> {
  try {
    return await decode<LocalJob>(await fetch(`/api/local/jobs/${encodeURIComponent(id)}`));
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Could not read generation status.' };
  }
}

export async function cancelLocalJob(id: string): Promise<ApiResponse<void>> {
  return postJson<void>(`/api/local/jobs/${encodeURIComponent(id)}/cancel`, {});
}

export async function generateWriting(prompt: string): Promise<ApiResponse<{ text: string; model: string }>> {
  return postJson('/api/generate/writing', { prompt });
}

export async function generateMedia(
  kind: 'image' | 'video',
  prompt: string,
  options: Record<string, number>,
): Promise<ApiResponse<{ id: string }>> {
  return postJson(`/api/local/generate/${kind}`, { prompt, options });
}

export async function generateScriptApi(req: ScriptGenerationRequest): Promise<ApiResponse<ScriptSection>> {
  return postJson('/api/ai/script', req);
}

export async function regenerateScriptSectionApi(
  req: SectionRegenerationRequest,
): Promise<ApiResponse<{ sectionType: string; content: string }>> {
  return postJson('/api/ai/regenerate-section', req);
}

export async function extractWorldBibleApi(req: BibleExtractionRequest): Promise<ApiResponse<WorldBible>> {
  return postJson('/api/ai/bible', req);
}

export async function breakdownScenesApi(req: SceneBreakdownRequest): Promise<ApiResponse<Scene[]>> {
  return postJson('/api/ai/scenes', req);
}

export async function generateVisualPromptApi(
  req: VisualPromptGenerationRequest,
): Promise<ApiResponse<{ prompt: string }>> {
  return postJson('/api/ai/visual-prompts', req);
}

export async function generateImageApi(
  req: ImageGenerationRequest,
): Promise<ApiResponse<{ imageUrl: string; mimeType: string }>> {
  const dimensions: Record<NonNullable<ImageGenerationRequest['aspectRatio']>, { width: number; height: number }> = {
    '16:9': { width: 512, height: 288 },
    '9:16': { width: 288, height: 512 },
    '1:1': { width: 512, height: 512 },
    '4:3': { width: 512, height: 384 },
  };
  const started = await generateMedia('image', req.prompt, dimensions[req.aspectRatio || '16:9']);
  if (!started.success || !started.data) return { success: false, error: started.error || 'Could not start image generation.' };
  const deadline = Date.now() + 45 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const status = await getLocalJob(started.data.id);
    if (!status.success || !status.data) return { success: false, error: status.error || 'Could not read image generation status.' };
    if (status.data.status === 'failed' || status.data.status === 'cancelled') {
      return { success: false, error: status.data.error || status.data.message };
    }
    if (status.data.status === 'completed' && status.data.output) {
      return { success: true, data: { imageUrl: status.data.output, mimeType: status.data.mimeType || 'image/png' } };
    }
  }
  await cancelLocalJob(started.data.id);
  return { success: false, error: 'Image generation exceeded the 45-minute limit and was cancelled.' };
}

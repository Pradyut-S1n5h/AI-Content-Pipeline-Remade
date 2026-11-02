/**
 * SceneCraft Client API Service
 * 
 * Communicates with the server-side Express API for all AI reasoning,
 * structured generation, image generation, and audio TTS.
 * API keys never touch the client browser bundle.
 */

import {
  ScriptGenerationRequest,
  SectionRegenerationRequest,
  BibleExtractionRequest,
  SceneBreakdownRequest,
  VisualPromptGenerationRequest,
  ImageGenerationRequest,
  AudioTTSRequest,
  ScriptSection,
  WorldBible,
  Scene,
  ApiResponse,
} from '../types';
import {
  AiProvider,
  ModelOption,
  PROVIDER_CAPABILITIES,
  PROVIDER_MODELS,
  ThinkingLevel,
} from './aiProviders';

export interface AiSettings {
  provider: AiProvider;
  model: string;
  thinkingLevel: ThinkingLevel;
  hasSavedKey: boolean;
  keySource: 'session' | 'persistent' | 'environment' | 'none';
  keySources: Record<AiProvider, 'session' | 'persistent' | 'environment' | 'none'>;
  maskedKey: string | null;
  keyPersistenceAvailable: boolean;
  capabilities: typeof PROVIDER_CAPABILITIES[AiProvider];
  models: typeof PROVIDER_MODELS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function decodeApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { success: false, error: 'The server returned an invalid response. Try again.' };
  }
  if (!isRecord(payload) || typeof payload.success !== 'boolean') {
    return { success: false, error: 'The server returned an unexpected response. Try again.' };
  }
  if (!response.ok || !payload.success) {
    return {
      success: false,
      error: typeof payload.error === 'string'
        ? payload.error
        : typeof payload.message === 'string' ? payload.message : `Server error (${response.status})`,
    };
  }
  return {
    success: true,
    ...(payload.data !== undefined ? { data: payload.data as T } : {}),
    ...(typeof payload.message === 'string' ? { message: payload.message } : {}),
  };
}

async function postJson<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return await decodeApiResponse<T>(res);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network request failed. Is the server running?',
    };
  }
}

export async function checkServerHealth(): Promise<{
  status: string;
  hasGeminiKey: boolean;
  hasAiKey?: boolean;
  provider?: AiProvider;
}> {
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const payload: unknown = await res.json();
      if (isRecord(payload) && typeof payload.status === 'string' &&
          typeof payload.hasGeminiKey === 'boolean') {
        return {
          status: payload.status,
          hasGeminiKey: payload.hasGeminiKey,
          ...(payload.provider === 'gemini' || payload.provider === 'openai' ||
              payload.provider === 'anthropic' || payload.provider === 'huggingface'
            ? { provider: payload.provider }
            : {}),
          ...(typeof payload.hasAiKey === 'boolean' ? { hasAiKey: payload.hasAiKey } : {}),
        };
      }
    }
    return { status: 'offline', hasGeminiKey: false };
  } catch {
    return { status: 'offline', hasGeminiKey: false };
  }
}

export async function getAiSettings(): Promise<ApiResponse<AiSettings>> {
  try {
    const response = await fetch('/api/settings');
    return await decodeApiResponse<AiSettings>(response);
  } catch {
    return { success: false, error: 'Could not reach server settings.' };
  }
}

export async function getProviderModels(provider: AiProvider, apiKey?: string): Promise<ApiResponse<ModelOption[]>> {
  try {
    if (apiKey) return postJson<ModelOption[]>('/api/settings/models', { provider, apiKey });
    const response = await fetch(`/api/settings/models?provider=${provider}`);
    return await decodeApiResponse<ModelOption[]>(response);
  } catch {
    return { success: false, error: 'Could not load provider models.' };
  }
}

export async function saveAiSettings(settings: {
  provider: AiProvider;
  model: string;
  thinkingLevel: ThinkingLevel;
  apiKey?: string;
}): Promise<ApiResponse<AiSettings>> {
  return postJson<AiSettings>('/api/settings', settings);
}

export async function testAiSettings(settings: {
  provider: AiProvider;
  apiKey?: string;
}): Promise<ApiResponse<{ valid: boolean }>> {
  return postJson<{ valid: boolean }>('/api/settings/test', settings);
}

export async function removeAiKey(provider: AiProvider): Promise<ApiResponse<AiSettings>> {
  return postJson<AiSettings>('/api/settings/key/remove', { provider });
}

export async function generateScriptApi(
  req: ScriptGenerationRequest
): Promise<ApiResponse<ScriptSection>> {
  return postJson<ScriptSection>('/api/ai/script', req);
}

export async function regenerateScriptSectionApi(
  req: SectionRegenerationRequest
): Promise<ApiResponse<{ sectionType: string; content: string }>> {
  return postJson<{ sectionType: string; content: string }>(
    '/api/ai/regenerate-section',
    req
  );
}

export async function extractWorldBibleApi(
  req: BibleExtractionRequest
): Promise<ApiResponse<WorldBible>> {
  return postJson<WorldBible>('/api/ai/bible', req);
}

export async function breakdownScenesApi(
  req: SceneBreakdownRequest
): Promise<ApiResponse<Scene[]>> {
  return postJson<Scene[]>('/api/ai/scenes', req);
}

export async function generateVisualPromptApi(
  req: VisualPromptGenerationRequest
): Promise<ApiResponse<{ prompt: string }>> {
  return postJson<{ prompt: string }>('/api/ai/visual-prompts', req);
}

export async function generateImageApi(
  req: ImageGenerationRequest
): Promise<ApiResponse<{ imageUrl: string; mimeType: string }>> {
  return postJson<{ imageUrl: string; mimeType: string }>(
    '/api/ai/generate-image',
    req
  );
}

export async function generateAudioTTSApi(
  req: AudioTTSRequest
): Promise<ApiResponse<{ audioUrl: string; duration: number }>> {
  return postJson<{ audioUrl: string; duration: number }>(
    '/api/ai/audio-tts',
    req
  );
}

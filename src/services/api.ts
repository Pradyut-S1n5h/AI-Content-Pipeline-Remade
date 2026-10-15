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
import { AiProvider, ModelOption, PROVIDER_MODELS, ThinkingLevel } from './aiProviders';

export interface AiSettings {
  provider: AiProvider;
  model: string;
  thinkingLevel: ThinkingLevel;
  hasSavedKey: boolean;
  keySource: 'session' | 'environment' | 'none';
  maskedKey: string | null;
  models: typeof PROVIDER_MODELS;
}

async function postJson<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.error || data.message || `Server error (${res.status})`,
      };
    }
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network request failed. Is the server running?',
    };
  }
}

export async function checkServerHealth(): Promise<{
  status: string;
  hasGeminiKey: boolean;
  hasAiKey?: boolean;
}> {
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      return await res.json();
    }
    return { status: 'offline', hasGeminiKey: false };
  } catch {
    return { status: 'offline', hasGeminiKey: false };
  }
}

export async function getAiSettings(): Promise<ApiResponse<AiSettings>> {
  try {
    const response = await fetch('/api/settings');
    return await response.json();
  } catch {
    return { success: false, error: 'Could not reach server settings.' };
  }
}

export async function getProviderModels(provider: AiProvider, apiKey?: string): Promise<ApiResponse<ModelOption[]>> {
  try {
    if (apiKey) return postJson<ModelOption[]>('/api/settings/models', { provider, apiKey });
    const response = await fetch(`/api/settings/models?provider=${provider}`);
    const data = await response.json();
    return response.ok ? data : { success: false, error: data.error || 'Could not load provider models.' };
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

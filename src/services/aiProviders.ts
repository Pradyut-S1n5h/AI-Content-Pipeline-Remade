export type AiProvider = 'gemini' | 'openai' | 'anthropic' | 'huggingface';
export type ThinkingLevel = 'low' | 'medium' | 'high';
export const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

export interface ModelOption {
  id: string;
  label: string;
  supportsThinking: boolean;
}

export async function listProviderModels(
  provider: AiProvider,
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<ModelOption[]> {
  const endpoints: Record<AiProvider, { url: string; headers: Record<string, string> }> = {
    gemini: {
      url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
      headers: { 'x-goog-api-key': apiKey },
    },
    openai: {
      url: 'https://api.openai.com/v1/models',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    anthropic: {
      url: 'https://api.anthropic.com/v1/models?limit=100',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    },
    huggingface: {
      url: 'https://router.huggingface.co/v1/models',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  };
  const endpoint: { url: string; headers: Record<string, string> } = endpoints[provider];
  const response = await requestWithRetry(endpoint.url, { method: 'GET', headers: endpoint.headers }, provider, fetchImpl);
  if (!response.ok) throw errorForStatus(response.status, provider, await response.text());

  let result: any;
  try {
    result = await response.json();
  } catch {
    throw new AiProviderError('The provider returned a malformed model list. Try again.', 502, 'malformed_response');
  }
  const items = provider === 'gemini' ? result?.models : result?.data;
  if (!Array.isArray(items)) {
    throw new AiProviderError('The provider returned an unexpected model list. Try again.', 502, 'malformed_response');
  }

  const discovered = items
    .filter((model: any) => {
      const modelId = typeof model.name === 'string' ? model.name : model.id;
      if (typeof modelId !== 'string') return false;
      if (provider === 'gemini') {
        return Array.isArray(model.supportedGenerationMethods) && model.supportedGenerationMethods.includes('generateContent');
      }
      return true;
    })
    .map((model: any) => typeof model.name === 'string' ? model.name.replace(/^models\//, '') : model.id)
    .filter((id: string) => /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,199}$/.test(id))
    .filter((id: string) => provider !== 'gemini' || !/(image|imagen|embedding|audio|tts|veo)/i.test(id))
    .map((id: string) => ({
      id,
      label: provider === 'gemini' ? `Gemini ${id.replace(/^gemini-/, '')}` : id,
      supportsThinking: modelSupportsThinking(provider, id),
    }));
  const available: ModelOption[] = discovered;
  for (const knownModel of PROVIDER_MODELS[provider]) {
    const knownIndex = available.findIndex((model) => model.id === knownModel.id);
    if (knownIndex >= 0) available[knownIndex] = knownModel;
  }
  return available.sort((left, right) => left.id.localeCompare(right.id));
}

export const PROVIDER_MODELS: Record<AiProvider, ModelOption[]> = {
  gemini: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', supportsThinking: true },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', supportsThinking: true },
  ],
  openai: [
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', supportsThinking: false },
    { id: 'gpt-4.1', label: 'GPT-4.1', supportsThinking: false },
    { id: 'o4-mini', label: 'o4-mini', supportsThinking: true },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', supportsThinking: true },
    { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet', supportsThinking: true },
  ],
  huggingface: [
    { id: 'Qwen/Qwen3-4B-Instruct-2507', label: 'Qwen3 4B Instruct', supportsThinking: false },
    { id: 'Qwen/Qwen3-30B-A3B-Instruct-2507', label: 'Qwen3 30B A3B Instruct', supportsThinking: false },
  ],
};

export interface GenerateTextOptions {
  provider: AiProvider;
  apiKey: string;
  model: string;
  thinkingLevel: ThinkingLevel;
  prompt: string;
  systemInstruction?: string;
  responseSchema?: Record<string, unknown>;
  allowedModels?: string[];
  fetchImpl?: typeof fetch;
}

export class AiProviderError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'AiProviderError';
    this.status = status;
    this.code = code;
  }
}

export function validateModel(provider: string, model: string): model is string {
  return provider in PROVIDER_MODELS &&
    PROVIDER_MODELS[provider as AiProvider].some((option) => option.id === model);
}

export function modelSupportsThinking(provider: AiProvider, model: string): boolean {
  return PROVIDER_MODELS[provider].some((option) => option.id === model && option.supportsThinking);
}

function thinkingConfig(provider: AiProvider, model: string, level: ThinkingLevel) {
  if (!modelSupportsThinking(provider, model)) return undefined;
  if (provider === 'gemini') {
    return { thinkingBudget: { low: 1024, medium: 8192, high: 24576 }[level] };
  }
  if (provider === 'openai') return { reasoning_effort: level };
  if (provider === 'anthropic') {
    return { thinking: { type: 'enabled', budget_tokens: { low: 1024, medium: 4096, high: 6144 }[level] } };
  }
  return undefined;
}

function providerName(provider: AiProvider): string {
  return {
    gemini: 'Gemini',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    huggingface: 'Hugging Face',
  }[provider];
}

function errorForStatus(status: number, provider: AiProvider, body: string): AiProviderError {
  let description = '';
  try {
    const parsed = JSON.parse(body);
    description = String(parsed?.error?.message || parsed?.message || '').toLowerCase();
  } catch {
    description = body.toLowerCase();
  }

  if (status === 400) {
    return new AiProviderError('The provider rejected this request. Check the selected model and try a shorter or simpler prompt.', 400, 'invalid_request');
  }
  if (status === 401) {
    return new AiProviderError(`The ${providerName(provider)} API key was rejected. Replace it in Settings.`, 401, 'invalid_key');
  }
  if (status === 403) {
    return new AiProviderError('The API key does not have permission to use this service or model. Check provider access and billing settings.', 403, 'permission_denied');
  }
  if (status === 404) {
    return new AiProviderError('The selected model or API endpoint is not available. Choose a supported model in Settings.', 400, 'unsupported_model');
  }
  if (status === 429) {
    const isQuota = /quota|billing|insufficient[_ ]quota|resource_exhausted/.test(description);
    return new AiProviderError(
      isQuota ? 'The provider reports that your quota or billing limit has been reached. Check your provider account.' : 'The provider is rate limiting requests. Wait briefly before trying again.',
      429,
      isQuota ? 'quota_exceeded' : 'rate_limited'
    );
  }
  if (status === 503) {
    return new AiProviderError('The AI service is temporarily unavailable (503). Try again shortly.', 503, 'service_unavailable');
  }
  if (status >= 500) {
    return new AiProviderError('The AI provider is experiencing an outage. Try again shortly.', status, 'provider_outage');
  }
  return new AiProviderError('The AI provider could not complete this request.', status, 'provider_error');
}

async function requestWithRetry(
  url: string,
  init: RequestInit,
  provider: AiProvider,
  fetchImpl: typeof fetch
): Promise<Response> {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetchImpl(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      if (response.status < 500 || attempt === maxAttempts - 1) return response;
      await response.body?.cancel();
    } catch (error) {
      clearTimeout(timeout);
      if (attempt === maxAttempts - 1) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new AiProviderError('The AI request timed out. Try again with a shorter prompt.', 504, 'timeout');
        }
        throw new AiProviderError('Could not reach the AI provider. Check your connection and try again.', 503, 'network_error');
      }
    }
    const delay = 250 * (2 ** attempt) + Math.floor(Math.random() * 250);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new AiProviderError('The AI provider is unavailable.', 503, 'provider_outage');
}

async function readResponseBody(response: Response): Promise<string> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      response.text(),
      new Promise<string>((_resolve, reject) => {
        timeout = setTimeout(() => {
          void response.body?.cancel();
          reject(new AiProviderError('The AI request timed out while receiving its response.', 504, 'timeout'));
        }, 90_000);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function generateText(options: GenerateTextOptions): Promise<string> {
  if (!validateModel(options.provider, options.model)) {
    if (!options.allowedModels?.includes(options.model)) {
      throw new AiProviderError('This model is not supported by the selected provider.', 400, 'unsupported_model');
    }
  }
  if (!options.apiKey) {
    throw new AiProviderError(`Add a ${providerName(options.provider)} API key in Settings to enable generation.`, 503, 'missing_key');
  }
  if (options.prompt.length > 100_000) {
    throw new AiProviderError('This request is too large. Shorten the source text and try again.', 413, 'request_too_large');
  }

  const fetchImpl = options.fetchImpl || fetch;
  const effort = thinkingConfig(options.provider, options.model, options.thinkingLevel);
  let url: string;
  let headers: Record<string, string>;
  let body: Record<string, unknown>;

  if (options.provider === 'gemini') {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent`;
    headers = { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey };
    body = {
      contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
      ...(options.systemInstruction ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } } : {}),
      generationConfig: {
        maxOutputTokens: 8192,
        ...(options.responseSchema ? { responseMimeType: 'application/json', responseSchema: options.responseSchema } : {}),
        ...(effort ? { thinkingConfig: effort } : {}),
      },
    };
  } else if (options.provider === 'anthropic') {
    url = 'https://api.anthropic.com/v1/messages';
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': options.apiKey,
      'anthropic-version': '2023-06-01',
    };
    const systemText = [options.systemInstruction, options.responseSchema ? `Return JSON matching this schema: ${JSON.stringify(options.responseSchema)}` : '']
      .filter(Boolean)
      .join('\n\n');
    body = {
      model: options.model,
      max_tokens: 8192,
      ...(systemText ? { system: systemText } : {}),
      messages: [{ role: 'user', content: options.prompt }],
      ...(effort || {}),
    };
  } else {
    url = options.provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://router.huggingface.co/v1/chat/completions';
    headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${options.apiKey}` };
    const systemText = [options.systemInstruction, options.responseSchema ? `Return JSON matching this schema: ${JSON.stringify(options.responseSchema)}` : '']
      .filter(Boolean)
      .join('\n\n');
    body = {
      model: options.model,
      messages: [
        ...(systemText ? [{ role: 'system', content: systemText }] : []),
        { role: 'user', content: options.prompt },
      ],
      ...(options.responseSchema ? { response_format: { type: 'json_object' } } : {}),
      max_completion_tokens: 8192,
      ...(effort || {}),
    };
  }

  const response = await requestWithRetry(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }, options.provider, fetchImpl);
  if (!response.ok) throw errorForStatus(response.status, options.provider, await readResponseBody(response));

  let result: any;
  try {
    result = JSON.parse(await readResponseBody(response));
  } catch {
    throw new AiProviderError('The provider returned a malformed response. Try again.', 502, 'malformed_response');
  }

  const candidate = result?.candidates?.[0];
  const choice = result?.choices?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS' || choice?.finish_reason === 'length' ||
    (options.provider === 'anthropic' && result?.stop_reason === 'max_tokens')) {
    throw new AiProviderError('The response reached the model output limit. Reduce the request size or choose a model with a larger output allowance.', 502, 'truncated_response');
  }
  const text = options.provider === 'gemini'
    ? candidate?.content?.parts?.map((part: any) => part.text || '').join('').trim()
    : options.provider === 'anthropic'
      ? result?.content?.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('').trim()
      : choice?.message?.content?.trim();
  if (!text) throw new AiProviderError('The provider returned an empty or truncated response. Try again with a shorter prompt.', 502, 'empty_response');
  return text;
}

export async function testProviderKey(
  provider: AiProvider,
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const endpoint: { url: string; headers: Record<string, string> } = {
    gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', headers: { 'x-goog-api-key': apiKey } },
    openai: { url: 'https://api.openai.com/v1/models', headers: { Authorization: `Bearer ${apiKey}` } },
    anthropic: { url: 'https://api.anthropic.com/v1/models?limit=1', headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } },
    huggingface: { url: 'https://router.huggingface.co/v1/models', headers: { Authorization: `Bearer ${apiKey}` } },
  }[provider];
  const { url, headers } = endpoint;
  const response = await requestWithRetry(url, { method: 'GET', headers }, provider, fetchImpl);
  if (!response.ok) throw errorForStatus(response.status, provider, await readResponseBody(response));
}

export function validateJsonSchema(value: unknown, schema: Record<string, any>): boolean {
  const type = schema.type;
  if (type === 'OBJECT') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const object = value as Record<string, unknown>;
    if ((schema.required || []).some((key: string) => !(key in object))) return false;
    return Object.entries(schema.properties || {}).every(([key, child]) =>
      object[key] === undefined || validateJsonSchema(object[key], child as Record<string, any>));
  }
  if (type === 'ARRAY') return Array.isArray(value) && value.every((item) => validateJsonSchema(item, schema.items || {}));
  if (type === 'STRING') return typeof value === 'string';
  if (type === 'INTEGER') return Number.isInteger(value);
  if (type === 'NUMBER') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'BOOLEAN') return typeof value === 'boolean';
  return true;
}

export function safeProviderError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;
  const candidate = error as { status?: number; statusCode?: number; code?: string; message?: string };
  const status = Number(candidate?.status || candidate?.statusCode || 500);
  if (status) return errorForStatus(status, 'gemini', '');
  if (candidate?.code === 'ETIMEDOUT' || candidate?.code === 'ECONNABORTED') {
    return new AiProviderError('The AI request timed out. Try again with a shorter prompt.', 504, 'timeout');
  }
  return new AiProviderError('The AI provider could not complete this request. Check the key, model access, and provider status.', 502, 'provider_error');
}

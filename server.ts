/**
 * SceneCraft Full-Stack Express Server
 * 
 * Handles all AI interactions server-side using the official @google/genai SDK:
 * - Provider/model-selectable text generation (Gemini and OpenAI)
 * - Gemini image generation (gemini-2.5-flash-image)
 * - Gemini speech synthesis (gemini-2.5-flash-preview-tts)
 * - Vite dev middleware mounting for seamless development
 */

import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash, randomUUID } from 'crypto';
import dotenv from 'dotenv';
import {
  AiProvider,
  AiProviderError,
  GenerateTextOptions,
  GEMINI_IMAGE_MODEL,
  PROVIDER_MODELS,
  ThinkingLevel,
  generateText,
  listProviderModels,
  safeProviderError,
  testProviderKey,
  validateJsonSchema,
  validateModel,
} from './src/services/aiProviders';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const sessions = new Map<string, {
  provider?: AiProvider;
  model?: string;
  thinkingLevel?: ThinkingLevel;
  keys: Partial<Record<AiProvider, string>>;
  availableModels: Partial<Record<AiProvider, { ids: string[]; keyDigest: string }>>;
  generationTimes: number[];
  lastUsed: number;
}>();

app.use((req: Request, res: Response, next) => {
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('ai_session='));
  let sessionId = cookie?.slice('ai_session='.length);
  if (!sessionId || !sessions.has(sessionId)) {
    sessionId = randomUUID();
    res.setHeader('Set-Cookie', `ai_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    sessions.set(sessionId, { keys: {}, availableModels: {}, generationTimes: [], lastUsed: Date.now() });
  }
  const session = sessions.get(sessionId)!;
  session.lastUsed = Date.now();
  if (sessions.size > 500) {
    for (const [id, value] of sessions) {
      if (Date.now() - value.lastUsed > 86_400_000) sessions.delete(id);
    }
  }
  next();
});

function getAiSettings(req: Request) {
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('ai_session='));
  const sessionId = cookie?.slice('ai_session='.length);
  const session = sessionId ? sessions.get(sessionId) : undefined;
  const envProvider = isAiProvider(process.env.AI_PROVIDER) ? process.env.AI_PROVIDER : 'gemini';
  const provider = session?.provider || envProvider;
  const defaultModel = PROVIDER_MODELS[provider][0].id;
  const envModel = process.env.AI_MODEL || defaultModel;
  const model = session?.model || (validateModel(provider, envModel) ? envModel : defaultModel);
  const key = session?.keys[provider] || getEnvironmentKey(provider);
  const keySource = session?.keys[provider] ? 'session' : key ? 'environment' : 'none';
  return {
    provider,
    model,
    thinkingLevel: session?.thinkingLevel || 'medium',
    key,
    keySource,
    publicSettings: {
      provider,
      model,
      thinkingLevel: session?.thinkingLevel || 'medium',
      hasSavedKey: Boolean(key),
      keySource,
      maskedKey: key ? '********' : null,
      models: PROVIDER_MODELS,
    },
  };
}

function isAiProvider(value: unknown): value is AiProvider {
  return value === 'gemini' || value === 'openai' || value === 'anthropic' || value === 'huggingface';
}

function getEnvironmentKey(provider: AiProvider): string {
  const keys: Record<AiProvider, string | undefined> = {
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    huggingface: process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN,
  };
  return keys[provider] || '';
}

async function loadProviderModels(req: Request, provider: AiProvider, key: string) {
  const models = key ? await listProviderModels(provider, key) : PROVIDER_MODELS[provider];
  const sessionId = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('ai_session='))?.slice('ai_session='.length);
  const session = sessionId ? sessions.get(sessionId) : undefined;
  if (key && session) {
    session.availableModels[provider] = {
      ids: models.map((model) => model.id),
      keyDigest: createHash('sha256').update(key).digest('hex'),
    };
  }
  return models;
}

const Type = { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING', INTEGER: 'INTEGER' } as const;

function sendAiError(res: Response, error: unknown) {
  const safeError = safeProviderError(error);
  console.error(`[AI] ${safeError.code}`);
  return res.status(safeError.status).json({ success: false, error: safeError.message });
}

function consumeGenerationBudget(req: Request) {
  const sessionId = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('ai_session='))?.slice('ai_session='.length);
  const session = sessionId ? sessions.get(sessionId) : undefined;
  if (!session) throw new AiProviderError('AI session is unavailable. Refresh the page and try again.', 503, 'session_unavailable');
  const now = Date.now();
  session.generationTimes = session.generationTimes.filter((timestamp) => now - timestamp < 86_400_000);
  if (session.generationTimes.length >= 100) {
    throw new AiProviderError('This browser session has reached its daily generation limit. Try again tomorrow.', 429, 'quota_exceeded');
  }
  if (session.generationTimes.filter((timestamp) => now - timestamp < 60_000).length >= 10) {
    throw new AiProviderError('This browser session is generating too quickly. Wait a minute before trying again.', 429, 'rate_limited');
  }
  session.generationTimes.push(now);
}

async function generateTextForRequest(
  req: Request,
  prompt: string,
  options: Pick<GenerateTextOptions, 'systemInstruction' | 'responseSchema'> = {}
) {
  const settings = getAiSettings(req);
  if (!settings.key) {
    throw new AiProviderError(`Add a ${settings.provider} API key in Settings to enable AI generation.`, 503, 'missing_key');
  }
  consumeGenerationBudget(req);
  const sessionId = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('ai_session='))?.slice('ai_session='.length);
  const session = sessionId ? sessions.get(sessionId) : undefined;
  const modelCache = session?.availableModels[settings.provider];
  const allowedModels = modelCache?.keyDigest === createHash('sha256').update(settings.key).digest('hex')
    ? modelCache.ids
    : [];
  return generateText({
    provider: settings.provider,
    apiKey: settings.key,
    model: settings.model,
    thinkingLevel: settings.thinkingLevel,
    prompt,
    allowedModels,
    ...options,
  });
}

function parseStructuredResponse(text: string, schema: Record<string, any>) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiProviderError('The model returned malformed JSON. Try again or choose a different model.', 502, 'malformed_json');
  }
  if (!validateJsonSchema(parsed, schema)) {
    throw new AiProviderError('The model response did not match the required data structure. Try again.', 502, 'invalid_output');
  }
  return parsed;
}

async function getGeminiClient(req: Request) {
  const settings = getAiSettings(req);
  if (settings.provider !== 'gemini') {
    throw new AiProviderError('Image and speech generation currently require Gemini. Select Gemini in Settings; no provider switch was made.', 400, 'unsupported_provider');
  }
  if (!settings.key) {
    throw new AiProviderError('Add a Gemini API key in Settings to generate images or audio.', 503, 'missing_key');
  }
  consumeGenerationBudget(req);
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey: settings.key });
}

// ==========================================
// 1. Health & Configuration Endpoint
// ==========================================
app.get('/api/health', (_req: Request, res: Response) => {
  const settings = getAiSettings(_req);
  const geminiKey = settings.provider === 'gemini' && Boolean(settings.key);
  res.json({
    status: 'ok',
    hasGeminiKey: geminiKey,
    hasAiKey: Boolean(settings.key),
    provider: settings.provider,
    model: settings.model,
    mode: settings.key ? 'live' : 'demo_only',
    message: settings.key ? 'AI provider is configured.' : 'Add an API key in Settings to enable live generation.',
  });
});

app.get('/api/settings', (req: Request, res: Response) => {
  res.json({ success: true, data: getAiSettings(req).publicSettings });
});

app.get('/api/settings/models', async (req: Request, res: Response) => {
  const provider = req.query.provider || getAiSettings(req).provider;
  if (!isAiProvider(provider)) {
    return res.status(400).json({ success: false, error: 'Choose a supported provider.' });
  }
  const current = getAiSettings(req);
  const sessionId = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('ai_session='))?.slice('ai_session='.length);
  const session = sessionId ? sessions.get(sessionId) : undefined;
  const key = session?.keys[provider] || getEnvironmentKey(provider) ||
    (current.provider === provider ? current.key : '');
  try {
    const models = await loadProviderModels(req, provider, key);
    return res.json({ success: true, data: models });
  } catch (error) {
    return sendAiError(res, error);
  }
});

app.post('/api/settings/models', async (req: Request, res: Response) => {
  const { provider } = req.body || {};
  if (!isAiProvider(provider)) {
    return res.status(400).json({ success: false, error: 'Choose a supported provider.' });
  }
  if (req.body.apiKey !== undefined && (typeof req.body.apiKey !== 'string' || req.body.apiKey.length > 1024)) {
    return res.status(400).json({ success: false, error: 'The API key value is not valid.' });
  }
  const current = getAiSettings(req);
  const key = typeof req.body.apiKey === 'string' && req.body.apiKey.trim()
    ? req.body.apiKey.trim()
    : current.provider === provider ? current.key : '';
  try {
    const models = await loadProviderModels(req, provider, key);
    return res.json({ success: true, data: models });
  } catch (error) {
    return sendAiError(res, error);
  }
});

app.post('/api/settings', (req: Request, res: Response) => {
  const sessionId = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('ai_session='))?.slice('ai_session='.length);
  const session = sessionId ? sessions.get(sessionId) : undefined;
  const { provider, model, thinkingLevel, apiKey } = req.body || {};
  if (!session || !isAiProvider(provider) ||
    !['low', 'medium', 'high'].includes(thinkingLevel)) {
    return res.status(400).json({ success: false, error: 'Choose a supported provider, model, and thinking level.' });
  }
  if (apiKey !== undefined && (typeof apiKey !== 'string' || apiKey.length > 1024)) {
    return res.status(400).json({ success: false, error: 'The API key value is not valid.' });
  }
  const selectedProvider = provider as AiProvider;
  const selectedKey = typeof apiKey === 'string' && apiKey.trim()
    ? apiKey.trim()
    : session.keys[selectedProvider] ||
      getEnvironmentKey(selectedProvider);
  const modelCache = session.availableModels[selectedProvider];
  const dynamicModelIsValid = modelCache?.keyDigest === createHash('sha256').update(selectedKey).digest('hex') &&
    modelCache.ids.includes(model);
  if (!validateModel(selectedProvider, model) && !dynamicModelIsValid) {
    return res.status(400).json({ success: false, error: 'Refresh the provider model list and choose a model available to this key.' });
  }
  session.provider = provider;
  session.model = model;
  session.thinkingLevel = thinkingLevel;
  if (typeof apiKey === 'string' && apiKey.trim()) session.keys[selectedProvider] = apiKey.trim();
  return res.json({ success: true, data: getAiSettings(req).publicSettings });
});

app.post('/api/settings/test', async (req: Request, res: Response) => {
  const { provider } = req.body || {};
  if (!isAiProvider(provider)) {
    return res.status(400).json({ success: false, error: 'Choose a supported provider.' });
  }
  const active = getAiSettings(req);
  const key = typeof req.body.apiKey === 'string' && req.body.apiKey.trim()
    ? req.body.apiKey.trim()
    : active.provider === provider ? active.key : '';
  if (!key) return res.status(400).json({ success: false, error: `Enter a ${provider} API key to test.` });
  try {
    await testProviderKey(provider, key);
    return res.json({ success: true, data: { valid: true } });
  } catch (error) {
    return sendAiError(res, error);
  }
});

app.post('/api/settings/key/remove', (req: Request, res: Response) => {
  const provider = req.body?.provider;
  if (!isAiProvider(provider)) {
    return res.status(400).json({ success: false, error: 'Choose a supported provider.' });
  }
  const sessionId = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('ai_session='))?.slice('ai_session='.length);
  const session = sessionId ? sessions.get(sessionId) : undefined;
  if (session) delete session.keys[provider as AiProvider];
  return res.json({ success: true, data: getAiSettings(req).publicSettings });
});

// ==========================================
// 2. Script Generation
// ==========================================
app.post('/api/ai/script', async (req: Request, res: Response) => {
  try {
    const {
      title,
      idea,
      contentType,
      tone,
      targetAudience,
      durationMinutes,
      language,
      visualStyle,
    } = req.body;

    if (!idea) {
      return res.status(400).json({ success: false, error: 'Project idea is required.' });
    }

    const systemInstruction = `You are an elite screenwriter and creative director specializing in high-impact narrative and commercial content.
Generate a structured script tailored for:
Content Type: ${contentType || 'short_film'}
Tone: ${tone || 'cinematic'}
Target Audience: ${targetAudience || 'general'}
Target Duration: ${durationMinutes || 3} minutes
Language: ${language || 'English'}
Visual Style: ${visualStyle || 'cinematic film'}

Format requirements:
- Title: Engaging and evocative.
- Logline: 1-2 sentence compelling hook.
- Synopsis: Detailed 2-3 paragraph overview of the narrative arc and themes.
- Full Script: Written in standard screenplay format with scene headings (INT./EXT.), character names, dialogue, and vivid action descriptions.`;

    const responseSchema = {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Final project title' },
            logline: { type: Type.STRING, description: 'Compelling 1-2 sentence logline' },
            synopsis: { type: Type.STRING, description: 'Narrative overview and themes' },
            fullScript: { type: Type.STRING, description: 'Screenplay with headings, actions, dialogues' },
            targetAudienceNotes: { type: Type.STRING, description: 'Pacing and tone advice' },
          },
          required: ['title', 'logline', 'synopsis', 'fullScript'],
        };
    const response = await generateTextForRequest(
      req,
      `Generate a complete structured script based on this idea: "${idea}". Existing working title: "${title || 'Untitled'}"`,
      { systemInstruction, responseSchema }
    );

    const parsed = parseStructuredResponse(response, responseSchema);
    return res.json({ success: true, data: parsed });
  } catch (error) {
    return sendAiError(res, error);
  }
});

// ==========================================
// 3. Section Regeneration
// ==========================================
app.post('/api/ai/regenerate-section', async (req: Request, res: Response) => {
  try {
    const { sectionType, currentScript, projectIdea, instructions } = req.body;

    const prompt = `You are a script doctor and screenwriter.
Rewrite ONLY the ${sectionType} for the following project:
Project Idea: ${projectIdea}
Current Title: ${currentScript?.title}
Current Logline: ${currentScript?.logline}
Current Synopsis: ${currentScript?.synopsis}

User Specific Instructions for this rewrite: "${instructions || 'Make it more compelling and cinematic.'}"

Return ONLY the updated content for ${sectionType}. Do not destroy or include the rest of the script.`;

    const response = await generateTextForRequest(req, prompt);

    return res.json({
      success: true,
      data: {
        sectionType,
        content: response,
      },
    });
  } catch (error) {
    return sendAiError(res, error);
  }
});

// ==========================================
// 4. World Bible Extraction
// ==========================================
app.post('/api/ai/bible', async (req: Request, res: Response) => {
  try {
    const { script, title, contentType } = req.body;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        visualTheme: { type: Type.STRING, description: 'Overarching visual and cinematography aesthetic' },
        characters: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              role: { type: Type.STRING, description: 'protagonist, antagonist, supporting, or narrator' },
              description: { type: Type.STRING },
              appearance: { type: Type.STRING, description: 'Physical visual characteristics' },
              personality: { type: Type.STRING },
              clothing: { type: Type.STRING, description: 'Wardrobe and garments' },
              visualMarkers: { type: Type.STRING, description: 'Unique identifiers for image prompt consistency' },
            },
            required: ['name', 'appearance', 'clothing'],
          },
        },
        locations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              environment: { type: Type.STRING },
              visualCharacteristics: { type: Type.STRING },
              timeAndLighting: { type: Type.STRING },
            },
            required: ['name', 'environment'],
          },
        },
        props: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              visualDetails: { type: Type.STRING },
            },
            required: ['name'],
          },
        },
      },
      required: ['visualTheme', 'characters', 'locations'],
    };
    const response = await generateTextForRequest(req, `Extract the characters, key locations, and props from this screenplay to establish visual consistency:
Title: ${title}
Content Type: ${contentType}

Script text:
${script}`, {
      systemInstruction: `You are an art director and production designer.
Analyze the script and extract:
1. Characters: Include exact visual traits, age, ethnic appearance/build, wardrobe, and distinct visual markers (e.g. eye color, scars, badges, hair).
2. Locations: Include setting, architectural vibe, lighting, weather, materials.
3. Props: Key narrative objects with textures and colors.
4. Visual Theme: Overarching aesthetic definition for image prompt generation.`,
    });

    const parsed = parseStructuredResponse(response, responseSchema) as any;
    // Ensure ids
    if (parsed.characters) {
      parsed.characters = parsed.characters.map((c: any, i: number) => ({
        ...c,
        id: c.id || `char-${i + 1}`,
      }));
    }
    if (parsed.locations) {
      parsed.locations = parsed.locations.map((l: any, i: number) => ({
        ...l,
        id: l.id || `loc-${i + 1}`,
      }));
    }
    if (parsed.props) {
      parsed.props = parsed.props.map((p: any, i: number) => ({
        ...p,
        id: p.id || `prop-${i + 1}`,
      }));
    }

    return res.json({ success: true, data: parsed });
  } catch (error) {
    return sendAiError(res, error);
  }
});

// ==========================================
// 5. Scene Breakdown
// ==========================================
app.post('/api/ai/scenes', async (req: Request, res: Response) => {
  try {
    const { script, title, contentType, durationMinutes, bible } = req.body;

    const bibleContext = bible
      ? `Visual Theme: ${bible.visualTheme || ''}
Known Characters: ${(bible.characters || []).map((c: any) => `${c.name}: ${c.appearance}, wearing ${c.clothing}`).join(' | ')}
Known Locations: ${(bible.locations || []).map((l: any) => `${l.name}: ${l.environment}`).join(' | ')}`
      : '';

    const responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          sceneNumber: { type: Type.INTEGER },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          setting: { type: Type.STRING },
          timeOfDay: { type: Type.STRING },
          characters: { type: Type.ARRAY, items: { type: Type.STRING } },
          actions: { type: Type.STRING },
          dialogue: { type: Type.STRING },
          cameraDirection: { type: Type.STRING },
          mood: { type: Type.STRING },
          visualStyle: { type: Type.STRING },
          durationSeconds: { type: Type.INTEGER },
          imagePrompt: { type: Type.STRING },
          videoPrompt: { type: Type.STRING },
        },
        required: ['sceneNumber', 'title', 'description', 'setting', 'cameraDirection', 'durationSeconds', 'imagePrompt'],
      },
    };
    const response = await generateTextForRequest(req, `Break down this screenplay into a sequential list of structured storyboard scenes.
Title: ${title}
Content Type: ${contentType}
Target Duration: ${durationMinutes || 3} minutes

${bibleContext ? `World Bible Context for Visual Consistency:\n${bibleContext}\n` : ''}

Screenplay:
${script}`, {
  systemInstruction: `You are an experienced film director and storyboard artist.
Break down the screenplay into between 4 and 8 key visual scenes.
For each scene, formulate:
1. sceneNumber: 1, 2, 3...
2. title: Short evocative title
3. description: Core dramatic beat
4. setting: Location name
5. timeOfDay: day, night, dusk, dawn, golden_hour, interior_lit, or dim_ambient
6. characters: Array of character names present
7. actions: Visible physical movement
8. dialogue: Snippet of spoken line or voiceover
9. cameraDirection: Specific framing e.g., "Low-angle close-up", "Wide establishing aerial", "Medium over-the-shoulder"
10. mood: Emotional tone
11. visualStyle: Cinematography notes
12. durationSeconds: Integer 3 to 12
13. imagePrompt: A masterclass text prompt for image generation that integrates the character appearance, clothing, environment, camera lens, and lighting.
14. videoPrompt: A prompt for motion/video cameras.`,
      responseSchema,
    });

    const parsed = parseStructuredResponse(response, responseSchema) as any[];
    const scenesWithIds = parsed.map((s: any, idx: number) => ({
      ...s,
      id: s.id || `scene-${idx + 1}-${Date.now()}`,
      sceneNumber: s.sceneNumber || idx + 1,
      durationSeconds: s.durationSeconds || 5,
      timeOfDay: s.timeOfDay || 'day',
      characters: s.characters || [],
    }));

    return res.json({ success: true, data: scenesWithIds });
  } catch (error) {
    return sendAiError(res, error);
  }
});

// ==========================================
// 6. Visual Prompt Regeneration
// ==========================================
app.post('/api/ai/visual-prompts', async (req: Request, res: Response) => {
  try {
    const { scene, bible, visualStyle } = req.body;

    const prompt = `Synthesize an ultra-detailed, cinematic text prompt for generating a storyboard image:
Scene Title: ${scene.title}
Scene Action: ${scene.actions || scene.description}
Camera Direction: ${scene.cameraDirection}
Setting: ${scene.setting}
Lighting/Time: ${scene.timeOfDay}
Mood: ${scene.mood}
Visual Style: ${visualStyle || bible?.visualTheme || 'Cinematic 35mm photograph'}

World Bible Details:
Characters: ${(bible?.characters || []).map((c: any) => `${c.name}: appearance=${c.appearance}, clothing=${c.clothing}, markers=${c.visualMarkers}`).join('; ')}
Locations: ${(bible?.locations || []).map((l: any) => `${l.name}: environment=${l.environment}`).join('; ')}

Return ONLY the final detailed image prompt. Do not wrap in quotes or formatting.`;

    const response = await generateTextForRequest(req, prompt);

    return res.json({
      success: true,
      data: { prompt: response.trim() || scene.imagePrompt },
    });
  } catch (error) {
    return sendAiError(res, error);
  }
});

// ==========================================
// 7. Image Generation (Gemini only)
// ==========================================
app.post('/api/ai/generate-image', async (req: Request, res: Response) => {
  try {
    const { prompt, aspectRatio = '16:9' } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt is required for image generation.' });
    }
    if (typeof prompt !== 'string') {
      return res.status(400).json({ success: false, error: 'Image prompt must be text.' });
    }
    if (prompt.length > 10_000) {
      return res.status(413).json({ success: false, error: 'Image prompts must be 10,000 characters or fewer.' });
    }
    if (!['16:9', '9:16', '1:1', '4:3'].includes(aspectRatio)) {
      return res.status(400).json({ success: false, error: 'Choose a supported image aspect ratio.' });
    }

    // Image generation remains tied to Gemini; the text model selector does not affect it.
    const ai = await getGeminiClient(req);
    const response = await ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: aspectRatio as any,
        },
      },
    });

    let imageUrl: string | null = null;
    let imageMimeType = 'image/png';
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        imageMimeType = part.inlineData.mimeType || imageMimeType;
        imageUrl = `data:${imageMimeType};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) {
      return res.status(500).json({
        success: false,
        error: 'Model did not return an image part. Please check the prompt or try again.',
      });
    }

    return res.json({
      success: true,
      data: {
        imageUrl,
        mimeType: imageMimeType,
      },
    });
  } catch (error) {
    return sendAiError(res, error);
  }
});

// ==========================================
// 8. Audio Speech Synthesis (Gemini only)
// ==========================================
app.post('/api/ai/audio-tts', async (req: Request, res: Response) => {
  try {
    const { text, voice = 'Kore', speakerRole } = req.body;

    if (typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Text is required for TTS synthesis.' });
    }
    if (text.length > 1000) {
      return res.status(413).json({ success: false, error: 'Audio text must be 1,000 characters or fewer.' });
    }

    const ai = await getGeminiClient(req);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text,
              speechMetadata: {
                style: speakerRole ? `Dramatic narration, role: ${speakerRole}` : 'Clear cinematic narration',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice as any },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({
        success: false,
        error: 'No audio data returned from Gemini TTS model.',
      });
    }

    // Default unary return is a complete WAV file with 44-byte RIFF header
    const audioUrl = `data:audio/wav;base64,${base64Audio}`;

    return res.json({
      success: true,
      data: {
        audioUrl,
        duration: Math.max(2, Math.round(text.split(' ').length / 2.5)),
      },
    });
  } catch (error) {
    return sendAiError(res, error);
  }
});

app.use((error: any, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);
  const status = error?.type === 'entity.parse.failed' ? 400
    : error?.type === 'entity.too.large' ? 413 : 500;
  console.error(`[HTTP] ${status}`);
  return res.status(status).json({
    success: false,
    error: status === 400 ? 'Request body must contain valid JSON.'
      : status === 413 ? 'Request body is too large.'
        : 'The server could not process this request.',
  });
});

// ==========================================
// 9. Static Assets & Vite Integration
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SceneCraft] Studio server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();

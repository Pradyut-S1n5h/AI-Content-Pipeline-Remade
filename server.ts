/**
 * SceneCraft Full-Stack Express Server
 * 
 * Handles all AI interactions server-side using the official @google/genai SDK:
 * - Script generation & section rewrites (gemini-3.8-flash)
 * - World Bible character & location extraction (gemini-3.8-flash)
 * - Scene breakdown & cinematic visual prompts (gemini-3.8-flash)
 * - Image generation (gemini-3.1-flash-lite-image)
 * - Speech synthesis & dialogue audio (gemini-3.8-flash-lite-tts)
 * - Vite dev middleware mounting for seamless development
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Shared Gemini client initialization
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// ==========================================
// 1. Health & Configuration Endpoint
// ==========================================
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(apiKey && apiKey.length > 5),
    mode: apiKey ? 'live' : 'demo_only',
    message: apiKey
      ? 'Gemini AI services are operational.'
      : 'No GEMINI_API_KEY detected. Demo mode is fully enabled; add your key to enable live generation.',
  });
});

// Helper for checking AI client
function ensureAiClient(res: Response) {
  if (!ai || !apiKey) {
    res.status(503).json({
      success: false,
      error: 'GEMINI_API_KEY is not configured on the server. Please add your key to the environment or explore the pre-loaded demo project.',
    });
    return false;
  }
  return true;
}

// ==========================================
// 2. Script Generation (gemini-3.8-flash)
// ==========================================
app.post('/api/ai/script', async (req: Request, res: Response) => {
  if (!ensureAiClient(res)) return;

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

    const response = await ai!.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Generate a complete structured script based on this idea: "${idea}". Existing working title: "${title || 'Untitled'}"`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Final project title' },
            logline: { type: Type.STRING, description: 'Compelling 1-2 sentence logline' },
            synopsis: { type: Type.STRING, description: 'Narrative overview and themes' },
            fullScript: { type: Type.STRING, description: 'Screenplay with headings, actions, dialogues' },
            targetAudienceNotes: { type: Type.STRING, description: 'Pacing and tone advice' },
          },
          required: ['title', 'logline', 'synopsis', 'fullScript'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Error generating script:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate script with Gemini API.',
    });
  }
});

// ==========================================
// 3. Section Regeneration (gemini-3.8-flash)
// ==========================================
app.post('/api/ai/regenerate-section', async (req: Request, res: Response) => {
  if (!ensureAiClient(res)) return;

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

    const response = await ai!.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return res.json({
      success: true,
      data: {
        sectionType,
        content: response.text?.trim() || '',
      },
    });
  } catch (err: any) {
    console.error('Error regenerating section:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to regenerate script section.',
    });
  }
});

// ==========================================
// 4. World Bible Extraction (gemini-3.8-flash)
// ==========================================
app.post('/api/ai/bible', async (req: Request, res: Response) => {
  if (!ensureAiClient(res)) return;

  try {
    const { script, title, contentType } = req.body;

    const response = await ai!.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Extract the characters, key locations, and props from this screenplay to establish visual consistency:
Title: ${title}
Content Type: ${contentType}

Script text:
${script}`,
      config: {
        systemInstruction: `You are an art director and production designer.
Analyze the script and extract:
1. Characters: Include exact visual traits, age, ethnic appearance/build, wardrobe, and distinct visual markers (e.g. eye color, scars, badges, hair).
2. Locations: Include setting, architectural vibe, lighting, weather, materials.
3. Props: Key narrative objects with textures and colors.
4. Visual Theme: Overarching aesthetic definition for image prompt generation.`,
        responseMimeType: 'application/json',
        responseSchema: {
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
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
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
  } catch (err: any) {
    console.error('Error extracting bible:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to extract world bible.',
    });
  }
});

// ==========================================
// 5. Scene Breakdown (gemini-3.8-flash)
// ==========================================
app.post('/api/ai/scenes', async (req: Request, res: Response) => {
  if (!ensureAiClient(res)) return;

  try {
    const { script, title, contentType, durationMinutes, bible } = req.body;

    const bibleContext = bible
      ? `Visual Theme: ${bible.visualTheme || ''}
Known Characters: ${(bible.characters || []).map((c: any) => `${c.name}: ${c.appearance}, wearing ${c.clothing}`).join(' | ')}
Known Locations: ${(bible.locations || []).map((l: any) => `${l.name}: ${l.environment}`).join(' | ')}`
      : '';

    const response = await ai!.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Break down this screenplay into a sequential list of structured storyboard scenes.
Title: ${title}
Content Type: ${contentType}
Target Duration: ${durationMinutes || 3} minutes

${bibleContext ? `World Bible Context for Visual Consistency:\n${bibleContext}\n` : ''}

Screenplay:
${script}`,
      config: {
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
        responseMimeType: 'application/json',
        responseSchema: {
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
              characters: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              actions: { type: Type.STRING },
              dialogue: { type: Type.STRING },
              cameraDirection: { type: Type.STRING },
              mood: { type: Type.STRING },
              visualStyle: { type: Type.STRING },
              durationSeconds: { type: Type.INTEGER },
              imagePrompt: { type: Type.STRING },
              videoPrompt: { type: Type.STRING },
            },
            required: [
              'sceneNumber',
              'title',
              'description',
              'setting',
              'cameraDirection',
              'durationSeconds',
              'imagePrompt',
            ],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '[]');
    const scenesWithIds = parsed.map((s: any, idx: number) => ({
      ...s,
      id: s.id || `scene-${idx + 1}-${Date.now()}`,
      sceneNumber: s.sceneNumber || idx + 1,
      durationSeconds: s.durationSeconds || 5,
      timeOfDay: s.timeOfDay || 'day',
      characters: s.characters || [],
    }));

    return res.json({ success: true, data: scenesWithIds });
  } catch (err: any) {
    console.error('Error generating scenes:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to breakdown scenes.',
    });
  }
});

// ==========================================
// 6. Visual Prompt Regeneration (gemini-3.8-flash)
// ==========================================
app.post('/api/ai/visual-prompts', async (req: Request, res: Response) => {
  if (!ensureAiClient(res)) return;

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

    const response = await ai!.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return res.json({
      success: true,
      data: { prompt: response.text?.trim() || scene.imagePrompt },
    });
  } catch (err: any) {
    console.error('Error generating prompt:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate visual prompt.',
    });
  }
});

// ==========================================
// 7. Image Generation (gemini-3.1-flash-lite-image)
// ==========================================
app.post('/api/ai/generate-image', async (req: Request, res: Response) => {
  if (!ensureAiClient(res)) return;

  try {
    const { prompt, aspectRatio = '16:9' } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt is required for image generation.' });
    }

    // Call gemini-3.1-flash-lite-image
    const response = await ai!.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
        },
      },
    });

    let imageUrl: string | null = null;
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
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
        mimeType: 'image/png',
      },
    });
  } catch (err: any) {
    console.error('Error generating image:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate image with Gemini model.',
    });
  }
});

// ==========================================
// 8. Audio Speech Synthesis (gemini-3.8-flash-lite-tts)
// ==========================================
app.post('/api/ai/audio-tts', async (req: Request, res: Response) => {
  if (!ensureAiClient(res)) return;

  try {
    const { text, voice = 'Kore', speakerRole } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Text is required for TTS synthesis.' });
    }

    const response = await ai!.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.slice(0, 1000), // safe length
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
  } catch (err: any) {
    console.error('Error synthesizing audio:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to synthesize audio with Gemini TTS.',
    });
  }
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

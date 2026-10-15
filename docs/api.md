# SceneCraft API Reference

All AI operations in SceneCraft are handled by backend Express endpoints in `server.ts`. Text generation supports Gemini, OpenAI, Anthropic, and Hugging Face. Web-entered credentials remain in server memory and are associated with an `HttpOnly` browser-session cookie. Keys are never returned by API endpoints.

---

## Health & System Status

### `GET /api/health`
Returns server readiness and whether the active browser session's selected provider is configured.

**Response**:
```json
{
  "status": "ok",
  "hasGeminiKey": false,
  "hasAiKey": true,
  "provider": "openai",
  "model": "gpt-4.1-mini",
  "mode": "live",
  "message": "AI provider is configured."
}
```

### `GET /api/settings`
Returns the selected provider, model, thinking level, supported model lists, and whether a key is configured. The key value is never returned; `maskedKey` is a fixed mask only.

### `GET /api/settings/models?provider=gemini`
Fetches Gemini models available to the current server-side key and returns only models advertising `generateContent`. Newer text models are therefore selectable when enabled for the key. Without a key, the maintained known model list is returned. Unknown models do not receive a thinking parameter unless support is explicitly configured.

### `POST /api/settings`
Saves session-scoped settings. Accepts `provider` (`gemini`, `openai`, `anthropic`, or `huggingface`), a compatible `model`, `thinkingLevel` (`low`, `medium`, or `high`), and an optional `apiKey`. A key is held in server memory only.

### `POST /api/settings/test`
Checks credentials with the provider's model-list endpoint using `GET`; it does not generate content or incur generation charges. An optional `apiKey` can be tested before saving.

### `GET /api/settings/models?provider=gemini`
Lists provider text models enabled for the active key. Use `POST /api/settings/models` with `{ "provider": "gemini", "apiKey": "..." }` to refresh with an unsaved key; credentials are sent in the request body, never the URL or response. Gemini results filter out image, audio, embedding, and other non-text models. Models such as `gemini-3.8-flash` appear only if the provider lists them for that key. Hugging Face includes Qwen models through its OpenAI-compatible router.

### `POST /api/settings/key/remove`
Removes the selected provider's key from the current server session. Environment-configured keys are not removed.

Web-entered keys/settings are lost on server restart. Generation is capped at 10 requests per minute and 100 per day per session.

---

## Screenplay & Narrative Endpoints

### `POST /api/ai/script`
Generates a structured screenplay from project metadata using the selected text provider and compatible model.

**Request Body**:
```json
{
  "title": "The Last Signal",
  "idea": "A solitary radio technician in deep space...",
  "contentType": "short_film",
  "tone": "Tense, atmospheric sci-fi",
  "targetAudience": "Sci-fi fans",
  "durationMinutes": 3,
  "language": "English",
  "visualStyle": "Cinematic 35mm anamorphic"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "title": "The Last Signal",
    "logline": "When an isolated deep-space radio technician...",
    "synopsis": "On the rim of known solar territory...",
    "fullScript": "INT. KEPLER-9 OBSERVATION DECK - NIGHT...",
    "targetAudienceNotes": "Focuses on cosmic suspense..."
  }
}
```

---

### `POST /api/ai/regenerate-section`
Rewrites only a specific section of the screenplay without destroying the rest.

**Request Body**:
```json
{
  "sectionType": "logline",
  "currentScript": { "title": "...", "logline": "...", "synopsis": "..." },
  "projectIdea": "Deep space signal discovery...",
  "instructions": "Make it punchier with higher stakes"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "sectionType": "logline",
    "content": "A high-stakes revised logline here."
  }
}
```

---

## World Bible & Entity Extraction

### `POST /api/ai/bible`
Extracts characters, recurring locations, and props from screenplay text using the selected text provider and compatible model.

**Request Body**:
```json
{
  "script": "INT. KEPLER-9 OBSERVATION DECK - NIGHT...",
  "title": "The Last Signal",
  "contentType": "short_film"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "visualTheme": "Cinematic 35mm, cold obsidian space with amber console lighting",
    "characters": [
      {
        "id": "char-1",
        "name": "Maya Lin",
        "role": "protagonist",
        "description": "Deep-space comms specialist...",
        "appearance": "East Asian woman in her mid-30s, sharp watchful dark eyes...",
        "personality": "Quiet, methodical, empathetic...",
        "clothing": "Charcoal-gray flight technician suit...",
        "visualMarkers": "Brass Kepler-9 mission patch, tactile fingerless radio gloves"
      }
    ],
    "locations": [
      {
        "id": "loc-1",
        "name": "Kepler-9 Observation Bay",
        "description": "Primary command watch...",
        "environment": "Tactile brass dials, CRT scopes, panoramic viewport...",
        "visualCharacteristics": "Ice crystals on glass edges, floating dust motes...",
        "timeAndLighting": "Dim interior lit by amber indicators..."
      }
    ],
    "props": []
  }
}
```

---

## Scene Breakdown & Prompt Engineering

### `POST /api/ai/scenes`
Parses the screenplay into sequential scenes with camera directions, actions, and visual prompts.

**Request Body**:
```json
{
  "script": "Screenplay content...",
  "title": "The Last Signal",
  "contentType": "short_film",
  "durationMinutes": 3,
  "bible": { "characters": [], "locations": [], "visualTheme": "..." }
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "scene-1-12345",
      "sceneNumber": 1,
      "title": "The Lonely Watch",
      "description": "Maya sits at the console...",
      "setting": "Kepler-9 Observation Bay",
      "timeOfDay": "dim_ambient",
      "characters": ["Maya Lin"],
      "actions": "Maya tunes an analog sweep dial...",
      "dialogue": "MAYA: Static harmonic...",
      "cameraDirection": "Wide establishing shot pushing in",
      "mood": "Melancholic, quiet",
      "visualStyle": "Cinematic 35mm anamorphic",
      "durationSeconds": 6,
      "imagePrompt": "Cinematic anamorphic 35mm film still of Maya Lin..."
    }
  ]
}
```

---

### `POST /api/ai/visual-prompts`
Re-synthesizes an ultra-detailed image prompt for an individual scene using the World Bible.

---

## Media Generation Endpoints

### `POST /api/ai/generate-image`
Generates a storyboard scene image using Gemini `gemini-2.5-flash-image` with image output explicitly requested. This media model is separate from the text-model selector. Image generation is not available through the OpenAI provider selection.

**Request Body**:
```json
{
  "prompt": "Cinematic anamorphic 35mm film still of Maya Lin seated before starfield...",
  "aspectRatio": "16:9"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "imageUrl": "data:image/png;base64,...",
    "mimeType": "image/png"
  }
}
```

---

### `POST /api/ai/audio-tts`
Synthesizes speech audio for character dialogue or scene narration using Gemini `gemini-2.5-flash-preview-tts`. Speech generation is not available through the OpenAI provider selection.

**Request Body**:
```json
{
  "text": "Receiver seven, identify carrier wave.",
  "voice": "Kore",
  "speakerRole": "Maya Lin"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "audioUrl": "data:audio/wav;base64,...",
    "duration": 4
  }
}
```

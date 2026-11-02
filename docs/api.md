# SceneCraft API Reference

All AI operations in SceneCraft are handled by backend Express endpoints in `server.ts`. Text generation supports Gemini, OpenAI, Anthropic, and Hugging Face. Gemini and OpenAI also provide image and speech adapters. Web-entered credentials are associated with an `HttpOnly` browser-session cookie; they are encrypted at rest when `SCENECRAFT_KEY_ENCRYPTION_KEY` is configured and are never returned by API endpoints.

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
Returns the selected provider/model, thinking level, media capabilities, whether encrypted key persistence is configured, and per-provider key source (`session`, `persistent`, `environment`, or `none`). The key value is never returned; the legacy `maskedKey` field is only a fixed mask.

### `GET /api/settings/models?provider=gemini`
Fetches text models available to the current server-side key. Gemini models must advertise `generateContent` and media/embedding models are filtered out. Without a key, the maintained known model list is returned. Thinking controls are enabled only for models whose provider-specific mapping is explicitly known.

### `POST /api/settings`
Saves settings for the current browser session. Accepts `provider` (`gemini`, `openai`, `anthropic`, or `huggingface`), a compatible `model`, `thinkingLevel` (`low`, `medium`, or `high`), and an optional `apiKey`. Keys are encrypted with AES-256-GCM in the server vault when the independently managed `SCENECRAFT_KEY_ENCRYPTION_KEY` is set; otherwise, they are memory-only.

### `POST /api/settings/test`
Checks credentials with the provider's model-list endpoint using `GET`; it does not generate content. An optional `apiKey` can be tested before saving. Without a key in the request, it checks that provider's session key or environment key even when another provider is currently selected.

Use `POST /api/settings/models` with `{ "provider": "gemini", "apiKey": "..." }` to refresh with an unsaved key; credentials are sent in the request body, never the URL or response. Dynamically discovered models are validated against the catalog for that provider key before they can be saved or used.

### `POST /api/settings/key/remove`
Removes the selected provider's web-entered key from the current session and encrypted vault. Environment-configured keys are not removed.

Encrypted provider keys/settings expire 30 days after the last settings save. The browser cookie is HttpOnly, SameSite=Strict, and Secure in production; the server allows at most 500 simultaneous sessions. Without the encryption secret, web-entered keys are memory-only and do not survive restart. Generation is capped at 10 requests per minute and 100 per day per session.

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
Generates an image using the active provider's media adapter: Gemini `gemini-2.5-flash-image` or OpenAI `gpt-image-1`. Anthropic and Hugging Face do not implement image generation in SceneCraft. Up to four PNG/JPEG/WebP reference images may be supplied. References are attached through Gemini multimodal input or OpenAI's image-edit endpoint. The media model is separate from the text-model selector.

**Request Body**:
```json
{
  "prompt": "Cinematic anamorphic 35mm film still of Maya Lin seated before starfield...",
  "aspectRatio": "16:9",
  "referenceImages": ["data:image/png;base64,..."]
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
Synthesizes speech for character dialogue or narration using Gemini `gemini-2.5-flash-preview-tts` or OpenAI `gpt-4o-mini-tts`, depending on the active provider. Gemini voices are Kore, Puck, Charon, Fenrir, and Zephyr. OpenAI voices use the provider's documented presets. Anthropic and Hugging Face do not implement speech synthesis in SceneCraft.

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

Gemini PCM audio is wrapped by the server in a 24kHz, 16-bit mono RIFF/WAV container; OpenAI is requested to return WAV. Duration is calculated from the WAV data size.

## Project Storage and Video Notes

- Project records/media are stored in IndexedDB; legacy localStorage records are migrated on first database open. The active-project pointer remains in localStorage. Browser quota remains applicable.
- Project backup files use `{ "format": "scenecraft-project", "version": 1, "project": ... }`. Imports validate project metadata, scenes, and world-bible entries. Previous unwrapped backup files remain supported; unsupported future versions and malformed files are rejected.
- Image/audio data URIs, screenplay history, character references, and persisted rendered video are included in project backups. Video is stored as a local IndexedDB Blob; its object URL is recreated when the project is reopened.
- Video rendering selects MP4 only when `MediaRecorder.isTypeSupported` confirms a supported MP4 MIME type; otherwise it selects WebM. It paces scene duration at 30fps and mixes generated WAV clips at scene boundaries.

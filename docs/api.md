# SceneCraft API Reference

All AI operations in SceneCraft are handled via backend Express endpoints in `server.ts`. This ensures that API credentials (`GEMINI_API_KEY`) remain strictly server-side.

---

## Health & System Status

### `GET /api/health`
Returns the status of the server and whether a Gemini API key is configured.

**Response**:
```json
{
  "status": "ok",
  "hasGeminiKey": true,
  "mode": "live",
  "message": "Gemini AI services are operational."
}
```

---

## Screenplay & Narrative Endpoints

### `POST /api/ai/script`
Generates a structured screenplay from project metadata using `gemini-3.8-flash`.

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
Extracts characters, recurring locations, and props from screenplay text using `gemini-3.8-flash`.

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
Generates a storyboard scene image using `gemini-3.1-flash-lite-image`.

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
Synthesizes speech audio for character dialogue or scene narration using `gemini-3.8-flash-lite-tts`.

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

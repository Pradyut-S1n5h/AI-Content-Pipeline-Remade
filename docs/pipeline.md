# SceneCraft Pipeline Specifications

SceneCraft structures the creative content creation journey into **8 distinct, non-destructive stages**:

---

## 01. Project Configuration (`project`)
- **Inputs**: Title, core concept/idea, format (short film, YouTube video, educational doc, advertisement, story, animation, social video), duration in minutes, tone, target audience, visual style, language, and aspect ratio.
- **Output**: Initialized `ProjectMetadata` entity with UUID and ISO timestamps.

---

## 02. Screenplay & Story Architecture (`script`)
- **AI Model**: Selected text provider/model (Gemini or OpenAI).
- **Output Schema**:
  - `title`: Polish working title.
  - `logline`: 1-2 sentence dramatic hook.
  - `synopsis`: Narrative overview detailing the beginning, middle, and climax.
  - `fullScript`: Standard screenplay draft featuring scene headers (`INT./EXT.`), action blocks, character cues, and dialogue.
- **Section Rewrite**: Users can selectively rewrite *only* the logline, synopsis, or full screenplay with targeted instructions without wiping the rest of the project.

---

## 03. World Bible & Visual Consistency (`bible`)
- **AI Model**: Selected text provider/model (Gemini or OpenAI).
- **Entities**:
  - **Characters**: Name, role, appearance, personality, wardrobe, and *visual prompt markers* (e.g. "East Asian woman, brass Kepler-9 patch, fingerless radio gloves").
  - **Locations**: Setting, architectural environment, visual characteristics, and lighting conditions.
  - **Props**: Narrative artifacts, gadgets, weapons, or items.
- **Purpose**: Establishes canonical visual descriptors that are programmatically injected into subsequent scene generation prompts.

---

## 04. Scene Engine & Breakdown (`scenes`)
- **AI Model**: Selected text provider/model (Gemini or OpenAI).
- **Scene Fields**:
  - `sceneNumber`: Sequential order (1, 2, 3...)
  - `title`: Evocative scene title
  - `description`: Core dramatic beat
  - `setting`: Location name referenced from the World Bible
  - `timeOfDay`: Lighting classification (day, night, dusk, dawn, golden_hour, interior_lit, dim_ambient)
  - `characters`: Associated character names
  - `actions`: Physical movement and staging
  - `dialogue`: Spoken lines or voiceover snippet
  - `cameraDirection`: Framing & lens direction (e.g. "Low-angle close-up pushing in")
  - `mood`: Emotional tone
  - `durationSeconds`: Estimated runtime (3 to 12s)
  - `imagePrompt`: Synthesized prompt combining camera framing + characters + setting + lighting
- **Interactive Controls**: Move Up, Move Down, Duplicate, Delete, Add Scene, Edit Scene, and Re-synthesize Prompt from Bible.

---

## 05. Visual Storyboard Studio (`storyboard`)
- **AI Model**: Gemini `gemini-2.5-flash-image` or OpenAI `gpt-image-1`, based on the configured provider. Character reference images are passed when supported.
- **States**:
  - `idle`: Pending visual generation.
  - `generating`: Active request with spinner and loading indicator.
  - `completed`: High-resolution frame generated and stored.
  - `failed`: Clear error display with single-click Retry or "Use Sample Art" fallback.
- **Controls**: Batch generate missing frames, per-frame reroll, full-size lightbox inspection, and asset download.

---

## 06. Voice Audio Studio (`audio`)
- **AI Model**: Gemini `gemini-2.5-flash-preview-tts` or OpenAI `gpt-4o-mini-tts`, depending on the selected provider.
- **Voice Presets**: Gemini Kore/Puck/Charon/Fenrir/Zephyr; OpenAI's supported preset voices.
- **Audio Output**: Gemini PCM is wrapped in a 24kHz 16-bit WAV header; OpenAI returns WAV. Audio is retained as a base64 data URI.
- **Philosophy**: Audio is strictly non-blocking and optional. Projects can proceed to video assembly and export with or without synthesized audio.

---

## 07. Video Timeline & Assembly (`video`)
- **Engine**: Canvas 2D + Web Audio API + MediaRecorder.
- **Features**:
  - Interactive animatic player with real-time audio sync.
  - Ken Burns cinematic zoom and pan rendering per scene.
  - Progress tracking through: *Preparing assets* -> *Rendering frames* -> *Finalizing* -> *Complete*.
  - Cancelable, real-time frame rendering at 30fps with image/audio resources released at completion.
  - Per-scene generated WAV is mixed into the rendered video; audio clips are clipped to their scene duration.
  - Aspect ratio follows project setup (16:9, 9:16, 1:1, or 4:3).
  - Browser-supported MP4 is selected when available; otherwise a supported WebM codec is used.
  - Rendered video is persisted in IndexedDB, can be downloaded after refresh, and is included in complete backups.
- **Limitations**: Browser support for Canvas capture and at least one MediaRecorder container/codec is required. Rendering is real-time at 30fps.

---

## 08. Export Suite (`export`)
- **Screenplay**: Fountain (`.fountain`), Markdown (`.md`), Plain Text (`.txt`), Script JSON (`.json`).
- **Scene Breakdown**: CSV spreadsheet (`.csv`), Scene JSON (`.json`).
- **Storyboard**: Printable HTML document with dedicated print stylesheet and browser PDF export.
- **Project Backup**: Versioned, validated project JSON export/import; legacy unversioned projects are migrated. Generated images, audio, screenplay history, character references, and the saved video are included.
- **Video Deliverable**: Download assembled video animatic.

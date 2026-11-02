# SceneCraft Architecture Documentation

## Overview

SceneCraft is built as a full-stack, modular TypeScript application designed to guide digital creators from an initial idea through a structured content creation pipeline to finished media deliverables.

```
+-----------------------------------------------------------------------+
|                           User Workspace                              |
|   +---------------------------------------------------------------+   |
|   |                     React 19 Frontend                         |   |
|   |  - Pipeline Stage Controller                                  |   |
|   |  - Screenplay & Section Editor                                |   |
|   |  - World Bible Manager                                        |   |
|   |  - Scene Engine (Reordering & Timing)                         |   |
|   |  - Storyboard Grid & Lightbox                                 |   |
|   |  - Interactive Animatic Player (Ken Burns)                    |   |
|   |  - HTML5 Canvas & MediaRecorder Video Compiler                |   |
|   |  - Export Suite (Fountain, CSV, PDF, JSON)                    |   |
|   +-------------------------------+-------------------------------+   |
|                                   |                                   |
|                          HTTP / JSON APIs                             |
|                                   v                                   |
|   +-------------------------------+-------------------------------+   |
|   |                    Express Backend (server.ts)                |   |
|   |  - Static & Vite Dev Middleware                               |   |
|   |  - Input Validation & Schema Enforcement                      |   |
|   |  - Session-scoped Gemini/OpenAI/Anthropic/HF text adapters    |   |
|   |  - Gemini/OpenAI image/audio adapters                         |   |
|   |  - Health, settings, and key-verification endpoints            |   |
|   +-------------------------------+-------------------------------+   |
+-----------------------------------|-----------------------------------+
                                    |
               Gemini REST API / OpenAI Chat Completions / Gemini SDK
                            v
            +-----------------------------------------------------------------------+
            | Text models: Gemini, OpenAI, Anthropic Claude, Hugging Face Qwen     |
            | Gemini media: 2.5 Flash Image and 2.5 Flash Preview TTS              |
            +-----------------------------------------------------------------------+
```

---

## Client-Server Separation & Security

### Why Server-Side AI?
1. **API Key Security**: Environment keys are read server-side. Web-entered keys are associated with an opaque `HttpOnly`, `SameSite=Strict` cookie; when configured, an AES-256-GCM vault encrypts keys at rest using an independently managed 32-byte `SCENECRAFT_KEY_ENCRYPTION_KEY`. API responses expose key status only. Production cookies use `Secure`.
2. **Schema Enforcement**: Structured JSON responses are validated server-side before returning to the React client.
3. **Bounded Requests**: Session limits cap generation frequency, prompts, and output tokens. Retries are limited to transient failures; invalid credentials and quota/rate-limit errors are not retried.

---

## State Management & Local Persistence

SceneCraft follows a resilient local-first architecture:
- **Primary Storage**: IndexedDB stores versioned project records and large media assets. Existing localStorage project records are migrated to IndexedDB; localStorage remains for the active-project pointer and a compatibility fallback.
- **Autosave Engine**: `App.tsx` debounces autosave by 600ms; the header reports unsaved, saving, saved, or failed states and offers manual save.
- **Portability**: Project backup JSON is versioned, validated, and retains legacy import support. It includes storyboard/audio data and the persisted rendered video; import stores the video as an IndexedDB Blob.
- **Offline / Demo Resilience**: If no Gemini API key is configured on the host server, the application enters a clean, fully operational **Demo Mode** loaded with the complete *The Last Signal* short film project.
- **AI Settings**: Provider/model preferences remain server-side and projects never contain keys or AI settings. Web-entered keys survive restarts only when the independent encryption secret and persistent vault storage are configured.
- **Media Provider**: Gemini and OpenAI support image and speech. Anthropic and Hugging Face are explicitly text-only; unsupported operations are disabled and return a clear API error.

---

## Video Assembly Architecture

Rather than relying on third-party cloud video rendering services that require paid subscriptions or mock buttons, SceneCraft implements a **genuine browser-side video assembler**:

1. **Asset Preparation**: Preloads all scene image assets into `HTMLImageElement` buffers.
2. **Canvas Pipeline**: Allocates an off-screen `HTMLCanvasElement` at 30 FPS using the project's selected aspect ratio.
3. **Cinematic Processing**:
   - Calculates duration-adjusted frame counts per scene and paces frames at the recording rate.
   - Applies continuous Ken Burns scale (1.0 to 1.08) and subtle panning.
   - Overlays cinematic vignetting and lower-third typography (Scene Number, Title, Camera Framing).
4. **Audio**: Decodes generated per-scene WAV assets and schedules them on a Web Audio stream alongside the canvas.
5. **Encoding**: Captures stream via `canvas.captureStream(30)` and selects MP4 only when `MediaRecorder.isTypeSupported` confirms it; otherwise chooses a supported WebM codec.
6. **Progressive Feedback**: Emits progress, supports abort, rejects unavailable or failed assets rather than drawing a fake placeholder, and stops media tracks/audio contexts when complete.
7. **Output**: Checks for a non-empty supported media Blob, persists it in IndexedDB, previews it through a temporary object URL, and includes it in project backups. The object URL is recreated on restore.

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
|   |  - Gemini-only image/audio adapters                           |   |
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
1. **API Key Security**: Environment keys are read server-side. Web-entered keys are held in server memory under a random `HttpOnly`, `SameSite=Strict` session cookie; API responses expose only whether a key exists and a fixed mask. They are never stored in browser storage or project data.
2. **Schema Enforcement**: Structured JSON responses are validated server-side before returning to the React client.
3. **Bounded Requests**: Session limits cap generation frequency, prompts, and output tokens. Retries are limited to transient failures; invalid credentials and quota/rate-limit errors are not retried.

---

## State Management & Local Persistence

SceneCraft follows a resilient local-first architecture:
- **Primary Storage**: `localStorage` acts as an immediate cache for user projects (`scenecraft_proj_<id>`).
- **Autosave Engine**: `App.tsx` contains a debounced autosave effect (600ms) that commits all edits without interrupting user typing.
- **Portability**: The Export Suite allows users to export complete project packages as `.json` files and import them on any device.
- **Offline / Demo Resilience**: If no Gemini API key is configured on the host server, the application enters a clean, fully operational **Demo Mode** loaded with the complete *The Last Signal* short film project.
- **AI Settings**: Provider/model preferences and web-entered keys remain server-side in memory and are lost when the process restarts. Projects continue to autosave locally; they do not contain keys or AI settings.
- **Media Provider**: Image and TTS generation are Gemini-only. An OpenAI text selection returns an explicit error for those operations instead of switching providers.

---

## Video Assembly Architecture

Rather than relying on third-party cloud video rendering services that require paid subscriptions or mock buttons, SceneCraft implements a **genuine browser-side video assembler**:

1. **Asset Preparation**: Preloads all scene image assets into `HTMLImageElement` buffers.
2. **Canvas Pipeline**: Allocates an off-screen `HTMLCanvasElement` (1280x720 @ 30 FPS).
3. **Cinematic Processing**:
   - Calculates duration-adjusted frame counts per scene.
   - Applies continuous Ken Burns scale (1.0 to 1.08) and subtle panning.
   - Overlays cinematic vignetting and lower-third typography (Scene Number, Title, Camera Framing).
4. **Encoding**: Captures stream via `canvas.captureStream(30)` into `MediaRecorder` (`video/webm;codecs=vp9` or native container).
5. **Progressive Feedback**: Emits real pipeline status (`preparing_assets` -> `rendering_frames` -> `finalizing` -> `completed`).
6. **Output**: Produces a valid, playable `Blob` ready for immediate in-browser preview and file download.

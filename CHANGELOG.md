# Changelog

All notable changes to **SceneCraft** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-03

### Initial Portfolio Release

#### Added
- **Core Workspace & Project Management**:
  - Full project setup with title, concept, content format (short film, YouTube, educational, ad, animation, social video), target duration, tone, target audience, and language.
  - Multi-project management with project creation, metadata editing, duplication, and deletion.
  - Automatic local state autosave with debounce and sync.
  - Pre-loaded, fully populated demo project (*The Last Signal*) ready to explore without requiring external API keys.

- **AI Screenplay & Story Engine**:
  - Structured screenplay generation via Gemini 3.8 Flash (`gemini-3.8-flash`) returning structured JSON with title, logline, synopsis, full screenplay, and pacing notes.
  - Targeted section rewrite: regenerate only logline, synopsis, title, or full script with custom instructions without erasing the rest.
  - Full manual screenplay editing in standard formatting.

- **World Bible & Consistency System**:
  - Automated extraction of characters, locations, and narrative props from screenplays.
  - Character cards detailing appearance, personality, wardrobe, and unique visual prompt markers.
  - Recurring location definitions with environment, visual characteristics, and lighting conditions.
  - Master visual style theme management.
  - Automatic injection of character visual markers and setting details into subsequent scene image prompts.

- **Scene Breakdown & Reordering Engine**:
  - Structured parsing of screenplays into sequential scenes (scene number, title, description, setting, time of day, characters, action beat, dialogue, camera direction, mood, duration).
  - Manual scene operations: add, delete, duplicate, edit, and reorder (move up/down) with sequential renumbering.
  - Per-scene visual prompt regeneration grounded in the World Bible.

- **Visual Storyboard Studio**:
  - Storyboard grid with real-time generation states: `idle`, `generating`, `completed`, and `failed`.
  - Image generation powered by Gemini 3.1 Flash Lite Image (`gemini-3.1-flash-lite-image`).
  - Batch generation of all ungenerated scene frames.
  - Error boundaries with retry controls and safe sample artwork fallback for quota-restricted environments.
  - Full-resolution image lightbox inspector and single-frame asset download.

- **Voice & Audio Studio (Optional)**:
  - Dialogue and narrative voiceover synthesis via Gemini 3.8 Flash Lite TTS (`gemini-3.8-flash-lite-tts`).
  - Support for 5 prebuilt voice models: Kore, Puck, Charon, Fenrir, and Zephyr.
  - Native in-browser audio playback and WAV file downloading.
  - Audio designed as an optional non-blocking pipeline stage.

- **Video Assembly & Animatic Player**:
  - Interactive animatic player with real-time frame switching, Ken Burns zoom/pan effect, and synchronized scene audio playback.
  - HTML5 Canvas and `MediaRecorder` video assembly engine that encodes real `.webm` video files directly in the browser with live stage tracking: *Preparing assets* → *Rendering frames* → *Finalizing* → *Complete*.
  - Direct video file download.

- **Export Suite**:
  - Screenplay exports: Fountain (`.fountain`), Markdown (`.md`), Plain Text (`.txt`), Script JSON (`.json`).
  - Scene breakdown exports: CSV (`.csv`) and JSON (`.json`).
  - Storyboard export: Dedicated high-contrast printable document layout with native `window.print()` / PDF support.
  - Project archive: Full JSON export and import for project portability.
  - Video export: Direct browser-rendered `.webm` download.

- **Architecture & Security**:
  - Client-server split with Express (`server.ts`) keeping `GEMINI_API_KEY` strictly on the server.
  - Vite dev server integration via Express middleware.
  - Automated test suite validating data structures, prompt generation, schema validation, and export generators.

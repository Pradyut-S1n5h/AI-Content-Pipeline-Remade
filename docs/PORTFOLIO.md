# Portfolio Case Study: SceneCraft

## Project Metadata
- **Project Name**: SceneCraft (AI Content Creation Pipeline)
- **Role**: Lead Full-Stack Engineer & Architect
- **Repository**: [https://github.com/Pradyut-S1n5h/AI-Content-Pipeline-Remade](https://github.com/Pradyut-S1n5h/AI-Content-Pipeline-Remade)
- **Live Demo**: [SceneCraft Studio Demo](https://ais-dev-kkxb7ks27a5svkbrvivdvi-968640885885.asia-southeast1.run.app)
- **Demo Video**: [Coming Soon / Placeholder]

---

## 1. Executive Summary & Problem
AI generation tools typically operate as disjointed, single-turn prompts (e.g., generating an ungrounded script in one chat window, then manually copying prompts into separate image generators where characters change face, clothes, and art style across every image).

**The Problem**:
- Screenplays lack visual and narrative consistency across scenes.
- Free-form LLM outputs frequently break downstream formatting and require tedious manual cleanup.
- Content creators must juggle 4-5 disparate platforms (LLM, image generator, TTS, video editor) to produce an initial animatic pitch.

**The Solution**:
SceneCraft is a structured, end-to-end content production pipeline. It guides a creator from an initial premise through scriptwriting, automated entity extraction (World Bible), camera-guided scene breakdown, visual prompt synthesis with character consistency, storyboard generation, voice synthesis, animatic video rendering, and multi-format export.

---

## 2. Key Features
- **Structured Screenplay Generation**: Generates titles, loglines, synopses, and formatted screenplays using JSON-schema validation with the selected text provider and model.
- **Targeted Section Rewriting**: Allows creators to regenerate a supported screenplay section with custom instructions without erasing the rest of the draft.
- **World & Character Bible**: Automatically extracts characters, locations, and props, storing visual markers (e.g., "scar across left eyebrow, charcoal flight suit") that are programmatically injected into subsequent scene prompts.
- **Scene Engine**: Scene breakdown with sequential reordering, camera framing, lighting, actions, and duration controls.
- **Visual Storyboard**: Multi-state storyboard with individual and sequential batch generation via Gemini `gemini-2.5-flash-image` or OpenAI `gpt-image-1`, lightbox inspection, per-frame retry, character references, and asset downloads.
- **Voiceover Synthesis (Optional)**: In-engine dialogue and narration synthesis using Gemini `gemini-2.5-flash-preview-tts` or OpenAI `gpt-4o-mini-tts`. Gemini PCM is converted to WAV on the server.
- **Real Video Assembly**: Browser-side Canvas and `MediaRecorder` produce MP4 when the browser supports it, otherwise WebM, at the project aspect ratio, with per-scene WAV mixing, cancelable rendering, and progress feedback.
- **Recoverable Projects**: Versioned IndexedDB project and media records, explicit save state, legacy backup migration, validated imports, and overwrite confirmation.
- **Provider Settings**: Web-entered keys can persist in an encrypted server-side vault when configured (otherwise session-only), with per-provider key status, live model discovery, and explicit capability checks.
- **Export Suite**: Exports to Fountain (`.fountain`), Markdown (`.md`), Plain Text, CSV, JSON, and printable HTML/PDF.

---

## 3. Tech Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Backend / API**: Node.js, Express, tsx
- **AI Providers & SDK**: Gemini, OpenAI, Anthropic, and Hugging Face text adapters; Gemini and OpenAI image and speech adapters.
  - Gemini image: `gemini-2.5-flash-image`
  - Gemini TTS: `gemini-2.5-flash-preview-tts`
  - OpenAI image: `gpt-image-1`
  - OpenAI TTS: `gpt-4o-mini-tts`
- **Video Assembly**: HTML5 Canvas 2D, MediaStream Recording API (`MediaRecorder`), Web Audio API
- **Testing**: Node.js native test runner (`node:test`, `node:assert/strict`)

---

## 4. Engineering Challenges & Solutions

### Challenge 1: Keeping API Keys Secure While Supporting Fluid AI Generation
- **Issue**: Calling providers directly from client-side React code risks exposing API keys in public bundles or browser developer tools.
- **Solution**: The Express backend holds environment keys and session keys. Optional authenticated encryption persists web-entered keys in a private server vault when a separately managed key is configured; browser settings return status only.

### Challenge 2: Maintaining Character & Location Consistency Across Image Prompts
- **Issue**: Standard image generators produce entirely different faces, clothing, and settings for each prompt.
- **Solution**: Designed a prompt builder engine (`promptBuilder.ts`) that matches character names and location tags referenced in a scene to the canonical World Bible. The engine injects physical markers, clothing details, and environment lighting into the image prompt, ensuring stylistic continuity.

### Challenge 3: Video Assembly Without Heavy Cloud Infrastructure or Fake Mockups
- **Issue**: Generating video on a cloud server often requires heavy GPU containers or expensive external rendering APIs, while mock video players mislead users.
- **Solution**: Implemented a pure browser-side video assembler using HTML5 Canvas and `MediaRecorder`. It programmatically frames images, animates cinematic Ken Burns zooms, renders lower-thirds, syncs audio, and records a real playable MP4 or WebM file when the browser supports the corresponding encoder.

---

## 5. What I Learned
- **Structured Outputs over Regex**: Provider schema requests plus server-side validation provide explicit malformed-output handling instead of relying on regex extraction.
- **Pipeline Modularity**: Decoupling stages (such as making audio synthesis optional) ensures users are never blocked from completing a project if they choose not to use speech or encounter rate limits.
- **Design Constitution**: Adhering to strict anti-slop rules (unboxed metadata, zero pill capsules, high-contrast typography) transforms an AI prototype into a professional creative tool.

---

## 6. Current Limitations & Roadmap
- **Current Limitations**:
  - Image and speech generation require a configured Gemini or OpenAI key; other configured providers are text-only. Demo mode is separate from live provider generation.
  - Video export chooses MP4 only when the browser reports support; otherwise it uses WebM. All output runs at real-time 30fps and remains subject to browser codec availability.
  - Project records and media are stored in IndexedDB under browser quota. Rendered video assets persist and are included in complete backups.
- **Roadmap**:
  - MP4 container transcoding via WebAssembly ffmpeg.
  - Video generation integration using Google Veo models (`veo-3.1-lite-generate-preview`).

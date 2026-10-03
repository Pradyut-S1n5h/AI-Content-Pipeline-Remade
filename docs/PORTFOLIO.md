# Portfolio Case Study: SceneCraft

## Project Metadata
- **Project Name**: SceneCraft (AI Content Creation Pipeline)
- **Role**: Lead Full-Stack Engineer & Architect
- **Repository**: [https://github.com/Pradyut-S1n5h/AI-Content-Pipeline-Re-coded](https://github.com/Pradyut-S1n5h/AI-Content-Pipeline-Re-coded)
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
- **Structured Screenplay Generation**: Generates titles, loglines, synopses, and formatted screenplays using JSON schema constraints (`gemini-3.8-flash`).
- **Targeted Section Rewriting**: Allows creators to regenerate only a logline, synopsis, or dialogue segment with custom instructions without erasing the rest of the draft.
- **World & Character Bible**: Automatically extracts characters, locations, and props, storing visual markers (e.g., "scar across left eyebrow, charcoal flight suit") that are programmatically injected into subsequent scene prompts.
- **Scene Engine**: Scene breakdown with drag-and-drop / sequential reordering, camera framing, lighting, actions, and duration controls.
- **Visual Storyboard**: Multi-state storyboard supporting single and batch image generation via `gemini-3.1-flash-lite-image`, with lightbox inspection and asset downloads.
- **Voiceover Synthesis (Optional)**: In-engine dialogue and narration synthesis using `gemini-3.8-flash-lite-tts` supporting 5 distinct voice personas.
- **Real Video Assembly**: Browser-side video rendering using HTML5 Canvas (`captureStream`) and `MediaRecorder` producing real `.webm` video animatics with Ken Burns panning, scene lower-thirds, and synchronized audio.
- **Export Suite**: Exports to Fountain (`.fountain`), Markdown (`.md`), Plain Text, CSV, JSON, and printable HTML/PDF.

---

## 3. Tech Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Backend / API**: Node.js, Express, tsx
- **AI Models & SDK**: Google GenAI SDK (`@google/genai`)
  - Screenplay & Extraction: `gemini-3.8-flash`
  - Visual Image Generation: `gemini-3.1-flash-lite-image`
  - Audio TTS Synthesis: `gemini-3.8-flash-lite-tts`
- **Video Assembly**: HTML5 Canvas 2D, MediaStream Recording API (`MediaRecorder`), Web Audio API
- **Testing**: Node.js native test runner (`node:test`, `node:assert/strict`)

---

## 4. Engineering Challenges & Solutions

### Challenge 1: Keeping API Keys Secure While Supporting Fluid AI Generation
- **Issue**: Calling Gemini directly from client-side React code risks exposing API keys in public bundles or browser developer tools.
- **Solution**: Designed an Express backend proxy layer (`server.ts`) that handles all SDK client calls. API keys remain strictly in server environment variables, while the client receives clean, structured JSON payloads.

### Challenge 2: Maintaining Character & Location Consistency Across Image Prompts
- **Issue**: Standard image generators produce entirely different faces, clothing, and settings for each prompt.
- **Solution**: Designed a prompt builder engine (`promptBuilder.ts`) that matches character names and location tags referenced in a scene to the canonical World Bible. The engine injects physical markers, clothing details, and environment lighting into the image prompt, ensuring stylistic continuity.

### Challenge 3: Video Assembly Without Heavy Cloud Infrastructure or Fake Mockups
- **Issue**: Generating video on a cloud server often requires heavy GPU containers or expensive external rendering APIs, while mock video players mislead users.
- **Solution**: Implemented a pure browser-side video assembler using HTML5 Canvas and `MediaRecorder`. It programmatically frames images, animates cinematic Ken Burns zooms, renders lower-thirds, syncs audio, and records frames into a real playable `.webm` video file.

---

## 5. What I Learned
- **Structured Outputs over Regex**: Using Gemini's `responseSchema` and `Type.OBJECT` completely eliminates parsing failures compared to regex extraction.
- **Pipeline Modularity**: Decoupling stages (such as making audio synthesis optional) ensures users are never blocked from completing a project if they choose not to use speech or encounter rate limits.
- **Design Constitution**: Adhering to strict anti-slop rules (unboxed metadata, zero pill capsules, high-contrast typography) transforms an AI prototype into a professional creative tool.

---

## 6. Current Limitations & Roadmap
- **Current Limitations**:
  - Image generation depends on the user's Gemini API quota or a configured paid key (a demo fallback mode is provided).
  - Video rendering is currently limited to 720p/30fps WebM animatic format.
- **Roadmap**:
  - MP4 container transcoding via WebAssembly ffmpeg.
  - Multi-speaker screenplay TTS with backchanneling (`gemini-3.8-flash-tts`).
  - Video generation integration using Google Veo models (`veo-3.1-lite-generate-preview`).

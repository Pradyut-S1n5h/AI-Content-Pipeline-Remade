# Pipeline Guide

The existing project workflow is preserved alongside the **Local Generation** workspace. Generated project content is persisted with the project in browser IndexedDB; model files and direct-generation outputs live under the local `.local-ai/` directory.

## Local Generation

Choose one of three fixed tasks: Writing, Image, or Video. The app automatically connects the task to its one default local model. Model readiness, runtime availability, free disk, RAM, GPU/VRAM, download state, and actionable resource errors appear in **Models**.

- **Writing:** prompt-to-text for articles, scripts, captions, rewriting, summaries, and ideas. Copy or download the actual Ollama output.
- **Image:** prompt-to-image with supported dimensions from 256–768 pixels. Diffusers reports inference-step progress; the completed PNG is previewable and downloadable.
- **Video:** prompt-to-video rendering for 2–6 seconds at 8 FPS. The job reports real inference-step progress, supports cooperative cancellation, and produces a playable/downloadable MP4.

Missing model files are downloaded once and reused. Model downloads come from the repositories linked in the setup UI. No API keys or hosted inference services are involved. A completed UI response is only shown after a valid output file is saved.

## Project stages

1. **Project Setup:** title, premise, content type, duration, tone, audience, language, and visual direction.
2. **Screenplay:** local writing model creates structured title, logline, synopsis, and screenplay; individual sections can be rewritten.
3. **World Bible:** local text model extracts visual character, location, and prop details.
4. **Scene Engine:** local text model returns bounded scene breakdowns and prompts.
5. **Storyboard:** local Stable Diffusion generates actual PNG frames; per-scene status, retry, preview, and download are preserved.
6. **Voice Audio:** existing saved audio can be played/downloaded. New speech synthesis is not offered.
7. **Video Assembly:** existing browser renderer makes an animatic from scene images/audio. This is distinct from the Video task, which runs the local CogVideoX model to generate video from text.
8. **Export Suite:** project backup and screenplay/scene exports.

## Safety and limits

SceneCraft does not fabricate fallback outputs. Missing runtimes, absent model weights, hardware constraints, downloads, generation failures, and cancellation are reported as such. Batch storyboard generation is sequential. Video length and output size are capped to protect local hardware.

Review model licenses and use restrictions from the linked model cards before generating content.

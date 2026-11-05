# Local API Reference

The Express API is served by `server.ts`. Generation traffic is restricted to local processes: Ollama at `127.0.0.1:11434`, and the app-managed Diffusers worker at `127.0.0.1:8765`. No provider credentials or remote inference hosts are configured.

## Status and model setup

### `GET /api/health`

Returns `{ status, localInference, modelsReady, models, hardware }`. `modelsReady` counts only installed models whose runtime and hardware checks pass.

### `GET /api/local/status`

Returns the same hardware/model details inside `{ success: true, data }`. Exactly three models are described by [`local-models.json`](../local-models.json).

### `POST /api/local/install/:kind`

`:kind` is `writing`, `image`, or `video`. Returns HTTP 202 and `{ success: true, data: { id } }`. The UI polls the job endpoint for status and download progress. Duplicate downloads are rejected. Image/video downloads are resumable and are skipped if their completion marker exists. The app checks available disk before starting media downloads.

### `GET /api/local/jobs/:id`

Returns `{ success: true, data: { id, kind, status, progress, message, error?, output?, mimeType? } }`. `status` is `queued`, `running`, `completed`, `failed`, or `cancelled`; media `progress` tracks actual Diffusers steps. Download progress is estimated from downloaded bytes and model-size metadata.

### `POST /api/local/jobs/:id/cancel`

Requests cancellation for an active image/video job. Cancellation is checked between inference steps; an in-progress step may finish before it takes effect. Ollama model downloads are not cancellable through this API.

## Generation

### `POST /api/generate/writing`

Request: `{ "prompt": "Write an article about..." }` (1–10,000 characters). Returns `{ success: true, data: { text, model } }`. The writing model is fixed in the registry and invoked using Ollama's local `/api/chat` endpoint. Generation requires the local model to be installed and at least 4 GB total RAM plus 1.5 GB available RAM.

Existing pipeline endpoints also use this same local model:

- `POST /api/ai/script`
- `POST /api/ai/regenerate-section`
- `POST /api/ai/bible`
- `POST /api/ai/scenes`
- `POST /api/ai/visual-prompts`

These endpoints return structured JSON for screenplay, bible, and scene data, or `{ prompt }` for visual prompts. Prompts are validated before inference. No provider selector or model override is accepted.

### `POST /api/local/generate/image`

Request: `{ "prompt": "...", "options": { "width": 512, "height": 512 } }`. Dimensions must be multiples of 8 in the range 256–768. Returns HTTP 202 with `{ success: true, data: { id } }`. Poll the job until completion; its `output` is a local `/generated/<id>.png` URL.

### `POST /api/local/generate/video`

Request: `{ "prompt": "...", "options": { "duration": 2 } }`. Duration is an integer from 2–6 seconds. Returns HTTP 202 with a job ID; poll the job for progress and its local `/generated/<id>.mp4` result.

Image and video jobs are exclusive per media type and execute sequentially through one model-loading lock. Resource checks occur before model loading. OOM and runtime failures produce failed jobs; they never return generated-looking fallback content.

### Generated assets

`GET /generated/<filename>` serves actual files saved to ignored `.local-ai/outputs/`. Clients can preview or download the returned media URL.

## Retired routes

`POST /api/ai/generate-image` returns HTTP 410 directing clients to the asynchronous local image route. `POST /api/ai/audio-tts` returns HTTP 410; existing saved audio remains usable, but speech generation is not part of the three-model system.

# SceneCraft · Local AI Content Pipeline

SceneCraft is a full-stack writing, image, and text-to-video application. AI inference is performed by models downloaded to and executed on the same machine as the app. There are no API keys, hosted inference providers, or external generation endpoints.

The existing screenplay, world bible, scene, storyboard, browser animatic, project backup, and export workflows remain. The **Local Generation** workspace provides direct writing, image, and video prompt-to-output flows. Voice tracks saved in existing projects can still be played and downloaded; voice synthesis is not one of the three supported models.

## Exactly three default models

| Task | Fixed model | Runtime | Approx. weights | License | Supported hardware |
|---|---|---|---:|---|---|
| Writing | Qwen 2.5 1.5B Instruct (`qwen2.5:1.5b`) | Ollama | 1.0 GB | Apache-2.0 | 4 GB RAM and 2 CPU cores; CPU inference supported |
| Image | Stable Diffusion 1.5 (`sd-legacy/stable-diffusion-v1-5`) | Diffusers | 4.3 GB | CreativeML OpenRAIL-M | 8 GB system RAM + 8 GB GPU VRAM, or 12 GB RAM + 8 GB available for slow CPU generation |
| Video | CogVideoX 2B (`zai-org/CogVideoX-2b`) | Diffusers | 6 GB | Apache-2.0 | This pipeline requires CUDA, 16 GB GPU VRAM, and 32 GB system RAM |

Weights are fetched from the linked model repositories and cached under the ignored `.local-ai/` directory. Review each model's usage restrictions before use; Stable Diffusion's OpenRAIL-M license includes use restrictions. The Diffusers worker loads only one media model at a time, serializes inference, caps image/video sizes, and stores finished files locally.

The video model produces short videos (2–6 seconds at 8 FPS). It is resource intensive; the UI blocks installation or inference when the detected machine is below the configured requirement. The browser-side **Video Assembly** stage is a separate animatic renderer and is not represented as text-to-video inference.

## Requirements and setup

- Node.js 20+ and npm.
- Ollama installed and running for writing.
- Python 3.11 for local image/video runtime dependencies.
- CUDA-capable NVIDIA GPU for text-to-video. For practical image generation, use a GPU with at least 8 GB VRAM; CPU mode requires at least 12 GB RAM and is slow.
- Allow roughly 12 GB for all three model weights, plus Python runtime packages and generated outputs.

Install Ollama using its official local installer, then run:

```bash
npm ci
npm run setup:local-ai
npm run dev
```

`npm run setup:local-ai` creates `.venv-ai`, installs PyTorch and the local Diffusers/media dependencies, and reports if Ollama is missing. In the app, open **Models** → **Install** to download each supported model and follow its status. The writing model is pulled through the local Ollama runtime; image/video weights are downloaded resumably from their model repositories. Ollama must be running before installing or generating text.

If needed, start Ollama in another terminal with:

```bash
ollama serve
```

The single `npm run dev` process serves the UI/API and starts the loopback-only media worker. Readiness and model/hardware status are available at `http://localhost:3000/api/health`. Only normal frontend assets and model downloads use internet access; generation requests go only to `127.0.0.1`.

## GitHub Codespaces hardware observed for this repository

The inspected Codespace has Ubuntu 24.04, 2 vCPUs, Python 3.14.2, Node.js 24.21.0, 7.8 GiB total RAM (about 2.3 GiB available during the live API check), no detected CUDA GPU, and about 18 GiB free disk. Ollama and Python 3.11 are not installed.

- **Writing:** the 1.5B model's 4 GB RAM / 2-core target and the live 1.5 GB available-memory check are met. Ollama is not installed, so inference is not verified; available RAM is still a narrow margin.
- **Image:** not supported in this Codespace: it lacks 12 GB RAM for CPU inference and has no GPU/VRAM. Image generation is blocked; it is not replaced with sample output or a remote API.
- **Video:** not supported: no CUDA GPU, 16 GB VRAM, or 32 GB RAM. Video model download and inference are blocked on this hardware.

For image/video generation, use a local computer that meets the table requirements. The same setup commands and app work there. The Codespace can still run the web app, preserve project data, and may run writing once Ollama is installed. Python 3.11 is needed for the media worker setup, not Ollama text. This report does not claim that any model is installed or running in the current Codespace.

## Testing

```bash
npm test
npm run lint
npm run build
```

Tests and builds do not download or simulate model outputs. To exercise actual inference, install a model from **Models**, submit a prompt in **Local Generation**, and confirm the generated file is stored in `.local-ai/outputs/`.

## Architecture

- `local-models.json` is the single registry for the three defaults, source repositories, licenses, and storage/hardware estimates.
- `server.ts` contains the Express app and uses only `http://127.0.0.1:11434` for Ollama; media requests are proxied to `127.0.0.1:8765`.
- `local_ai_worker.py` handles resumable model downloads, hardware checks, exclusive job execution, progress, cancellation, Diffusers inference, and local output files.
- `src/components/stages/GenerateStage.tsx` provides the direct generation workflows. Existing script/storyboard stages also use the same local inference endpoints.
- `.local-ai/`, `.venv-ai/`, and downloaded weights are excluded from Git.

See [API reference](docs/api.md), [architecture](docs/architecture.md), [pipeline guide](docs/pipeline.md), and [troubleshooting](docs/troubleshooting.md).

# Architecture

## Local inference boundary

```text
React app ──same-origin──> Express (server.ts)
                            ├── http://127.0.0.1:11434 ──> Ollama ──> Qwen 2.5 1.5B
                            └── http://127.0.0.1:8765 ──> Python/Diffusers worker
                                                            ├── Stable Diffusion 1.5
                                                            └── CogVideoX 2B
```

The Ollama and media-worker addresses are fixed loopback addresses, not user-configurable provider URLs. Text, image, and video inference requests do not leave the machine. Internet access is used only for ordinary app dependencies and downloading model weights from the configured repositories. No API credentials, provider adapters, cloud generation routes, or model-provider selectors remain.

[`local-models.json`](../local-models.json) is the authoritative list of the three defaults, their repositories, estimated storage, licenses, and supported tasks. The app lazily loads one image/video pipeline at a time, serializes media inference, checks hardware before loading, and writes completed output to `.local-ai/outputs/`. Model files and the Python virtual environment are git-ignored.

## Model runtimes

- **Writing:** fixed Ollama model `qwen2.5:1.5b`. Ollama's local pull endpoint downloads the model once; requests use the local chat endpoint. Existing screenplay, world bible, scene, visual-prompt, and direct writing workflows share this runtime.
- **Image:** local Diffusers `StableDiffusionPipeline`, loaded from the downloaded model directory with local-files-only inference. Generated PNG dimensions are bounded and checked before inference.
- **Video:** local Diffusers `CogVideoXPipeline`, with callback-based step progress, cooperative cancellation, MP4 encoding through `imageio-ffmpeg`, and a 2–6 second duration cap.

The Express process starts the standard-library Python worker on loopback. `npm run setup:local-ai` creates a Python 3.11 virtual environment and installs PyTorch plus the Diffusers stack. The worker starts without those packages too, so status/setup errors remain visible; media is not reported as ready until dependencies, weights, and resource checks all pass.

## Frontend and storage

Projects continue to use IndexedDB. Browser-built animatic video remains a separate feature from actual text-to-video inference. The new Local Generation stage provides prompt, status, preview, copy/download, and media cancellation controls. Existing project audio playback is preserved, but cloud TTS was removed rather than silently substituted.

## Resource protection

- Image/video downloads display estimated progress and are rejected when free disk is below the model size plus a buffer.
- Runtime checks reject CPU image generation below 12 GB total / 8 GB available RAM, GPU image generation below 8 GB VRAM, and video generation below the configured 16 GB CUDA VRAM / 32 GB RAM target.
- Text inference requires at least 4 GB total RAM and 1.5 GB available RAM.
- Prompt length, output dimensions, video duration, and parallel generation are bounded.
- Media models are not loaded simultaneously; the previous pipeline is released and CUDA cache is cleared before a model switch.

## Environment noted during implementation

This Codespace is Ubuntu 24.04 with 2 vCPUs, Python 3.14.2, Node.js 24.21.0, 7.8 GiB RAM, no NVIDIA GPU, and about 18 GiB free disk. It cannot run the image or video defaults under these resource checks. Python 3.11 and Ollama are also absent, so successful local text inference has not been verified here. See [README](../README.md) for a supported-machine install path and the exact observed limits.

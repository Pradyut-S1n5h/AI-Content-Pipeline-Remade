# SceneCraft: Local AI Content Pipeline

SceneCraft demonstrates an end-to-end content workflow that keeps project data and AI inference local.

## Features

- Structured screenplay writing, section rewrites, world-bible extraction, scene breakdown, and visual prompt generation.
- Direct writing/image/video generation using exactly three fixed open-weight models.
- Local model installation status, disk/resource checks, resumable downloads, media progress, cancellation, preview, and download.
- IndexedDB project persistence, versioned project backups, screenplay history, browser animatic rendering, and exports.

## Technology

- React, TypeScript, Vite, Tailwind CSS, and Express.
- Ollama for local text inference.
- Python 3.11, PyTorch, and Diffusers for image/video inference.
- `local-models.json` is the authoritative default model registry.
- Node's built-in test runner for unit/integration behavior.

## Resource tradeoffs

The writing model is intentionally small enough for ordinary CPU inference. Image generation remains compute-intensive, and text-to-video requires a CUDA GPU and substantially more VRAM/RAM. The interface checks the actual machine and disables unsupported execution instead of returning demo media.

The inspected Codespace has 2 vCPUs, 7.8 GiB RAM, no CUDA GPU, Python 3.14.2, and 18 GiB free disk. It is not a supported image/video host. The video model is therefore not presented as runnable in this workspace.

## Start

```bash
npm ci
npm run setup:local-ai
npm run dev
```

Install and start Ollama separately for writing, then use **Models** in the UI to install model weights. See [README](../README.md) for hardware requirements, licenses, and setup details.

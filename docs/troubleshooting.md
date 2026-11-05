# Troubleshooting

## Writing model is unavailable

- Start Ollama locally (`ollama serve` where required), then check `http://localhost:3000/api/health`.
- In **Models**, install the Writing model. The fixed default is `qwen2.5:1.5b`.
- `npm run setup:local-ai` warns if Ollama is absent; install it from its official download page. The application will not fall back to a hosted model.
- Close memory-heavy processes if the local RAM check fails. Writing requires 4 GB total RAM and 1.5 GB available.

## Image/video model cannot be installed or run

- Install Python 3.11 and run `npm run setup:local-ai`. Python 3.14 is not a supported Diffusers environment for this setup.
- Confirm `.venv-ai` exists and refresh **Models**. Model files are stored under `.local-ai/models/`.
- Check free disk. Downloads need approximately 5.3 GB for Stable Diffusion and 7 GB for CogVideoX, including a safety buffer; all weights together are about 11.3 GB.
- Image requires 8 GB system RAM plus 8 GB GPU VRAM, or at least 12 GB total and 8 GB available RAM for slow CPU inference.
- This video implementation requires CUDA, 16 GB GPU VRAM, and 32 GB system RAM. Codespaces without an attached GPU cannot run it.
- If installation was interrupted, start it again. Repository downloads resume and reuse the local model directory.

## Generation fails or stops

- Model files are checked before inference. A missing-model error means installation has not completed or its marker is absent.
- Read the job error displayed in the UI. Out-of-memory errors require smaller image dimensions, shorter video duration, fewer concurrent workloads, or stronger hardware.
- Media jobs are serialized. A second request of the same kind is rejected while another is queued/running.
- Cancellation is cooperative and is checked between inference steps; a running step may complete first.
- The worker only serves loopback port `8765`; Ollama uses loopback port `11434`. No remote inference fallback is attempted.
- For model license, gated access, or repository issues, use the repository link shown for that exact default model. Image/video downloads require ordinary model repository access but no inference API key.

## Server or frontend is unavailable

Run `npm run dev`, then inspect `/api/health`. The backend logs whether the media worker starts. The worker can report status without PyTorch, but image/video inference remains unavailable until setup completes.

If a generated file is not found, inspect `.local-ai/outputs/`. Files can be regenerated if the app output folder was cleared; the app does not return a simulated success.

Automated tests, `npm run lint`, and `npm run build` do not download models or claim inference success. Verify actual inference only on hardware that meets the selected model requirements.

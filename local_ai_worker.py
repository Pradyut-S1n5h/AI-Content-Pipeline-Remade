#!/usr/bin/env python3
"""Loopback-only local Diffusers worker for image and video inference."""

from __future__ import annotations

import json
import multiprocessing
import os
import platform
import shutil
import threading
import time
import ctypes
import urllib.parse
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATE = ROOT / ".local-ai"
MODELS = STATE / "models"
OUTPUTS = STATE / "outputs"
TEMP = STATE / "tmp"
CONFIG = json.loads((ROOT / "local-models.json").read_text())
HOST = "127.0.0.1"
PORT = 8765
jobs: dict[str, dict] = {}
jobs_lock = threading.Lock()
generation_lock = threading.Lock()
pipelines: dict[str, object] = {}
cancel_events: dict[str, threading.Event] = {}


def load_torch():
    try:
        import torch
        return torch
    except ImportError as error:
        raise RuntimeError(
            "The local media runtime is not installed. Run `npm run setup:local-ai` "
            "with Python 3.11 before installing image or video models."
        ) from error


def hardware():
    torch = None
    try:
        torch = load_torch()
    except RuntimeError:
        pass
    total_ram = 0
    available_ram = 0
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            key, value, *_ = line.replace(":", "").split()
            if key == "MemTotal":
                total_ram = int(value) // 1024
            elif key == "MemAvailable":
                available_ram = int(value) // 1024
    except (OSError, ValueError):
        try:
            page_size = os.sysconf("SC_PAGE_SIZE")
            total_ram = os.sysconf("SC_PHYS_PAGES") * page_size // (1024 * 1024)
            available_ram = os.sysconf("SC_AVPHYS_PAGES") * page_size // (1024 * 1024)
        except (AttributeError, OSError, ValueError):
            if platform.system() == "Windows":
                class MemoryStatus(ctypes.Structure):
                    _fields_ = [
                        ("length", ctypes.c_ulong),
                        ("memory_load", ctypes.c_ulong),
                        ("total_physical", ctypes.c_ulonglong),
                        ("available_physical", ctypes.c_ulonglong),
                        ("total_page_file", ctypes.c_ulonglong),
                        ("available_page_file", ctypes.c_ulonglong),
                        ("total_virtual", ctypes.c_ulonglong),
                        ("available_virtual", ctypes.c_ulonglong),
                        ("available_extended_virtual", ctypes.c_ulonglong),
                    ]
                memory = MemoryStatus()
                memory.length = ctypes.sizeof(memory)
                if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(memory)):
                    total_ram = memory.total_physical // (1024 * 1024)
                    available_ram = memory.available_physical // (1024 * 1024)
    gpu_name = None
    vram_mb = 0
    if torch and torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        vram_mb = torch.cuda.get_device_properties(0).total_memory // (1024 * 1024)
    return {
        "os": platform.platform(),
        "python": platform.python_version(),
        "cpuCores": multiprocessing.cpu_count(),
        "ramMb": total_ram,
        "availableRamMb": available_ram,
        "gpu": gpu_name,
        "vramMb": vram_mb,
        "cuda": bool(torch and torch.cuda.is_available()),
        "torchAvailable": torch is not None,
        "diskFreeMb": shutil.disk_usage(STATE if STATE.exists() else ROOT).free // (1024 * 1024),
    }


def model_dir(kind: str) -> Path:
    return MODELS / kind


def model_installed(kind: str) -> bool:
    marker = model_dir(kind) / ".installed"
    return marker.is_file()


def free_disk_mb() -> int:
    return shutil.disk_usage(STATE if STATE.exists() else ROOT).free // (1024 * 1024)


def set_job(job_id: str, **updates):
    with jobs_lock:
        if job_id in jobs:
            jobs[job_id].update(updates, updatedAt=time.time())


def install_model(job_id: str, kind: str):
    try:
        from huggingface_hub import snapshot_download

        model = CONFIG[kind]
        destination = model_dir(kind)
        destination.mkdir(parents=True, exist_ok=True)
        set_job(job_id, status="running", progress=1, message="Downloading model files")
        # Snapshot downloads are resumable and reuse the local cache on retries.
        snapshot_download(
            repo_id=model["model"],
            local_dir=str(destination),
        )
        (destination / ".installed").write_text(model["model"])
        set_job(job_id, status="completed", progress=100, message="Model installed")
    except Exception as error:
        set_job(job_id, status="failed", error=str(error), message="Model download failed")


def report_download_progress(job_id: str, kind: str):
    destination = model_dir(kind)
    expected = CONFIG[kind]["storageBytes"]
    while True:
        time.sleep(1)
        if jobs.get(job_id, {}).get("status") != "running":
            return
        downloaded = 0
        for file in destination.rglob("*"):
            try:
                if file.is_file():
                    downloaded += file.stat().st_size
            except FileNotFoundError:
                continue
        progress = min(95, int(downloaded * 100 / expected))
        set_job(job_id, progress=progress, message=f"Downloaded {downloaded // 1_000_000} MB")


def start_install(kind: str):
    if kind not in ("image", "video"):
        raise ValueError("Only image and video models are managed by the media worker.")
    if model_installed(kind):
        raise ValueError(f"The {kind} model is already installed.")
    if not hardware()["torchAvailable"]:
        raise ValueError("The local media runtime is not installed. Run `npm run setup:local-ai` first.")
    resource = resource_error(kind, hardware())
    if resource:
        raise ValueError(f"{resource} Model installation is disabled on this hardware.")
    required_mb = CONFIG[kind]["storageBytes"] // 1_000_000 + 1_000
    if free_disk_mb() < required_mb:
        raise ValueError(
            f"Installing the {kind} model requires about {required_mb // 1000} GB free disk; "
            f"only {free_disk_mb() // 1000} GB is available."
        )
    with jobs_lock:
        if any(job.get("kind") == kind and job["status"] in ("queued", "running")
               for job in jobs.values()):
            raise ValueError(f"The {kind} model is already being installed.")
        job_id = str(uuid.uuid4())
        jobs[job_id] = {
            "id": job_id, "kind": kind, "status": "queued", "progress": 0,
            "message": "Waiting to download", "createdAt": time.time(),
        }
    threading.Thread(target=report_download_progress, args=(job_id, kind), daemon=True).start()
    threading.Thread(target=install_model, args=(job_id, kind), daemon=True).start()
    return job_id


def resource_error(kind: str, info: dict):
    requirements = CONFIG[kind]["hardware"]
    issues = []
    if not info["torchAvailable"]:
        issues.append("the Python 3.11 PyTorch/Diffusers runtime")
    minimum_ram = requirements.get("minCpuRamMb", requirements["minRamMb"]) if not info["cuda"] else requirements["minRamMb"]
    if info["ramMb"] < minimum_ram:
        issues.append(f"{minimum_ram // 1000} GB system RAM")
    if requirements.get("cuda") and not info["cuda"]:
        issues.append("a CUDA GPU")
    if info["cuda"] and info["vramMb"] < requirements.get("minVramMb", 0):
        issues.append(f"{requirements['minVramMb'] // 1000} GB GPU VRAM")
    if not info["cuda"] and info["availableRamMb"] < requirements.get("minAvailableRamMb", 0):
        issues.append(f"{requirements['minAvailableRamMb'] // 1000} GB available system RAM for CPU inference")
    if issues:
        return f"{CONFIG[kind]['label']} needs {' and '.join(issues)}. The detected machine does not meet these requirements."
    return None


def progress_callback(job_id: str, total: int):
    def callback(_pipeline, step, _timestep, callback_kwargs):
        event = cancel_events.get(job_id)
        if event and event.is_set():
            raise InterruptedError("Generation cancelled.")
        set_job(job_id, progress=min(99, int((step + 1) * 100 / total)),
                message=f"Generating step {step + 1} of {total}")
        return callback_kwargs
    return callback


def get_pipeline(kind: str):
    torch = load_torch()
    if kind in pipelines:
        return pipelines[kind]
    for cached_kind in list(pipelines):
        del pipelines[cached_kind]
    import gc
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    if not model_installed(kind):
        raise RuntimeError(f"The {CONFIG[kind]['label']} model is not installed. Install it in Model Setup.")
    folder = str(model_dir(kind))
    if kind == "image":
        from diffusers import StableDiffusionPipeline
        is_mps = bool(getattr(torch.backends, "mps", None) and torch.backends.mps.is_available())
        device = "cuda" if torch.cuda.is_available() else "mps" if is_mps else "cpu"
        dtype = torch.float16 if device in ("cuda", "mps") else torch.float32
        pipeline = StableDiffusionPipeline.from_pretrained(
            folder, torch_dtype=dtype, local_files_only=True,
        )
        pipeline = pipeline.to(device)
        pipeline.enable_attention_slicing()
    else:
        from diffusers import CogVideoXPipeline
        pipeline = CogVideoXPipeline.from_pretrained(
            folder, torch_dtype=torch.float16, local_files_only=True,
        )
        pipeline.enable_model_cpu_offload()
    pipelines[kind] = pipeline
    return pipeline


def generate(job_id: str, kind: str, prompt: str, options: dict):
    temporary_output = None
    try:
        resource = resource_error(kind, hardware())
        if resource:
            raise RuntimeError(resource)
        if not model_installed(kind):
            raise RuntimeError(f"The {CONFIG[kind]['label']} model is not installed. Install it in Model Setup.")
        with generation_lock:
            event = cancel_events[job_id]
            set_job(job_id, status="running", progress=1, message="Loading local model")
            pipeline = get_pipeline(kind)
            if kind == "image":
                width, height = options["width"], options["height"]
                result = pipeline(
                    prompt=prompt, width=width, height=height, num_inference_steps=25,
                    callback_on_step_end=progress_callback(job_id, 25),
                    callback_on_step_end_tensor_inputs=[],
                )
                if event.is_set():
                    raise InterruptedError("Generation cancelled.")
                output = OUTPUTS / f"{job_id}.png"
                temporary_output = TEMP / f"{job_id}.partial.png"
                result.images[0].save(temporary_output)
                mime = "image/png"
            else:
                from diffusers.utils import export_to_video
                fps = 8
                frames = options["duration"] * fps
                frames = max(9, ((frames - 1 + 3) // 4) * 4 + 1)
                result = pipeline(
                    prompt=prompt, num_frames=frames, guidance_scale=6,
                    num_inference_steps=30,
                    callback_on_step_end=progress_callback(job_id, 30),
                    callback_on_step_end_tensor_inputs=[],
                )
                if event.is_set():
                    raise InterruptedError("Generation cancelled.")
                output = OUTPUTS / f"{job_id}.mp4"
                temporary_output = TEMP / f"{job_id}.partial.mp4"
                export_to_video(result.frames[0], str(temporary_output), fps=fps)
                mime = "video/mp4"
            os.replace(temporary_output, output)
            del pipeline
        set_job(job_id, status="completed", progress=100, message="Generation complete",
                output=f"/generated/{output.name}", mimeType=mime)
    except InterruptedError as error:
        set_job(job_id, status="cancelled", message=str(error))
    except Exception as error:
        message = str(error)
        if "out of memory" in message.lower() or "cuda" in message.lower() and "memory" in message.lower():
            message = "The model ran out of memory. Reduce dimensions/duration or use a GPU with more VRAM."
        set_job(job_id, status="failed", error=message, message="Generation failed")
    finally:
        if temporary_output and temporary_output.exists():
            try:
                temporary_output.unlink()
            except OSError as error:
                set_job(job_id, status="failed", error=f"Could not remove temporary output: {error}",
                        message="Temporary-file cleanup failed")
        cancel_events.pop(job_id, None)


def start_generation(kind: str, body: dict):
    prompt = body.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 4000:
        raise ValueError("Prompt must contain 1–4,000 characters.")
    options = body.get("options", {})
    if not isinstance(options, dict):
        raise ValueError("Generation options must be an object.")
    if kind == "image":
        width = options.get("width", 512)
        height = options.get("height", 512)
        if (not isinstance(width, int) or not isinstance(height, int) or
                width < 256 or width > 768 or height < 256 or height > 768 or
                width % 8 or height % 8):
            raise ValueError("Image dimensions must be multiples of 8 between 256 and 768.")
        options = {"width": width, "height": height}
    else:
        duration = options.get("duration", 2)
        if not isinstance(duration, int) or not 2 <= duration <= 6:
            raise ValueError("Video duration must be an integer from 2 to 6 seconds.")
        options = {"duration": duration}
    info = hardware()
    resource = resource_error(kind, info)
    if resource:
        raise ValueError(resource)
    if not model_installed(kind):
        raise ValueError(f"The {CONFIG[kind]['label']} model is not installed.")
    if not info["torchAvailable"]:
        raise ValueError("The local media runtime is not installed. Run `npm run setup:local-ai` first.")
    with jobs_lock:
        if any(job.get("kind") == kind and job["status"] in ("queued", "running")
               for job in jobs.values()):
            raise ValueError(f"A {kind} generation is already running. Wait for it to finish or cancel it.")
        job_id = str(uuid.uuid4())
        jobs[job_id] = {
            "id": job_id, "kind": kind, "status": "queued", "progress": 0,
            "message": "Queued", "createdAt": time.time(),
        }
        cancel_events[job_id] = threading.Event()
    threading.Thread(target=generate, args=(job_id, kind, prompt.strip(), options), daemon=True).start()
    return job_id


class Handler(BaseHTTPRequestHandler):
    server_version = "LocalInference/1.0"

    def log_message(self, _format, *_args):
        return

    def send_json(self, status: int, value: dict):
        payload = json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/status":
            info = hardware()
            models = {
                kind: {
                    **value,
                    "installed": model_installed(kind),
                    "ready": model_installed(kind) and info["torchAvailable"] and not resource_error(kind, info),
                    "resourceError": resource_error(kind, info),
                }
                for kind, value in CONFIG.items() if kind in ("image", "video")
            }
            return self.send_json(200, {"hardware": info, "models": models})
        if parsed.path.startswith("/jobs/"):
            job_id = parsed.path.removeprefix("/jobs/")
            with jobs_lock:
                job = jobs.get(job_id)
            return self.send_json(200 if job else 404, job or {"error": "Job not found."})
        return self.send_json(404, {"error": "Not found."})

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
        except (json.JSONDecodeError, ValueError):
            return self.send_json(400, {"error": "Request body must be valid JSON."})
        try:
            if parsed.path.startswith("/install/"):
                return self.send_json(202, {"id": start_install(parsed.path.split("/")[-1])})
            if parsed.path.startswith("/generate/"):
                kind = parsed.path.split("/")[-1]
                if kind not in ("image", "video"):
                    return self.send_json(404, {"error": "Unknown generation type."})
                return self.send_json(202, {"id": start_generation(kind, body)})
            if parsed.path.startswith("/jobs/") and parsed.path.endswith("/cancel"):
                job_id = parsed.path.split("/")[-2]
                event = cancel_events.get(job_id)
                if not event:
                    return self.send_json(409, {"error": "This job cannot be cancelled."})
                event.set()
                set_job(job_id, message="Cancellation requested")
                return self.send_json(202, {"success": True})
            return self.send_json(404, {"error": "Not found."})
        except ValueError as error:
            return self.send_json(409, {"error": str(error)})
        except Exception as error:
            return self.send_json(500, {"error": str(error)})


if __name__ == "__main__":
    STATE.mkdir(exist_ok=True)
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    TEMP.mkdir(parents=True, exist_ok=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()

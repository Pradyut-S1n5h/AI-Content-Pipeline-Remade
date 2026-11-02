/**
 * SceneCraft Video Assembly Engine
 * 
 * Uses HTML5 Canvas + MediaRecorder to assemble storyboard scene frames
 * into a playable WebM video file with:
 * - Dynamic frame duration based on scene length
 * - Ken Burns cinematic zoom & pan effect per scene
 * - On-screen scene lower-third titles (optional)
 * - Audio track mixing via Web Audio API when audio assets exist
 * - Progress tracking through standard pipeline states
 */

import { Scene } from '../types';

export type VideoAssemblyStage =
  | 'idle'
  | 'preparing_assets'
  | 'rendering_frames'
  | 'finalizing'
  | 'completed'
  | 'failed';

export interface VideoRenderProgress {
  stage: VideoAssemblyStage;
  progressPercent: number;
  currentSceneIndex: number;
  totalScenes: number;
  message: string;
}

export function selectSupportedVideoMimeType(
  isTypeSupported: (mimeType: string) => boolean
): string | null {
  return [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find((mimeType) => isTypeSupported(mimeType)) || null;
}

/**
 * Preloads an image into an HTMLImageElement
 */
function preloadImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const cleanup = () => signal?.removeEventListener('abort', handleAbort);
    const handleAbort = () => {
      cleanup();
      img.src = '';
      reject(new Error('Video rendering cancelled.'));
    };
    img.onload = () => {
      cleanup();
      resolve(img);
    };
    img.onerror = () => {
      cleanup();
      reject(new Error('A storyboard image could not be loaded. Check that the image is still available and try again.'));
    };
    if (signal?.aborted) {
      handleAbort();
      return;
    }
    signal?.addEventListener('abort', handleAbort, { once: true });
    img.src = url;
  });
}

/**
 * Assembles storyboard scenes into a real video Blob using Canvas MediaRecorder
 */
export async function assembleVideoFromScenes(
  scenes: Scene[],
  onProgress?: (progress: VideoRenderProgress) => void,
  options: {
    width?: number;
    height?: number;
    fps?: number;
    includeTitles?: boolean;
    signal?: AbortSignal;
  } = {}
): Promise<Blob> {
  const width = options.width || 1280;
  const height = options.height || 720;
  const fps = options.fps || 30;
  const includeTitles = options.includeTitles !== false;
  const signal = options.signal;
  const assertNotCancelled = () => {
    if (signal?.aborted) throw new Error('Video rendering cancelled.');
  };

  const validScenes = scenes.filter((s) => s.imageUrl);
  if (validScenes.length === 0) {
    throw new Error('No scenes with generated or uploaded images to assemble.');
  }
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error('This browser does not support Canvas video recording.');
  }

  // 1. Preparing assets
  onProgress?.({
    stage: 'preparing_assets',
    progressPercent: 5,
    currentSceneIndex: 0,
    totalScenes: validScenes.length,
    message: 'Loading scene artwork and assets...',
  });

  const loadedImages: HTMLImageElement[] = [];
  for (let i = 0; i < validScenes.length; i++) {
    assertNotCancelled();
    const s = validScenes[i];
    const img = await preloadImage(s.imageUrl!, signal);
    loadedImages.push(img);
    const p = Math.round(5 + ((i + 1) / validScenes.length) * 20);
    onProgress?.({
      stage: 'preparing_assets',
      progressPercent: p,
      currentSceneIndex: i + 1,
      totalScenes: validScenes.length,
      message: `Loaded asset for scene ${s.sceneNumber}: "${s.title}"`,
    });
  }

  // 2. Setup Canvas & Stream
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not supported on this browser.');
  }

  let stream: MediaStream;
  try {
    stream = canvas.captureStream(fps);
  } catch {
    canvas.width = 0;
    canvas.height = 0;
    throw new Error('The browser could not capture the video canvas.');
  }
  const mimeType = selectSupportedVideoMimeType((candidate) => MediaRecorder.isTypeSupported(candidate));
  if (!mimeType) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error('This browser cannot encode MP4 or WebM video. Try a current desktop browser.');
  }

  const recordedChunks: Blob[] = [];
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType });
  } catch {
    stream.getTracks().forEach((track) => track.stop());
    canvas.width = 0;
    canvas.height = 0;
    throw new Error('The browser could not initialize a supported MP4 or WebM encoder.');
  }
  const audioSources: AudioBufferSourceNode[] = [];
  let audioContext: AudioContext | null = null;

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) recordedChunks.push(event.data);
  };

  const totalVideoDuration = validScenes.reduce((sum, s) => sum + Math.max(s.durationSeconds || 4, 2), 0);

  try {
    const audioScenes = validScenes.filter((scene) => scene.audioUrl);
    if (audioScenes.length > 0) {
      if (typeof AudioContext === 'undefined') {
        throw new Error('This browser does not support audio mixing for video export.');
      }
      audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      const audioBuffers: (AudioBuffer | null)[] = [];
      for (const scene of validScenes) {
        assertNotCancelled();
        if (scene.audioUrl) {
          const response = await fetch(scene.audioUrl);
          if (!response.ok) throw new Error(`Could not load audio for scene ${scene.sceneNumber}.`);
          audioBuffers.push(await audioContext.decodeAudioData(await response.arrayBuffer()));
        } else {
          audioBuffers.push(null);
        }
      }
      await audioContext.resume();
      const playbackStart = audioContext.currentTime + 0.1;
      let sceneOffset = 0;
      for (let index = 0; index < validScenes.length; index += 1) {
        const scene = validScenes[index];
        const sceneDuration = Math.max(scene.durationSeconds || 4, 2);
        const buffer = audioBuffers[index];
        if (buffer) {
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.connect(destination);
          source.start(playbackStart + sceneOffset);
          source.stop(playbackStart + sceneOffset + sceneDuration);
          audioSources.push(source);
        }
        sceneOffset += sceneDuration;
      }
      stream.addTrack(destination.stream.getAudioTracks()[0]);
    }

    const recordingFinished = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(recordedChunks, { type: recorder.mimeType || mimeType }));
      recorder.onerror = () => reject(new Error('MediaRecorder failed while encoding the video.'));
    });
    recorder.start();

    onProgress?.({
      stage: 'rendering_frames',
      progressPercent: 25,
      currentSceneIndex: 0,
      totalScenes: validScenes.length,
      message: 'Rendering timeline frames and synchronized audio...',
    });

    let renderedSeconds = 0;
    for (let sceneIdx = 0; sceneIdx < validScenes.length; sceneIdx++) {
      const scene = validScenes[sceneIdx];
      const img = loadedImages[sceneIdx];
      const sceneDurationSec = Math.max(scene.durationSeconds || 4, 2);
      const totalSceneFrames = Math.round(sceneDurationSec * fps);

      for (let frame = 0; frame < totalSceneFrames; frame++) {
        assertNotCancelled();
        const frameStart = performance.now();
        const progressInScene = frame / totalSceneFrames;

        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, width, height);

        const scale = 1.0 + progressInScene * 0.08;
        const panX = (progressInScene - 0.5) * 20;
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-width / 2 + panX, -height / 2);

        const imgAspect = img.width / img.height;
        const canvasAspect = width / height;
        const drawW = imgAspect > canvasAspect ? height * imgAspect : width;
        const drawH = imgAspect > canvasAspect ? height : width / imgAspect;
        ctx.drawImage(img, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
        ctx.restore();

        const gradient = ctx.createRadialGradient(
          width / 2, height / 2, Math.min(width, height) * 0.35,
          width / 2, height / 2, Math.max(width, height) * 0.75
        );
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        if (includeTitles) {
          ctx.fillStyle = 'rgba(9, 9, 11, 0.75)';
          ctx.fillRect(36, height - 88, width - 72, 54);
          ctx.fillStyle = '#f4f4f5';
          ctx.font = '600 17px Inter, system-ui, sans-serif';
          ctx.fillText(`Scene ${scene.sceneNumber} · ${scene.title}`, 52, height - 56);
          if (scene.cameraDirection) {
            ctx.fillStyle = '#a1a1aa';
            ctx.font = '13px Inter, system-ui, sans-serif';
            ctx.fillText(scene.cameraDirection, 52, height - 40);
          }
        }

        renderedSeconds += 1 / fps;
        if (frame % 10 === 0) {
          onProgress?.({
            stage: 'rendering_frames',
            progressPercent: Math.min(90, Math.round(25 + (renderedSeconds / totalVideoDuration) * 65)),
            currentSceneIndex: sceneIdx + 1,
            totalScenes: validScenes.length,
            message: `Rendering Scene ${scene.sceneNumber} (${Math.round(progressInScene * 100)}%)...`,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, 1000 / fps - (performance.now() - frameStart))));
      }
    }

    assertNotCancelled();
    onProgress?.({
      stage: 'finalizing',
      progressPercent: 92,
      currentSceneIndex: validScenes.length,
      totalScenes: validScenes.length,
      message: 'Encoding container and finalizing video output...',
    });

    recorder.stop();
    const finalBlob = await recordingFinished;
    if (!finalBlob.size) throw new Error('The browser produced an empty video. Try a supported browser and render again.');
    if (!/^video\/(?:mp4|webm)(?:;|$)/.test(finalBlob.type)) {
      throw new Error('The browser returned an unsupported video container. The file was not saved.');
    }
    onProgress?.({
      stage: 'completed',
      progressPercent: 100,
      currentSceneIndex: validScenes.length,
      totalScenes: validScenes.length,
      message: `Video assembly complete (${finalBlob.type.startsWith('video/mp4') ? 'MP4' : 'WebM'}).`,
    });
    return finalBlob;
  } catch (error) {
    onProgress?.({
      stage: 'failed',
      progressPercent: 100,
      currentSceneIndex: 0,
      totalScenes: validScenes.length,
      message: error instanceof Error ? error.message : 'Video assembly failed.',
    });
    throw error;
  } finally {
    if (recorder.state !== 'inactive') recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
    audioSources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // A scheduled source may already have stopped at the end of its scene.
      }
    });
    if (audioContext && audioContext.state !== 'closed') await audioContext.close();
    canvas.width = 0;
    canvas.height = 0;
    loadedImages.length = 0;
  }

}

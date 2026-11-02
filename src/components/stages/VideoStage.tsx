import React, { useState, useEffect, useRef } from 'react';
import { Project, Scene } from '../../types';
import {
  assembleVideoFromScenes,
  VideoRenderProgress,
} from '../../utils/videoRenderer';
import { loadProjectVideo } from '../../services/storage';
import { downloadBlob } from '../../utils/exportUtils';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Video,
  Download,
  RefreshCw,
  Film,
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface VideoStageProps {
  project: Project;
  onUpdateProjectVideo: (video: Blob) => Promise<string>;
  onProceedToExport: () => void;
}

export const VideoStage: React.FC<VideoStageProps> = ({
  project,
  onUpdateProjectVideo,
  onProceedToExport,
}) => {
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [isPlayingAnimatic, setIsPlayingAnimatic] = useState(false);
  const [renderProgress, setRenderProgress] = useState<VideoRenderProgress | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderedBlob, setRenderedBlob] = useState<Blob | null>(null);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(project.assembledVideoUrl || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scenes = project.scenes || [];
  const validScenes = scenes.filter((s) => s.imageUrl);

  // Playback timer ref
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const renderAbortRef = useRef<AbortController | null>(null);
  const renderedUrlRef = useRef<string | null>(project.assembledVideoUrl || null);
  const knownAssetIdRef = useRef<string | null>(null);

  const currentScene = validScenes[currentSceneIdx] || validScenes[0];

  useEffect(() => {
    let cancelled = false;
    const assetId = project.assembledVideoAssetId;
    if (assetId && knownAssetIdRef.current === assetId) return;

    const previousUrl = renderedUrlRef.current;
    if (previousUrl?.startsWith('blob:')) URL.revokeObjectURL(previousUrl);
    renderedUrlRef.current = null;
    setRenderedUrl(null);
    setRenderedBlob(null);
    knownAssetIdRef.current = null;

    if (!assetId) {
      if (project.assembledVideoUrl && !project.assembledVideoUrl.startsWith('blob:')) {
        renderedUrlRef.current = project.assembledVideoUrl;
        setRenderedUrl(project.assembledVideoUrl);
      }
      return () => { cancelled = true; };
    }

    void loadProjectVideo(assetId).then((blob) => {
      if (cancelled) return;
      if (!blob) {
        setErrorMessage('The project refers to a saved video that is no longer available. Re-render the video.');
        return;
      }
      const url = URL.createObjectURL(blob);
      renderedUrlRef.current = url;
      knownAssetIdRef.current = assetId;
      setRenderedBlob(blob);
      setRenderedUrl(url);
    }).catch((error: unknown) => {
      if (!cancelled) {
        setErrorMessage(error instanceof Error ? error.message : 'Could not restore the saved video.');
      }
    });
    return () => { cancelled = true; };
  }, [project.metadata.id, project.assembledVideoAssetId, project.assembledVideoUrl]);

  // Stop playback when unmounting or paused
  const stopPlayback = () => {
    setIsPlayingAnimatic(false);
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (renderedUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(renderedUrlRef.current);
      if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      renderAbortRef.current?.abort();
    };
  }, []);

  // Animatic player engine
  useEffect(() => {
    if (!isPlayingAnimatic || validScenes.length === 0) return;

    const scene = validScenes[currentSceneIdx];
    const durationMs = Math.max(scene?.durationSeconds || 4, 2) * 1000;

    // Play scene audio if available
    if (scene?.audioUrl) {
      const aud = new Audio(scene.audioUrl);
      currentAudioRef.current = aud;
      aud.play().catch(() => {
        if (currentAudioRef.current === aud) {
          currentAudioRef.current = null;
          setErrorMessage(`Audio for scene ${scene.sceneNumber} could not be played.`);
        }
      });
    }

    playbackTimerRef.current = setTimeout(() => {
      if (currentSceneIdx < validScenes.length - 1) {
        setCurrentSceneIdx((prev) => prev + 1);
      } else {
        // Loop back or finish
        setIsPlayingAnimatic(false);
        setCurrentSceneIdx(0);
      }
    }, durationMs);

    return () => {
      if (playbackTimerRef.current) {
        clearTimeout(playbackTimerRef.current);
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, [isPlayingAnimatic, currentSceneIdx, validScenes]);

  const handleTogglePlay = () => {
    if (validScenes.length === 0) return;
    if (isPlayingAnimatic) {
      stopPlayback();
    } else {
      setIsPlayingAnimatic(true);
    }
  };

  const handleNextScene = () => {
    stopPlayback();
    setCurrentSceneIdx((prev) => (prev + 1) % validScenes.length);
  };

  const handlePrevScene = () => {
    stopPlayback();
    setCurrentSceneIdx((prev) => (prev - 1 + validScenes.length) % validScenes.length);
  };

  // Video Assembly Execution
  const handleAssembleVideo = async () => {
    if (validScenes.length === 0) {
      setErrorMessage('Please generate storyboard artwork for at least one scene before assembling video.');
      return;
    }

    stopPlayback();
    const controller = new AbortController();
    renderAbortRef.current = controller;
    setIsRendering(true);
    setErrorMessage(null);

    try {
      const dimensions = {
        '16:9': { width: 1280, height: 720 },
        '9:16': { width: 720, height: 1280 },
        '1:1': { width: 1080, height: 1080 },
        '4:3': { width: 960, height: 720 },
      }[project.metadata.aspectRatio];
      const blob = await assembleVideoFromScenes(
        validScenes,
        (progress) => {
          setRenderProgress(progress);
        },
        {
          ...dimensions,
          fps: 30,
          includeTitles: true,
          signal: controller.signal,
        }
      );

      const previousUrl = renderedUrlRef.current;
      if (previousUrl?.startsWith('blob:')) URL.revokeObjectURL(previousUrl);
      const url = URL.createObjectURL(blob);
      renderedUrlRef.current = url;
      setRenderedBlob(blob);
      setRenderedUrl(url);
      try {
        knownAssetIdRef.current = await onUpdateProjectVideo(blob);
      } catch (error) {
        setErrorMessage(error instanceof Error
          ? `Video rendered, but could not be saved with the project: ${error.message}`
          : 'Video rendered, but could not be saved with the project.');
      }
    } catch (err: any) {
      if (err instanceof Error && err.message === 'Video rendering cancelled.') {
        setErrorMessage('Video rendering cancelled. Your project assets are unchanged.');
      } else {
        console.error('Video assembly failed:', err);
        setErrorMessage(err instanceof Error ? err.message : 'Video assembly failed.');
      }
    } finally {
      renderAbortRef.current = null;
      setIsRendering(false);
    }
  };

  const handleDownloadVideo = () => {
    if (!renderedBlob && !renderedUrl) return;
    const extension = renderedBlob?.type.startsWith('video/mp4') ? 'mp4' : 'webm';
    const filename = `${project.metadata.title.toLowerCase().replace(/\s+/g, '_')}_final.${extension}`;
    if (renderedBlob) {
      downloadBlob(renderedBlob, filename);
    } else if (renderedUrl) {
      const a = document.createElement('a');
      a.href = renderedUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const totalRuntimeSec = validScenes.reduce((sum, s) => sum + (s.durationSeconds || 4), 0);

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <span>Video Timeline & Assembly</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real animatic player with Ken Burns movement and scene audio. Exports MP4 when the browser supports it, otherwise WebM; rendered files are saved in the project database.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleAssembleVideo}
            disabled={isRendering || validScenes.length === 0}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-semibold px-4 py-2 rounded text-xs transition-colors"
          >
            {isRendering ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Assembling Video...</span>
              </>
            ) : (
              <>
                <Video className="w-3.5 h-3.5" />
                <span>{renderedUrl ? 'Re-Assemble Video' : 'Assemble & Render Video'}</span>
              </>
            )}
          </button>
          {isRendering && (
            <button
              type="button"
              onClick={() => renderAbortRef.current?.abort()}
              className="rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              Cancel render
            </button>
          )}

          <button
            onClick={onProceedToExport}
            className="flex items-center gap-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold px-3.5 py-2 rounded text-xs transition-colors"
          >
            <span>Next: Export Suite</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-lg p-4 flex items-start gap-3 text-xs text-rose-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-rose-300">Assembly Notice: </span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Assembly Progress Status */}
      {isRendering && renderProgress && (
        <div className="bg-zinc-900 border border-amber-400/40 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-amber-300 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span className="capitalize">{renderProgress.stage.replace(/_/g, ' ')}</span>
            </span>
            <span className="font-mono text-zinc-400 font-semibold">
              {renderProgress.progressPercent}%
            </span>
          </div>

          <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800">
            <div
              className="bg-amber-400 h-full transition-all duration-200"
              style={{ width: `${renderProgress.progressPercent}%` }}
            />
          </div>

          <p className="text-[11px] text-zinc-400 font-mono">{renderProgress.message}</p>
        </div>
      )}

      {/* Rendered Video Success Banner */}
      {renderedUrl && !isRendering && (
        <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-semibold text-emerald-300">Video Assembly Ready: </span>
              <span className="text-zinc-300">
                {renderedBlob?.type.startsWith('video/mp4') ? 'MP4' : 'WebM'} animatic assembled ({validScenes.length} scenes, {totalRuntimeSec}s total runtime).
              </span>
            </div>
          </div>
          <button
            onClick={handleDownloadVideo}
            className="flex items-center justify-center gap-1.5 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold px-3.5 py-1.5 rounded transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Video File</span>
          </button>
        </div>
      )}

      {/* Main Animatic Stage Player */}
      {validScenes.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-lg p-16 text-center text-xs text-zinc-500">
          No visual frames have been generated yet. Please visit the Storyboard stage and generate or assign artwork.
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden space-y-0">
          {/* Viewport Frame */}
          <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
            {currentScene?.imageUrl && (
              <img
                src={currentScene.imageUrl}
                alt={currentScene.title}
                className="w-full h-full object-cover transition-all duration-700 ease-in-out"
              />
            )}

            {/* Cinematic Lower Third Overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-6 flex flex-col justify-end">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-semibold">
                <span>Scene {currentScene?.sceneNumber} of {validScenes.length}</span>
                <span>·</span>
                <span>{currentScene?.durationSeconds}s duration</span>
              </div>
              <h2 className="text-lg font-bold text-white mt-0.5">{currentScene?.title}</h2>
              <p className="text-xs text-zinc-300 mt-1 line-clamp-2 max-w-2xl">
                {currentScene?.description || currentScene?.actions}
              </p>
            </div>
          </div>

          {/* Player Transport Controls */}
          <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex flex-col gap-3">
            {/* Timeline scrubber / Scene pills */}
            <div className="flex items-center gap-1.5 w-full">
              {validScenes.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => {
                    stopPlayback();
                    setCurrentSceneIdx(idx);
                  }}
                  className={`h-2 flex-1 rounded-full transition-all ${
                    idx === currentSceneIdx
                      ? 'bg-amber-400'
                      : idx < currentSceneIdx
                      ? 'bg-zinc-600'
                      : 'bg-zinc-800 hover:bg-zinc-700'
                  }`}
                  title={`Scene ${s.sceneNumber}: ${s.title}`}
                />
              ))}
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevScene}
                  className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
                  title="Previous scene"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={handleTogglePlay}
                  className="w-9 h-9 rounded-full bg-amber-400 hover:bg-amber-300 text-zinc-950 flex items-center justify-center font-bold transition-colors"
                  title={isPlayingAnimatic ? 'Pause animatic' : 'Play animatic'}
                >
                  {isPlayingAnimatic ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
                <button
                  onClick={handleNextScene}
                  className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
                  title="Next scene"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-zinc-400 flex items-center gap-3 font-mono">
                <span>
                  {currentSceneIdx + 1} / {validScenes.length} Scenes
                </span>
                <span>·</span>
                <span>Total: {totalRuntimeSec}s</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

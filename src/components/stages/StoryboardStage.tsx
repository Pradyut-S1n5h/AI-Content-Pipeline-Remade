import React, { useState } from 'react';
import { Project, Scene } from '../../types';
import { generateImageApi } from '../../services/api';
import {
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  Download,
  AlertCircle,
  Eye,
  Maximize2,
  Clock,
  Camera,
  ArrowRight,
  CheckCircle2,
  X,
} from 'lucide-react';

interface StoryboardStageProps {
  project: Project;
  onUpdateScenes: (scenes: Scene[]) => void;
  onProceedToAudio: () => void;
  hasGeminiKey: boolean;
}

export const StoryboardStage: React.FC<StoryboardStageProps> = ({
  project,
  onUpdateScenes,
  onProceedToAudio,
  hasGeminiKey,
}) => {
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [inspectImageScene, setInspectImageScene] = useState<Scene | null>(null);

  const scenes = project.scenes || [];

  const handleGenerateSceneImage = async (sceneId: string) => {
    const target = scenes.find((s) => s.id === sceneId);
    if (!target) return;

    // Set generating status
    const updated = scenes.map((s) =>
      s.id === sceneId ? { ...s, imageStatus: 'generating' as const, imageError: undefined } : s
    );
    onUpdateScenes(updated);

    const res = await generateImageApi({
      prompt: target.imagePrompt || `${target.cameraDirection}, ${target.description}, ${project.metadata.visualStyle}`,
      aspectRatio: project.metadata.aspectRatio,
      sceneId: target.id,
    });

    if (res.success && res.data?.imageUrl) {
      const finished = scenes.map((s) =>
        s.id === sceneId
          ? {
              ...s,
              imageUrl: res.data!.imageUrl,
              imageStatus: 'completed' as const,
              imageError: undefined,
            }
          : s
      );
      onUpdateScenes(finished);
    } else {
      const failed = scenes.map((s) =>
        s.id === sceneId
          ? {
              ...s,
              imageStatus: 'failed' as const,
              imageError:
                res.error ||
                'Image generation failed. Ensure your Gemini API key is valid or click "Use Cinematic Sample" to proceed.',
            }
          : s
      );
      onUpdateScenes(failed);
    }
  };

  const handleBatchGenerate = async () => {
    setIsBatchGenerating(true);
    for (const scene of scenes) {
      if (!scene.imageUrl || scene.imageStatus === 'failed') {
        await handleGenerateSceneImage(scene.id);
      }
    }
    setIsBatchGenerating(false);
  };

  const handleDownloadImage = (scene: Scene) => {
    if (!scene.imageUrl) return;
    const a = document.createElement('a');
    a.href = scene.imageUrl;
    a.download = `${project.metadata.title.toLowerCase().replace(/\s+/g, '_')}_scene_${scene.sceneNumber}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Safe fallback sample image applicator if user is in demo mode or offline
  const handleApplyFallbackSample = (sceneId: string) => {
    const samplePool = [
      'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    ];
    const sIdx = scenes.findIndex((s) => s.id === sceneId);
    const chosen = samplePool[sIdx % samplePool.length];

    const updated = scenes.map((s) =>
      s.id === sceneId
        ? {
            ...s,
            imageUrl: chosen,
            imageStatus: 'completed' as const,
            imageError: undefined,
          }
        : s
    );
    onUpdateScenes(updated);
  };

  const completedImagesCount = scenes.filter((s) => s.imageUrl).length;

  return (
    <div className="max-w-6xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <span>Visual Storyboard Studio</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Generate cinematic frames using Gemini 3.1 Flash Lite Image with consistent character and location bible prompts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleBatchGenerate}
            disabled={isBatchGenerating || scenes.length === 0}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-semibold px-4 py-2 rounded text-xs transition-colors"
          >
            {isBatchGenerating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Generating Frames...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Batch Generate Missing</span>
              </>
            )}
          </button>

          {completedImagesCount > 0 && (
            <button
              onClick={onProceedToAudio}
              className="flex items-center gap-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold px-3.5 py-2 rounded text-xs transition-colors"
            >
              <span>Next: Voice Audio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress & Stats Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="text-zinc-300 font-medium">
            Storyboard Assets: {completedImagesCount} of {scenes.length} Frames Generated
          </span>
        </div>
        <div className="flex items-center gap-4 text-zinc-400">
          <span>Aspect Ratio: {project.metadata.aspectRatio}</span>
          <span>·</span>
          <span>Format: Gemini Flash Lite Image</span>
        </div>
      </div>

      {/* Storyboard Grid */}
      {scenes.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-lg p-16 text-center text-xs text-zinc-500">
          No scenes available to storyboard. Please create or breakdown scenes in the Scene Engine first.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenes.map((scene) => {
            const isGenerating = scene.imageStatus === 'generating';
            const isFailed = scene.imageStatus === 'failed';
            const isCompleted = Boolean(scene.imageUrl);

            return (
              <div
                key={scene.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col justify-between group hover:border-zinc-700 transition-colors"
              >
                {/* Visual Area */}
                <div className="relative aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden border-b border-zinc-800">
                  {scene.imageUrl ? (
                    <>
                      <img
                        src={scene.imageUrl}
                        alt={scene.title}
                        className="w-full h-full object-cover transition-transform group-hover:scale-102"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-4">
                        <button
                          onClick={() => setInspectImageScene(scene)}
                          className="bg-zinc-900/90 hover:bg-zinc-800 text-white p-2 rounded text-xs flex items-center gap-1.5 shadow"
                          title="Inspect frame full-size"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => handleDownloadImage(scene)}
                          className="bg-zinc-900/90 hover:bg-zinc-800 text-white p-2 rounded text-xs flex items-center gap-1.5 shadow"
                          title="Download frame image"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Export</span>
                        </button>
                      </div>
                    </>
                  ) : isGenerating ? (
                    <div className="p-6 text-center space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
                      <p className="text-xs text-zinc-300 font-medium">Generating visual frame...</p>
                      <p className="text-[11px] text-zinc-500">Applying character & lighting bible</p>
                    </div>
                  ) : isFailed ? (
                    <div className="p-4 text-center space-y-2 max-w-xs">
                      <AlertCircle className="w-6 h-6 text-rose-400 mx-auto" />
                      <p className="text-xs text-rose-300 font-medium">Generation Error</p>
                      <p className="text-[10px] text-zinc-400 leading-tight">
                        {scene.imageError || 'Unable to generate image.'}
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-1">
                        <button
                          onClick={() => handleGenerateSceneImage(scene.id)}
                          className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded"
                        >
                          Retry
                        </button>
                        <button
                          onClick={() => handleApplyFallbackSample(scene.id)}
                          className="text-[11px] bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 px-2.5 py-1 rounded"
                        >
                          Use Sample Art
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center space-y-3">
                      <ImageIcon className="w-6 h-6 text-zinc-700 mx-auto" />
                      <div>
                        <p className="text-xs text-zinc-400 font-medium">No Visual Generated</p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{scene.cameraDirection}</p>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleGenerateSceneImage(scene.id)}
                          className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold px-3 py-1.5 rounded text-xs transition-colors"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Generate Frame</span>
                        </button>
                        <button
                          onClick={() => handleApplyFallbackSample(scene.id)}
                          className="text-[11px] text-zinc-400 hover:text-zinc-200 px-2 py-1"
                          title="Apply pre-built sample still"
                        >
                          Sample
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Scene Number Badge */}
                  <div className="absolute top-2.5 left-2.5 bg-zinc-950/80 backdrop-blur-xs border border-zinc-800 px-2 py-0.5 rounded text-[11px] font-mono font-medium text-zinc-300">
                    Scene {scene.sceneNumber}
                  </div>

                  {/* Duration Badge */}
                  <div className="absolute top-2.5 right-2.5 bg-zinc-950/80 backdrop-blur-xs border border-zinc-800 px-2 py-0.5 rounded text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{scene.durationSeconds}s</span>
                  </div>
                </div>

                {/* Metadata Card Footer */}
                <div className="p-4 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-zinc-100 text-xs truncate">{scene.title}</h3>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider shrink-0">
                      {scene.timeOfDay.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                    {scene.description || scene.actions}
                  </p>

                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="truncate max-w-[180px]">{scene.cameraDirection}</span>
                    {scene.imageUrl && (
                      <button
                        onClick={() => handleGenerateSceneImage(scene.id)}
                        disabled={isGenerating}
                        className="text-zinc-400 hover:text-amber-400 transition-colors flex items-center gap-1"
                        title="Regenerate this frame"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reroll</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {inspectImageScene && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-4xl w-full overflow-hidden shadow-2xl space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  Scene {inspectImageScene.sceneNumber}: {inspectImageScene.title}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {inspectImageScene.cameraDirection} · {inspectImageScene.durationSeconds}s runtime
                </p>
              </div>
              <button
                onClick={() => setInspectImageScene(null)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-video bg-black rounded overflow-hidden flex items-center justify-center">
              <img
                src={inspectImageScene.imageUrl}
                alt={inspectImageScene.title}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded p-3 text-xs space-y-1">
              <span className="text-zinc-500 font-medium">Synthesized Image Prompt:</span>
              <p className="text-zinc-300 text-[11px] leading-relaxed select-all">
                {inspectImageScene.imagePrompt}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => handleDownloadImage(inspectImageScene)}
                className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download High-Res PNG</span>
              </button>
              <button
                onClick={() => setInspectImageScene(null)}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold rounded text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

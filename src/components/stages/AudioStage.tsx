import React, { useEffect, useRef, useState } from 'react';
import { Project, Scene, SceneUpdate } from '../../types';
import { generateAudioTTSApi } from '../../services/api';
import { AiProvider, PROVIDER_CAPABILITIES } from '../../services/aiProviders';
import {
  Mic,
  Play,
  Pause,
  Download,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Volume2,
  VolumeX,
  ArrowRight,
  Music,
} from 'lucide-react';

interface AudioStageProps {
  project: Project;
  onUpdateScenes: (update: SceneUpdate) => void;
  onProceedToVideo: () => void;
  hasGeminiKey: boolean;
  activeProvider: AiProvider;
}

export const AudioStage: React.FC<AudioStageProps> = ({
  project,
  onUpdateScenes,
  onProceedToVideo,
  hasGeminiKey,
  activeProvider,
}) => {
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [currentAudioElement, setCurrentAudioElement] = useState<HTMLAudioElement | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isSynthesizingForId, setIsSynthesizingForId] = useState<string | null>(null);
  const [isBatchSynthesizing, setIsBatchSynthesizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scenes = project.scenes || [];
  const speechGenerationSupported = PROVIDER_CAPABILITIES[activeProvider].speech;
  const voices = activeProvider === 'openai'
    ? ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse', 'marin', 'cedar']
    : activeProvider === 'gemini' ? ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'] : [];

  useEffect(() => {
    setSelectedVoice(activeProvider === 'openai' ? 'alloy' : 'Kore');
  }, [activeProvider]);

  const stopCurrentAudio = () => {
    const audio = currentAudioRef.current;
    if (audio) {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      audio.removeAttribute('src');
      audio.load();
      currentAudioRef.current = null;
    }
    setCurrentAudioElement(null);
    setActivePlayingId(null);
  };

  useEffect(() => () => {
    const audio = currentAudioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      currentAudioRef.current = null;
    }
  }, []);

  const handlePlayAudio = (sceneId: string, audioUrl: string) => {
    if (activePlayingId === sceneId && currentAudioElement) {
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio();

    const audio = new Audio(audioUrl);
    currentAudioRef.current = audio;
    audio.onended = () => {
      if (currentAudioRef.current === audio) stopCurrentAudio();
    };
    audio.onerror = () => {
      if (currentAudioRef.current === audio) {
        stopCurrentAudio();
        setErrorMessage('Audio playback error.');
      }
    };
    setCurrentAudioElement(audio);
    setActivePlayingId(sceneId);
    audio.play().catch(() => {
      if (currentAudioRef.current === audio) {
        stopCurrentAudio();
        setErrorMessage('Audio could not be played by this browser.');
      }
    });
  };

  const handleSynthesizeScene = async (sceneId: string) => {
    if (!speechGenerationSupported) return;
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;

    // Determine voice text: spoken dialogue if present, or narration description
    const textToVoice =
      scene.dialogue?.trim() ||
      `Scene ${scene.sceneNumber}: ${scene.title}. ${scene.description || scene.actions}`;

    setIsSynthesizingForId(sceneId);
    setErrorMessage(null);

    const res = await generateAudioTTSApi({
      text: textToVoice,
      voice: selectedVoice,
      speakerRole: scene.characters?.[0] || 'Narrator',
    });

    setIsSynthesizingForId(null);

    if (res.success && res.data?.audioUrl) {
      onUpdateScenes((current) => current.map((scene) =>
        scene.id === sceneId
          ? {
              ...scene,
              audioUrl: res.data!.audioUrl,
              audioStatus: 'completed',
              audioDuration: res.data!.duration,
              audioError: undefined,
            }
          : scene
      ));
    } else {
      onUpdateScenes((current) => current.map((scene) =>
        scene.id === sceneId
          ? { ...scene, audioStatus: 'failed', audioError: res.error || 'TTS synthesis failed.' }
          : scene
      ));
      setErrorMessage(res.error || 'Failed to synthesize speech.');
    }
  };

  const handleBatchSynthesize = async () => {
    if (!speechGenerationSupported) return;
    setIsBatchSynthesizing(true);
    try {
      for (const scene of scenes) {
        if (!scene.audioUrl && scene.audioStatus !== 'generating') {
          await handleSynthesizeScene(scene.id);
        }
      }
    } finally {
      setIsBatchSynthesizing(false);
    }
  };

  const handleDownloadAudio = (scene: Scene) => {
    if (!scene.audioUrl) return;
    const a = document.createElement('a');
    a.href = scene.audioUrl;
    a.download = `${project.metadata.title.toLowerCase().replace(/\s+/g, '_')}_scene_${scene.sceneNumber}_audio.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const voicedCount = scenes.filter((s) => s.audioUrl).length;

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <span>Voice & Audio Studio (Optional)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Generate voiceover and dialogue audio with the selected provider: {activeProvider === 'openai' ? 'OpenAI TTS' : activeProvider === 'gemini' ? 'Gemini TTS' : 'speech generation unavailable'}.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleBatchSynthesize}
            disabled={!speechGenerationSupported || isBatchSynthesizing || Boolean(isSynthesizingForId) || scenes.length === 0}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-semibold px-4 py-2 rounded text-xs transition-colors"
          >
            {isBatchSynthesizing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Synthesizing Audio...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Synthesize All Scenes</span>
              </>
            )}
          </button>

          <button
            onClick={onProceedToVideo}
            className="flex items-center gap-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold px-3.5 py-2 rounded text-xs transition-colors"
          >
            <span>Next: Video Assembly</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Optional Stage Notice */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <span className="text-zinc-200 font-medium">
              Audio is an optional production stage.
            </span>
            <span className="text-zinc-400 ml-1.5">
              {voicedCount} of {scenes.length} scenes voiced. You may proceed to Video Assembly at any time.
            </span>
          </div>
        </div>

        {/* Voice Selector */}
        <div className="flex items-center gap-2">
          <label className="text-zinc-400 text-xs">TTS Voice:</label>
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            disabled={!speechGenerationSupported}
            className="bg-zinc-950 border border-zinc-800 text-zinc-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-amber-400"
          >
            {voices.map((voice) => <option key={voice} value={voice}>{voice}</option>)}
          </select>
        </div>
        {!speechGenerationSupported && (
          <div role="status" className="rounded border border-amber-900/70 bg-amber-950/30 px-4 py-3 text-xs text-amber-200">
            {activeProvider} does not provide speech synthesis in SceneCraft. Choose Gemini or OpenAI in AI Settings. Existing audio can still be played and downloaded.
          </div>
        )}
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-lg p-4 flex items-start gap-3 text-xs text-rose-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-rose-300">Audio Notice: </span>
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

      {/* Scenes Audio List */}
      <div className="space-y-4">
        {scenes.map((scene) => {
          const isSynthesizing = isSynthesizingForId === scene.id;
          const isPlaying = activePlayingId === scene.id;
          const hasAudio = Boolean(scene.audioUrl);
          const voiceSnippet =
            scene.dialogue || `Scene ${scene.sceneNumber}: ${scene.description || scene.actions}`;

          return (
            <div
              key={scene.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="font-mono font-semibold text-amber-400">
                    Scene {scene.sceneNumber}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-zinc-300 font-medium">{scene.title}</span>
                  {scene.dialogue ? (
                    <span className="text-zinc-400 text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded">
                      Dialogue Line
                    </span>
                  ) : (
                    <span className="text-zinc-500 text-[10px]">Narrator Audio</span>
                  )}
                </div>

                <p className="text-xs text-zinc-300 font-mono italic bg-zinc-950/70 p-2 rounded border border-zinc-800/80">
                  "{voiceSnippet}"
                </p>
                {scene.audioError && (
                  <p role="alert" className="text-[11px] leading-relaxed text-rose-300">
                    Audio generation failed; previous audio is retained. {scene.audioError}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                {hasAudio ? (
                  <>
                    <button
                      onClick={() => handlePlayAudio(scene.id, scene.audioUrl!)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                        isPlaying
                          ? 'bg-amber-400 text-zinc-950'
                          : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700'
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Play Audio</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDownloadAudio(scene)}
                      className="p-2 text-zinc-400 hover:text-zinc-200 bg-zinc-950 border border-zinc-800 rounded transition-colors"
                      title="Download WAV file"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleSynthesizeScene(scene.id)}
                      disabled={isSynthesizing || !speechGenerationSupported}
                      className="p-2 text-zinc-500 hover:text-amber-400 bg-zinc-950 border border-zinc-800 rounded transition-colors"
                      title="Re-synthesize audio"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSynthesizing ? 'animate-spin' : ''}`} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleSynthesizeScene(scene.id)}
                    disabled={isSynthesizing || !speechGenerationSupported}
                    className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-3 py-1.5 rounded text-xs transition-colors"
                  >
                    {isSynthesizing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Synthesizing...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        <span>Synthesize Audio</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

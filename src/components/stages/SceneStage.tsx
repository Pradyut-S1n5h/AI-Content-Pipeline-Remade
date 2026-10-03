import React, { useState } from 'react';
import { Project, Scene } from '../../types';
import { breakdownScenesApi, generateVisualPromptApi } from '../../services/api';
import {
  Film,
  Plus,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Edit3,
  Sparkles,
  RefreshCw,
  Clock,
  Camera,
  ArrowRight,
  AlertCircle,
  Wand2,
} from 'lucide-react';

interface SceneStageProps {
  project: Project;
  onUpdateScenes: (scenes: Scene[]) => void;
  onProceedToStoryboard: () => void;
}

export const SceneStage: React.FC<SceneStageProps> = ({
  project,
  onUpdateScenes,
  onProceedToStoryboard,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [isRegeneratingPromptForId, setIsRegeneratingPromptForId] = useState<string | null>(null);

  const scenes = project.scenes || [];

  const handleBreakdownScenes = async () => {
    if (!project.script?.fullScript) {
      setErrorMessage('Please generate or enter a screenplay first before breaking down scenes.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    const res = await breakdownScenesApi({
      script: project.script.fullScript,
      title: project.metadata.title,
      contentType: project.metadata.contentType,
      durationMinutes: project.metadata.targetDurationMinutes,
      bible: project.bible,
    });

    setIsGenerating(false);

    if (res.success && res.data) {
      onUpdateScenes(res.data);
    } else {
      setErrorMessage(res.error || 'Failed to breakdown screenplay into scenes.');
    }
  };

  const handleMoveScene = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= scenes.length) return;

    const updated = [...scenes];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Renumber scenes sequentially
    const renumbered = updated.map((s, idx) => ({
      ...s,
      sceneNumber: idx + 1,
    }));

    onUpdateScenes(renumbered);
  };

  const handleDuplicateScene = (scene: Scene) => {
    const newScene: Scene = {
      ...scene,
      id: 'scene-' + Date.now(),
      title: `${scene.title} (Copy)`,
      sceneNumber: scenes.length + 1,
      imageUrl: undefined,
      imageStatus: 'idle',
    };
    onUpdateScenes([...scenes, newScene]);
  };

  const handleDeleteScene = (id: string) => {
    const filtered = scenes
      .filter((s) => s.id !== id)
      .map((s, idx) => ({ ...s, sceneNumber: idx + 1 }));
    onUpdateScenes(filtered);
  };

  const handleAddScene = () => {
    const newScene: Scene = {
      id: 'scene-' + Date.now(),
      sceneNumber: scenes.length + 1,
      title: `Scene ${scenes.length + 1}`,
      description: '',
      setting: project.bible?.locations?.[0]?.name || 'Interior Room',
      timeOfDay: 'day',
      characters: project.bible?.characters?.[0] ? [project.bible.characters[0].name] : [],
      actions: '',
      dialogue: '',
      cameraDirection: 'Medium shot',
      mood: 'Dramatic',
      visualStyle: project.metadata.visualStyle,
      durationSeconds: 5,
      imagePrompt: '',
    };
    onUpdateScenes([...scenes, newScene]);
    setEditingScene(newScene);
  };

  const handleSaveEditedScene = (updated: Scene) => {
    const list = scenes.map((s) => (s.id === updated.id ? updated : s));
    onUpdateScenes(list);
    setEditingScene(null);
  };

  const handleRegeneratePrompt = async (scene: Scene) => {
    setIsRegeneratingPromptForId(scene.id);
    const res = await generateVisualPromptApi({
      scene,
      bible: project.bible,
      visualStyle: project.metadata.visualStyle,
    });
    setIsRegeneratingPromptForId(null);

    if (res.success && res.data) {
      const list = scenes.map((s) =>
        s.id === scene.id ? { ...s, imagePrompt: res.data!.prompt } : s
      );
      onUpdateScenes(list);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <span>Scene Engine & Breakdown</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage individual cinematic beats, camera framing, timing, and visual prompts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleBreakdownScenes}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-semibold px-4 py-2 rounded text-xs transition-colors"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Deconstructing Beats...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{scenes.length > 0 ? 'Regenerate Scenes' : 'Breakdown Screenplay'}</span>
              </>
            )}
          </button>

          <button
            onClick={handleAddScene}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-3.5 py-2 rounded text-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Scene</span>
          </button>

          {scenes.length > 0 && (
            <button
              onClick={onProceedToStoryboard}
              className="flex items-center gap-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold px-3.5 py-2 rounded text-xs transition-colors"
            >
              <span>Next: Storyboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-lg p-4 flex items-start gap-3 text-xs text-rose-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-rose-300">Notice: </span>
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

      {/* Scenes List */}
      {scenes.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-lg p-16 text-center space-y-3">
          <Film className="w-8 h-8 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-300">No Scenes Yet</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Click "Breakdown Screenplay" to automatically parse your script into structured scenes,
            or click "Add Scene" to build your timeline manually.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {scenes.map((scene, idx) => (
            <div
              key={scene.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4 hover:border-zinc-700 transition-colors"
            >
              {/* Scene Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded bg-zinc-800 flex items-center justify-center font-mono font-bold text-xs text-amber-400">
                    {scene.sceneNumber}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">{scene.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                      <span>{scene.setting}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{scene.timeOfDay.replace(/_/g, ' ')}</span>
                      <span aria-hidden="true">·</span>
                      <span>{scene.durationSeconds}s duration</span>
                      {scene.mood && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Mood: {scene.mood}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Scene Controls */}
                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <button
                    onClick={() => handleMoveScene(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1.5 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-400"
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveScene(idx, 'down')}
                    disabled={idx === scenes.length - 1}
                    className="p-1.5 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-400"
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDuplicateScene(scene)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-200"
                    title="Duplicate scene"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingScene(scene)}
                    className="p-1.5 text-zinc-400 hover:text-amber-400"
                    title="Edit scene"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteScene(scene.id)}
                    className="p-1.5 text-zinc-500 hover:text-rose-400"
                    title="Delete scene"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Scene Body Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Description & Action */}
                <div className="space-y-2">
                  <div>
                    <span className="text-zinc-500 font-medium">Camera Direction: </span>
                    <span className="text-zinc-300">{scene.cameraDirection}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 font-medium">Action & Beat: </span>
                    <span className="text-zinc-300">{scene.actions || scene.description}</span>
                  </div>
                  {scene.characters && scene.characters.length > 0 && (
                    <div>
                      <span className="text-zinc-500 font-medium">Characters: </span>
                      <span className="text-zinc-300">{scene.characters.join(', ')}</span>
                    </div>
                  )}
                  {scene.dialogue && (
                    <div className="pt-1">
                      <span className="text-zinc-500 font-medium">Dialogue:</span>
                      <p className="font-mono text-zinc-400 italic bg-zinc-950/80 p-2 rounded mt-1 border border-zinc-800">
                        {scene.dialogue}
                      </p>
                    </div>
                  )}
                </div>

                {/* Visual Prompt Box */}
                <div className="bg-zinc-950 border border-zinc-800/90 rounded p-3.5 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-amber-400" />
                        <span>Synthesized Visual Prompt</span>
                      </span>
                      <button
                        onClick={() => handleRegeneratePrompt(scene)}
                        disabled={isRegeneratingPromptForId === scene.id}
                        className="text-[11px] text-zinc-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
                      >
                        {isRegeneratingPromptForId === scene.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Wand2 className="w-3 h-3" />
                        )}
                        <span>Update from Bible</span>
                      </button>
                    </div>
                    <p className="text-zinc-300 text-[11px] leading-relaxed line-clamp-4">
                      {scene.imagePrompt || 'No visual prompt generated yet.'}
                    </p>
                  </div>

                  <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-800/80 flex items-center justify-between">
                    <span>Aspect: {project.metadata.aspectRatio}</span>
                    <span>{scene.imageUrl ? '✓ Visual frame ready' : 'Pending generation'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Scene Modal */}
      {editingScene && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-semibold text-zinc-100">
                Edit Scene {editingScene.sceneNumber}: {editingScene.title}
              </h3>
              <button
                onClick={() => setEditingScene(null)}
                className="text-zinc-400 hover:text-zinc-200 text-xs"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Scene Title</label>
                  <input
                    type="text"
                    value={editingScene.title}
                    onChange={(e) =>
                      setEditingScene({ ...editingScene, title: e.target.value })
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Setting / Location</label>
                  <input
                    type="text"
                    value={editingScene.setting}
                    onChange={(e) =>
                      setEditingScene({ ...editingScene, setting: e.target.value })
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Time of Day</label>
                  <select
                    value={editingScene.timeOfDay}
                    onChange={(e) =>
                      setEditingScene({
                        ...editingScene,
                        timeOfDay: e.target.value as any,
                      })
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="day">Day</option>
                    <option value="night">Night</option>
                    <option value="dusk">Dusk</option>
                    <option value="dawn">Dawn</option>
                    <option value="golden_hour">Golden Hour</option>
                    <option value="interior_lit">Interior Lit</option>
                    <option value="dim_ambient">Dim Ambient</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1">
                    Duration (Seconds)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={editingScene.durationSeconds}
                    onChange={(e) =>
                      setEditingScene({
                        ...editingScene,
                        durationSeconds: Number(e.target.value),
                      })
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Mood</label>
                  <input
                    type="text"
                    value={editingScene.mood}
                    onChange={(e) =>
                      setEditingScene({ ...editingScene, mood: e.target.value })
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">
                  Camera Direction & Shot Framing
                </label>
                <input
                  type="text"
                  value={editingScene.cameraDirection}
                  onChange={(e) =>
                    setEditingScene({ ...editingScene, cameraDirection: e.target.value })
                  }
                  placeholder="e.g. Wide establishing aerial, Close-up on eyes, Dutch angle"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">
                  Action & Narrative Beat
                </label>
                <textarea
                  value={editingScene.actions || editingScene.description}
                  onChange={(e) =>
                    setEditingScene({
                      ...editingScene,
                      actions: e.target.value,
                      description: e.target.value,
                    })
                  }
                  rows={2}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Dialogue (Optional)</label>
                <textarea
                  value={editingScene.dialogue || ''}
                  onChange={(e) =>
                    setEditingScene({ ...editingScene, dialogue: e.target.value })
                  }
                  rows={2}
                  placeholder="CHARACTER: Dialogue..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">
                  Synthesized Image Prompt
                </label>
                <textarea
                  value={editingScene.imagePrompt}
                  onChange={(e) =>
                    setEditingScene({ ...editingScene, imagePrompt: e.target.value })
                  }
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingScene(null)}
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveEditedScene(editingScene)}
                className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold rounded text-xs transition-colors"
              >
                Save Scene
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

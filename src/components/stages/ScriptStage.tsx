import React, { useState } from 'react';
import { Project, ScriptSection, ScriptUpdate } from '../../types';
import { generateScriptApi, regenerateScriptSectionApi } from '../../services/api';
import {
  Sparkles,
  RefreshCw,
  Edit3,
  Check,
  ArrowRight,
  BookOpen,
  AlertCircle,
  Wand2,
  Undo2,
  Redo2,
} from 'lucide-react';

interface ScriptStageProps {
  project: Project;
  onUpdateScript: (update: ScriptUpdate, label?: string) => void;
  onRestoreVersion: (index: number) => void;
  onProceedToBible: () => void;
}

export const ScriptStage: React.FC<ScriptStageProps> = ({
  project,
  onUpdateScript,
  onRestoreVersion,
  onProceedToBible,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Section rewrite modal state
  const [rewriteSection, setRewriteSection] = useState<'title' | 'logline' | 'synopsis' | 'fullScript' | null>(null);
  const [rewriteInstructions, setRewriteInstructions] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);

  const script = project.script || {
    title: project.metadata.title,
    logline: '',
    synopsis: '',
    fullScript: '',
  };

  const handleGenerateFullScript = async () => {
    if (hasScript && !confirm('Regenerating the full screenplay will replace its current contents. Continue?')) return;
    const scriptAtStart = script;
    setIsGenerating(true);
    setErrorMessage(null);

    const res = await generateScriptApi({
      title: project.metadata.title,
      idea: project.metadata.idea,
      contentType: project.metadata.contentType,
      tone: project.metadata.tone,
      targetAudience: project.metadata.targetAudience,
      durationMinutes: project.metadata.targetDurationMinutes,
      language: project.metadata.language,
      visualStyle: project.metadata.visualStyle,
    });

    setIsGenerating(false);

    if (res.success && res.data) {
      onUpdateScript((current) => ({
        title: current.title !== scriptAtStart.title ? current.title : res.data!.title,
        logline: current.logline !== scriptAtStart.logline ? current.logline : res.data!.logline,
        synopsis: current.synopsis !== scriptAtStart.synopsis ? current.synopsis : res.data!.synopsis,
        fullScript: current.fullScript !== scriptAtStart.fullScript ? current.fullScript : res.data!.fullScript,
        targetAudienceNotes: current.targetAudienceNotes !== scriptAtStart.targetAudienceNotes
          ? current.targetAudienceNotes
          : res.data!.targetAudienceNotes,
      }), 'Generated full screenplay');
    } else {
      setErrorMessage(
        res.error || 'Local script generation failed. Check that the writing model is installed and the Ollama runtime is running.'
      );
    }
  };

  const handleRewriteSection = async () => {
    if (!rewriteSection) return;
    setIsRewriting(true);
    setErrorMessage(null);

    const res = await regenerateScriptSectionApi({
      sectionType: rewriteSection,
      currentScript: script,
      projectIdea: project.metadata.idea,
      instructions: rewriteInstructions,
    });

    setIsRewriting(false);

    if (res.success && res.data) {
      onUpdateScript((current) => ({
        ...current,
        [rewriteSection]: res.data!.content,
      }), `Rewrote ${rewriteSection}`);
      setRewriteSection(null);
      setRewriteInstructions('');
    } else {
      setErrorMessage(res.error || 'Failed to rewrite section.');
    }
  };

  const handleFieldChange = (field: keyof ScriptSection, value: string) => {
    onUpdateScript((current) => ({ ...current, [field]: value }));
  };

  const hasScript = Boolean(script.fullScript && script.fullScript.trim().length > 0);
  const history = project.scriptHistory?.length
    ? project.scriptHistory
    : [{ script, savedAt: project.metadata.updatedAt, label: 'Current draft' }];
  const historyIndex = Math.max(0, Math.min(
    project.scriptHistoryIndex ?? history.length - 1,
    history.length - 1
  ));
  const wordCount = script.fullScript.trim() ? script.fullScript.trim().split(/\s+/).length : 0;
  const characterCount = script.fullScript.length;

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <span>Screenplay & Story Architecture</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Structured narrative breakdown into logline, synopsis, and full screenplay format.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onRestoreVersion(historyIndex - 1)}
            disabled={historyIndex <= 0}
            aria-label="Undo screenplay change"
            title="Undo"
            className="rounded border border-zinc-700 p-2 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRestoreVersion(historyIndex + 1)}
            disabled={historyIndex >= history.length - 1}
            aria-label="Redo screenplay change"
            title="Redo"
            className="rounded border border-zinc-700 p-2 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <select
            aria-label="Screenplay version history"
            value={historyIndex}
            onChange={(event) => onRestoreVersion(Number(event.target.value))}
            className="max-w-36 rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-[10px] text-zinc-300"
          >
            {history.map((version, index) => (
              <option key={`${version.savedAt}-${index}`} value={index}>
                {new Date(version.savedAt).toLocaleString()} — {version.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerateFullScript}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-semibold px-4 py-2 rounded text-xs transition-colors"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Crafting Screenplay...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{hasScript ? 'Regenerate Full Script' : 'Generate Screenplay'}</span>
              </>
            )}
          </button>

          {hasScript && (
            <button
              onClick={onProceedToBible}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-3.5 py-2 rounded text-xs transition-colors"
            >
              <span>Next: World Bible</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-lg p-4 flex items-start gap-3 text-xs text-rose-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-rose-300">Generation Notice: </span>
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

      {/* Script Work Area */}
      <div className="space-y-6">
        {/* Title & Logline */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Title */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300">Project Title</label>
              <button
                onClick={() => setRewriteSection('title')}
                className="text-[11px] text-zinc-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
              >
                <Wand2 className="w-3 h-3" />
                <span>Rewrite</span>
              </button>
            </div>
            <input
              type="text"
              value={script.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="Script Title..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-xs font-semibold focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Logline */}
          <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300">Logline (1-2 Sentences)</label>
              <button
                onClick={() => setRewriteSection('logline')}
                className="text-[11px] text-zinc-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
              >
                <Wand2 className="w-3 h-3" />
                <span>Rewrite Logline</span>
              </button>
            </div>
            <textarea
              value={script.logline}
              onChange={(e) => handleFieldChange('logline', e.target.value)}
              rows={2}
              placeholder="A concise, high-concept sentence establishing protagonist, inciting incident, and stakes..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-xs leading-relaxed focus:outline-none focus:border-amber-400 resize-none"
            />
          </div>
        </div>

        {/* Narrative Synopsis */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-semibold text-zinc-300">Narrative Synopsis</label>
              <p className="text-[11px] text-zinc-500">
                Core dramatic arc, themes, and emotional journey.
              </p>
            </div>
            <button
              onClick={() => setRewriteSection('synopsis')}
              className="text-[11px] text-zinc-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
            >
              <Wand2 className="w-3 h-3" />
              <span>Rewrite Synopsis</span>
            </button>
          </div>
          <textarea
            value={script.synopsis}
            onChange={(e) => handleFieldChange('synopsis', e.target.value)}
            rows={4}
            placeholder="Story synopsis providing full dramatic context..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-xs leading-relaxed focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Screenplay Body */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-semibold text-zinc-300">Screenplay Draft</label>
              <p className="text-[11px] text-zinc-500">
                Formatted in standard screenplay conventions (INT./EXT., Dialogue, Parentheticals).
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-zinc-500" aria-live="polite">
                {wordCount} words · {characterCount} characters
              </span>
              <button
                onClick={() => setRewriteSection('fullScript')}
                className="text-[11px] text-zinc-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
              >
                <Wand2 className="w-3 h-3" />
                <span>Rewrite Script</span>
              </button>
            </div>
          </div>

          <textarea
            value={script.fullScript}
            onChange={(e) => handleFieldChange('fullScript', e.target.value)}
            rows={18}
            placeholder="INT. LOCATION - TIME OF DAY

Action description here...

CHARACTER NAME
Dialogue lines here..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded p-4 text-zinc-200 font-mono text-xs leading-relaxed focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Targeted Section Rewrite Modal */}
      {rewriteSection && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-lg p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 capitalize">
                Rewrite {rewriteSection}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Provide custom directions to improve or adapt this specific section without
                affecting the rest of the screenplay.
              </p>
            </div>

            <textarea
              value={rewriteInstructions}
              onChange={(e) => setRewriteInstructions(e.target.value)}
              rows={3}
              placeholder="e.g. 'Make it more urgent and mysterious', 'Focus on Maya’s emotional conflict', 'Add more tension before the reveal'..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400"
              autoFocus
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setRewriteSection(null)}
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRewriteSection}
                disabled={isRewriting}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-semibold rounded text-xs transition-colors"
              >
                {isRewriting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Rewriting...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Execute Rewrite</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

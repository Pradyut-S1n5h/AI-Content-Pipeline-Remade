import React from 'react';
import { Project } from '../types';
import { Film, Plus, FolderOpen, Check, RefreshCw, Settings2, AlertCircle, Save } from 'lucide-react';

interface HeaderProps {
  project: Project;
  allProjects: { id: string; title: string; isDemo?: boolean }[];
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onOpenProjectModal: () => void;
  saveStatus: 'saving' | 'saved' | 'unsaved' | 'failed';
  saveError?: string;
  onSaveNow: () => void;
  hasAiKey: boolean;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  allProjects,
  onSelectProject,
  onNewProject,
  onOpenProjectModal,
  saveStatus,
  saveError,
  onSaveNow,
  hasAiKey,
  onOpenSettings,
}) => {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950 px-3 py-3 sm:px-6 sm:py-3.5 flex flex-wrap items-center justify-between gap-y-2 sticky top-0 z-40">
      <div className="flex min-w-0 items-center gap-2 sm:gap-6">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-amber-400">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-zinc-100">SceneCraft</span>
              <span className="text-xs text-zinc-500 font-mono">v1.0</span>
            </div>
            <p className="hidden text-[11px] text-zinc-400 leading-none sm:block">AI Content Creation Pipeline</p>
          </div>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

        {/* Project Selector & Details */}
        <div className="flex items-center gap-3">
          <div className="relative min-w-0">
            <select
              value={project.metadata.id}
              onChange={(e) => onSelectProject(e.target.value)}
              className="max-w-[28vw] truncate bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-zinc-600 appearance-none pr-7 cursor-pointer hover:bg-zinc-850 sm:max-w-none"
            >
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} {p.isDemo ? '(Sample Demo)' : ''}
                </option>
              ))}
            </select>
            <FolderOpen className="w-3.5 h-3.5 text-zinc-400 absolute right-2 top-2 pointer-events-none" />
          </div>

          <button
            onClick={onOpenProjectModal}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors hidden md:inline-flex items-center gap-1"
          >
            <span>Edit Info</span>
          </button>
        </div>
      </div>

      {/* Right Actions */}
      <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
        {/* Save Status */}
        <div className="text-xs text-zinc-500 hidden sm:flex items-center gap-1.5">
          {saveStatus === 'saving' ? (
            <>
              <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
              <span>Saving…</span>
            </>
          ) : saveStatus === 'saved' ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Saved locally</span>
            </>
          ) : saveStatus === 'failed' ? (
            <>
              <AlertCircle className="w-3 h-3 text-red-400" aria-hidden="true" />
              <span className="text-red-300" title={saveError}>Save failed</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3 text-amber-400" />
              <span>Unsaved changes</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onSaveNow}
          aria-label="Save project now"
          title="Save project now"
          className="inline-flex items-center gap-1.5 rounded border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
        >
          <Save className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Save</span>
        </button>

        {/* API / Mode Indicator */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-400 border border-zinc-800/80 px-2.5 py-1 rounded bg-zinc-900/60">
          <div
            className={`w-2 h-2 rounded-full ${
              hasAiKey ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <span>{hasAiKey ? 'AI provider ready' : 'Demo / key needed'}</span>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          title="AI Settings"
          aria-label="Open AI settings"
          className="inline-flex items-center gap-1.5 rounded border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
        >
          <Settings2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">AI Settings</span>
        </button>

        {/* New Project Button */}
        <button
          onClick={onNewProject}
          className="flex items-center gap-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs px-2.5 py-1.5 rounded transition-colors sm:px-3"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Project</span>
        </button>
      </div>
    </header>
  );
};

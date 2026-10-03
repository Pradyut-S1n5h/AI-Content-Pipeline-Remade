import React from 'react';
import { Project } from '../types';
import { Film, Plus, FolderOpen, Sparkles, Check, RefreshCw } from 'lucide-react';

interface HeaderProps {
  project: Project;
  allProjects: { id: string; title: string; isDemo?: boolean }[];
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onOpenProjectModal: () => void;
  isSaving: boolean;
  hasGeminiKey: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  allProjects,
  onSelectProject,
  onNewProject,
  onOpenProjectModal,
  isSaving,
  hasGeminiKey,
}) => {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950 px-6 py-3.5 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-6">
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
            <p className="text-[11px] text-zinc-400 leading-none">AI Content Creation Pipeline</p>
          </div>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

        {/* Project Selector & Details */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={project.metadata.id}
              onChange={(e) => onSelectProject(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-zinc-600 appearance-none pr-7 cursor-pointer hover:bg-zinc-850"
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
      <div className="flex items-center gap-3">
        {/* Save Status */}
        <div className="text-xs text-zinc-500 hidden sm:flex items-center gap-1.5">
          {isSaving ? (
            <>
              <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
              <span>Autosaving...</span>
            </>
          ) : (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Saved locally</span>
            </>
          )}
        </div>

        {/* API / Mode Indicator */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-400 border border-zinc-800/80 px-2.5 py-1 rounded bg-zinc-900/60">
          <div
            className={`w-2 h-2 rounded-full ${
              hasGeminiKey ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <span>{hasGeminiKey ? 'Gemini 3.8 Live Connected' : 'Demo / Free Mode'}</span>
        </div>

        {/* New Project Button */}
        <button
          onClick={onNewProject}
          className="flex items-center gap-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs px-3 py-1.5 rounded transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Project</span>
        </button>
      </div>
    </header>
  );
};

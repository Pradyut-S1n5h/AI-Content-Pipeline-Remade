import React from 'react';
import { Project, PipelineStage } from '../../types';
import {
  FileText,
  Users,
  Film,
  Image as ImageIcon,
  Mic,
  Video,
  Download,
  ArrowRight,
  Settings,
  Trash2,
  Copy,
  Info,
} from 'lucide-react';

interface ProjectOverviewProps {
  project: Project;
  onNavigateStage: (stage: PipelineStage) => void;
  onEditMetadata: () => void;
  onDeleteProject: () => void;
  onDuplicateProject: () => void;
}

export const ProjectOverview: React.FC<ProjectOverviewProps> = ({
  project,
  onNavigateStage,
  onEditMetadata,
  onDeleteProject,
  onDuplicateProject,
}) => {
  const meta = project.metadata;

  const PIPELINE_CARDS: {
    stage: PipelineStage;
    title: string;
    description: string;
    icon: any;
    count?: string;
  }[] = [
    {
      stage: 'script',
      title: '02. Screenplay & Story',
      description: 'Logline, synopsis, full scene script, and act structure',
      icon: FileText,
      count: project.script?.fullScript ? 'Draft Ready' : 'Pending',
    },
    {
      stage: 'bible',
      title: '03. World & Bible',
      description: 'Consistent character profiles, key locations, and props',
      icon: Users,
      count: `${project.bible?.characters?.length || 0} Chars · ${project.bible?.locations?.length || 0} Locs`,
    },
    {
      stage: 'scenes',
      title: '04. Scene Engine',
      description: 'Structured scenes with camera direction, mood, and actions',
      icon: Film,
      count: `${project.scenes.length} Scenes`,
    },
    {
      stage: 'storyboard',
      title: '05. Visual Storyboard',
      description: 'Cinematic visual prompts and AI frame generation',
      icon: ImageIcon,
      count: `${project.scenes.filter((s) => s.imageUrl).length}/${project.scenes.length} Visuals`,
    },
    {
      stage: 'audio',
      title: '06. Voice Audio',
      description: 'Scene dialogue and narration synthesis with Gemini TTS',
      icon: Mic,
      count: `${project.scenes.filter((s) => s.audioUrl).length}/${project.scenes.length} Voiced`,
    },
    {
      stage: 'video',
      title: '07. Video Assembly',
      description: 'Timeline playback, Ken Burns effects, animatic rendering',
      icon: Video,
      count: project.assembledVideoUrl ? 'Rendered' : 'Ready to Assemble',
    },
    {
      stage: 'export',
      title: '08. Export Suite',
      description: 'Fountain screenplay, CSV scenes, printable storyboard, MP4',
      icon: Download,
      count: 'Available',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto py-8 px-6 space-y-8">
      {/* Demo Project Notice */}
      {meta.isDemo && (
        <div className="border border-amber-500/30 bg-amber-500/10 rounded-lg p-4 flex items-start gap-3 text-xs text-amber-200">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-300">Demo Project Mode: </span>
            <span>
              This is a pre-loaded demonstration project ("{meta.title}") showcasing structured
              screenplay writing, world bible character consistency, scene breakdowns, and video animatic
              assembly. You can explore, edit, or regenerate any stage freely!
            </span>
          </div>
        </div>
      )}

      {/* Hero Overview */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="capitalize">{meta.contentType.replace(/_/g, ' ')}</span>
              <span aria-hidden="true">·</span>
              <span>{meta.targetDurationMinutes} min target</span>
              <span aria-hidden="true">·</span>
              <span>{meta.aspectRatio}</span>
              <span aria-hidden="true">·</span>
              <span>{meta.language}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
              {meta.title}
            </h1>

            <p className="text-sm text-zinc-300 leading-relaxed font-normal">
              {meta.idea || 'No project idea provided yet. Click "Edit Parameters" to describe your story.'}
            </p>

            <div className="pt-2 flex flex-wrap gap-4 text-xs text-zinc-400">
              <div>
                <span className="text-zinc-500">Tone: </span>
                <span className="text-zinc-300">{meta.tone}</span>
              </div>
              <span className="text-zinc-700">·</span>
              <div>
                <span className="text-zinc-500">Target Audience: </span>
                <span className="text-zinc-300">{meta.targetAudience}</span>
              </div>
              <span className="text-zinc-700">·</span>
              <div>
                <span className="text-zinc-500">Visual Theme: </span>
                <span className="text-zinc-300">{meta.visualStyle}</span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
            <button
              onClick={() => onNavigateStage('script')}
              className="flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold px-5 py-2.5 rounded text-xs transition-colors shadow-sm"
            >
              <span>{project.script?.fullScript ? 'Review Screenplay' : 'Generate Screenplay'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onEditMetadata}
              className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 px-4 py-2 rounded text-xs transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Edit Parameters</span>
            </button>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={onDuplicateProject}
                className="flex-1 flex items-center justify-center gap-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded text-[11px] transition-colors"
                title="Duplicate this project"
              >
                <Copy className="w-3 h-3" />
                <span>Duplicate</span>
              </button>

              {!meta.isDemo && (
                <button
                  onClick={onDeleteProject}
                  className="flex items-center justify-center gap-1.5 text-rose-400 hover:text-rose-300 bg-rose-950/20 border border-rose-900/40 px-3 py-1.5 rounded text-[11px] transition-colors"
                  title="Delete project"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Navigation Grid */}
      <div>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-zinc-100">Content Pipeline Stages</h2>
          <p className="text-xs text-zinc-400">
            Follow the sequential pipeline from narrative writing to final media export.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PIPELINE_CARDS.map((card) => {
            const Icon = card.icon;
            const isCompleted = project.completedStages.includes(card.stage);

            return (
              <div
                key={card.stage}
                onClick={() => onNavigateStage(card.stage)}
                className="group cursor-pointer bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 rounded-lg p-5 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded bg-zinc-800 group-hover:bg-zinc-700 flex items-center justify-center text-zinc-300 group-hover:text-amber-400 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-mono text-zinc-500">{card.count}</span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-xs text-zinc-500 group-hover:text-amber-400 transition-colors">
                  <span>{isCompleted ? 'Completed · Review' : 'Open Stage'}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

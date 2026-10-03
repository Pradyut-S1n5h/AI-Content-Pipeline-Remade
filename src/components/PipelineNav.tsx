import React from 'react';
import { PipelineStage } from '../types';
import { Check } from 'lucide-react';

interface PipelineNavProps {
  currentStage: PipelineStage;
  completedStages: PipelineStage[];
  onSelectStage: (stage: PipelineStage) => void;
}

interface StageDefinition {
  id: PipelineStage;
  number: string;
  label: string;
}

const STAGES: StageDefinition[] = [
  { id: 'project', number: '01', label: 'Project Config' },
  { id: 'script', number: '02', label: 'Screenplay' },
  { id: 'bible', number: '03', label: 'World Bible' },
  { id: 'scenes', number: '04', label: 'Scene Engine' },
  { id: 'storyboard', number: '05', label: 'Storyboard' },
  { id: 'audio', number: '06', label: 'Voice Audio' },
  { id: 'video', number: '07', label: 'Video Assembly' },
  { id: 'export', number: '08', label: 'Export Suite' },
];

export const PipelineNav: React.FC<PipelineNavProps> = ({
  currentStage,
  completedStages,
  onSelectStage,
}) => {
  return (
    <nav className="border-b border-zinc-800 bg-zinc-900/40 px-6 overflow-x-auto scrollbar-none">
      <div className="flex items-center min-w-max gap-1">
        {STAGES.map((stage, idx) => {
          const isActive = currentStage === stage.id;
          const isCompleted = completedStages.includes(stage.id);

          return (
            <React.Fragment key={stage.id}>
              <button
                onClick={() => onSelectStage(stage.id)}
                className={`py-3 px-3.5 flex items-center gap-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? 'border-amber-400 text-amber-300 bg-amber-400/5'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                      : isActive
                      ? 'bg-amber-400 text-zinc-950 font-bold'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {isCompleted ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : stage.number}
                </div>
                <span>{stage.label}</span>
              </button>

              {idx < STAGES.length - 1 && (
                <div className="text-zinc-700 select-none text-xs px-0.5">/</div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};

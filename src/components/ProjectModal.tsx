import React, { useState } from 'react';
import { ProjectMetadata, ContentType } from '../types';
import { X, Sparkles } from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: ProjectMetadata;
  onSave: (updated: Partial<ProjectMetadata>) => void;
  isNew?: boolean;
}

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'short_film', label: 'Short Film' },
  { value: 'youtube_video', label: 'YouTube Video' },
  { value: 'educational_video', label: 'Educational Video' },
  { value: 'advertisement', label: 'Advertisement' },
  { value: 'story', label: 'Narrative Story' },
  { value: 'animation', label: 'Animation' },
  { value: 'social_media_video', label: 'Social Media Video' },
];

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  metadata,
  onSave,
  isNew = false,
}) => {
  const [title, setTitle] = useState(metadata.title || '');
  const [idea, setIdea] = useState(metadata.idea || '');
  const [contentType, setContentType] = useState<ContentType>(
    metadata.contentType || 'short_film'
  );
  const [targetDurationMinutes, setTargetDurationMinutes] = useState(
    metadata.targetDurationMinutes || 3
  );
  const [tone, setTone] = useState(metadata.tone || 'Cinematic, engaging');
  const [targetAudience, setTargetAudience] = useState(
    metadata.targetAudience || 'General Audience'
  );
  const [language, setLanguage] = useState(metadata.language || 'English');
  const [visualStyle, setVisualStyle] = useState(
    metadata.visualStyle || 'Cinematic 35mm film, atmospheric lighting'
  );
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '4:3'>(
    metadata.aspectRatio || '16:9'
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title: title.trim() || 'Untitled Project',
      idea: idea.trim(),
      contentType,
      targetDurationMinutes: Number(targetDurationMinutes),
      tone,
      targetAudience,
      language,
      visualStyle,
      aspectRatio,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              {isNew ? 'Create New Content Project' : 'Project Configuration'}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Configure parameters that guide script, scene, and visual generation.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Title */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">Project Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Last Signal"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 text-xs"
              required
            />
          </div>

          {/* Idea / Concept */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">
              Core Idea or Prompt
            </label>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={4}
              placeholder="Describe what your content is about, the protagonist, the conflict, or the message you want to communicate..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 text-xs leading-relaxed"
              required
            />
          </div>

          {/* Grid Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Content Type */}
            <div>
              <label className="block text-zinc-300 font-medium mb-1.5">Content Format</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as ContentType)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-400 text-xs"
              >
                {CONTENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Duration */}
            <div>
              <label className="block text-zinc-300 font-medium mb-1.5">
                Target Duration (Minutes)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={targetDurationMinutes}
                onChange={(e) => setTargetDurationMinutes(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-400 text-xs"
              />
            </div>

            {/* Tone / Style */}
            <div>
              <label className="block text-zinc-300 font-medium mb-1.5">Tone & Mood</label>
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="e.g. Atmospheric, suspenseful, energetic"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-400 text-xs"
              />
            </div>

            {/* Target Audience */}
            <div>
              <label className="block text-zinc-300 font-medium mb-1.5">Target Audience</label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. Sci-Fi fans, tech founders, teenagers"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-400 text-xs"
              />
            </div>

            {/* Visual Style */}
            <div className="sm:col-span-2">
              <label className="block text-zinc-300 font-medium mb-1.5">
                Cinematography & Visual Style
              </label>
              <input
                type="text"
                value={visualStyle}
                onChange={(e) => setVisualStyle(e.target.value)}
                placeholder="e.g. 35mm anamorphic film, warm tungsten, high contrast shadows, photorealistic"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-400 text-xs"
              />
            </div>

            {/* Language & Aspect Ratio */}
            <div>
              <label className="block text-zinc-300 font-medium mb-1.5">Language</label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="English"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-400 text-xs"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1.5">Aspect Ratio</label>
              <select
                value={aspectRatio}
                onChange={(e) =>
                  setAspectRatio(e.target.value as '16:9' | '9:16' | '1:1' | '4:3')
                }
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-400 text-xs"
              >
                <option value="16:9">16:9 (Landscape / Widescreen)</option>
                <option value="9:16">9:16 (Vertical / Mobile / Shorts)</option>
                <option value="1:1">1:1 (Square / Feed)</option>
                <option value="4:3">4:3 (Classic Cinema / Retro)</option>
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold rounded text-xs transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isNew ? 'Create Project' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

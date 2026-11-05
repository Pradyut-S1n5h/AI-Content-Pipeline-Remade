import React, { useRef, useState } from 'react';
import { ArrowRight, Download, Mic, Pause, Play, Volume2 } from 'lucide-react';
import { Project } from '../../types';

interface AudioStageProps {
  project: Project;
  onProceedToVideo: () => void;
}

export const AudioStage: React.FC<AudioStageProps> = ({ project, onProceedToVideo }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scenes = project.scenes || [];
  const existingTracks = scenes.filter((scene) => scene.audioUrl).length;

  const playTrack = (sceneId: string, url: string) => {
    if (playingId === sceneId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(url);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(sceneId);
    void audio.play().catch(() => setPlayingId(null));
  };

  const downloadTrack = (sceneNumber: number, url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.metadata.title.toLowerCase().replace(/\s+/g, '_')}_scene_${sceneNumber}_audio.wav`;
    link.click();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-100"><Mic className="h-5 w-5" />Voice & Audio</h1>
          <p className="mt-1 text-xs text-zinc-400">Existing project audio can still be played and downloaded.</p>
        </div>
        <button type="button" onClick={onProceedToVideo} className="inline-flex items-center gap-2 rounded bg-zinc-100 px-3.5 py-2 text-xs font-semibold text-zinc-950 hover:bg-white">Next: Video Assembly<ArrowRight className="h-3.5 w-3.5" /></button>
      </header>

      <div role="status" className="rounded border border-amber-900/70 bg-amber-950/30 p-4 text-xs text-amber-100">
        Audio synthesis is not included in the three-model local generation system. This stage does not call an external speech API. Add audio with a local editor; saved tracks remain available below.
      </div>

      <div className="flex items-center gap-2 text-xs text-zinc-400"><Volume2 className="h-4 w-4 text-amber-400" />{existingTracks} of {scenes.length} scenes have saved audio.</div>
      {scenes.map((scene) => (
        <article key={scene.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="min-w-0">
            <h2 className="text-xs font-medium text-zinc-200">Scene {scene.sceneNumber}: {scene.title}</h2>
            <p className="mt-1 truncate text-[11px] text-zinc-500">{scene.dialogue || scene.description || scene.actions}</p>
          </div>
          {scene.audioUrl ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => playTrack(scene.id, scene.audioUrl!)} className="inline-flex items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800">
                {playingId === scene.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {playingId === scene.id ? 'Pause' : 'Play'}
              </button>
              <button type="button" onClick={() => downloadTrack(scene.sceneNumber, scene.audioUrl!)} aria-label={`Download scene ${scene.sceneNumber} audio`} className="rounded border border-zinc-700 p-2 text-zinc-300 hover:bg-zinc-800"><Download className="h-3.5 w-3.5" /></button>
            </div>
          ) : <span className="text-[11px] text-zinc-500">No saved audio</span>}
        </article>
      ))}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Download, LoaderCircle, RefreshCw, X } from 'lucide-react';
import {
  getLocalJob,
  getLocalStatus,
  installLocalModel,
  LocalJob,
  LocalStatus,
  ModelKind,
} from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const kinds: ModelKind[] = ['writing', 'image', 'video'];
const labels: Record<ModelKind, string> = { writing: 'Writing', image: 'Image', video: 'Video' };

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [status, setStatus] = useState<LocalStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<ModelKind | null>(null);
  const [job, setJob] = useState<LocalJob | null>(null);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    const result = await getLocalStatus();
    setLoading(false);
    if (result.success && result.data) {
      setStatus(result.data);
      setError('');
      onSaved();
    } else {
      setError(result.error || 'Could not read local model status.');
    }
  };

  useEffect(() => {
    if (isOpen) void refresh();
  }, [isOpen]);

  useEffect(() => {
    if (!job || !installing || !['queued', 'running'].includes(job.status)) return;
    const timer = setTimeout(() => {
      void getLocalJob(job.id).then((result) => {
        if (result.success && result.data) {
          setJob(result.data);
          if (['completed', 'failed', 'cancelled'].includes(result.data.status)) {
            setInstalling(null);
            if (result.data.status === 'failed') setError(result.data.error || 'Model download failed.');
            void refresh();
          }
        } else {
          setInstalling(null);
          setError(result.error || 'Could not read model download progress.');
        }
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [job, installing]);

  if (!isOpen) return null;

  const handleInstall = async (kind: ModelKind) => {
    setError('');
    setInstalling(kind);
    const result = await installLocalModel(kind);
    if (!result.success || !result.data) {
      setInstalling(null);
      setError(result.error || 'Could not start model installation.');
      return;
    }
    setJob({
      id: result.data.id, kind, status: 'queued', progress: 0, message: 'Starting download',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="local-models-title" className="w-full max-w-2xl overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
        <header className="flex items-start justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 id="local-models-title" className="text-sm font-semibold text-zinc-100">Local Model Setup</h2>
            <p className="mt-1 text-xs text-zinc-400">Three fixed models. Downloads and generation stay on this machine.</p>
          </div>
          <button type="button" aria-label="Close model setup" onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"><X className="h-4 w-4" /></button>
        </header>

        <div className="max-h-[75vh] space-y-4 overflow-y-auto px-5 py-5">
          {status && (
            <div className="rounded border border-zinc-700 bg-zinc-950/60 p-3 text-[11px] text-zinc-400">
              <span className="font-medium text-zinc-200">Detected hardware: </span>
              {status.hardware.os}; {status.hardware.cpuCores} CPU cores; {Math.round(status.hardware.ramMb / 1024)} GB RAM ({Math.round(status.hardware.availableRamMb / 1024)} GB available)
              {status.hardware.gpu ? `; ${status.hardware.gpu} (${(status.hardware.vramMb / 1024).toFixed(1)} GB VRAM)` : '; no CUDA GPU detected'}
              {status.hardware.diskFreeMb ? `; ${Math.round(status.hardware.diskFreeMb / 1024)} GB free disk` : ''}
            </div>
          )}
          {kinds.map((kind) => {
            const model = status?.models[kind];
            const active = installing === kind;
            const jobInfo = active && job?.kind === kind ? job : null;
            return (
              <article key={kind} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-100">{labels[kind]} · {model?.label || kind}</h3>
                    <p className="mt-1 text-xs text-zinc-400">Runtime: {model?.runtime} · Download: {model?.storage} · License: {model?.license}</p>
                    <p className="mt-1 text-[11px] text-zinc-500">Hardware: {model?.minimum}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-1 text-[10px] ${model?.ready ? 'bg-emerald-950 text-emerald-300' : model?.installed ? 'bg-amber-950 text-amber-200' : 'bg-zinc-800 text-zinc-400'}`}>
                      {model?.ready ? 'Ready' : model?.installed ? 'Installed · hardware limited' : 'Not installed'}
                    </span>
                    {!model?.installed && (
                      <button type="button" onClick={() => void handleInstall(kind)} disabled={Boolean(installing) || loading || Boolean(model?.resourceError) || !model?.runtimeRunning} className="inline-flex items-center gap-1.5 rounded bg-amber-400 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-amber-300 disabled:opacity-50">
                        {active ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        {active ? 'Downloading…' : 'Install'}
                      </button>
                    )}
                  </div>
                </div>
                {jobInfo && (
                  <div className="mt-3" role="status">
                    <div className="mb-1 flex justify-between text-[11px] text-zinc-400"><span>{jobInfo.message}</span><span>{jobInfo.progress}%</span></div>
                    <progress className="h-1.5 w-full accent-amber-400" max={100} value={jobInfo.progress} />
                  </div>
                )}
                {model?.resourceError && <p className="mt-3 text-xs text-amber-200">{model.resourceError}</p>}
                {!model?.runtimeRunning && <p className="mt-2 text-[11px] text-amber-200">Start or install the local {model?.runtime || 'model'} runtime before downloading model files.</p>}
                <a className="mt-2 inline-block text-[11px] text-zinc-500 underline hover:text-zinc-300" href={model?.repository} target="_blank" rel="noreferrer">Model repository and license</a>
              </article>
            );
          })}
          {error && <p role="alert" className="rounded border border-red-900 bg-red-950/50 px-3 py-2 text-xs text-red-300">{error}</p>}
          <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
            <p className="text-[11px] text-zinc-500">Models are downloaded to the ignored `.local-ai/` directory.</p>
            <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
          </div>
        </div>
      </section>
    </div>
  );
};

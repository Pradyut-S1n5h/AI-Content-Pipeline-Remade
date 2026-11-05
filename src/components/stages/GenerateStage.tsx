import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Clipboard, Download, Image, LoaderCircle, Sparkles, Video, X } from 'lucide-react';
import {
  cancelLocalJob,
  generateMedia,
  generateWriting,
  getLocalJob,
  getLocalStatus,
  LocalJob,
  LocalStatus,
  ModelKind,
} from '../../services/api';

interface GenerateStageProps {
  onOpenSetup: () => void;
  statusRefresh: number;
}

type Tab = 'writing' | 'image' | 'video';

const tabs: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'writing', label: 'Writing', icon: Sparkles },
  { id: 'image', label: 'Image', icon: Image },
  { id: 'video', label: 'Video', icon: Video },
];

export const GenerateStage: React.FC<GenerateStageProps> = ({ onOpenSetup, statusRefresh }) => {
  const [tab, setTab] = useState<Tab>('writing');
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<LocalStatus | null>(null);
  const [job, setJob] = useState<LocalJob | null>(null);
  const [resultText, setResultText] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [imageSize, setImageSize] = useState('512x512');
  const [duration, setDuration] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void getLocalStatus().then((result) => {
      if (result.success && result.data) setStatus(result.data);
      else setError(result.error || 'Could not detect local models.');
    });
  }, [statusRefresh]);

  useEffect(() => {
    if (!job || !['queued', 'running'].includes(job.status)) return;
    const timer = setTimeout(() => {
      void getLocalJob(job.id).then((response) => {
        if (!response.success || !response.data) {
          setError(response.error || 'Could not read generation progress.');
          setJob(null);
          return;
        }
        setJob(response.data);
        if (response.data.status === 'completed' && response.data.output) {
          setResultUrl(response.data.output);
          setNotice('Generation completed locally.');
        } else if (['failed', 'cancelled'].includes(response.data.status)) {
          setError(response.data.error || response.data.message);
        }
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [job]);

  const modelKind: ModelKind = tab;
  const model = status?.models[modelKind];
  const isMediaBusy = Boolean(job && ['queued', 'running'].includes(job.status));
  const canGenerate = Boolean(model?.ready) && !busy && !isMediaBusy && prompt.trim().length > 0;

  const handleGenerate = async () => {
    setError('');
    setNotice('');
    setResultText('');
    setResultUrl('');
    if (!prompt.trim()) {
      setError('Enter a prompt before generating.');
      return;
    }
    if (!model?.ready) {
      setError(model?.resourceError || `${model?.label || 'The local model'} is not ready. Install it in Model Setup.`);
      return;
    }
    if (tab === 'writing') {
      setBusy(true);
      const response = await generateWriting(prompt.trim());
      setBusy(false);
      if (response.success && response.data) {
        setResultText(response.data.text);
        setNotice(`Generated with ${response.data.model} using local inference.`);
      } else {
        setError(response.error || 'Local text generation failed.');
      }
      return;
    }
    const options = tab === 'image'
      ? (() => {
          const [width, height] = imageSize.split('x').map(Number);
          return { width, height };
        })()
      : { duration };
    setBusy(true);
    const response = await generateMedia(tab, prompt.trim(), options);
    setBusy(false);
    if (response.success && response.data) {
      setJob({
        id: response.data.id,
        kind: tab,
        status: 'queued',
        progress: 0,
        message: 'Queued for local inference',
      });
    } else {
      setError(response.error || 'Could not start local generation.');
    }
  };

  const handleCancel = async () => {
    if (!job) return;
    const response = await cancelLocalJob(job.id);
    if (!response.success) setError(response.error || 'The running generation could not be cancelled.');
    else setNotice('Cancellation requested. The current inference step will finish first.');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resultText);
      setNotice('Generated text copied to clipboard.');
    } catch {
      setError('Clipboard access is unavailable in this browser.');
    }
  };

  const downloadText = () => {
    const blob = new Blob([resultText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'local-generated-writing.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Local AI Generation</h1>
          <p className="mt-1 text-xs text-zinc-400">Writing, image, and text-to-video inference runs on your machine. No hosted AI APIs.</p>
        </div>
        <button type="button" onClick={onOpenSetup} className="rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800">Model Setup</button>
      </header>

      <div role="tablist" aria-label="Generation type" className="flex gap-2 border-b border-zinc-800">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setError(''); setNotice(''); }} className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-xs ${tab === id ? 'border-amber-400 text-amber-200' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      <section className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">{model?.label || 'Loading default model…'}</h2>
            <p className="mt-1 text-[11px] text-zinc-400">Default model · {model?.storage || ''} · {model?.installed ? model.ready ? 'Ready for local inference' : 'Installed but hardware is insufficient' : 'Not installed'}</p>
          </div>
          <span className={`rounded px-2 py-1 text-[10px] ${model?.ready ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-200'}`}>{model?.ready ? 'Ready' : 'Setup required'}</span>
        </div>

        <label className="block text-xs font-medium text-zinc-300" htmlFor="generation-prompt">
          Prompt
          <textarea id="generation-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={4000} rows={5} placeholder={tab === 'writing' ? 'Describe the article, script, caption, rewrite, summary, or ideas you want…' : tab === 'image' ? 'Describe the image to create…' : 'Describe the video to render…'} className="mt-1.5 w-full resize-y rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none" />
          <span className="mt-1 block text-right text-[10px] text-zinc-500">{prompt.length}/4,000</span>
        </label>

        {tab === 'image' && (
          <label className="block max-w-xs text-xs text-zinc-300">Image dimensions
            <select value={imageSize} onChange={(event) => setImageSize(event.target.value)} className="mt-1.5 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs">
              <option value="512x512">512 × 512</option>
              <option value="512x288">512 × 288 (16:9)</option>
              <option value="288x512">288 × 512 (9:16)</option>
              <option value="512x384">512 × 384 (4:3)</option>
            </select>
          </label>
        )}
        {tab === 'video' && (
          <label className="block max-w-xs text-xs text-zinc-300">Duration
            <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-1.5 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs">
              {[2, 3, 4, 5, 6].map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
            </select>
          </label>
        )}

        {model?.resourceError && (
          <div role="status" className="rounded border border-amber-900/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">{model.resourceError}</div>
        )}
        {error && <div role="alert" className="flex gap-2 rounded border border-rose-900/70 bg-rose-950/40 px-3 py-2 text-xs text-rose-200"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
        {notice && <div role="status" className="flex gap-2 rounded border border-emerald-900/70 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200"><Check className="h-4 w-4 shrink-0" />{notice}</div>}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void handleGenerate()} disabled={!canGenerate} className="inline-flex items-center gap-2 rounded bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50">
            {busy || isMediaBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy || isMediaBusy ? 'Generating locally…' : 'Generate'}
          </button>
          {!model?.ready && <button type="button" onClick={onOpenSetup} className="rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800">Install model</button>}
          {isMediaBusy && <button type="button" onClick={() => void handleCancel()} className="inline-flex items-center gap-1 rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"><X className="h-3.5 w-3.5" />Cancel</button>}
        </div>
      </section>

      {busy && tab === 'writing' && (
        <div role="status" className="flex items-center gap-2 text-xs text-zinc-400"><LoaderCircle className="h-4 w-4 animate-spin text-amber-400" />Generating text with the local Ollama model…</div>
      )}
      {isMediaBusy && job && (
        <section role="status" className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-2 flex justify-between text-xs text-zinc-300"><span>{job.message}</span><span>{job.progress}%</span></div>
          <progress className="h-2 w-full accent-amber-400" max={100} value={job.progress} />
        </section>
      )}
      {resultText && (
        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-100">Generated text</h2>
            <div className="flex gap-2">
              <button type="button" onClick={() => void handleCopy()} className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"><Clipboard className="h-3.5 w-3.5" />Copy</button>
              <button type="button" onClick={downloadText} className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"><Download className="h-3.5 w-3.5" />Download</button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-zinc-200">{resultText}</pre>
        </section>
      )}
      {resultUrl && (
        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-semibold text-zinc-100">Generated {tab}</h2>
          {tab === 'image' ? <img src={resultUrl} alt="Generated locally from your prompt" className="max-h-[70vh] max-w-full rounded border border-zinc-700 object-contain" /> : <video src={resultUrl} controls className="max-h-[70vh] w-full rounded border border-zinc-700" />}
          <a href={resultUrl} download={tab === 'image' ? 'local-generated-image.png' : 'local-generated-video.mp4'} className="inline-flex items-center gap-2 rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800"><Download className="h-3.5 w-3.5" />Download {tab}</a>
        </section>
      )}
    </div>
  );
};

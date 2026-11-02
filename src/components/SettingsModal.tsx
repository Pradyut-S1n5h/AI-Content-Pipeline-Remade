import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, LoaderCircle, RefreshCw, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import {
  AiSettings,
  getAiSettings,
  getProviderModels,
  removeAiKey,
  saveAiSettings,
  testAiSettings,
} from '../services/api';
import {
  AiProvider,
  ModelOption,
  PROVIDER_CAPABILITIES,
  PROVIDER_MODELS,
  ThinkingLevel,
} from '../services/aiProviders';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const inputStyle = 'w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400';
const buttonStyle = 'inline-flex items-center justify-center gap-2 rounded px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [model, setModel] = useState(PROVIDER_MODELS.gemini[0].id);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>(PROVIDER_MODELS.gemini);
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('medium');
  const [apiKey, setApiKey] = useState('');
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [busyAction, setBusyAction] = useState<'loading' | 'testing' | 'saving' | 'removing' | null>(null);
  const busy = busyAction !== null;
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setApiKey('');
      setIsKeyVisible(false);
      return;
    }
    setBusyAction('loading');
    setError('');
    getAiSettings().then((result) => {
      if (result.success && result.data) {
        setSettings(result.data);
        setProvider(result.data.provider);
        setModel(result.data.model);
        setThinkingLevel(result.data.thinkingLevel);
        setModelOptions(result.data.models[result.data.provider]);
        if (result.data.hasSavedKey) {
          getProviderModels(result.data.provider).then((models) => {
            if (models.success && models.data) setModelOptions(models.data);
          });
        }
      } else {
        setError(result.error || 'Could not load AI settings.');
      }
    }).finally(() => setBusyAction(null));
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedModel = modelOptions.find((option) => option.id === model) ||
    PROVIDER_MODELS[provider].find((option) => option.id === model) || { id: model, label: model, supportsThinking: false };
  const keySource = settings?.keySources?.[provider] ??
    (settings?.provider === provider ? settings.keySource : 'none');
  const savedForProvider = keySource === 'session' || keySource === 'persistent';
  const envKeyForProvider = keySource === 'environment';
  const canThink = selectedModel.supportsThinking;

  const refreshModels = async (nextProvider: AiProvider, key = apiKey.trim() || undefined) => {
    const result = await getProviderModels(nextProvider, key);
    if (result.success && result.data?.length) {
      setModelOptions(result.data);
      setModel((selected) => result.data!.some((option) => option.id === selected)
        ? selected
        : result.data![0].id);
      return result.data;
    }
    const fallbackModels = PROVIDER_MODELS[nextProvider];
    setModelOptions(fallbackModels);
    setModel((selected) => fallbackModels.some((option) => option.id === selected)
      ? selected
      : fallbackModels[0].id);
    if (!result.success) setError(result.error || 'Could not load provider models.');
    return fallbackModels;
  };

  const handleProviderChange = async (nextProvider: AiProvider) => {
    setProvider(nextProvider);
    setModel(PROVIDER_MODELS[nextProvider][0].id);
    setModelOptions(PROVIDER_MODELS[nextProvider]);
    setApiKey('');
    setNotice('');
    setError('');
    await refreshModels(nextProvider, '');
  };

  const handleSave = async () => {
    setBusyAction('saving');
    setError('');
    setNotice('');
    const result = await saveAiSettings({
      provider,
      model,
      thinkingLevel,
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
    });
    setBusyAction(null);
    if (!result.success || !result.data) {
      setError(result.error || 'Could not save settings.');
      return;
    }
    setSettings(result.data);
    setApiKey('');
    setNotice(result.data.keyPersistenceAvailable
      ? 'Settings saved. Provider keys are encrypted on the server and can be restored for up to 30 days.'
      : 'Settings saved for this browser session. Configure encrypted key persistence to keep keys after a server restart.');
    await refreshModels(provider);
    onSaved();
  };

  const handleTest = async () => {
    setBusyAction('testing');
    setError('');
    setNotice('');
    const result = await testAiSettings({ provider, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) });
    setBusyAction(null);
    if (!result.success) {
      setError(result.error || 'The provider key could not be verified.');
      return;
    }
    setNotice('Key accepted by provider. No generation request was made.');
    await refreshModels(provider, apiKey.trim() || undefined);
  };

  const handleRemove = async () => {
    setBusyAction('removing');
    setError('');
    setNotice('');
    const result = await removeAiKey(provider);
    setBusyAction(null);
    if (!result.success || !result.data) {
      setError(result.error || 'Could not remove the session key.');
      return;
    }
    setSettings(result.data);
    setApiKey('');
    setNotice(result.data.keySources?.[provider] === 'environment'
      ? 'Session key removed. The environment-managed key remains active.'
      : 'Saved key removed from the server.');
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="ai-settings-title" className="w-full max-w-xl overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
        <header className="flex items-start justify-between border-b border-zinc-800 px-5 py-4 sm:px-6">
          <div className="flex gap-3">
            <div className="mt-0.5 rounded border border-amber-400/30 bg-amber-400/10 p-2 text-amber-300"><KeyRound className="h-4 w-4" /></div>
            <div>
              <h2 id="ai-settings-title" className="text-sm font-semibold text-zinc-100">AI Settings</h2>
              <p className="mt-1 text-xs text-zinc-400">Provider credentials and generation preferences</p>
            </div>
          </div>
          <button type="button" aria-label="Close settings" onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"><X className="h-4 w-4" /></button>
        </header>

        <div className="max-h-[75vh] space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          {busy && !settings ? <div className="flex items-center gap-2 text-xs text-zinc-400"><LoaderCircle className="h-4 w-4 animate-spin" />Loading settings…</div> : <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-xs font-medium text-zinc-300">Provider
                <select value={provider} onChange={(event) => handleProviderChange(event.target.value as AiProvider)} className={`${inputStyle} mt-1.5`}>
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="huggingface">Hugging Face (Qwen and more)</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-zinc-300">Text model
                <span className="mt-1.5 flex gap-2">
                  <select value={model} onChange={(event) => setModel(event.target.value)} className={inputStyle}>
                    {modelOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                  <button type="button" aria-label="Refresh models" title="Refresh available models" onClick={() => refreshModels(provider)} disabled={busy} className="shrink-0 rounded border border-zinc-700 px-2.5 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" /></button>
                </span>
              </label>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">API key</label>
              <div className="relative">
                <input type={isKeyVisible ? 'text' : 'password'} autoComplete="new-password" spellCheck={false} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={keySource !== 'none' ? 'Configured (enter a new key to replace)' : `Enter ${{
                  gemini: 'Gemini', openai: 'OpenAI', anthropic: 'Anthropic', huggingface: 'Hugging Face',
                }[provider]} API key`} className={`${inputStyle} pr-10`} />
                <button type="button" onClick={() => setIsKeyVisible((visible) => !visible)} aria-label={isKeyVisible ? 'Hide API key' : 'Show API key'} className="absolute right-2 top-2 rounded p-1 text-zinc-500 hover:text-zinc-200">
                  {isKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
                {envKeyForProvider
                  ? 'An environment-managed key is active. A session key can temporarily replace it.'
                  : keySource === 'persistent'
                    ? 'A key is encrypted on the server for this browser session; its value is never returned.'
                    : savedForProvider
                      ? 'A key is stored in server memory for this browser session; its value is never returned.'
                      : envKeyForProvider
                        ? 'An environment-managed key is active for this provider.'
                        : settings?.keyPersistenceAvailable
                          ? 'No key is configured. Web-entered keys will be encrypted on the server.'
                          : 'No key is configured. Without an encryption secret, web-entered keys remain in server memory only.'}
              </p>
            </div>

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-zinc-300">Thinking level</legend>
              <div className="grid grid-cols-3 gap-2">
                {(['low', 'medium', 'high'] as ThinkingLevel[]).map((level) => (
                  <button key={level} type="button" disabled={!canThink} aria-pressed={thinkingLevel === level} onClick={() => setThinkingLevel(level)} className={`${buttonStyle} border ${thinkingLevel === level ? 'border-amber-400 bg-amber-400/10 text-amber-200' : 'border-zinc-700 bg-zinc-950 text-zinc-300'} capitalize`}>
                    {level}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-500">{canThink ? 'Applied using this model’s supported reasoning parameter.' : 'This model does not expose a thinking-level parameter; choose a reasoning-capable model to enable it.'}</p>
            </fieldset>

            <p className="text-[11px] leading-relaxed text-zinc-400">
              {PROVIDER_CAPABILITIES[provider].image && PROVIDER_CAPABILITIES[provider].speech
                ? `${provider === 'gemini' ? 'Gemini' : 'OpenAI'} supports text, image, and speech generation with this provider's saved key.`
                : `${provider} supports text generation only. Select Gemini or OpenAI for image and speech; SceneCraft will not switch providers automatically.`}
            </p>

            <div className="flex items-center gap-2 border-t border-zinc-800 pt-4 text-[11px] text-zinc-500">
              <Eye className="h-3.5 w-3.5 shrink-0" /> Keys are never saved in project data, browser storage, or URLs. {settings?.keyPersistenceAvailable ? 'Server-side backups use authenticated encryption.' : 'Configure SCENECRAFT_KEY_ENCRYPTION_KEY to keep web keys after a restart.'}
            </div>
          </>}
          {error && <p role="alert" className="rounded border border-red-900 bg-red-950/50 px-3 py-2 text-xs text-red-300">{error}</p>}
          {notice && <p role="status" className="rounded border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">{notice}</p>}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 bg-zinc-950/50 px-5 py-3 sm:px-6">
          <button type="button" onClick={handleRemove} disabled={busy || (!savedForProvider && !envKeyForProvider)} title="Remove the saved key for this provider" className={`${buttonStyle} text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100`}><Trash2 className="h-3.5 w-3.5" />Remove key</button>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={handleTest} disabled={busy || (!apiKey.trim() && !savedForProvider && !envKeyForProvider)} className={`${buttonStyle} border border-zinc-700 text-zinc-200 hover:bg-zinc-800`}>{busyAction === 'testing' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}{busyAction === 'testing' ? 'Testing…' : 'Test key'}</button>
            <button type="button" onClick={handleSave} disabled={busy || !settings} className={`${buttonStyle} bg-amber-400 text-zinc-950 hover:bg-amber-300`}>{busyAction === 'saving' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}{busyAction === 'saving' ? 'Saving…' : 'Save settings'}</button>
          </div>
        </footer>
      </section>
    </div>
  );
};

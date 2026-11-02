import { Project, ScriptSection, ScriptVersion } from '../types';

const MAX_SCRIPT_VERSIONS = 50;
const EDIT_COALESCE_MS = 1200;

export function appendScriptVersion(
  project: Project,
  script: ScriptSection,
  label = 'Edit',
  now = new Date()
): Pick<Project, 'scriptHistory' | 'scriptHistoryIndex'> {
  const history = project.scriptHistory?.length
    ? project.scriptHistory.slice(0, (project.scriptHistoryIndex ?? project.scriptHistory.length - 1) + 1)
    : [{ script: project.script, savedAt: now.toISOString(), label: 'Current draft' }];
  const last = history[history.length - 1];
  const shouldCoalesce = label === 'Edit' && last?.label === 'Edit' &&
    now.getTime() - Date.parse(last.savedAt) < EDIT_COALESCE_MS;
  const version: ScriptVersion = { script, savedAt: now.toISOString(), label };
  if (shouldCoalesce) history[history.length - 1] = version;
  else history.push(version);
  const boundedHistory = history.slice(-MAX_SCRIPT_VERSIONS);
  return {
    scriptHistory: boundedHistory,
    scriptHistoryIndex: boundedHistory.length - 1,
  };
}

export function restoreScriptVersion(
  project: Project,
  index: number
): Pick<Project, 'script' | 'scriptHistoryIndex'> | null {
  const history = project.scriptHistory || [];
  if (!Number.isInteger(index) || index < 0 || index >= history.length) return null;
  return { script: history[index].script, scriptHistoryIndex: index };
}

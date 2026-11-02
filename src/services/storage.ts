/**
 * Project persistence with IndexedDB for media-heavy projects and a legacy
 * localStorage fallback for browsers or test environments without IndexedDB.
 */

import { Project, ProjectMetadata } from '../types';
import { DEMO_PROJECT_SIGNAL } from '../utils/sampleData';
import { normalizeProject } from '../utils/projectBackup';

const STORAGE_KEY_PREFIX = 'scenecraft_proj_';
const RECENT_LIST_KEY = 'scenecraft_recent_ids';
const ACTIVE_PROJECT_KEY = 'scenecraft_active_id';
const STORAGE_SCHEMA_VERSION = 1;
const DATABASE_NAME = 'scenecraft-projects';
const DATABASE_VERSION = 2;
const PROJECTS_STORE = 'projects';
const METADATA_STORE = 'metadata';
const VIDEOS_STORE = 'videos';
const MIGRATION_KEY = 'legacy-local-storage-migrated-v1';

interface StoredProject {
  id: string;
  format: 'scenecraft-local-project';
  version: number;
  project: Project;
}

function decodeStoredProject(raw: string): Project {
  const parsed: unknown = JSON.parse(raw);
  if (parsed && typeof parsed === 'object' && 'format' in parsed) {
    const stored = parsed as { format?: unknown; version?: unknown; project?: unknown };
    if (stored.format !== 'scenecraft-local-project' || stored.version !== STORAGE_SCHEMA_VERSION) {
      throw new Error('This locally saved project uses an unsupported format.');
    }
    return normalizeProject(stored.project);
  }
  return normalizeProject(parsed);
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Project storage transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Project storage transaction was aborted.'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Project storage request failed.'));
  });
}

let databasePromise: Promise<IDBDatabase | null> | null = null;

async function migrateLegacyProjects(database: IDBDatabase): Promise<void> {
  const check = database.transaction(METADATA_STORE, 'readonly');
  const migrated = await requestResult(check.objectStore(METADATA_STORE).get(MIGRATION_KEY));
  if (migrated) return;

  const localRecords: Array<{ key: string; project: Project }> = [];
  const keysToRemove: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(STORAGE_KEY_PREFIX)) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      localRecords.push({ key, project: decodeStoredProject(raw) });
      keysToRemove.push(key);
    } catch {
      // Keep damaged records in place so migration never destroys recoverable data.
    }
  }

  const transaction = database.transaction([PROJECTS_STORE, METADATA_STORE], 'readwrite');
  const projectStore = transaction.objectStore(PROJECTS_STORE);
  for (const record of localRecords) {
    const stored: StoredProject = {
      id: record.project.metadata.id,
      format: 'scenecraft-local-project',
      version: STORAGE_SCHEMA_VERSION,
      project: record.project,
    };
    projectStore.put(stored);
  }
  transaction.objectStore(METADATA_STORE).put(true, MIGRATION_KEY);
  await transactionDone(transaction);
  for (const key of keysToRemove) localStorage.removeItem(key);
}

function getDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PROJECTS_STORE)) {
          database.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(METADATA_STORE)) {
          database.createObjectStore(METADATA_STORE);
        }
        if (!database.objectStoreNames.contains(VIDEOS_STORE)) {
          const videos = database.createObjectStore(VIDEOS_STORE, { keyPath: 'assetId' });
          videos.createIndex('projectId', 'projectId', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open project storage.'));
      request.onblocked = () => reject(new Error('Project storage is blocked by another open SceneCraft tab.'));
    }).then(async (database) => {
      await migrateLegacyProjects(database);
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      return database;
    }).catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

function getLegacyProjectIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_LIST_KEY);
    let listed: string[] = [];
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) listed = parsed;
      } catch {
        // The project records are still scanned below.
      }
    }
    const recovered: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) recovered.push(key.slice(STORAGE_KEY_PREFIX.length));
    }
    return [...new Set([...listed, ...recovered])];
  } catch {
    return [];
  }
}

function updateRecentIds(id: string): void {
  try {
    const recent = getLegacyProjectIds().filter((recentId) => recentId !== id);
    recent.unshift(id);
    localStorage.setItem(RECENT_LIST_KEY, JSON.stringify(recent.slice(0, 100)));
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  } catch {
    throw new Error('The project was saved, but its active selection could not be updated.');
  }
}

async function listStoredProjects(database: IDBDatabase): Promise<Project[]> {
  const transaction = database.transaction(PROJECTS_STORE, 'readonly');
  const values = await requestResult(transaction.objectStore(PROJECTS_STORE).getAll());
  return values.flatMap((value: unknown) => {
    try {
      if (!value || typeof value !== 'object' || !('project' in value)) return [];
      return [normalizeProject((value as StoredProject).project)];
    } catch {
      return [];
    }
  });
}

export async function getAllProjectIds(): Promise<string[]> {
  const database = await getDatabase();
  if (!database) return getLegacyProjectIds();
  const projects = await listStoredProjects(database);
  return [...new Set([...getLegacyProjectIds(), ...projects.map((project) => project.metadata.id)])];
}

export async function saveProjectLocal(project: Project): Promise<Project> {
  try {
    const normalized = normalizeProject(project);
    const updated: Project = {
      ...normalized,
      metadata: {
        ...normalized.metadata,
        updatedAt: new Date().toISOString(),
      },
    };
    const database = await getDatabase();
    if (!database) {
      const envelope: StoredProject = {
        id: updated.metadata.id,
        format: 'scenecraft-local-project',
        version: STORAGE_SCHEMA_VERSION,
        project: updated,
      };
      localStorage.setItem(STORAGE_KEY_PREFIX + updated.metadata.id, JSON.stringify(envelope));
    } else {
      const transaction = database.transaction([PROJECTS_STORE, VIDEOS_STORE], 'readwrite');
      transaction.objectStore(PROJECTS_STORE).put({
        id: updated.metadata.id,
        format: 'scenecraft-local-project',
        version: STORAGE_SCHEMA_VERSION,
        project: updated,
      } satisfies StoredProject);
      const projectId = updated.metadata.id;
      const currentAssetId = updated.assembledVideoAssetId;
      const videoStore = transaction.objectStore(VIDEOS_STORE);
      const assetKeys = videoStore.index('projectId').getAllKeys(projectId);
      assetKeys.onsuccess = () => {
        for (const assetId of assetKeys.result) {
          if (assetId !== currentAssetId) videoStore.delete(assetId);
        }
      };
      await transactionDone(transaction);
      localStorage.removeItem(STORAGE_KEY_PREFIX + updated.metadata.id);
    }
    updateRecentIds(updated.metadata.id);
    return updated;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('The project was saved,')) throw error;
    throw new Error(
      'Could not save this project to browser storage. Check browser storage availability and export a project backup before retrying.'
    );
  }
}

export async function loadProjectLocal(id: string): Promise<Project | null> {
  if (id === DEMO_PROJECT_SIGNAL.metadata.id) {
    try {
      const demo = localStorage.getItem(STORAGE_KEY_PREFIX + id);
      if (demo) return decodeStoredProject(demo);
    } catch {
      // Use the immutable sample project if its optional local copy is damaged.
    }
  }
  const database = await getDatabase();
  if (database) {
    const transaction = database.transaction(PROJECTS_STORE, 'readonly');
    const stored = await requestResult(transaction.objectStore(PROJECTS_STORE).get(id)) as StoredProject | undefined;
    if (stored) return normalizeProject(stored.project);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + id);
    return raw ? decodeStoredProject(raw) : id === DEMO_PROJECT_SIGNAL.metadata.id ? DEMO_PROJECT_SIGNAL : null;
  } catch {
    return null;
  }
}

export async function listAllProjects(): Promise<ProjectMetadata[]> {
  const database = await getDatabase();
  const ids = await getAllProjectIds();
  const projects = database ? await listStoredProjects(database) : [];
  const projectById = new Map(projects.map((project) => [project.metadata.id, project]));

  for (const id of ids) {
    if (projectById.has(id)) continue;
    const legacy = loadLegacyProject(id);
    if (legacy) projectById.set(id, legacy);
  }

  if (!projectById.has(DEMO_PROJECT_SIGNAL.metadata.id)) {
    projectById.set(DEMO_PROJECT_SIGNAL.metadata.id, DEMO_PROJECT_SIGNAL);
  }
  return [...projectById.values()]
    .map((project) => project.metadata)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function loadLegacyProject(id: string): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + id);
    return raw ? decodeStoredProject(raw) : null;
  } catch {
    return null;
  }
}

export async function deleteProjectLocal(id: string): Promise<void> {
  const database = await getDatabase();
  if (database) {
    const transaction = database.transaction([PROJECTS_STORE, VIDEOS_STORE], 'readwrite');
    transaction.objectStore(PROJECTS_STORE).delete(id);
    const videoStore = transaction.objectStore(VIDEOS_STORE);
    const assetKeys = videoStore.index('projectId').getAllKeys(id);
    assetKeys.onsuccess = () => assetKeys.result.forEach((assetId) => videoStore.delete(assetId));
    await transactionDone(transaction);
  }
  localStorage.removeItem(STORAGE_KEY_PREFIX + id);
  try {
    const list = getLegacyProjectIds().filter((item) => item !== id);
    localStorage.setItem(RECENT_LIST_KEY, JSON.stringify(list));
    if (localStorage.getItem(ACTIVE_PROJECT_KEY) === id) localStorage.removeItem(ACTIVE_PROJECT_KEY);
  } catch {
    throw new Error('The project was deleted, but its recent-project metadata could not be updated.');
  }
}

export async function saveProjectVideo(projectId: string, blob: Blob): Promise<string> {
  if (!/^video\/(?:webm|mp4)(?:;|$)/.test(blob.type) || blob.size === 0) {
    throw new Error('Only non-empty WebM or MP4 video files can be stored in a project.');
  }
  const database = await getDatabase();
  if (!database) {
    throw new Error('This browser does not support persistent video storage. Download the rendered video before leaving this page.');
  }
  const transaction = database.transaction(VIDEOS_STORE, 'readwrite');
  const assetId = `${projectId}-${crypto.randomUUID()}`;
  transaction.objectStore(VIDEOS_STORE).put({
    assetId,
    projectId,
    blob,
    mimeType: blob.type,
    updatedAt: new Date().toISOString(),
  });
  await transactionDone(transaction);
  return assetId;
}

export async function loadProjectVideo(assetId: string): Promise<Blob | null> {
  const database = await getDatabase();
  if (!database) return null;
  const transaction = database.transaction(VIDEOS_STORE, 'readonly');
  const stored = await requestResult(transaction.objectStore(VIDEOS_STORE).get(assetId)) as
    { blob?: unknown; mimeType?: unknown } | undefined;
  return stored?.blob instanceof Blob && typeof stored.mimeType === 'string'
    ? stored.blob
    : null;
}

export async function deleteProjectVideo(assetId: string): Promise<void> {
  const database = await getDatabase();
  if (!database) return;
  const transaction = database.transaction(VIDEOS_STORE, 'readwrite');
  transaction.objectStore(VIDEOS_STORE).delete(assetId);
  await transactionDone(transaction);
}

export function getActiveProjectId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function setActiveProjectId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  } catch {
    throw new Error('Could not update the active project in browser storage.');
  }
}

export async function createNewBlankProject(partial?: Partial<ProjectMetadata>): Promise<Project> {
  const now = new Date().toISOString();
  const id = 'proj_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

  const metadata: ProjectMetadata = {
    id,
    title: partial?.title || 'Untitled Project',
    idea: partial?.idea || '',
    contentType: partial?.contentType || 'short_film',
    targetDurationMinutes: partial?.targetDurationMinutes || 3,
    tone: partial?.tone || 'Cinematic, engaging, character-driven',
    targetAudience: partial?.targetAudience || 'General Audience',
    language: partial?.language || 'English',
    visualStyle: partial?.visualStyle || 'Cinematic 35mm film, atmospheric lighting, rich textures',
    aspectRatio: partial?.aspectRatio || '16:9',
    createdAt: now,
    updatedAt: now,
    isDemo: false,
  };

  const project: Project = {
    metadata,
    script: { title: metadata.title, logline: '', synopsis: '', fullScript: '' },
    bible: { visualTheme: metadata.visualStyle, characters: [], locations: [], props: [] },
    scenes: [],
    currentStage: 'project',
    completedStages: ['project'],
  };

  return saveProjectLocal(project);
}

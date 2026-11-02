import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createNewBlankProject,
  getActiveProjectId,
  getAllProjectIds,
  loadProjectLocal,
  saveProjectLocal,
} from '../src/services/storage';
import { DEMO_PROJECT_SIGNAL } from '../src/utils/sampleData';
import { Project } from '../src/types';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  failWrites = false;

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException('Storage is full', 'QuotaExceededError');
    this.values.set(key, String(value));
  }
}

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let storage = new MemoryStorage();

function installStorage() {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });
}

afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('Project storage', () => {
  it('creates, saves, and restores a project with a versioned schema and active selection', async () => {
    installStorage();
    const project = await createNewBlankProject({ title: 'Recovery test' });
    const savedEnvelope = JSON.parse(storage.getItem(`scenecraft_proj_${project.metadata.id}`)!);

    assert.equal(savedEnvelope.format, 'scenecraft-local-project');
    assert.equal(savedEnvelope.version, 1);
    assert.equal(getActiveProjectId(), project.metadata.id);
    assert.equal((await loadProjectLocal(project.metadata.id))?.metadata.title, 'Recovery test');
  });

  it('recovers the project list by scanning stored project records if the recent list is damaged', async () => {
    installStorage();
    const project = await createNewBlankProject({ title: 'Recover listed project' });
    storage.setItem('scenecraft_recent_ids', '{broken');

    assert.ok((await getAllProjectIds()).includes(project.metadata.id));
  });

  it('preserves project data and reports browser storage failures instead of reporting success', async () => {
    installStorage();
    storage.failWrites = true;
    const project = structuredClone(DEMO_PROJECT_SIGNAL) as Project;

    await assert.rejects(saveProjectLocal(project), /Could not save this project to browser storage/);
  });
});

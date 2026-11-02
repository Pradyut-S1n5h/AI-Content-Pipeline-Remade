import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import {
  deleteProjectLocal,
  getAllProjectIds,
  listAllProjects,
  loadProjectLocal,
  loadProjectVideo,
  saveProjectLocal,
  saveProjectVideo,
} from '../src/services/storage';
import { DEMO_PROJECT_SIGNAL } from '../src/utils/sampleData';
import { Project } from '../src/types';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');

afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
  if (originalIndexedDb) Object.defineProperty(globalThis, 'indexedDB', originalIndexedDb);
  else Reflect.deleteProperty(globalThis, 'indexedDB');
});

describe('IndexedDB project repository', () => {
  it('migrates existing projects, stores media outside localStorage, and supports project lifecycle', async () => {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });

    const legacy = structuredClone(DEMO_PROJECT_SIGNAL) as Project;
    legacy.metadata.id = 'proj_legacy_migration_test';
    legacy.metadata.title = 'Legacy media project';
    storage.setItem(`scenecraft_proj_${legacy.metadata.id}`, JSON.stringify({
      format: 'scenecraft-local-project',
      version: 1,
      project: legacy,
    }));

    const migrated = await loadProjectLocal(legacy.metadata.id);
    assert.equal(migrated?.metadata.title, 'Legacy media project');
    assert.equal(storage.getItem(`scenecraft_proj_${legacy.metadata.id}`), null);

    const withLargeImage = structuredClone(legacy);
    withLargeImage.scenes[0].imageUrl = `data:image/png;base64,${'A'.repeat(1_500_000)}`;
    const videoBlob = new Blob([new Uint8Array([0, 1, 2, 3])], { type: 'video/webm' });
    const videoAssetId = await saveProjectVideo(legacy.metadata.id, videoBlob);
    withLargeImage.assembledVideoAssetId = videoAssetId;
    await saveProjectLocal(withLargeImage);
    assert.equal(storage.getItem(`scenecraft_proj_${legacy.metadata.id}`), null);
    assert.equal(
      (await loadProjectLocal(legacy.metadata.id))?.scenes[0].imageUrl,
      withLargeImage.scenes[0].imageUrl
    );
    assert.ok((await getAllProjectIds()).includes(legacy.metadata.id));
    assert.ok((await listAllProjects()).some((project) => project.id === legacy.metadata.id));
    assert.deepEqual(await loadProjectVideo(videoAssetId), videoBlob);

    await deleteProjectLocal(legacy.metadata.id);
    assert.equal(await loadProjectLocal(legacy.metadata.id), null);
    assert.equal(await loadProjectVideo(videoAssetId), null);
    assert.equal((await getAllProjectIds()).includes(legacy.metadata.id), false);
  });
});

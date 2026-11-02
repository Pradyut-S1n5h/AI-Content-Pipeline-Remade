import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DEMO_PROJECT_SIGNAL } from '../src/utils/sampleData';
import {
  escapeHtml,
  normalizeProject,
  parseProjectBackup,
  serializeProjectBackup,
} from '../src/utils/projectBackup';
import { pcm16ToWav } from '../src/utils/wav';

describe('Project backup and migration', () => {
  it('round-trips the complete project using a versioned backup envelope', async () => {
    const backup = await serializeProjectBackup(DEMO_PROJECT_SIGNAL);
    const parsed = JSON.parse(backup);

    assert.equal(parsed.format, 'scenecraft-project');
    assert.equal(parsed.version, 1);
    assert.deepEqual(parseProjectBackup(backup), normalizeProject(DEMO_PROJECT_SIGNAL));
  });

  it('imports legacy unversioned project files and supplies missing optional fields', () => {
    const legacy = JSON.parse(JSON.stringify(DEMO_PROJECT_SIGNAL)) as Record<string, unknown>;
    delete legacy.currentStage;
    delete legacy.completedStages;
    delete (legacy.bible as Record<string, unknown>).props;

    const imported = parseProjectBackup(JSON.stringify(legacy));
    assert.equal(imported.currentStage, 'project');
    assert.deepEqual(imported.completedStages, ['project']);
    assert.deepEqual(imported.bible.props, []);
  });

  it('rejects unknown backup versions and malformed project content', () => {
    assert.throws(
      () => parseProjectBackup(JSON.stringify({ format: 'scenecraft-project', version: 99, project: {} })),
      /version is not supported/
    );

    const invalid = structuredClone(DEMO_PROJECT_SIGNAL);
    (invalid.scenes[0] as { sceneNumber: number }).sceneNumber = NaN;
    assert.throws(() => normalizeProject(invalid), /scenes .* invalid/);
  });

  it('escapes user-controlled values before inserting them into printable HTML', () => {
    assert.equal(escapeHtml(`<script src="bad">&'`), '&lt;script src=&quot;bad&quot;&gt;&amp;&#39;');
  });

  it('wraps provider PCM audio in a valid 16-bit WAV container', () => {
    const wav = Buffer.from(pcm16ToWav(new Uint8Array([0, 0, 255, 127]), 24000));

    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.readUInt32LE(24), 24000);
    assert.equal(wav.readUInt32LE(40), 4);
    assert.equal(wav.byteLength, 48);
  });

  it('preserves screenplay history and character reference images in backups', () => {
    const project = structuredClone(DEMO_PROJECT_SIGNAL);
    const reference = 'data:image/png;base64,aGVsbG8=';
    project.bible.characters[0].referenceImages = [reference];
    project.scriptHistory = [
      { script: { ...project.script, synopsis: 'Earlier draft' }, savedAt: '2026-01-01T00:00:00.000Z', label: 'Edit' },
      { script: project.script, savedAt: '2026-01-01T00:00:01.000Z', label: 'Current draft' },
    ];
    project.scriptHistoryIndex = 0;
    project.script = project.scriptHistory[0].script;

    const restored = parseProjectBackup(JSON.stringify({
      format: 'scenecraft-project',
      version: 1,
      project,
    }));

    assert.deepEqual(restored.bible.characters[0].referenceImages, [reference]);
    assert.equal(restored.scriptHistory?.length, 2);
    assert.equal(restored.scriptHistoryIndex, 0);
    assert.equal(restored.script.synopsis, 'Earlier draft');
  });

  it('includes the persisted video blob in the portable project backup', async () => {
    const project = { ...DEMO_PROJECT_SIGNAL, assembledVideoAssetId: 'local-video-id' };
    const video = new Blob([new Uint8Array([0, 1, 2, 3])], { type: 'video/webm' });
    const backup = await serializeProjectBackup(project, video);
    const restored = parseProjectBackup(backup);

    assert.equal(restored.assembledVideoAssetId, 'local-video-id');
    assert.equal(restored.assembledVideoDataUrl, 'data:video/webm;base64,AAECAw==');
  });
});

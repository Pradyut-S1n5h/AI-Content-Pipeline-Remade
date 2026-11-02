import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { appendScriptVersion, restoreScriptVersion } from '../src/utils/scriptHistory';
import { DEMO_PROJECT_SIGNAL } from '../src/utils/sampleData';

describe('Screenplay version history', () => {
  it('coalesces rapid typing into one editable version', () => {
    const first = {
      ...DEMO_PROJECT_SIGNAL,
      scriptHistory: [{
        script: DEMO_PROJECT_SIGNAL.script,
        savedAt: '2026-01-01T00:00:00.000Z',
        label: 'Current draft',
      }],
      scriptHistoryIndex: 0,
    };
    const edited = { ...first.script, fullScript: 'First edit' };
    const once = appendScriptVersion(first, edited, 'Edit', new Date('2026-01-01T00:00:01.000Z'));
    const twice = appendScriptVersion(
      { ...first, ...once, script: edited },
      { ...edited, fullScript: 'Second edit' },
      'Edit',
      new Date('2026-01-01T00:00:02.000Z')
    );

    assert.equal(twice.scriptHistory?.length, 2);
    assert.equal(twice.scriptHistory?.[1].script.fullScript, 'Second edit');
  });

  it('supports undo, redo, and new branches after undo', () => {
    const first = DEMO_PROJECT_SIGNAL;
    const secondScript = { ...first.script, synopsis: 'Version two' };
    const second = {
      ...first,
      script: secondScript,
      ...appendScriptVersion(first, secondScript, 'Rewrote synopsis', new Date('2026-01-01T00:00:01.000Z')),
    };

    const undone = restoreScriptVersion(second, 0);
    assert.equal(undone?.script.synopsis, first.script.synopsis);
    const redone = restoreScriptVersion({ ...second, ...undone }, 1);
    assert.equal(redone?.script.synopsis, 'Version two');

    const branch = appendScriptVersion(
      { ...second, ...undone },
      { ...first.script, title: 'New branch' },
      'Edit',
      new Date('2026-01-01T00:00:03.000Z')
    );
    assert.equal(branch.scriptHistory?.length, 2);
    assert.equal(restoreScriptVersion({ ...second, ...branch }, 2), null);
  });

  it('keeps the most recent fifty versions', () => {
    let project = DEMO_PROJECT_SIGNAL;
    for (let index = 0; index < 55; index += 1) {
      const script = { ...project.script, title: `Title ${index}` };
      project = {
        ...project,
        script,
        ...appendScriptVersion(project, script, `Rewrite ${index}`, new Date(1_000 + index)),
      };
    }

    assert.equal(project.scriptHistory?.length, 50);
    assert.equal(project.scriptHistory?.[49].script.title, 'Title 54');
  });
});

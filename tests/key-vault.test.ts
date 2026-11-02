import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createKeyVault } from '../src/services/keyVault';

let testDirectory = '';

function createTestVault(secret = '11'.repeat(32)) {
  testDirectory = mkdtempSync(path.join(os.tmpdir(), 'scenecraft-key-vault-'));
  return {
    vault: createKeyVault(secret, path.join(testDirectory, 'private', 'keys.json')),
    filePath: path.join(testDirectory, 'private', 'keys.json'),
  };
}

afterEach(() => {
  if (testDirectory) rmSync(testDirectory, { recursive: true, force: true });
  testDirectory = '';
});

describe('Encrypted provider key vault', () => {
  it('restores encrypted provider keys and settings in a new server instance', () => {
    const { vault, filePath } = createTestVault();
    const sessionId = '93b1a3e2-f4cf-4e31-bd6d-2f645d2e04e1';
    vault.save(sessionId, {
      keys: { openai: 'secret-provider-key' },
      settings: { provider: 'openai', model: 'gpt-4.1-mini', thinkingLevel: 'medium' },
    });

    const storedFile = readFileSync(filePath, 'utf8');
    assert.equal(storedFile.includes('secret-provider-key'), false);
    assert.equal(storedFile.includes(sessionId), false);
    assert.deepEqual(
      createKeyVault('11'.repeat(32), filePath).load(sessionId),
      {
        keys: { openai: 'secret-provider-key' },
        settings: { provider: 'openai', model: 'gpt-4.1-mini', thinkingLevel: 'medium' },
      }
    );
  });

  it('rejects vaults that cannot be authenticated with the configured secret', () => {
    const { vault, filePath } = createTestVault();
    const sessionId = '93b1a3e2-f4cf-4e31-bd6d-2f645d2e04e1';
    vault.save(sessionId, { keys: { gemini: 'secret-key' }, settings: {} });

    assert.throws(
      () => createKeyVault('22'.repeat(32), filePath).load(sessionId),
      /Could not decrypt the saved provider settings/
    );
  });

  it('allows session-only key handling without a persistence secret', () => {
    const { filePath } = createTestVault();
    const vault = createKeyVault(undefined, filePath);

    assert.equal(vault.enabled, false);
    assert.equal(vault.load('93b1a3e2-f4cf-4e31-bd6d-2f645d2e04e1'), null);
    assert.doesNotThrow(() => vault.save('93b1a3e2-f4cf-4e31-bd6d-2f645d2e04e1', {
      keys: { gemini: 'session-only' },
      settings: {},
    }));
  });

  it('requires exactly 32 bytes of externally managed encryption key material', () => {
    assert.throws(
      () => createKeyVault('short-key', path.join(os.tmpdir(), 'unused-scenecraft-vault')),
      /exactly 64 hexadecimal characters/
    );
  });
});

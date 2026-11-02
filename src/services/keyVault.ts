import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { AiProvider, ThinkingLevel } from './aiProviders';

const FORMAT = 'scenecraft-key-vault';
const VERSION = 1;
const SESSION_TTL_MS = 30 * 86_400_000;

export interface PersistedSettings {
  provider?: AiProvider;
  model?: string;
  thinkingLevel?: ThinkingLevel;
}

interface VaultPayload {
  keys: Partial<Record<AiProvider, string>>;
  settings: PersistedSettings;
}

interface EncryptedRecord {
  expiresAt: number;
  iv: string;
  tag: string;
  ciphertext: string;
}

interface VaultFile {
  format: typeof FORMAT;
  version: typeof VERSION;
  records: Record<string, EncryptedRecord>;
}

export interface KeyVault {
  readonly enabled: boolean;
  load(sessionId: string): VaultPayload | null;
  save(sessionId: string, payload: VaultPayload): void;
  remove(sessionId: string): void;
}

function parseEncryptionKey(value: string | undefined): Buffer | null {
  if (!value) return null;
  if (!/^[\da-f]{64}$/i.test(value)) {
    throw new Error('SCENECRAFT_KEY_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes).');
  }
  return Buffer.from(value, 'hex');
}

function isProvider(value: unknown): value is AiProvider {
  return value === 'gemini' || value === 'openai' || value === 'anthropic' || value === 'huggingface';
}

function readPayload(value: unknown): VaultPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The encrypted key vault contains an invalid payload.');
  }
  const record = value as Record<string, unknown>;
  if (!record.keys || typeof record.keys !== 'object' || Array.isArray(record.keys) ||
      !record.settings || typeof record.settings !== 'object' || Array.isArray(record.settings)) {
    throw new Error('The encrypted key vault contains an invalid payload.');
  }
  const keys: VaultPayload['keys'] = {};
  for (const [provider, key] of Object.entries(record.keys)) {
    if (!isProvider(provider) || typeof key !== 'string' || !key || key.length > 1024) {
      throw new Error('The encrypted key vault contains invalid provider credentials.');
    }
    keys[provider] = key;
  }
  const settings = record.settings as Record<string, unknown>;
  if ((settings.provider !== undefined && !isProvider(settings.provider)) ||
      (settings.model !== undefined && (typeof settings.model !== 'string' || settings.model.length > 200)) ||
      (settings.thinkingLevel !== undefined &&
        !['low', 'medium', 'high'].includes(settings.thinkingLevel as string))) {
    throw new Error('The encrypted key vault contains invalid settings.');
  }
  return {
    keys,
    settings: {
      ...(isProvider(settings.provider) ? { provider: settings.provider } : {}),
      ...(typeof settings.model === 'string' ? { model: settings.model } : {}),
      ...(typeof settings.thinkingLevel === 'string'
        ? { thinkingLevel: settings.thinkingLevel as ThinkingLevel }
        : {}),
    },
  };
}

export function createKeyVault(
  encryptionKey: string | undefined,
  filePath: string
): KeyVault {
  const key = parseEncryptionKey(encryptionKey);
  const resolvedPath = path.resolve(filePath);

  const readFile = (): VaultFile => {
    try {
      const parsed: unknown = JSON.parse(readFileSync(resolvedPath, 'utf8'));
      if (!parsed || typeof parsed !== 'object' ||
          (parsed as VaultFile).format !== FORMAT ||
          (parsed as VaultFile).version !== VERSION ||
          !(parsed as VaultFile).records ||
          typeof (parsed as VaultFile).records !== 'object') {
        throw new Error('The encrypted key vault has an unsupported or malformed format.');
      }
      return parsed as VaultFile;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return { format: FORMAT, version: VERSION, records: {} };
      }
      throw error;
    }
  };

  const sessionDigest = (sessionId: string) =>
    createHash('sha256').update(sessionId).digest('hex');
  const additionalData = (sessionId: string) =>
    Buffer.from(`${FORMAT}:${VERSION}:${sessionDigest(sessionId)}`);

  const writeFile = (file: VaultFile) => {
    const directory = path.dirname(resolvedPath);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const temporaryPath = `${resolvedPath}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
    let descriptor: number | undefined;
    try {
      descriptor = openSync(temporaryPath, 'wx', 0o600);
      writeFileSync(descriptor, JSON.stringify(file), 'utf8');
      closeSync(descriptor);
      descriptor = undefined;
      renameSync(temporaryPath, resolvedPath);
    } catch (error) {
      if (descriptor !== undefined) closeSync(descriptor);
      try {
        unlinkSync(temporaryPath);
      } catch {
        // Preserve the original filesystem error.
      }
      throw error;
    }
  };

  return {
    enabled: Boolean(key),
    load(sessionId) {
      if (!key) return null;
      const file = readFile();
      const record = file.records[sessionDigest(sessionId)];
      if (!record) return null;
      if (record.expiresAt <= Date.now()) {
        delete file.records[sessionDigest(sessionId)];
        writeFile(file);
        return null;
      }
      try {
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(record.iv, 'base64'));
        decipher.setAAD(additionalData(sessionId));
        decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
        const plaintext = Buffer.concat([
          decipher.update(Buffer.from(record.ciphertext, 'base64')),
          decipher.final(),
        ]).toString('utf8');
        return readPayload(JSON.parse(plaintext));
      } catch {
        throw new Error('Could not decrypt the saved provider settings. Check the key-vault encryption secret and vault file.');
      }
    },
    save(sessionId, payload) {
      if (!key) return;
      const file = readFile();
      const digest = sessionDigest(sessionId);
      const now = Date.now();
      for (const [recordId, record] of Object.entries(file.records)) {
        if (!record || record.expiresAt <= now) delete file.records[recordId];
      }
      const plaintext = Buffer.from(JSON.stringify(readPayload(payload)), 'utf8');
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(additionalData(sessionId));
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      file.records[digest] = {
        expiresAt: now + SESSION_TTL_MS,
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        ciphertext: ciphertext.toString('base64'),
      };
      const oldestRecords = Object.entries(file.records)
        .sort((left, right) => left[1].expiresAt - right[1].expiresAt)
        .slice(0, Math.max(0, Object.keys(file.records).length - 500));
      for (const [recordId] of oldestRecords) delete file.records[recordId];
      writeFile(file);
    },
    remove(sessionId) {
      if (!key) return;
      const file = readFile();
      delete file.records[sessionDigest(sessionId)];
      writeFile(file);
    },
  };
}

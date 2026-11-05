import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const models = JSON.parse(readFileSync(new URL('../local-models.json', import.meta.url), 'utf8')) as Record<string, {
  runtime: string;
  model: string;
  repository: string;
  storageBytes: number;
  hardware: Record<string, unknown>;
}>;

describe('fixed local model configuration', () => {
  it('contains exactly one default model for each generation category', () => {
    assert.deepEqual(Object.keys(models).sort(), ['image', 'video', 'writing']);
    assert.equal(models.writing.model, 'qwen2.5:1.5b');
    assert.equal(models.image.model, 'sd-legacy/stable-diffusion-v1-5');
    assert.equal(models.video.model, 'zai-org/CogVideoX-2b');
    for (const model of Object.values(models)) {
      assert.ok(model.model);
      assert.ok(model.repository.startsWith('https://'));
      assert.ok(model.storageBytes > 0);
      assert.ok(Object.keys(model.hardware).length > 0);
    }
  });

  it('has no external generation SDK dependency or provider credential fields', () => {
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    const sources = [
      readFileSync(new URL('../server.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('../local_ai_worker.py', import.meta.url), 'utf8'),
    ].join('\n');

    assert.equal(packageJson.dependencies['@google/genai'], undefined);
    assert.doesNotMatch(sources, /api\.openai\.com|generativelanguage\.googleapis\.com|api\.anthropic\.com|router\.huggingface\.co/);
    assert.match(sources, /127\.0\.0\.1:11434/);
    assert.match(sources, /127\.0\.0\.1:8765/);
  });
});

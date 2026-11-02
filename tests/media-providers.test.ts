import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AiProviderError, PROVIDER_CAPABILITIES } from '../src/services/aiProviders';
import { generateOpenAiImage, generateOpenAiSpeech } from '../src/services/serverMediaProviders';

describe('Provider media adapters', () => {
  it('advertises only implemented media capabilities', () => {
    assert.deepEqual(PROVIDER_CAPABILITIES.gemini, {
      text: true, image: true, speech: true, referenceImages: true,
    });
    assert.deepEqual(PROVIDER_CAPABILITIES.openai, {
      text: true, image: true, speech: true, referenceImages: true,
    });
    assert.equal(PROVIDER_CAPABILITIES.anthropic.image, false);
    assert.equal(PROVIDER_CAPABILITIES.huggingface.speech, false);
  });

  it('generates OpenAI images through the image model and normalizes base64 output', async () => {
    let requestUrl = '';
    let requestHeaders: Headers | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      requestUrl = String(input);
      requestHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ data: [{ b64_json: 'aGVsbG8=' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const result = await generateOpenAiImage({
      apiKey: 'private-test-key',
      prompt: 'A lighthouse at dawn',
      aspectRatio: '16:9',
      fetchImpl,
    });

    assert.equal(requestUrl, 'https://api.openai.com/v1/images/generations');
    assert.equal(requestHeaders?.get('authorization'), 'Bearer private-test-key');
    assert.equal(requestUrl.includes('private-test-key'), false);
    assert.equal(result.imageUrl, 'data:image/png;base64,aGVsbG8=');
    assert.equal(result.mimeType, 'image/png');
  });

  it('sends supported reference images to the OpenAI image-edit operation', async () => {
    let form: FormData | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      assert.equal(init?.body instanceof FormData, true);
      form = init?.body as FormData;
      return new Response(JSON.stringify({ data: [{ b64_json: 'aGVsbG8=' }] }), { status: 200 });
    };

    await generateOpenAiImage({
      apiKey: 'private-test-key',
      prompt: 'Keep the character visually consistent',
      aspectRatio: '1:1',
      referenceImages: [{ mimeType: 'image/png', data: 'aGVsbG8=' }],
      fetchImpl,
    });

    assert.equal(form?.get('model'), 'gpt-image-1');
    assert.equal(form?.get('size'), '1024x1024');
    assert.equal(form?.getAll('image[]').length, 1);
  });

  it('normalizes OpenAI image authentication failures without exposing credentials', async () => {
    const fetchImpl: typeof fetch = async () => new Response(
      JSON.stringify({ error: { message: 'invalid api key private-test-key' } }),
      { status: 401 }
    );

    await assert.rejects(
      generateOpenAiImage({
        apiKey: 'private-test-key',
        prompt: 'A test image',
        aspectRatio: '1:1',
        fetchImpl,
      }),
      (error: unknown) => error instanceof AiProviderError &&
        error.code === 'invalid_key' && !error.message.includes('private-test-key')
    );
  });

  it('returns a validated WAV data URI and duration for OpenAI speech', async () => {
    const wav = Buffer.alloc(48);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(40, 4);
    wav.write('WAVE', 8);
    wav.writeUInt32LE(8, 28);
    wav.writeUInt32LE(4, 40);
    const fetchImpl: typeof fetch = async (_input, init) => {
      const request = JSON.parse(String(init?.body));
      assert.equal(request.model, 'gpt-4o-mini-tts');
      assert.equal(request.voice, 'alloy');
      return new Response(wav, { status: 200 });
    };

    const result = await generateOpenAiSpeech({
      apiKey: 'private-test-key',
      text: 'Hello there.',
      voice: 'alloy',
      fetchImpl,
    });

    assert.match(result.audioUrl, /^data:audio\/wav;base64,/);
    assert.equal(result.duration, 0.5);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AiProviderError,
  generateText,
  listProviderModels,
  modelSupportsThinking,
  testProviderKey,
  validateJsonSchema,
  validateModel,
} from '../src/services/aiProviders';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const baseRequest = {
  provider: 'gemini' as const,
  apiKey: 'test-secret-not-for-urls',
  model: 'gemini-2.5-flash',
  thinkingLevel: 'medium' as const,
  prompt: 'Write one sentence.',
};

describe('AI provider adapters', () => {
  it('rejects missing keys and provider/model mismatches before making requests', async () => {
    await assert.rejects(
      generateText({ ...baseRequest, apiKey: '' }),
      (error: unknown) => error instanceof AiProviderError && error.code === 'missing_key'
    );
    await assert.rejects(
      generateText({ ...baseRequest, provider: 'openai', model: 'gemini-2.5-flash' }),
      (error: unknown) => error instanceof AiProviderError && error.code === 'unsupported_model'
    );
    assert.equal(validateModel('gemini', 'gemini-2.5-pro'), true);
    assert.equal(validateModel('openai', 'gemini-2.5-pro'), false);
  });

  it('applies Low, Medium, and High thinking budgets to Gemini requests', async () => {
    const actualBudgets: number[] = [];
    for (const [thinkingLevel, expected] of [['low', 1024], ['medium', 8192], ['high', 24576]] as const) {
      const fetchImpl: typeof fetch = async (_input, init) => {
        const request = JSON.parse(String(init?.body));
        actualBudgets.push(request.generationConfig.thinkingConfig.thinkingBudget);
        return jsonResponse({ candidates: [{ content: { parts: [{ text: 'Done.' }] } }] });
      };
      await generateText({ ...baseRequest, thinkingLevel, fetchImpl });
      assert.equal(actualBudgets.at(-1), expected);
    }
  });

  it('uses compatible OpenAI models and only sends reasoning effort when supported', async () => {
    let captured: Record<string, any> | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      captured = JSON.parse(String(init?.body));
      return jsonResponse({ choices: [{ message: { content: 'Done.' }, finish_reason: 'stop' }] });
    };
    assert.equal(modelSupportsThinking('openai', 'gpt-4.1-mini'), false);
    await generateText({
      provider: 'openai', apiKey: 'secret', model: 'gpt-4.1-mini',
      thinkingLevel: 'high', prompt: 'Hello', fetchImpl,
    });
    assert.equal(captured?.model, 'gpt-4.1-mini');
    assert.equal('reasoning_effort' in (captured || {}), false);
    await generateText({
      provider: 'openai', apiKey: 'secret', model: 'o4-mini',
      thinkingLevel: 'high', prompt: 'Hello', fetchImpl,
    });
    assert.equal(captured?.reasoning_effort, 'high');
  });

  it('keeps credentials in headers, never URLs or response content', async () => {
    let requestedUrl = '';
    let sentHeaders: HeadersInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      requestedUrl = String(input);
      sentHeaders = init?.headers;
      return jsonResponse({ candidates: [{ content: { parts: [{ text: 'Done.' }] } }] });
    };
    await generateText({ ...baseRequest, fetchImpl });
    assert.equal(requestedUrl.includes(baseRequest.apiKey), false);
    assert.equal(new Headers(sentHeaders).get('x-goog-api-key'), baseRequest.apiKey);
  });

  it('does not retry invalid keys or quota/rate-limit responses', async () => {
    for (const [status, body, expectedCode] of [
      [401, { error: { message: 'invalid key' } }, 'invalid_key'],
      [429, { error: { message: 'quota exceeded' } }, 'quota_exceeded'],
      [429, { error: { message: 'rate limit' } }, 'rate_limited'],
    ] as const) {
      let calls = 0;
      const fetchImpl: typeof fetch = async () => {
        calls += 1;
        return jsonResponse(body, status);
      };
      await assert.rejects(
        generateText({ ...baseRequest, fetchImpl }),
        (error: unknown) => error instanceof AiProviderError && error.code === expectedCode
      );
      assert.equal(calls, 1);
    }
  });

  it('retries transient provider errors within the bound and reports outages safely', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return calls < 2
        ? jsonResponse({ error: { message: 'internal details are not surfaced' } }, 503)
        : jsonResponse({ candidates: [{ content: { parts: [{ text: 'Recovered.' }] } }] });
    };
    assert.equal(await generateText({ ...baseRequest, fetchImpl }), 'Recovered.');
    assert.equal(calls, 2);

    const outageFetch: typeof fetch = async () => jsonResponse({}, 503);
    await assert.rejects(
      generateText({ ...baseRequest, fetchImpl: outageFetch }),
      (error: unknown) => error instanceof AiProviderError && error.code === 'service_unavailable'
    );
  });

  it('validates structured output and reports malformed or empty responses', async () => {
    const schema = { type: 'OBJECT', properties: { title: { type: 'STRING' } }, required: ['title'] };
    assert.equal(validateJsonSchema({ title: 'Valid' }, schema), true);
    assert.equal(validateJsonSchema({ title: 1 }, schema), false);
    const malformedFetch: typeof fetch = async () => new Response('{', { status: 200 });
    await assert.rejects(
      generateText({ ...baseRequest, fetchImpl: malformedFetch }),
      (error: unknown) => error instanceof AiProviderError && error.code === 'malformed_response'
    );
    const emptyFetch: typeof fetch = async () => jsonResponse({ candidates: [] });
    await assert.rejects(
      generateText({ ...baseRequest, fetchImpl: emptyFetch }),
      (error: unknown) => error instanceof AiProviderError && error.code === 'empty_response'
    );
  });

  it('reports provider-truncated responses instead of returning partial content', async () => {
    const truncatedGemini: typeof fetch = async () => jsonResponse({
      candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"title":' }] } }],
    });
    await assert.rejects(
      generateText({ ...baseRequest, fetchImpl: truncatedGemini }),
      (error: unknown) => error instanceof AiProviderError && error.code === 'truncated_response'
    );
    const truncatedOpenAI: typeof fetch = async () => jsonResponse({
      choices: [{ finish_reason: 'length', message: { content: '{"title":' } }],
    });
    await assert.rejects(
      generateText({
        provider: 'openai', apiKey: 'secret', model: 'gpt-4.1-mini',
        thinkingLevel: 'medium', prompt: 'Write JSON.', fetchImpl: truncatedOpenAI,
      }),
      (error: unknown) => error instanceof AiProviderError && error.code === 'truncated_response'
    );
  });

  it('tests credentials through the provider model-list endpoint without generation', async () => {
    let url = '';
    let method = '';
    const fetchImpl: typeof fetch = async (input, init) => {
      url = String(input);
      method = String(init?.method);
      return jsonResponse({ models: [] });
    };
    await testProviderKey('gemini', 'secret', fetchImpl);
    assert.equal(method, 'GET');
    assert.match(url, /\/models\?pageSize=1$/);
    assert.equal(url.includes('secret'), false);
  });

  it('discovers enabled Gemini text models, including newer releases, from the provider catalog', async () => {
    const fetchImpl: typeof fetch = async () => jsonResponse({
      models: [
        { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-2.5-flash-image', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
      ],
    });
    const models = await listProviderModels('gemini', 'secret', fetchImpl);
    assert.ok(models.some((model) => model.id === 'gemini-3.8-flash'));
    assert.ok(!models.some((model) => model.id === 'gemini-2.5-flash-image'));
    assert.ok(!models.some((model) => model.id === 'gemini-embedding-001'));
    assert.equal(models.find((model) => model.id === 'gemini-3.8-flash')?.supportsThinking, false);
  });

  it('uses a newly discovered Gemini model only when its ID is allowlisted', async () => {
    let requestedModel = '';
    const fetchImpl: typeof fetch = async (input) => {
      requestedModel = String(input);
      return jsonResponse({ candidates: [{ content: { parts: [{ text: 'Generated.' }] } }] });
    };
    await assert.rejects(
      generateText({ ...baseRequest, model: 'gemini-3.8-flash', fetchImpl }),
      (error: unknown) => error instanceof AiProviderError && error.code === 'unsupported_model'
    );
    assert.equal(requestedModel, '');
    assert.equal(await generateText({
      ...baseRequest,
      model: 'gemini-3.8-flash',
      allowedModels: ['gemini-3.8-flash'],
      fetchImpl,
    }), 'Generated.');
    assert.match(requestedModel, /models\/gemini-3\.8-flash:generateContent$/);
  });
});

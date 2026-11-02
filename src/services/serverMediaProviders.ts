import { AiProviderError, errorForStatus, readResponseBody, requestWithRetry } from './aiProviders';

export interface ImageReferenceData {
  mimeType: string;
  data: string;
}

export interface GeneratedImage {
  imageUrl: string;
  mimeType: string;
}

export interface GeneratedSpeech {
  audioUrl: string;
  duration: number;
}

export async function generateOpenAiImage(options: {
  apiKey: string;
  prompt: string;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
  referenceImages?: ImageReferenceData[];
  fetchImpl?: typeof fetch;
}): Promise<GeneratedImage> {
  const landscape = options.aspectRatio === '16:9' || options.aspectRatio === '4:3';
  const size = options.aspectRatio === '1:1' ? '1024x1024' : landscape ? '1536x1024' : '1024x1536';
  const prompt = `${options.prompt}\nCompose the image in ${options.aspectRatio} ${landscape ? 'landscape' : 'portrait'} framing.`;
  const references = options.referenceImages || [];
  let endpoint = 'https://api.openai.com/v1/images/generations';
  let requestBody: BodyInit;
  const headers: Record<string, string> = { Authorization: `Bearer ${options.apiKey}` };

  if (references.length > 0) {
    endpoint = 'https://api.openai.com/v1/images/edits';
    const form = new FormData();
    form.set('model', 'gpt-image-1');
    form.set('prompt', prompt);
    form.set('size', size);
    form.set('quality', 'medium');
    references.forEach((image, index) => {
      const bytes = new Uint8Array(Buffer.from(image.data, 'base64'));
      form.append(
        'image[]',
        new Blob([bytes], { type: image.mimeType }),
        `reference-${index + 1}.${image.mimeType.split('/')[1]}`
      );
    });
    requestBody = form;
  } else {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size,
      quality: 'medium',
    });
  }

  const response = await requestWithRetry(endpoint, {
    method: 'POST',
    headers,
    body: requestBody,
  }, 'openai', options.fetchImpl || fetch);
  if (!response.ok) throw errorForStatus(response.status, 'openai', await readResponseBody(response));

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AiProviderError('OpenAI returned a malformed image response. Try again.', 502, 'malformed_response');
  }
  const image = payload && typeof payload === 'object' && 'data' in payload &&
    Array.isArray(payload.data) ? payload.data[0] : undefined;
  if (!image || typeof image !== 'object' || !('b64_json' in image) ||
      typeof image.b64_json !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.b64_json)) {
    throw new AiProviderError('OpenAI did not return usable image data. Check model access and try again.', 502, 'malformed_media_response');
  }
  return { imageUrl: `data:image/png;base64,${image.b64_json}`, mimeType: 'image/png' };
}

export async function generateOpenAiSpeech(options: {
  apiKey: string;
  text: string;
  voice: string;
  speakerRole?: string;
  fetchImpl?: typeof fetch;
}): Promise<GeneratedSpeech> {
  const response = await requestWithRetry('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: options.voice,
      input: options.text,
      response_format: 'wav',
      ...(options.speakerRole
        ? { instructions: `Deliver this as cinematic speech for the role: ${options.speakerRole}.` }
        : {}),
    }),
  }, 'openai', options.fetchImpl || fetch);
  if (!response.ok) throw errorForStatus(response.status, 'openai', await readResponseBody(response));

  let timeout: ReturnType<typeof setTimeout> | undefined;
  let audio: Buffer;
  try {
    const data = await Promise.race([
      response.arrayBuffer(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          void response.body?.cancel();
          reject(new AiProviderError('The provider timed out while returning speech.', 504, 'timeout'));
        }, 90_000);
      }),
    ]);
    audio = Buffer.from(data);
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  if (audio.length < 44 || audio.subarray(0, 4).toString('ascii') !== 'RIFF' ||
      audio.subarray(8, 12).toString('ascii') !== 'WAVE') {
    throw new AiProviderError('OpenAI returned audio in an unsupported format.', 502, 'unsupported_audio_format');
  }
  const byteRate = audio.readUInt32LE(28);
  const dataSize = audio.readUInt32LE(40);
  if (!byteRate || dataSize > audio.length - 44) {
    throw new AiProviderError('OpenAI returned a malformed WAV audio file.', 502, 'malformed_media_response');
  }
  return {
    audioUrl: `data:audio/wav;base64,${audio.toString('base64')}`,
    duration: dataSize / byteRate,
  };
}

export function pcm16ToWav(pcm: Uint8Array, sampleRate: number, channels = 1): Uint8Array {
  if (!Number.isInteger(sampleRate) || sampleRate <= 0 ||
      !Number.isInteger(channels) || channels <= 0 || pcm.byteLength % 2 !== 0) {
    throw new Error('PCM audio must have a valid sample rate, channel count, and 16-bit sample length.');
  }

  const bitsPerSample = 16;
  const blockAlign = channels * bitsPerSample / 8;
  const wav = Buffer.alloc(44 + pcm.byteLength);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + pcm.byteLength, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * blockAlign, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bitsPerSample, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(pcm.byteLength, 40);
  Buffer.from(pcm).copy(wav, 44);
  return new Uint8Array(wav);
}

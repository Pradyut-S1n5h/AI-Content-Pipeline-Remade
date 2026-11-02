import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectSupportedVideoMimeType } from '../src/utils/videoRenderer';

describe('Browser video encoder capability selection', () => {
  it('prefers MP4 only when the browser reports a supported MP4 MIME type', () => {
    const mimeType = selectSupportedVideoMimeType((candidate) =>
      candidate === 'video/mp4'
    );
    assert.equal(mimeType, 'video/mp4');
  });

  it('falls back to a real supported WebM codec when MP4 is unavailable', () => {
    const mimeType = selectSupportedVideoMimeType((candidate) =>
      candidate === 'video/webm;codecs=vp8'
    );
    assert.equal(mimeType, 'video/webm;codecs=vp8');
  });

  it('reports no encoder when the browser supports neither container', () => {
    assert.equal(selectSupportedVideoMimeType(() => false), null);
  });
});

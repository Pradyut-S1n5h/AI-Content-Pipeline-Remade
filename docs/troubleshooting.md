# SceneCraft Troubleshooting

## AI provider or model errors

- Open **AI Settings**, select the intended provider, and use **Test key**. This checks provider access without generating content. A key saved for one provider remains separate from keys for the other providers.
- Replace an invalid key in Settings. To retain web-entered keys after restart, set `SCENECRAFT_KEY_ENCRYPTION_KEY` to a 32-byte random key encoded as 64 hex characters (generate with `openssl rand -hex 32`) and provide persistent private storage for the encrypted vault.
- Keys stored by the vault expire 30 days after the last settings save. Back up the encryption secret separately; losing/changing it prevents decryption. Without the secret, web keys stay in memory and do not survive restart.
- Refresh the model list after adding a key. The selected model must appear in that provider's catalog for the key; SceneCraft will not silently substitute another model.
- Thinking controls are unavailable for models without an explicit provider mapping.
- `401` means the provider rejected the key; `403` indicates missing access; `429` may mean rate limiting or quota/billing exhaustion. Check provider account limits before retrying.
- Gemini and OpenAI support image and speech generation. Anthropic and Hugging Face are text-only; unsupported operations are disabled, and requests are not routed to another provider.

## Project saving and recovery

- The header distinguishes unsaved changes, saving, saved, and failed saves. Use **Save** for an immediate save.
- Projects and media live in IndexedDB, which has a larger browser-managed quota than localStorage but is still subject to device/browser limits. Export a project backup and remove unused media/projects if the browser reports a quota failure.
- Project data is browser-local. To move it to another browser or device, export the versioned project JSON and import it there. SceneCraft asks before replacing an existing project with the same ID.
- The temporary `blob:` preview URL is recreated from the project's IndexedDB video asset after a refresh. The project backup includes the rendered video.

## Storyboard, audio, and video

- A failed image/audio retry preserves prior successful media. The error appears on that scene and can be retried individually or from the batch action.
- Remote/sample images must remain available and permit cross-origin loading for canvas export. Video rendering reports an asset-load error instead of inserting a blank placeholder.
- Video export requires a browser with Canvas `captureStream`, `MediaRecorder`, and (when audio exists) Web Audio support. SceneCraft uses MP4 only when the browser reports a supported MP4 MIME type; otherwise it selects a supported WebM codec.
- Renders run at 30fps in real time; long timelines take correspondingly longer. Use **Cancel render** to stop a long export. The file extension follows the actual recorded MIME type.
- Audio clips are mixed at their scene boundaries and clipped to the configured scene duration. Check the audio stage if a clip is missing or ends early.

## Development and verification

Run `npm run dev` in Codespaces and check `/api/health` if the UI cannot reach the server. Use `npm test`, `npm run lint`, and `npm run build` for local verification. Automated tests mock provider requests and do not require paid API calls.

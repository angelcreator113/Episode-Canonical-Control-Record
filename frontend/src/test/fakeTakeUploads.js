/**
 * Tests: the upload in parts (lib/rawClipsApi sendInParts) against a mocked
 * services/api. Start answers an upload id, every part is taken, and
 * "complete" answers what `answer(url, form, cfg)` says, where url is the
 * episode's clips URL and form reads the fields the upload started with
 * (form.get('label'), form.get('video').name), as the one-request upload's
 * FormData did. `other(url, body, cfg)` answers any other POST.
 */
import { vi } from 'vitest';

const UPLOADS = /^(\/api\/v1\/episode-clips\/[^/]+)\/uploads(?:\/([^/]+)\/complete)?$/;

/** The started fields read like a FormData. */
export const formOf = (body = {}) => ({
  get: (k) => {
    if (k === 'video') return { name: body.filename, size: body.size, type: body.content_type };
    return body[k] === undefined || body[k] === null ? null : String(body[k]);
  },
});

export function fakeTakeUploads(api, answer, { other } = {}) {
  const starts = [];
  const completes = [];
  const parts = [];
  vi.mocked(api.post).mockImplementation(async (url, body, cfg) => {
    const m = UPLOADS.exec(String(url));
    if (m && !m[2]) {
      starts.push({ url, body, cfg });
      const n = starts.length;
      return { data: { success: true, uploadId: `up-${n}`, clipId: `clip-${n}`, partSize: 8 * 1024 * 1024 } };
    }
    if (m && m[2]) {
      const start = starts[Number(String(m[2]).replace('up-', '')) - 1] || starts[starts.length - 1];
      completes.push({ url, body, cfg });
      return answer(m[1], formOf(start?.body), cfg);
    }
    return other ? other(url, body, cfg) : { data: { data: {} } };
  });
  if (api.put) {
    vi.mocked(api.put).mockImplementation(async (url, data, cfg) => {
      parts.push({ url, data, cfg });
      cfg?.onUploadProgress?.({ loaded: data?.size ?? 0 });
      return { data: { success: true } };
    });
  }
  return {
    starts, completes, parts,
    /** The fields upload `i` started with, read like a FormData. */
    form: (i = 0) => formOf(starts[i]?.body),
  };
}

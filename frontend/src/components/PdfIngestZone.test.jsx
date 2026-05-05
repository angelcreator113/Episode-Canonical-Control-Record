/**
 * PdfIngestZone — Track 6 CP7 behavioral tests (file 5 of 10).
 *
 * 1 multipart-POST fetch site migrated via ingestPdfApi. First multipart
 * upload in F-AUTH-1 — pattern: pass FormData directly to apiClient.post,
 * axios sets Content-Type with multipart boundary automatically.
 */

import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import apiClient from '../services/api';
import { ingestPdfApi } from './PdfIngestZone';

describe('PdfIngestZone — Track 6 CP7 module-scope helper (multipart)', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('ingestPdfApi POST on /franchise-brain/ingest-pdf with FormData payload', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { entries_created: 12 } });
    const formData = new FormData();
    formData.append('file', new Blob(['fake pdf bytes'], { type: 'application/pdf' }));
    formData.append('brain', 'story');
    formData.append('source_document', 'franchise_bible');
    formData.append('source_version', 'v3.1');

    await ingestPdfApi(formData);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/franchise-brain/ingest-pdf',
      formData,
    );
  });

  test('ingestPdfApi exposes response.data.error for upload UX', async () => {
    const httpErr = new Error('payload too large');
    httpErr.response = { status: 413, data: { error: 'file too big' } };
    vi.mocked(apiClient.post).mockRejectedValue(httpErr);
    await expect(ingestPdfApi(new FormData())).rejects.toMatchObject({
      response: { data: { error: 'file too big' } },
    });
  });
});

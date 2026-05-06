/**
 * TemplateStudio — Track 6 CP10 behavioral tests (file 5 of 8).
 *
 * 6 fetch sites migrated via 6 module-scope helpers on /template-studio/*.
 * publishTemplateApi duplicated locally per v2.12 §9.11 (CP6 TemplateDesigner
 * has it).
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
import {
  listTemplatesApi,
  cloneTemplateApi,
  publishTemplateApi,
  lockTemplateApi,
  archiveTemplateApi,
  deleteTemplateApi,
} from './TemplateStudio';

describe('TemplateStudio — Track 6 CP10 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listTemplatesApi GET on /template-studio without query', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
    await listTemplatesApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/template-studio');
  });

  test('listTemplatesApi GET with status query', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
    await listTemplatesApi('status=PUBLISHED');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/template-studio?status=PUBLISHED');
  });

  test('cloneTemplateApi POST on /template-studio/:id/clone (no body)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { version: 2 } } });
    await cloneTemplateApi('t-1');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/template-studio/t-1/clone');
  });

  test('publishTemplateApi POST on /template-studio/:id/publish (CP6 dup, no body)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await publishTemplateApi('t-1');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/template-studio/t-1/publish');
  });

  test('lockTemplateApi POST on /template-studio/:id/lock (no body)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await lockTemplateApi('t-1');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/template-studio/t-1/lock');
  });

  test('archiveTemplateApi POST on /template-studio/:id/archive (no body)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await archiveTemplateApi('t-1');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/template-studio/t-1/archive');
  });

  test('deleteTemplateApi DELETE on /template-studio/:id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await deleteTemplateApi('t-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/template-studio/t-1');
  });

  describe('Error path propagation', () => {
    test('listTemplatesApi exposes response.data.message for UX', async () => {
      const httpErr = new Error('forbidden');
      httpErr.response = { status: 403, data: { message: 'no access' } };
      vi.mocked(apiClient.get).mockRejectedValue(httpErr);
      await expect(listTemplatesApi()).rejects.toMatchObject({
        response: { data: { message: 'no access' } },
      });
    });

    test('cloneTemplateApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('quota exceeded'));
      await expect(cloneTemplateApi('t-1')).rejects.toThrow('quota exceeded');
    });

    test('deleteTemplateApi rejection propagates', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('not draft'));
      await expect(deleteTemplateApi('t-1')).rejects.toThrow('not draft');
    });
  });
});

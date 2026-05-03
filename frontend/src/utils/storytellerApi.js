/**
 * storytellerApi.js — Shared API helpers for storyteller features
 *
 * Centralises the storyteller-route base URL and the api() JSON wrapper.
 * Auth header injection is now handled by the apiClient request interceptor
 * (services/api.js) — Path A → apiClient migration, Track 2 fix plan v2.4 §4.6.
 *
 * Used by StorytellerPage, PlanWithVoicePage, BookEditor, ChapterSelection, etc.
 */

import apiClient from '../services/api';

export const API = '/api/v1/storyteller';

// Kept temporarily until BookEditor's direct fetch+authHeader sites migrate
// in the next commit. Removed at the end of Track 2.
export function authHeader() {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// api() helper now delegates to apiClient. Public contract preserved:
//  - returns parsed response body (apiClient's res.data) — NOT the response object
//  - throws Error with the backend's error message string on non-2xx
//  - 401 with AUTH_REQUIRED / AUTH_INVALID_TOKEN handled by the apiClient
//    response interceptor (Track 1) before this catch sees the error
export async function api(path, opts = {}) {
  const method = (opts.method || 'GET').toLowerCase();
  let data;
  if (opts.body !== undefined) {
    try {
      data = JSON.parse(opts.body);
    } catch {
      data = opts.body;
    }
  }
  try {
    const res = await apiClient.request({
      url: `${API}${path}`,
      method,
      data,
      headers: opts.headers,
    });
    return res.data;
  } catch (err) {
    const body = err.response?.data;
    const msg =
      (typeof body === 'string' ? body : body?.error || body?.message) ||
      err.message ||
      'Request failed';
    throw new Error(msg);
  }
}

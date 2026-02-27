/**
 * storytellerApi.js — Shared API helpers for storyteller features
 *
 * Centralises auth header injection, base URL, and JSON fetch wrapper.
 * Used by StorytellerPage, PlanWithVoicePage, BookEditor, ChapterSelection, etc.
 */

export const API = '/api/v1/storyteller';

export function authHeader() {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => 'Request failed');
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Ctrl+S works from the moment a loaded editor is on screen (Timeline Editor
 * P0 follow-up, 2026-11-02). useSaveManager used to copy `enabled` into its
 * ref in a passive effect, which React runs after the screen updates: for that
 * moment the loaded scenes were visible and Ctrl+S was silently dropped.
 * TimelineEditor.saveGuard.test.jsx hit it on CI (Frontend Tests on main at
 * 80275cc0). Here the key is pressed exactly when the DOM shows the loaded
 * state, as a person (or findByTestId) would see it, before React's passive
 * effects run.
 */
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../services/api', () => ({ saveEpisodeData: vi.fn() }));

import { saveEpisodeData } from '../services/api';
import useSaveManager from './useSaveManager';

const payload = () => ({ scenes: [{ id: 's1', scene_number: 1, title: 'One' }] });

function Editor() {
  // Loads like TimelineEditor: the loaded flag is set after an await, so the
  // render is an ordinary (not synchronous) update.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { Promise.resolve().then(() => setLoaded(true)); }, []);
  useSaveManager({ episodeId: 'ep-1', getSavePayload: payload, enabled: loaded, autoSaveDelay: 10000 });
  return loaded ? <button type="button" data-testid="loaded">Scene</button> : <p>Loading</p>;
}

describe('useSaveManager: enabled as soon as the loaded state is on screen', () => {
  let host;
  let root;
  let actFlag;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(saveEpisodeData).mockResolvedValue({ data: { success: true, scenes: [] } });
    // Real scheduling, as in the browser (no act() flushing effects early).
    actFlag = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => {
    root?.unmount();
    host.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = actFlag;
    vi.restoreAllMocks();
  });

  test('Ctrl+S pressed the moment the loaded editor appears is saved', async () => {
    const pressed = new Promise((resolve) => {
      const seen = new MutationObserver(() => {
        if (!host.querySelector('[data-testid="loaded"]')) return;
        seen.disconnect();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
        resolve();
      });
      seen.observe(host, { childList: true, subtree: true });
    });
    root = createRoot(host);
    root.render(<Editor />);
    await pressed;
    await new Promise((r) => setTimeout(r, 50));
    expect(saveEpisodeData).toHaveBeenCalledTimes(1);
  });
});

/**
 * Ctrl+S works from the moment a loaded editor is on screen (Timeline Editor
 * P0 follow-up, 2026-11-02). useSaveManager used to copy `enabled` into its
 * ref in a passive effect, which React runs after the screen updates: for that
 * moment the loaded scenes were visible and Ctrl+S was silently dropped.
 * TimelineEditor.saveGuard.test.jsx hit it on CI (Frontend Tests on main at
 * 80275cc0). Here the key is pressed exactly when the DOM shows the loaded
 * state, as a person (or findByTestId) would see it, before React's passive
 * effects run.
 *
 * Gate 2a follow-up (2026-11-02): the payload, episode id and onSaved were
 * still copied in passive effects. TimelineEditor's getSavePayload is null
 * until its load is done, so in the same moment `enabled` was true but the
 * payload was the pre-load one, and Ctrl+S saved nothing ("called 0 times",
 * Frontend Tests on PR 3682). The second test presses Ctrl+S from a later
 * sibling's layout effect: after the editor's layout effects, before any
 * passive effect, every time.
 */
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
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

describe('useSaveManager: the loaded payload is used as soon as the loaded state commits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(saveEpisodeData).mockResolvedValue({ data: { success: true, scenes: [] } });
  });
  afterEach(() => vi.restoreAllMocks());

  test('Ctrl+S in the commit that loads the editor saves the loaded payload, not the pre-load null', async () => {
    function GatedEditor({ loaded }) {
      // As TimelineEditor: the payload is null until the load is done.
      const getSavePayload = useCallback(() => (loaded ? payload() : null), [loaded]);
      useSaveManager({ episodeId: 'ep-1', getSavePayload, enabled: loaded, autoSaveDelay: 10000 });
      return null;
    }
    // A later sibling: its layout effect runs after GatedEditor's and before any passive effect.
    function PressOnLoad({ loaded }) {
      useLayoutEffect(() => {
        if (loaded) window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
      }, [loaded]);
      return null;
    }
    function App() {
      const [loaded, setLoaded] = useState(false);
      useEffect(() => { Promise.resolve().then(() => setLoaded(true)); }, []);
      return <><GatedEditor loaded={loaded} /><PressOnLoad loaded={loaded} /></>;
    }
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(<App />);
    await new Promise((r) => setTimeout(r, 50));
    expect(saveEpisodeData).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveEpisodeData).mock.calls[0]).toEqual(['ep-1', payload()]);
    root.unmount();
    host.remove();
  });
});

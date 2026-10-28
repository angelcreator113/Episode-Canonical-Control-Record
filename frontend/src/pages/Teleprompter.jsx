// frontend/src/pages/Teleprompter.jsx
// The Teleprompter page (Evoni, 2026-10-20: "I need a teleprompter for my
// script and I need a way to be able to read the script and record at the
// same time"). Two sources: paste text (kept on this device), or pick a
// show's episode and read its saved script. Start opens the full-screen
// reader (components/Teleprompter/TeleprompterReader), where "Read & record"
// films her: a picked script's takes go to the episode's Files, one beat at
// a time; a pasted text's take downloads.
// /teleprompter?episode=<id>&beat=<n> (the Script tab's Teleprompter button)
// opens that episode's script on that beat.

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ScrollText, ClipboardPaste, BookOpen, Play } from 'lucide-react';
import api from '../services/api';
import { fetchAllEpisodes } from '../lib/fetchAllPages';
import TeleprompterReader from '../components/Teleprompter/TeleprompterReader';
import { teleprompterScript, pastedParagraphs } from '../lib/teleprompterLines';
import './Teleprompter.css';

export const PASTE_KEY = 'teleprompter.pastedText';
export const SOURCE_KEY = 'teleprompter.source';

function readStored(key, fallback) {
  try {
    const v = window.localStorage.getItem(key);
    return v == null ? fallback : v;
  } catch (err) {
    console.error('[Teleprompter] could not read', key, err);
    return fallback;
  }
}
function store(key, value) {
  try { window.localStorage.setItem(key, value); } catch (err) { console.error('[Teleprompter] could not keep', key, err); }
}

const episodeLabel = (ep) => `${ep.episode_number != null ? `Ep ${ep.episode_number} · ` : ''}${ep.title || 'Untitled episode'}`;

export default function Teleprompter() {
  const [params, setParams] = useSearchParams();
  const askedEpisode = params.get('episode');
  const askedBeat = params.get('beat');

  const [sourceKind, setSourceKind] = useState(() => (askedEpisode ? 'script' : (readStored(SOURCE_KEY, 'paste') === 'script' ? 'script' : 'paste')));
  const [pasted, setPasted] = useState(() => readStored(PASTE_KEY, ''));
  const [shows, setShows] = useState([]);
  const [showId, setShowId] = useState('');
  const [episodes, setEpisodes] = useState([]);
  const [episode, setEpisode] = useState(null);
  const [scriptRevision, setScriptRevision] = useState(null);
  const [startBeat, setStartBeat] = useState(askedBeat ? Number(askedBeat) : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // From the Script tab, the reader opens on its beat as soon as the script is in.
  const [reading, setReading] = useState(false);
  const [autoOpen, setAutoOpen] = useState(!!askedEpisode);

  useEffect(() => { store(SOURCE_KEY, sourceKind); }, [sourceKind]);
  useEffect(() => { store(PASTE_KEY, pasted); }, [pasted]);

  useEffect(() => {
    if (sourceKind !== 'script') return undefined;
    let live = true;
    api.get('/api/v1/shows')
      .then((r) => { if (live) setShows(Array.isArray(r.data?.data) ? r.data.data : []); })
      .catch((err) => { console.error('[Teleprompter] shows not loaded:', err); if (live) setError('Could not load the shows.'); });
    return () => { live = false; };
  }, [sourceKind]);

  useEffect(() => {
    if (!showId) { setEpisodes([]); return undefined; }
    let live = true;
    // Paged, 100 at a time: the server refuses a limit over 100.
    fetchAllEpisodes(api, showId, { sort: 'episode_number:ASC' })
      .then((r) => { if (live) setEpisodes(r.items); })
      .catch((err) => { console.error('[Teleprompter] episodes not loaded:', err); if (live) setError('Could not load the episodes.'); });
    return () => { live = false; };
  }, [showId]);

  // The picked episode's saved script.
  useEffect(() => {
    if (!askedEpisode) { setEpisode(null); return undefined; }
    let live = true;
    setLoading(true);
    setError(null);
    api.get(`/api/v1/episodes/${encodeURIComponent(askedEpisode)}`)
      .then((r) => {
        if (!live) return;
        const ep = r.data?.data || r.data || null;
        setEpisode(ep);
        // The saved script's revision: Voice Studio playback plays only for this script (B2b).
        setScriptRevision(typeof r.data?.script_revision === 'string' ? r.data.script_revision : null);
        if (ep?.show_id) setShowId(String(ep.show_id));
      })
      .catch((err) => {
        console.error('[Teleprompter] episode not loaded:', err);
        if (live) { setEpisode(null); setError('Could not load that episode.'); setAutoOpen(false); }
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [askedEpisode]);

  const script = useMemo(() => teleprompterScript(episode?.script_content || ''), [episode]);
  const hasScript = !!String(episode?.script_content || '').trim();
  const hasText = pastedParagraphs(pasted).length > 0;

  useEffect(() => {
    if (autoOpen && episode && !loading) {
      setAutoOpen(false);
      if (hasScript) setReading(true);
    }
  }, [autoOpen, episode, loading, hasScript]);

  const pickEpisode = (id) => {
    setStartBeat(null);
    const next = new URLSearchParams(params);
    if (id) next.set('episode', id); else next.delete('episode');
    next.delete('beat');
    setParams(next, { replace: true });
  };

  const canStart = sourceKind === 'paste' ? hasText : hasScript;
  const title = episode ? episodeLabel(episode) : '';
  const source = sourceKind === 'paste'
    ? { kind: 'text', text: pasted }
    : { kind: 'script', scriptText: episode?.script_content || '', episodeId: episode?.id || null, scriptRevision: episode ? scriptRevision : null, title };
  const numberedBeats = script.beats.filter((b) => b.number != null);
  // The source tabs: arrow keys, Home and End move between them (one tab stop).
  const tabRefs = useRef({});
  const KINDS = ['paste', 'script'];
  const onTabKey = (e) => {
    const at = KINDS.indexOf(sourceKind);
    const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (at + 1) % KINDS.length
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (at + KINDS.length - 1) % KINDS.length
        : e.key === 'Home' ? 0 : e.key === 'End' ? KINDS.length - 1 : null;
    if (to == null) return;
    e.preventDefault();
    setSourceKind(KINDS[to]);
    tabRefs.current[KINDS[to]]?.focus();
  };

  return (
    <div className="stp-pagewrap">
      <header className="stp-head">
        <h1 className="stp-h1"><ScrollText size={24} aria-hidden="true" /> Teleprompter</h1>
        <p className="stp-sub">Big words, a steady scroll, and a camera when you want to record yourself reading.</p>
      </header>

      <section className="stp-card" aria-label="What to read">
        <div className="stp-tabs" role="tablist" aria-label="Source" onKeyDown={onTabKey}>
          <button type="button" role="tab" className="stp-tab" id="stp-tab-paste" aria-controls={sourceKind === 'paste' ? 'stp-panel-paste' : undefined} aria-selected={sourceKind === 'paste'} tabIndex={sourceKind === 'paste' ? 0 : -1}
            ref={(el) => { tabRefs.current.paste = el; }} data-testid="stp-source-paste" onClick={() => setSourceKind('paste')}>
            <ClipboardPaste size={18} aria-hidden="true" /> Paste text
          </button>
          <button type="button" role="tab" className="stp-tab" id="stp-tab-script" aria-controls={sourceKind === 'script' ? 'stp-panel-script' : undefined} aria-selected={sourceKind === 'script'} tabIndex={sourceKind === 'script' ? 0 : -1}
            ref={(el) => { tabRefs.current.script = el; }} data-testid="stp-source-script" onClick={() => setSourceKind('script')}>
            <BookOpen size={18} aria-hidden="true" /> Pick a script
          </button>
        </div>

        {sourceKind === 'paste' ? (
          <div className="stp-field" role="tabpanel" id="stp-panel-paste" aria-labelledby="stp-tab-paste">
            <label htmlFor="stp-paste" className="stp-label">Your text</label>
            <textarea id="stp-paste" className="stp-textarea" value={pasted} onChange={(e) => setPasted(e.target.value)} rows={12}
              placeholder="Paste or type what you want to read. A blank line starts a new paragraph." data-testid="stp-paste" />
            <p className="stp-hint">Kept on this device, so it is here next time. A take you record from pasted text downloads to this device.</p>
          </div>
        ) : (
          <div className="stp-field" role="tabpanel" id="stp-panel-script" aria-labelledby="stp-tab-script">
            <div className="stp-pickers">
              <label className="stp-label">Show
                <select className="stp-select" value={showId} onChange={(e) => { setShowId(e.target.value); pickEpisode(''); }} data-testid="stp-show">
                  <option value="">Choose a show</option>
                  {shows.map((s) => <option key={s.id} value={String(s.id)}>{s.name || s.title || 'Untitled show'}</option>)}
                </select>
              </label>
              <label className="stp-label">Episode
                <select className="stp-select" value={askedEpisode || ''} disabled={!showId} onChange={(e) => pickEpisode(e.target.value)} data-testid="stp-episode">
                  <option value="">{showId ? 'Choose an episode' : 'Choose a show first'}</option>
                  {episode && !episodes.some((ep) => String(ep.id) === String(episode.id)) && <option value={String(episode.id)}>{episodeLabel(episode)}</option>}
                  {episodes.map((ep) => <option key={ep.id} value={String(ep.id)}>{episodeLabel(ep)}</option>)}
                </select>
              </label>
              {numberedBeats.length > 0 && (
                <label className="stp-label">Start at
                  <select className="stp-select" value={startBeat == null ? '' : String(startBeat)} onChange={(e) => setStartBeat(e.target.value ? Number(e.target.value) : null)} data-testid="stp-start-beat">
                    <option value="">The top</option>
                    {numberedBeats.map((b) => <option key={b.number} value={String(b.number)}>{b.number} · {b.name}</option>)}
                  </select>
                </label>
              )}
            </div>
            {loading && <p className="stp-hint">Loading the script…</p>}
            {episode && !loading && (hasScript
              ? <p className="stp-hint" data-testid="stp-script-ready">{numberedBeats.length || script.beats.length} {numberedBeats.length === 1 ? 'beat' : 'beats'} · the saved script. Takes you record go to this episode&apos;s Files, one beat at a time.</p>
              : <p className="stp-hint" data-testid="stp-no-script">This episode has no script yet. <Link to={`/episodes/${episode.id}?tab=scripts`}>Open its Script tab</Link></p>)}
          </div>
        )}
        {error && <p className="stp-page-error" role="alert">{error}</p>}

        <div className="stp-start-row">
          <button type="button" className="stp-start" disabled={!canStart} onClick={() => setReading(true)} data-testid="stp-start">
            <Play size={18} aria-hidden="true" /> Start reading
          </button>
          <span className="stp-hint">Space plays and pauses · ↑ ↓ speed · Page Up / Page Down jump (clickers and foot pedals) · Esc exits</span>
        </div>
      </section>

      {reading && <TeleprompterReader source={source} startBeat={sourceKind === 'script' ? startBeat : null} onClose={() => setReading(false)} />}
    </div>
  );
}

/**
 * The season pitch on the printable one-pager (pages/SeasonPlanPrint's
 * pitch spot; Evoni, 2026-10-26, Season page round 3 AI buttons). Shows the
 * pitch saved for this season (GET .../season/pitch), else the logline.
 * "Draft with AI" is one AI call (POST .../season/ai/pitch,
 * services/seasonAiHelpers) that drafts two lines from the logline and the
 * parts into the box for her to edit; nothing is saved until Save (PUT
 * .../season/pitch: shows.metadata.season_pitches[<arc id>]). Edit lets
 * her write or change it by hand; an empty Save clears it. The buttons do
 * not print.
 *
 * Props: api, showId, season (?season=N, a past season's), fallback (the logline).
 */
import { useEffect, useState } from 'react';
import { Sparkles, Pencil } from 'lucide-react';
import { aiErrorText, seasonQuery } from '../../lib/seasonAi';
import './SeasonPitch.css';

const PITCH_MAX = 1200;

export default function SeasonPitch({ api, showId, season = null, fallback = null }) {
  const [saved, setSaved] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState(null); // null: not editing
  const [busy, setBusy] = useState(null); // 'draft' | 'save'
  const [note, setNote] = useState(null);
  const q = seasonQuery(season);

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/v1/world/${showId}/season/pitch${q}`)
      .then((res) => { if (!cancelled) setSaved(res.data?.saved || null); })
      .catch((err) => console.error('[SeasonPitch] the saved pitch could not be read:', err))
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [api, showId, q]);

  const ask = async () => {
    setBusy('draft');
    setNote(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/season/ai/pitch${q}`);
      setDraft(res.data?.pitch || '');
      setNote({ text: 'A draft: edit it, then Save. Nothing is saved yet.' });
    } catch (err) {
      console.error('[SeasonPitch] draft failed:', err);
      setNote({ error: true, text: aiErrorText(err, 'No pitch could be drafted. Try again.') });
    } finally {
      setBusy(null);
    }
  };
  const save = async () => {
    setBusy('save');
    try {
      const res = await api.put(`/api/v1/world/${showId}/season/pitch${q}`, { text: draft });
      setSaved(res.data?.saved || null);
      setDraft(null);
      setNote({ text: res.data?.saved ? 'Saved.' : 'The pitch was cleared.' });
    } catch (err) {
      console.error('[SeasonPitch] save failed:', err);
      setNote({ error: true, text: aiErrorText(err, 'The pitch could not be saved. Try again.') });
    } finally {
      setBusy(null);
    }
  };

  const shown = saved?.text || fallback;
  return (
    <div className="spitch" data-testid="splan-pitch-ai">
      {draft == null ? (
        shown ? <p className="spitch-text" data-testid="splan-pitch-shown">{shown}</p>
          : <p className="spitch-empty">Two lines on what this season is. Not written yet.</p>
      ) : (
        <>
          <label htmlFor="spitch-box" className="spitch-label">Season pitch (two lines)</label>
          <textarea id="spitch-box" className="spitch-box" rows={4} maxLength={PITCH_MAX} value={draft}
            onChange={(e) => setDraft(e.target.value)} data-testid="splan-pitch-box" />
        </>
      )}
      {!saved && draft == null && fallback && <p className="spitch-sub">The logline, until a pitch is saved.</p>}
      {note && <p className={`spitch-note${note.error ? ' is-error' : ''}`} role={note.error ? 'alert' : 'status'} data-testid="splan-pitch-note">{note.text}</p>}
      <div className="spitch-actions">
        {draft == null ? (
          <>
            <button type="button" className="spitch-btn" onClick={ask} disabled={!loaded || busy != null} data-testid="splan-pitch-draft">
              <Sparkles size={14} aria-hidden="true" /> {busy === 'draft' ? 'Drafting…' : 'Draft with AI'}
            </button>
            <button type="button" className="spitch-btn is-quiet" onClick={() => { setDraft(saved?.text || ''); setNote(null); }} disabled={!loaded || busy != null} data-testid="splan-pitch-edit">
              <Pencil size={14} aria-hidden="true" /> {saved ? 'Edit' : 'Write it'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="spitch-btn" onClick={save} disabled={busy != null} data-testid="splan-pitch-save">
              {busy === 'save' ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="spitch-btn is-quiet" onClick={ask} disabled={busy != null} data-testid="splan-pitch-redraft">
              <Sparkles size={14} aria-hidden="true" /> {busy === 'draft' ? 'Drafting…' : 'Draft again'}
            </button>
            <button type="button" className="spitch-btn is-quiet" onClick={() => { setDraft(null); setNote(null); }} disabled={busy != null} data-testid="splan-pitch-cancel">
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Beat11Piece — the short story's beat 11 piece, on the Stories page.
 *
 * Beat 11 (The Event) of Styling Adventures with Lala plays a short
 * animated piece of the episode's short story: the hook that leaves the
 * viewer asking "what happened at that event?" (Evoni, 2026-10-15;
 * docs/CANON.md). Cut it from the story, edit it, keep it for animation.
 * Saved on the story (stories.metadata.beat11_excerpt) by
 * routes/bookFromShowRoutes.js. Also step 4 of an episode's story path
 * (Episodes/EpisodeBookSteps): `embedded` leaves the title and the intro to
 * the step and drops the box; onChange hears each cut or save.
 */
import { useEffect, useState } from 'react';
import apiClient from '../services/api';

const API = '/api/v1/book-from-show/stories';

export const getBeat11Api = (storyId) => apiClient.get(`${API}/${storyId}/beat11-excerpt`);
export const cutBeat11Api = (storyId) => apiClient.post(`${API}/${storyId}/beat11-excerpt`, {}, { timeout: 120000 });
export const saveBeat11Api = (storyId, text) => apiClient.put(`${API}/${storyId}/beat11-excerpt`, { text });

const btn = { padding: '8px 14px', minHeight: 36, borderRadius: 6, border: '1px solid #B8962E40', background: '#FAF7F0', color: '#8a6d1d', fontSize: 12, fontWeight: 600, cursor: 'pointer' };

export default function Beat11Piece({ storyId, embedded = false, onChange }) {
  const [excerpt, setExcerpt] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(null);   // 'cut' | 'save'
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    setLoaded(false); setError(null);
    getBeat11Api(storyId)
      .then((res) => { if (!live) return; setExcerpt(res.data?.excerpt || null); setText(res.data?.excerpt?.text || ''); })
      .catch((err) => { console.error('[Beat11Piece] load failed:', err); if (live) setError('The beat 11 piece did not load.'); })
      .finally(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [storyId]);

  const cut = async () => {
    setBusy('cut'); setError(null);
    try {
      const res = await cutBeat11Api(storyId);
      setExcerpt(res.data.excerpt); setText(res.data.excerpt.text);
      onChange?.();
    } catch (err) {
      console.error('[Beat11Piece] cut failed:', err);
      setError(err?.response?.data?.error || 'The piece was not cut. Try again.');
    }
    setBusy(null);
  };

  const save = async () => {
    setBusy('save'); setError(null);
    try {
      const res = await saveBeat11Api(storyId, text);
      setExcerpt(res.data.excerpt);
      onChange?.();
    } catch (err) {
      console.error('[Beat11Piece] save failed:', err);
      setError(err?.response?.data?.error || 'The piece was not saved. Try again.');
    }
    setBusy(null);
  };

  const words = text.split(/\s+/).filter(Boolean).length;
  const changed = excerpt && text.trim() !== (excerpt.text || '');

  return (
    <section data-testid="beat11-piece" aria-label={embedded ? 'Beat 11 piece' : undefined} style={embedded ? undefined : { background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {!embedded && (
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>Beat 11 piece</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>The animated moment in the episode that makes viewers ask what happened at the event.</p>
          </div>
        )}
        <button type="button" onClick={cut} disabled={!!busy || !loaded} style={btn}>
          {busy === 'cut' ? 'Cutting…' : excerpt ? 'Cut again' : 'Cut the beat 11 piece'}
        </button>
      </div>
      {excerpt && (
        <div style={{ marginTop: 12 }}>
          <textarea aria-label="Beat 11 piece" value={text} onChange={(e) => setText(e.target.value)} style={{
            width: '100%', minHeight: 120, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, boxSizing: 'border-box',
            fontSize: 15, lineHeight: 1.7, fontFamily: "'Lora', Georgia, serif", color: '#2C2C2C', resize: 'vertical',
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {words} words · about {Math.max(1, Math.round(words / 2.5))} seconds{excerpt.why ? ` · Leaves them asking: ${excerpt.why}` : ''}
            </span>
            <button type="button" onClick={save} disabled={!!busy || !changed || !text.trim()} style={btn}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}
      {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: '#C62828' }}>{error}</p>}
    </section>
  );
}

/**
 * A post's pictures and format (Visual Memory phase 2; Evoni, 2026-10-19):
 * pick pictures from the poster's library, in order, and how the post looks
 * on The Pulse (post, carousel, story, Pulse video, live). Nothing is copied:
 * the post points at the library picture. The caption never changes.
 * A live or scheduled post can only use pictures that are approved and
 * public; when one isn't, "Approve and make public" does it in one click
 * (GET/PUT /api/v1/post-media/posts/:id, .../approve-pictures,
 * .../suggestions; services/postMedia).
 */
import { useState, useEffect, useCallback } from 'react';
import { Images, ArrowUp, ArrowDown, X, Check, Sparkles, Wand2 } from 'lucide-react';
import api from '../../services/api';
import { MakeVariation } from '../MediaVariations/MakeVariation';
import './PostPictures.css';

const errorText = (err, fallback) => err?.response?.data?.error || fallback;
const notPublic = (a) => !a || a.status !== 'approved' || a.visibility !== 'public';
const STATE_WORDS = (a) => (a.status !== 'approved' ? 'Draft' : a.visibility === 'public' ? 'Public' : a.visibility === 'internal' ? 'Studio only' : 'Only me');

export default function PostPictures({ postId, onSaved }) {
  const [data, setData] = useState(null);
  const [chosen, setChosen] = useState([]);
  const [format, setFormat] = useState('post');
  const [suggested, setSuggested] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [note, setNote] = useState(null);
  const [varyId, setVaryId] = useState(null); // phase 3: the chosen picture being varied

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get(`/api/v1/post-media/posts/${postId}`);
      setData(d);
      setFormat(d.post.format);
      setChosen(d.pictures.map((p) => p.asset).filter(Boolean));
    } catch (err) {
      console.error('[PostPictures] the post could not be read:', err);
      setError(errorText(err, 'The pictures could not be loaded.'));
    }
  }, [postId]);
  useEffect(() => { load(); }, [load]);
  // A new variation joins their library; what is chosen on the post stays as it is.
  const refreshLibrary = async () => {
    try {
      const { data: d } = await api.get(`/api/v1/post-media/posts/${postId}`);
      setData((prev) => (prev ? { ...prev, library: d.library } : d));
    } catch (err) {
      console.error('[PostPictures] the library could not be refreshed:', err);
    }
  };

  if (error && !data) return <p className="pp-error" role="alert">{error}</p>;
  if (!data) return <p className="pp-muted">Loading pictures…</p>;

  const rules = data.formats.find((f) => f.key === format) || { min: 0, max: 4, label: 'Post' };
  const isChosen = (a) => chosen.some((c) => c.id === a.id);
  const toggle = (a) => setChosen((list) => (isChosen(a) ? list.filter((c) => c.id !== a.id) : [...list, a]));
  const move = (i, by) => setChosen((list) => {
    const next = [...list];
    const j = i + by;
    if (j < 0 || j >= next.length) return list;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const countOk = chosen.length >= rules.min && chosen.length <= rules.max;
  const goingOut = data.post.status === 'live' || data.post.release_state === 'scheduled';
  const hiddenPictures = data.pictures.filter((p) => !p.asset).length;

  const save = async () => {
    setBusy(true); setError(null); setBlocked(null); setNote(null);
    try {
      const { data: d } = await api.put(`/api/v1/post-media/posts/${postId}`, { asset_ids: chosen.map((a) => a.id), format });
      setData(d);
      setNote('Saved. The caption is unchanged.');
      onSaved?.();
    } catch (err) {
      console.error('[PostPictures] the pictures could not be saved:', err);
      if (err?.response?.data?.code === 'pictures_not_public') setBlocked(err.response.data.pictures || []);
      setError(errorText(err, 'The pictures were not saved. Try again.'));
    } finally { setBusy(false); }
  };

  const approve = async () => {
    setBusy(true); setError(null);
    try {
      await Promise.all((blocked || []).map((p) => api.put(`/api/v1/media/${p.id}`, { status: 'approved', visibility: 'public' })));
      setChosen((list) => list.map((a) => ((blocked || []).some((b) => b.id === a.id) ? { ...a, status: 'approved', visibility: 'public' } : a)));
      setBlocked(null);
      setNote('Approved and public. Save to put them on the post.');
    } catch (err) {
      console.error('[PostPictures] the pictures could not be approved:', err);
      setError(errorText(err, 'They could not be approved. Try again.'));
    } finally { setBusy(false); }
  };

  const suggest = async () => {
    setBusy(true); setError(null);
    try {
      const { data: d } = await api.get(`/api/v1/post-media/posts/${postId}/suggestions`);
      setSuggested(d.suggestions || []);
    } catch (err) {
      console.error('[PostPictures] no suggestions:', err);
      setError(errorText(err, 'No suggestions came back. Try again.'));
    } finally { setBusy(false); }
  };

  return (
    <section className="pp" data-testid="post-pictures" aria-label="The post's pictures">
      <div className="pp-row">
        <label className="pp-label" htmlFor={`pp-format-${postId}`}>Format</label>
        <select id={`pp-format-${postId}`} className="pp-select" value={format} onChange={(e) => setFormat(e.target.value)} disabled={busy}>
          {data.formats.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <span className="pp-muted">
          {rules.max === 1 ? 'One picture at most.' : rules.min ? `${rules.min} to ${rules.max} pictures.` : `Up to ${rules.max} pictures.`}
          {format === 'story' && ' Leaves The Pulse 24 hours after it goes live.'}
        </span>
      </div>

      <h4 className="pp-title"><Images size={15} aria-hidden /> On the post ({chosen.length})</h4>
      {hiddenPictures > 0 && <p className="pp-muted">{hiddenPictures} of its current pictures aren't in the library; saving replaces them with these.</p>}
      {chosen.length ? (
        <ol className="pp-chosen" data-testid="pp-chosen">
          {chosen.map((a, i) => (
            <li key={a.id} className="pp-chosen-item">
              <img src={a.url} alt={a.caption || ''} />
              <span className={notPublic(a) ? 'pp-state is-warn' : 'pp-state'}>{STATE_WORDS(a)}</span>
              <span className="pp-chosen-actions">
                <button type="button" className="pp-icon" aria-label={`Move picture ${i + 1} earlier`} disabled={busy || i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} aria-hidden /></button>
                <button type="button" className="pp-icon" aria-label={`Move picture ${i + 1} later`} disabled={busy || i === chosen.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} aria-hidden /></button>
                <button type="button" className="pp-icon" aria-label={`Take picture ${i + 1} off`} disabled={busy} onClick={() => toggle(a)}><X size={14} aria-hidden /></button>
                <button type="button" className="pp-icon" aria-label={`Make a variation of picture ${i + 1}`} disabled={busy} onClick={() => setVaryId(varyId === a.id ? null : a.id)}><Wand2 size={14} aria-hidden /></button>
              </span>
            </li>
          ))}
        </ol>
      ) : <p className="pp-muted">No pictures yet. Not every post needs one.</p>}
      {/* A variation of a chosen picture lands in their library as a draft (Visual Memory phase 3). */}
      {varyId && chosen.some((a) => a.id === varyId) && (
        <MakeVariation key={varyId} asset={chosen.find((a) => a.id === varyId)} onMade={refreshLibrary} startOpen />
      )}

      <div className="pp-row">
        <h4 className="pp-title">{data.poster ? `${data.poster.name}'s library` : 'Library'}</h4>
        <button type="button" className="pp-btn is-quiet" disabled={busy || !data.poster} onClick={suggest}><Sparkles size={14} aria-hidden /> Suggest for this caption</button>
      </div>
      {!data.poster && <p className="pp-muted">This post has no character in the registry, so there is no library to pick from.</p>}
      {suggested && (
        suggested.length ? (
          <ul className="pp-grid" data-testid="pp-suggestions">
            {suggested.map((s) => {
              const a = data.library.find((x) => x.id === s.id) || s;
              return (
                <li key={s.id} className="pp-pick">
                  <button type="button" className={isChosen(a) ? 'pp-thumb is-on' : 'pp-thumb'} aria-pressed={isChosen(a)} onClick={() => toggle(a)} aria-label={`Suggested: ${s.caption || 'a picture'}`}>
                    <img src={s.url} alt={s.caption || ''} loading="lazy" />
                  </button>
                  <span className="pp-why">{s.why.join('; ') || 'From their library'}</span>
                </li>
              );
            })}
          </ul>
        ) : <p className="pp-muted" data-testid="pp-suggestions">Nothing in their library matches this caption yet.</p>
      )}
      {data.library.length ? (
        <ul className="pp-grid" data-testid="pp-library">
          {data.library.map((a) => (
            <li key={a.id} className="pp-pick">
              <button type="button" className={isChosen(a) ? 'pp-thumb is-on' : 'pp-thumb'} aria-pressed={isChosen(a)} onClick={() => toggle(a)} aria-label={a.caption || 'A picture'}>
                <img src={a.url} alt={a.caption || ''} loading="lazy" />
                {isChosen(a) && <span className="pp-check"><Check size={14} aria-hidden /></span>}
              </button>
              <span className={notPublic(a) ? 'pp-state is-warn' : 'pp-state'}>{STATE_WORDS(a)}</span>
            </li>
          ))}
        </ul>
      ) : data.poster && <p className="pp-muted">Their library is empty. Add pictures in their Places &amp; Gallery tab.</p>}

      {goingOut && chosen.some(notPublic) && !blocked && <p className="pp-muted">This post is {data.post.status === 'live' ? 'on The Pulse' : 'scheduled'}, so its pictures must be approved and public.</p>}
      {error && <p className="pp-error" role="alert">{error}</p>}
      {blocked && blocked.length > 0 && (
        <p className="pp-row">
          <button type="button" className="pp-btn" disabled={busy} onClick={approve} data-testid="pp-approve">Approve and make public</button>
        </p>
      )}
      {note && <p className="pp-note">{note}</p>}
      <div className="pp-row">
        <button type="button" className="pp-btn" disabled={busy || !countOk} onClick={save} data-testid="pp-save">{busy ? 'Saving…' : 'Save pictures'}</button>
        {!countOk && <span className="pp-muted">A {rules.label.toLowerCase()} takes {rules.min ? `${rules.min} to ${rules.max}` : `up to ${rules.max}`}.</span>}
      </div>
    </section>
  );
}

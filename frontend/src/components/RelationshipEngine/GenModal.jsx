/**
 * GenModal — AI relationship generator dialog
 * Prime Studios · LalaVerse
 *
 * Aimed (2026-10-24): what kind of seeds, about whom, among one episode's
 * guests or to pay off one season twist, and how many. The episodes and
 * twists are the active show's (utils/activeShow: the show last opened, or
 * the only one); with no show to go on, those two are left out.
 */
import { useState, useEffect, useId } from 'react';
import apiClient from '../../services/api';
import { activeShowId } from '../../utils/activeShow';
import { cname } from './tokens';
import { Btn, Label, Select, useFocusTrap } from './primitives';
import './GenModal.css';

export const GEN_KINDS = [
  { v: 'any',     l: 'Any' },
  { v: 'romance', l: 'Romance' },
  { v: 'rivals',  l: 'Rivals' },
  { v: 'friends', l: 'Friends' },
  { v: 'mentors', l: 'Mentors' },
  { v: 'family',  l: 'Family' },
];
export const GEN_COUNTS = [3, 4, 5, 6, 7, 8];

/** The POST /relationships/generate body: only what was chosen, plus kind and count. */
export function generateBody({ kind = 'any', focus = '', episode = '', twist = '', count = 5 } = {}) {
  return {
    kind,
    count: Number(count),
    ...(focus ? { focus_character_id: focus } : {}),
    ...(episode ? { episode_id: episode } : {}),
    ...(twist ? { twist_id: twist } : {}),
  };
}

/** The active show's episodes and twists, for the two aims; empty lists when there is no show or a read fails. */
function useShowAims() {
  const [aims, setAims] = useState({ loaded: false, showId: null, episodes: [], twists: [] });
  useEffect(() => {
    let gone = false;
    (async () => {
      try {
        const r = await apiClient.get('/api/v1/shows');
        const list = r?.data?.data || r?.data?.shows || r?.data;
        const showId = activeShowId({ shows: Array.isArray(list) ? list : [] });
        if (!showId) { if (!gone) setAims(a => ({ ...a, loaded: true })); return; }
        const [eps, tw] = await Promise.all([
          apiClient.get(`/api/v1/episodes?show_id=${encodeURIComponent(showId)}&limit=100&sort=episode_number:ASC`)
            .catch(err => { console.error('[GenModal] episodes not loaded:', err?.response?.status || err?.message); return null; }),
          apiClient.get(`/api/v1/world/${encodeURIComponent(showId)}/season/twists`)
            .catch(err => { console.error('[GenModal] twists not loaded:', err?.response?.status || err?.message); return null; }),
        ]);
        if (gone) return;
        setAims({
          loaded: true, showId,
          episodes: (eps?.data?.data || []).filter(e => e && e.id),
          twists: (tw?.data?.twists || []).filter(t => t && t.id && ['planned', 'planted'].includes(t.status)),
        });
      } catch (err) {
        console.error('[GenModal] the show for episodes and twists not loaded:', err?.response?.status || err?.message);
        if (!gone) setAims(a => ({ ...a, loaded: true }));
      }
    })();
    return () => { gone = true; };
  }, []);
  return aims;
}

const epLabel = e => [e.episode_number != null ? `Episode ${e.episode_number}` : null, e.title].filter(Boolean).join(' · ') || 'Episode';

export default function GenModal({ chars, genning, onGenerate, onClose }) {
  const [kind, setKind] = useState('any');
  const [focus, setFocus] = useState('');
  const [episode, setEpisode] = useState('');
  const [twist, setTwist] = useState('');
  const [count, setCount] = useState(5);
  const uid = useId();
  const idOf = k => `${uid}-${k}`;
  const aims = useShowAims();
  const trapRef = useFocusTrap(true, onClose);

  const kindWord = kind === 'any' ? '' : `${GEN_KINDS.find(k => k.v === kind).l.toLowerCase()} `;

  return (
    <div className="cg-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Generate relationship seeds">
      <div ref={trapRef} className="cg-modal re-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="re-accent-bar re-accent-reverse" />
        <div className="re-modal-header">
          <span className="re-modal-title">◈ Generate Seeds</span>
          <button onClick={onClose} className="re-close-btn" aria-label="Close dialog">×</button>
        </div>
        <div className="re-modal-body">
          <p className="re-gen-desc">
            Claude reads what has happened (the approved episode records, open threads and twists, who knows what)
            and proposes <strong>{count} {kindWord}seeds</strong>, each saying what it builds on. They join the seeds already waiting.
          </p>

          <Label>Kind</Label>
          <div className="re-preset-grid re-gen-kinds" role="radiogroup" aria-label="Kind">
            {GEN_KINDS.map(k => (
              <button key={k.v} type="button" role="radio" aria-checked={kind === k.v}
                className={`cg-preset-btn ${kind === k.v ? 'is-active' : ''}`}
                onClick={() => setKind(k.v)}>{k.l}</button>
            ))}
          </div>

          <Label htmlFor={idOf('focus')}>Focus Character (optional)</Label>
          <Select id={idOf('focus')} value={focus} onChange={e => setFocus(e.target.value)}>
            <option value="">Any character</option>
            {chars.map(c => <option key={c.id} value={c.id}>{cname(c)}</option>)}
          </Select>

          {aims.showId ? (
            <>
              <Label htmlFor={idOf('episode')}>Among an episode&apos;s guests (optional)</Label>
              <Select id={idOf('episode')} value={episode} onChange={e => setEpisode(e.target.value)}>
                <option value="">Any episode</option>
                {aims.episodes.map(e => <option key={e.id} value={e.id}>{epLabel(e)}</option>)}
              </Select>
              <Label htmlFor={idOf('twist')}>Pay off a twist (optional)</Label>
              <Select id={idOf('twist')} value={twist} onChange={e => setTwist(e.target.value)}>
                <option value="">No twist</option>
                {aims.twists.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </Select>
            </>
          ) : aims.loaded && (
            <p className="re-gen-note">Open a show first to aim at one of its episodes or twists.</p>
          )}

          <Label htmlFor={idOf('count')}>How many</Label>
          <Select id={idOf('count')} value={String(count)} onChange={e => setCount(Number(e.target.value))}>
            {GEN_COUNTS.map(n => <option key={n} value={n}>{n}</option>)}
          </Select>
        </div>
        <div className="re-modal-footer">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={() => onGenerate(generateBody({ kind, focus, episode, twist, count }))} disabled={genning}>
            {genning ? 'Generating…' : '◈ Generate'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

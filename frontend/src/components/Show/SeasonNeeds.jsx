/**
 * Season Plan › Relationships the season needs (Evoni, 2026-10-24, planner
 * PR 3). Each twist, thread and slot purpose depends on relationships
 * between people; this lists each pair, the slot it is needed by, and
 * whether the story has it (GET /season/needs, services/seasonNeeds):
 *   There      confirmed, with its stage and tension
 *   Seed only  an unconfirmed seed (waiting, kept as an idea, or Later)
 *   Missing    nothing yet: "Add a seed" (POST /relationships/seeds, its
 *              why naming the need, needed by its slot) or "Generate for
 *              this" (the Relationships page's Generate, aimed at the slot)
 * Each links to the pair on the Relationships page.
 *
 * SeasonNeeds is the Season Plan's fold (the count of missing on it);
 * NeedList is the same rows, shorter, in a slot's panel.
 */
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartHandshake } from 'lucide-react';
import { REL_PRESETS } from '../RelationshipEngine/tokens';
import './SeasonNeeds.css';

export const NEED_STATE = {
  there: { label: 'There', cls: 'is-there' },
  seed: { label: 'Seed only', cls: 'is-seed' },
  missing: { label: 'Missing', cls: 'is-missing' },
};
const SEED_STATE_WORDS = { kept: 'kept as an idea', later: 'put off for later' };
const KIND_WORDS = { twist: 'Twist', thread: 'Thread', purpose: 'Purpose' };
const words = (v) => String(v || '').replace(/_/g, ' ');

/** The type a need's words suggest, else friend: what "Add a seed" starts with. */
export function guessType(text) {
  const t = String(text || '').toLowerCase();
  if (/\b(love|romance|romantic|date|dating|kiss|flirt|crush|affair)/.test(t)) return 'love_interest';
  if (/\b(rival|feud|confront|betray|enem|grudge|compet|sabotag|fight)/.test(t)) return 'rival';
  if (/\bmentor/.test(t)) return 'mentor';
  if (/\bmanag/.test(t)) return 'manager';
  if (/\bcollab/.test(t)) return 'collaborator';
  if (/\bbest friend|\bbestie/.test(t)) return 'best friend';
  return 'friend';
}

/** Where the need's pair is on the Relationships page. */
export function pairLink(need) {
  if (need.state === 'there' && need.relationship?.id) return `/relationships?rel=${encodeURIComponent(need.relationship.id)}`;
  if (need.state === 'seed') return `/relationships?tab=candidates&char=${encodeURIComponent(need.a.id)}`;
  return `/relationships?char=${encodeURIComponent(need.a.id)}`;
}

/** Generate on the Relationships page, aimed at the slot the need is for. */
export const generateLink = (need) => (need.slot?.id ? `/relationships?gen_slot=${encodeURIComponent(need.slot.id)}` : null);

/** The line under the pair: what it is now, or what is waiting. */
export function stateDetail(need) {
  const r = need.relationship;
  if (need.state === 'there' && r) {
    return [words(r.type), r.is_romantic ? 'romantic' : null, r.stage ? `now ${words(r.stage)}` : null, r.tension_state].filter(Boolean).join(' · ');
  }
  if (need.state === 'seed' && r) return `A ${words(r.type)} seed, ${SEED_STATE_WORDS[r.seed_state] || 'waiting to be confirmed'}`;
  return 'No relationship between them yet';
}

function AddSeed({ need, api, onAdded }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(() => guessType(need.title));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const uid = useId();
  const add = async () => {
    setBusy(true); setNote(null);
    try {
      const r = await api.post('/api/v1/relationships/seeds', {
        source: 'manual',
        seeds: [{
          character_id_a: need.a.id, character_id_b: need.b.id, relationship_type: type,
          is_romantic: type === 'love_interest', seed_why: need.seed_why,
          ...(need.slot?.id ? { needed_by_slot_id: need.slot.id } : {}),
        }],
      });
      const made = r.data?.candidates || [];
      if (made.length) {
        setOpen(false);
        setNote({ ok: true, text: 'Seed added. Confirm it on the Relationships page.' });
        onAdded?.();
      } else {
        setNote({ ok: false, text: r.data?.skipped?.[0]?.why || 'It was not added.' });
      }
    } catch (err) {
      console.error('[SeasonNeeds] add a seed failed:', err);
      setNote({ ok: false, text: err.response?.data?.error || err.message || 'It was not added.' });
    }
    setBusy(false);
  };
  return (
    <>
      {open ? (
        <span className="sn-add" role="group" aria-label={`Add a seed for ${need.a.name} and ${need.b.name}`}>
          <label className="sn-sr" htmlFor={`${uid}-type`}>Type</label>
          <select id={`${uid}-type`} className="sn-select" value={type} onChange={(e) => setType(e.target.value)} disabled={busy}>
            {REL_PRESETS.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
          </select>
          <button type="button" className="sn-btn" onClick={add} disabled={busy} data-testid={`need-add-save-${need.key}`}>{busy ? 'Adding…' : 'Add'}</button>
          <button type="button" className="sn-btn-soft" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
        </span>
      ) : (
        <button type="button" className="sn-btn" onClick={() => setOpen(true)} data-testid={`need-add-${need.key}`}>Add a seed</button>
      )}
      {note && <span className={`sn-note${note.ok ? ' is-ok' : ' is-error'}`} role="status">{note.text}</span>}
    </>
  );
}

function NeedRow({ need, api, onChanged, showSlot = true }) {
  const st = NEED_STATE[need.state] || NEED_STATE.missing;
  const gen = generateLink(need);
  return (
    <li className={`sn-row ${st.cls}`} data-testid={`need-${need.key}`}>
      <div className="sn-row-top">
        <span className={`sn-state ${st.cls}`}>{st.label}</span>
        <span className="sn-pair">{need.a.name} <span aria-hidden="true">↔</span><span className="sn-sr"> and </span> {need.b.name}</span>
        {showSlot && need.slot && <span className="sn-when">Needed by E{need.slot.slot_number}</span>}
      </div>
      <p className="sn-detail">{stateDetail(need)}</p>
      <p className="sn-source"><span className="sn-source-kind">{KIND_WORDS[need.kind] || 'For'}:</span> {need.title}</p>
      <div className="sn-actions">
        {need.state === 'missing' && api && <AddSeed need={need} api={api} onAdded={onChanged} />}
        {need.state === 'missing' && gen && <Link className="sn-link" to={gen}>Generate for this</Link>}
        <Link className="sn-link" to={pairLink(need)}>{need.state === 'there' ? 'Open in Relationships' : need.state === 'seed' ? 'Open the seed' : 'See them in Relationships'}</Link>
      </div>
    </li>
  );
}

/** The rows, missing first within each slot (the server's order). */
export function NeedList({ needs, api, onChanged, showSlot = true, label = 'Relationships needed' }) {
  if (!needs?.length) return null;
  return (
    <ul className="sn-list" aria-label={label}>
      {needs.map((n) => <NeedRow key={n.key} need={n} api={api} onChanged={onChanged} showSlot={showSlot} />)}
    </ul>
  );
}

/** "3 missing", "all there", from the counts. */
export function needsSummary(counts) {
  const c = counts || {};
  const total = (c.there || 0) + (c.seed || 0) + (c.missing || 0);
  if (!total) return 'none yet';
  if (c.missing) return `${c.missing} missing`;
  if (c.seed) return `${c.seed} seed only`;
  return 'all there';
}

export default function SeasonNeeds({ data, api, onChanged, error = null, onRetry }) {
  const needs = data?.needs || [];
  const counts = data?.counts || {};
  return (
    <details className="sn-card" data-testid="season-needs">
      <summary className="sn-summary">
        <HeartHandshake size={16} aria-hidden="true" />
        <span className="sn-summary-title">Relationships the season needs</span>
        <span className={`sn-count${counts.missing ? ' is-missing' : ''}`} data-testid="season-needs-count">{needsSummary(counts)}</span>
      </summary>
      <div className="sn-body">
        <p className="sn-about">
          The pairs each twist, thread and slot purpose depends on, and the episode each is needed by.
          {' '}{counts.there || 0} there · {counts.seed || 0} seed only · {counts.missing || 0} missing.
        </p>
        {error && (
          <p className="sn-note is-error" role="alert">
            The needs did not load ({error}).{' '}
            {onRetry && <button type="button" className="sn-btn-soft" onClick={onRetry}>Retry</button>}
          </p>
        )}
        {!error && !needs.length && (
          <p className="sn-empty">Nothing yet. A twist with two people, or a purpose or thread that names two people, shows here.</p>
        )}
        <NeedList needs={needs} api={api} onChanged={onChanged} />
      </div>
    </details>
  );
}

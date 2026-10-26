/**
 * CandidateView — the Seeds tab: relationship seeds waiting for Evoni.
 * Prime Studios · LalaVerse
 *
 * Seeds (2026-10-24, "I want them all"): each card says why the pair, what
 * it is built on (episode, thread, twist) and where it came from. Confirm
 * opens the Inspector to edit first; ✓ confirms as it is; Keep as idea and
 * a "too soon" dismiss move it to a fold below, with Bring back; any other
 * reason dismisses it, with Undo. Confirm all confirms the pending ones
 * after one confirm step and lists any the server refused.
 *
 * Timing (planner PR 3, 2026-10-24): a seed made for a season slot says
 * "Needed by E12"; one put off for Later is back with the pending ones,
 * marked "Back: E12 is next", once its slot is the next to make (the
 * server decides, GET /relationships/cast).
 */
import { useState, useId } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Lightbulb, Clock } from 'lucide-react';
import { T, TENSION, sideName, typeLabel, humanize } from './tokens';
import { Btn, Pill } from './primitives';
import './Seeds.css';

export const SOURCE_LABEL = { generate: 'Generate', family: 'Family', scene: 'Scene', pulse: 'Pulse', manual: 'Manual' };

// The reasons a dismiss can carry (DELETE /dismiss/:id body.reason).
export const DISMISS_REASONS = [
  { v: 'wrong_for_them',  l: 'Wrong for them' },
  { v: 'too_soon',        l: 'Too soon' },
  { v: 'already_covered', l: 'Already covered' },
  { v: 'not_this_type',   l: 'Not this type' },
  { v: 'other',           l: 'Other' },
];

// Confirm all sends at most this many ids (POST /confirm-all).
export const CONFIRM_ALL_MAX = 50;

/** The seed's basis as chips: episodes link to the episode; threads, twists and facts are words. */
export function basisChips(basis) {
  const b = basis && typeof basis === 'object' ? basis : {};
  const list = (v) => (Array.isArray(v) ? v : []);
  return [
    ...list(b.episodes).filter(e => e && (e.id || e.number != null)).map(e => ({
      key: `ep-${e.id || e.number}`, label: e.number != null ? `Episode ${e.number}` : (e.title || 'Episode'),
      title: e.title || null, to: e.id ? `/episodes/${e.id}` : null,
    })),
    ...list(b.threads).filter(t => t && t.title).map(t => ({ key: `th-${t.id || t.title}`, label: `Thread: ${t.title}` })),
    ...list(b.twists).filter(t => t && t.title).map(t => ({ key: `tw-${t.id || t.title}`, label: `Twist: ${t.title}` })),
    ...list(b.facts).filter(f => typeof f === 'string' && f.trim()).map((f, i) => ({ key: `f-${i}`, label: f.trim() })),
  ];
}

function Basis({ seed }) {
  const chips = basisChips(seed.seed_basis);
  if (!chips.length) return null;
  return (
    <ul className="re-seed-basis" aria-label="Built on">
      {chips.map(c => (
        <li key={c.key}>
          {c.to
            ? <Link to={c.to} className="re-seed-chip is-link" title={c.title || undefined}>{c.label}</Link>
            : <span className="re-seed-chip">{c.label}</span>}
        </li>
      ))}
    </ul>
  );
}

/** The small reason picker a Dismiss opens, inside the card. */
function ReasonPicker({ pairName, busy, onPick, onCancel }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const uid = useId();
  const later = reason === 'too_soon';
  return (
    <div className="re-seed-reasons" role="group" aria-label={`Why dismiss ${pairName}?`}>
      <div className="re-seed-reasons-title">Why not?</div>
      <div className="re-seed-reason-list" role="radiogroup" aria-label="Reason">
        {DISMISS_REASONS.map(r => (
          <button key={r.v} type="button" role="radio" aria-checked={reason === r.v}
            className={`re-seed-reason ${reason === r.v ? 'is-active' : ''}`}
            onClick={() => setReason(r.v)}>{r.l}</button>
        ))}
      </div>
      {reason && (
        <>
          <label className="re-label" htmlFor={`${uid}-note`}>{reason === 'other' ? 'What is wrong with it?' : 'Note (optional)'}</label>
          <textarea id={`${uid}-note`} className="cg-form-input is-multiline" rows={2} value={note}
            onChange={e => setNote(e.target.value)} maxLength={500} />
          <p className="re-seed-reason-hint">
            {later ? 'It waits under Later, to bring back when the story is ready.' : 'Generate learns from this and will not suggest it again the same way. You can undo.'}
          </p>
        </>
      )}
      <div className="re-seed-reasons-actions">
        <Btn variant={later ? 'outline' : 'rose'} disabled={!reason || busy}
          onClick={() => onPick(reason, note.trim() || null)}>
          {later ? 'Move to Later' : 'Dismiss'}
        </Btn>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  );
}

function SeedCard({ c, charById, busy, onConfirm, onQuickConfirm, onKeep, onDismiss }) {
  const [picking, setPicking] = useState(false);
  const tc = c.tension_state && TENSION[c.tension_state];
  const nA = sideName(c, 'a', charById);
  const nB = sideName(c, 'b', charById);
  const pair = `${nA} ↔ ${nB}`;
  const source = SOURCE_LABEL[c.seed_source];
  return (
    <div className={`re-candidate-card re-fade-in ${busy ? 'is-busy' : ''}`} role="listitem" aria-busy={busy || undefined}>
      <div className="re-accent-bar" />
      <div className="re-candidate-body">
        <div className="re-seed-top">
          <div className="re-candidate-pair">
            <span className="re-candidate-name">{nA}</span>
            <span className="re-candidate-arrow">↔</span>
            <span className="re-candidate-name">{nB}</span>
          </div>
          {source && <span className={`re-seed-source is-${c.seed_source}`}>{source}</span>}
        </div>
        {(c.needed_by || c.back_note) && (
          <div className="re-seed-timing">
            {c.needed_by && <span className="re-seed-needed" data-testid={`seed-needed-${c.id}`}>Needed by {c.needed_by.label || `E${c.needed_by.slot_number}`}</span>}
            {c.back_note && <span className="re-seed-back" data-testid={`seed-back-${c.id}`}><Clock size={14} aria-hidden /> {c.back_note}</span>}
          </div>
        )}
        <div className="re-candidate-type">{typeLabel(c)}{c.family_role && c.family_role !== c.relationship_type ? ` · ${c.family_role}` : ''}{c.is_romantic ? ' · romance' : ''}</div>
        {c.seed_why && <p className="re-seed-why"><span className="re-seed-why-key">Why · </span>{c.seed_why}</p>}
        <Basis seed={c} />
        {c.situation && c.situation !== c.seed_why && <p className="re-candidate-situation">{c.situation}</p>}
        <div className="re-candidate-pills">
          {tc && <Pill color={tc.color} bg={tc.bg}>{humanize(c.tension_state)}</Pill>}
          {c.connection_mode && <Pill color={T.steel} bg={T.steelFog}>{c.connection_mode}</Pill>}
          {c.pain_point_category && <Pill color={T.rose} bg={T.roseFog}>{c.pain_point_category}</Pill>}
        </div>
        {c.lala_mirror && (
          <div className="re-candidate-meta">
            <span className="re-candidate-meta-key" style={{ color: T.orchid }}>Mirror · </span>{c.lala_mirror}
          </div>
        )}
        {c.career_echo_potential && (
          <div className="re-candidate-meta">
            <span className="re-candidate-meta-key" style={{ color: T.goldText }}>Echo · </span>{c.career_echo_potential}
          </div>
        )}
        {picking ? (
          <ReasonPicker pairName={pair} busy={busy}
            onCancel={() => setPicking(false)}
            onPick={(reason, note) => { setPicking(false); onDismiss(c.id, reason, note); }} />
        ) : (
          <div className="re-candidate-actions re-seed-actions">
            <Btn variant="primary" onClick={() => onConfirm(c)} disabled={busy}
              className="re-candidate-confirm" aria-label={`Confirm ${pair}`} title="Check and edit, then confirm">
              Confirm…
            </Btn>
            <Btn variant="outline" onClick={() => onQuickConfirm(c.id)} disabled={busy}
              className="re-seed-quick" aria-label={`Quick confirm ${pair}`} title="Confirm as it is">
              <Check size={18} aria-hidden />
            </Btn>
            <Btn variant="ghost" onClick={() => onKeep(c.id)} disabled={busy} aria-label={`Keep ${pair} as an idea`}>
              Keep as idea
            </Btn>
            <Btn variant="ghost" onClick={() => setPicking(true)} disabled={busy} aria-label={`Dismiss ${pair}`}>
              Dismiss
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

/** Kept ideas and Later: a fold under the pending seeds, each with Bring back. */
function Fold({ title, hint, Icon, seeds, charById, busy, onBringBack, label }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!seeds.length) return null;
  return (
    <section className="re-seed-fold" aria-label={label}>
      <button type="button" className="re-family-list-toggle re-seed-fold-toggle" aria-expanded={open} aria-controls={id}
        onClick={() => setOpen(o => !o)}>
        <Icon size={16} aria-hidden /> {title} · {seeds.length}
        <ChevronDown size={16} aria-hidden className={`re-seed-fold-chev ${open ? 'is-open' : ''}`} />
      </button>
      {open && (
        <div id={id}>
          <p className="re-seed-fold-hint">{hint}</p>
          <ul className="re-seed-fold-list">
            {seeds.map(c => {
              const pair = `${sideName(c, 'a', charById)} ↔ ${sideName(c, 'b', charById)}`;
              return (
                <li key={c.id} className="re-seed-fold-row">
                  <div className="re-seed-fold-text">
                    <div className="re-seed-fold-pair">{pair} <span className="re-seed-fold-type">· {typeLabel(c)}</span>{c.needed_by && <span className="re-seed-fold-type"> · Needed by {c.needed_by.label || `E${c.needed_by.slot_number}`}</span>}</div>
                    {(c.seed_why || c.situation) && <div className="re-seed-fold-why">{c.seed_why || c.situation}</div>}
                    {c.dismiss_note && <div className="re-seed-fold-why">Your note: {c.dismiss_note}</div>}
                  </div>
                  <Btn variant="outline" onClick={() => onBringBack(c)} disabled={busyFor(busy, c.id)} aria-label={`Bring back ${pair}`}>Bring back</Btn>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Confirm all: the button, its confirm step, then what happened. */
function ConfirmAll({ pending, busy, onConfirmAll, charById }) {
  const [step, setStep] = useState('idle'); // idle | ask | running | done
  const [result, setResult] = useState(null);
  const ids = pending.slice(0, CONFIRM_ALL_MAX).map(c => c.id);
  const names = id => {
    const c = pending.find(x => x.id === id) || result?.seen?.[id];
    return c ? `${sideName(c, 'a', charById)} ↔ ${sideName(c, 'b', charById)}` : 'One seed';
  };
  const run = async () => {
    setStep('running');
    const seen = Object.fromEntries(pending.map(c => [c.id, c]));
    const r = await onConfirmAll(ids);
    if (!r) { setStep('idle'); return; }
    setResult({ ...r, seen });
    setStep('done');
  };
  if (step === 'done' && result) {
    const refused = result.refused || [];
    return (
      <div className="re-seed-all-result" role="status">
        <div>
          <strong>{(result.confirmed || []).length} confirmed.</strong>
          {refused.length > 0 && ` ${refused.length} could not be confirmed:`}
        </div>
        {refused.length > 0 && (
          <ul className="re-seed-refused" aria-label="Not confirmed">
            {refused.map(x => <li key={x.id}><strong>{names(x.id)}</strong>: {x.error || 'refused'}</li>)}
          </ul>
        )}
        <Btn variant="ghost" onClick={() => { setStep('idle'); setResult(null); }}>Done</Btn>
      </div>
    );
  }
  if (pending.length < 2) return null;
  if (step === 'ask' || step === 'running') {
    return (
      <div className="re-seed-all-ask" role="alert">
        <span>
          Confirm {ids.length === pending.length ? `all ${ids.length}` : `the first ${ids.length} of ${pending.length}`} pending seeds as they are?
          They join the relationships; any the rules refuse stay here.
        </span>
        <span className="re-seed-all-actions">
          <Btn variant="primary" onClick={run} disabled={step === 'running' || busy}>{step === 'running' ? 'Confirming…' : 'Yes, confirm all'}</Btn>
          <Btn variant="ghost" onClick={() => setStep('idle')} disabled={step === 'running'}>Not now</Btn>
        </span>
      </div>
    );
  }
  return (
    <Btn variant="outline" onClick={() => setStep('ask')} disabled={busy} className="re-seed-all-btn">
      <Check size={16} aria-hidden /> Confirm all ({pending.length})
    </Btn>
  );
}

// busy: the id of the seed in flight ('all' for Confirm all, true for
// everything). Only that seed's buttons wait; the rest stay usable.
function busyFor(busy, id) {
  return busy === true || busy === 'all' || (busy != null && busy !== false && busy === id);
}

export default function CandidateView({
  cands, charById = {}, busy,
  onConfirm, onQuickConfirm, onKeep, onDismiss, onBringBack, onConfirmAll,
  children,
}) {
  const pending = cands.filter(c => !c.seed_state);
  const kept = cands.filter(c => c.seed_state === 'kept');
  const later = cands.filter(c => c.seed_state === 'later');

  return (
    <div className="re-seeds">
      {children}
      {/* outside the list, so what Confirm all did stays when nothing is left */}
      <div className="re-seeds-bar">
        <ConfirmAll pending={pending} busy={!!busy} onConfirmAll={onConfirmAll} charById={charById} />
      </div>
      {pending.length ? (
        <div className="cg-seed-grid" role="list" aria-label="Candidate relationships">
          {pending.map(c => (
            <SeedCard key={c.id} c={c} charById={charById} busy={busyFor(busy, c.id)}
              onConfirm={onConfirm} onQuickConfirm={onQuickConfirm} onKeep={onKeep} onDismiss={onDismiss} />
          ))}
        </div>
      ) : (
        <div className="re-empty" role="status">
          <div className="re-empty-icon">◈</div>
          <div className="re-empty-title">No Proposed Seeds</div>
          <div className="re-empty-desc">
            Generate proposes pairs built on what has happened in the story: the episodes, open threads and twists.
          </div>
        </div>
      )}
      <div className="re-seed-folds">
        <Fold title="Kept ideas" label="Kept ideas" Icon={Lightbulb} seeds={kept} charById={charById} busy={busy} onBringBack={onBringBack}
          hint="Ideas you are keeping for later, not in the story yet. Bring one back to confirm it." />
        <Fold title="Later" label="Later" Icon={Clock} seeds={later} charById={charById} busy={busy} onBringBack={onBringBack}
          hint="Dismissed as too soon. Bring one back when the story is ready for it." />
      </div>
    </div>
  );
}

/**
 * TypeTidy — the one-time tidy-up of relationship types (Evoni, 2026-10-24:
 * "Yes tidy up existing relationships"). GET /relationships/type-tidy lists
 * the pairs whose type is not one of the app's (AI-invented ones such as
 * "Subject turned critic"), each with a proposed type and the situation
 * kept in words. A quiet banner offers Review; the dialog lets Evoni
 * accept, change or skip each one before anything is saved (POST).
 * Prime Studios · LalaVerse
 */
import { useState, useId } from 'react';
import { REL_PRESETS, typeLabel } from './tokens';
import { Btn, useFocusTrap } from './primitives';
import './TypeTidy.css';

// The app's types, in the Add dialog's order (the server's list is the same).
export const REL_TYPES = REL_PRESETS.map(p => ({ v: p.type, l: p.label, romantic: p.romantic }));

// A proposed type spelled another way stays selectable as itself.
const typeOptions = it => (it.proposed_type && !REL_TYPES.some(t => t.v === it.proposed_type)
  ? [...REL_TYPES, { v: it.proposed_type, l: typeLabel(it.proposed_type), romantic: !!it.proposed_is_romantic }]
  : REL_TYPES);

/** The quiet banner: shown only when something needs a look. */
export function TypeTidyBanner({ count, onReview }) {
  if (!count) return null;
  return (
    <div className="re-tidy-banner" role="status">
      <span>
        {count} relationship{count === 1 ? ' uses a type' : 's use types'} the app doesn&apos;t know
      </span>
      <Btn variant="ghost" onClick={onReview} className="re-tidy-review">Review</Btn>
    </div>
  );
}

// A type guessed from the situation, not read from the type's own words.
const isGuess = it => it.proposed_from === 'situation';

const rowOf = it => ({
  type: it.proposed_type || '',
  situation: it.situation_after ?? it.situation_now ?? '',
  // a row with no suggestion waits until a type is picked; a guess waits for her Accept
  accept: !!it.proposed_type && !isGuess(it),
  romantic: it.proposed_type ? !!it.proposed_is_romantic : false,
});

/** The changes POST /type-tidy takes: the accepted rows that have a type. */
export function tidyChanges(items, rows) {
  const out = [];
  for (const it of items) {
    const r = rows[it.id];
    if (!r || !r.accept || !r.type) continue;
    const change = { id: it.id, relationship_type: r.type, is_romantic: !!r.romantic };
    if ((r.situation || '') !== (it.situation_now || '')) change.situation = r.situation;
    out.push(change);
  }
  return out;
}

export default function TypeTidyDialog({ items, refused = [], saving, onSave, onClose }) {
  const [rows, setRows] = useState(() => Object.fromEntries(items.map(it => [it.id, rowOf(it)])));
  const uid = useId();
  const trapRef = useFocusTrap(true, onClose);
  // Rows arrive again after a save (the refused ones stay); new ones get theirs.
  const rowFor = it => rows[it.id] || rowOf(it);
  const set = (id, patch) => setRows(p => ({ ...p, [id]: { ...(p[id] || rowOf(items.find(i => i.id === id))), ...patch } }));
  const pick = (id, type) => {
    const t = typeOptions(items.find(i => i.id === id) || {}).find(x => x.v === type);
    set(id, { type, accept: !!type, romantic: t ? t.romantic : false });
  };
  const all = Object.fromEntries(items.map(it => [it.id, rowFor(it)]));
  const changes = tidyChanges(items, all);
  // Accept all takes the types read from the type's own words. A guess from
  // the situation stays as she left it: only her own Accept or pick takes it.
  const acceptAll = () => setRows(Object.fromEntries(items.map(it => {
    const r = rowFor(it);
    return [it.id, { ...r, accept: isGuess(it) ? r.accept : !!r.type }];
  })));
  const nameOf = id => {
    const it = items.find(x => x.id === id);
    return it ? `${it.a_name} ↔ ${it.b_name}` : 'One relationship';
  };

  return (
    <div className="cg-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Tidy up relationship types">
      <div ref={trapRef} className="cg-modal re-tidy-modal" onClick={e => e.stopPropagation()}>
        <div className="re-accent-bar re-accent-reverse" />
        <div className="re-modal-header">
          <span className="re-modal-title">Tidy up types</span>
          <button onClick={onClose} className="re-close-btn" aria-label="Close dialog">×</button>
        </div>
        <div className="re-modal-body re-tidy-body">
          <p className="re-gen-desc">
            These use a type the app doesn&apos;t know, so the Family tab, the Pulse and Generate cannot read them.
            Each gets one of the app&apos;s types; the old wording moves into the situation. Nothing changes until you save.
          </p>
          {refused.length > 0 && (
            <div className="re-tidy-refused" role="alert">
              <strong>{refused.length} could not be changed:</strong>
              <ul aria-label="Not changed">
                {refused.map(x => <li key={x.id}><strong>{nameOf(x.id)}</strong>: {x.error || 'refused'}</li>)}
              </ul>
            </div>
          )}
          {items.length === 0 ? (
            <p className="re-tidy-done" role="status">Every relationship uses one of the app&apos;s types now.</p>
          ) : (
            <ul className="re-tidy-list" aria-label="Relationships to tidy">
              {items.map(it => {
                const r = rowFor(it);
                const pair = `${it.a_name} ↔ ${it.b_name}`;
                const sel = `${uid}-${it.id}-type`;
                const sit = `${uid}-${it.id}-sit`;
                return (
                  <li key={it.id} className={`re-tidy-row ${r.accept ? 'is-accepted' : 'is-skipped'}`} aria-label={pair}>
                    <div className="re-tidy-pair">{pair}</div>
                    <div className="re-tidy-change">
                      <span className="re-tidy-old">&lsquo;{it.current_type}&rsquo;</span>
                      <span className="re-tidy-arrow" aria-hidden>→</span>
                      <label className="re-tidy-sr" htmlFor={sel}>New type for {pair}</label>
                      <select id={sel} className="cg-form-select re-tidy-select" value={r.type} onChange={e => pick(it.id, e.target.value)}>
                        <option value="">Pick a type…</option>
                        {typeOptions(it).map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                      </select>
                    </div>
                    {!it.proposed_type && !r.type && <p className="re-tidy-hint">No suggestion: pick a type, or it is skipped.</p>}
                    {isGuess(it) && r.type === it.proposed_type && (
                      <p className="re-tidy-hint is-guess">Guessed from the situation: check it, then Accept.</p>
                    )}
                    <label className="re-label" htmlFor={sit}>Situation after</label>
                    <textarea id={sit} className="cg-form-input is-multiline" rows={2} value={r.situation}
                      onChange={e => set(it.id, { situation: e.target.value })} />
                    <div className="re-tidy-choice" role="group" aria-label={`Accept or skip ${pair}`}>
                      <button type="button" className={`re-seed-reason ${r.accept ? 'is-active' : ''}`} aria-pressed={r.accept}
                        disabled={!r.type} onClick={() => set(it.id, { accept: true })}>
                        {r.type && r.type !== it.proposed_type && it.proposed_type ? 'Accept change' : 'Accept'}
                      </button>
                      <button type="button" className={`re-seed-reason ${!r.accept ? 'is-active' : ''}`} aria-pressed={!r.accept}
                        onClick={() => set(it.id, { accept: false })}>Skip</button>
                      {r.type && <span className="re-tidy-will">{r.accept ? `Becomes ${typeLabel(r.type)}${r.romantic ? ' (romance)' : ''}` : 'Stays as it is'}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="re-modal-footer re-tidy-footer">
          {items.length > 0 && <Btn variant="outline" onClick={acceptAll} disabled={saving}>Accept all suggested</Btn>}
          <span className="re-tidy-spacer" />
          <Btn variant="ghost" onClick={onClose}>{items.length ? 'Cancel' : 'Close'}</Btn>
          {items.length > 0 && (
            <Btn variant="primary" onClick={() => onSave(changes)} disabled={saving || !changes.length}>
              {saving ? 'Saving…' : `Save ${changes.length} change${changes.length === 1 ? '' : 's'}`}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

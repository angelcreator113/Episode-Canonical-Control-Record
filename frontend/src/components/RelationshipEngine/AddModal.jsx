/**
 * AddModal — create a new relationship
 * Prime Studios · LalaVerse
 *
 * When either person is a company (a cast member's `company`; Evoni,
 * 2026-10-24) only the company types are offered, and never a romance.
 */
import { useState, useEffect, useRef, useId } from 'react';
import { CONN_MODES, STATUSES, TENSIONS, cname, humanize, presetsFor } from './tokens';
import { Btn, Label, Input, Select } from './primitives';

export default function AddModal({ chars, rels = [], onAdd, onClose }) {
  const [f, setF] = useState({
    character_id_a: '', character_id_b: '', relationship_type: '',
    connection_mode: 'IRL', status: 'Active', tension_state: '', situation: '', is_romantic: false,
  });
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  // Each field has an id its label names (screen readers read it).
  const uid = useId();
  const idOf = k => `${uid}-${k}`;
  // Everyone here is in Lala's world: any two of them can be connected.
  const bOpts = chars.filter(c => c.id !== f.character_id_a);
  const byId = Object.fromEntries(chars.map(c => [c.id, c]));
  const companyA = byId[f.character_id_a]?.company || null;
  const companyB = byId[f.character_id_b]?.company || null;
  const company = { any: !!(companyA || companyB), both: !!(companyA && companyB) };
  const presets = presetsFor(company);

  /* check if chosen pair + type already exists (either direction) */
  const isDupe = f.character_id_a && f.character_id_b && f.relationship_type && rels.some(r =>
    r.relationship_type?.toLowerCase() === f.relationship_type.toLowerCase() && (
      (r.character_id_a === f.character_id_a && r.character_id_b === f.character_id_b) ||
      (r.character_id_a === f.character_id_b && r.character_id_b === f.character_id_a)
    )
  );
  const typeOk = company.any ? presets.some(p => p.type === f.relationship_type) : !!f.relationship_type;
  const valid = f.character_id_a && f.character_id_b && typeOk && !isDupe;

  /* focus trap */
  const overlayRef = useRef(null);
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const trap = e => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    el.addEventListener('keydown', trap);
    return () => el.removeEventListener('keydown', trap);
  }, [onClose]);

  return (
    <div ref={overlayRef} className="cg-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Add relationship">
      <div className="cg-modal" onClick={e => e.stopPropagation()}>
        <div className="re-accent-bar" />
        <div className="re-modal-header">
          <span className="re-modal-title">Add Relationship</span>
          <button onClick={onClose} className="re-close-btn" aria-label="Close dialog">×</button>
        </div>
        <div className="re-modal-body">
          {[['Character A', 'character_id_a', chars], ['Character B', 'character_id_b', bOpts]].map(([label, key, opts]) => (
            <div key={key}>
              <Label htmlFor={idOf(key)}>{label}</Label>
              <Select id={idOf(key)} value={f[key]} onChange={set(key)}>
                <option value="">Select…</option>
                {opts.map(c => <option key={c.id} value={c.id}>{cname(c)} · {c.role_type}</option>)}
              </Select>
            </div>
          ))}
          <Label htmlFor={idOf('relationship_type')}>Relationship Type</Label>
          <div className="re-preset-grid" role="group" aria-label="Relationship type presets">
            {presets.map(p => (
              <button key={p.type} type="button" onClick={() => setF(fr => ({ ...fr, relationship_type: p.type, is_romantic: p.romantic }))}
                className={`cg-preset-btn ${f.relationship_type === p.type ? 'is-active' : ''}`}
                aria-pressed={f.relationship_type === p.type}>
                {p.label}
              </button>
            ))}
          </div>
          {company.any ? (
            <p className="re-inspector-seed-note" id={idOf('relationship_type')}>
              {(companyA || companyB).name} is a company: pick a company type. A company is never a romance or family.
            </p>
          ) : (
            <>
              <input id={idOf('relationship_type')} value={f.relationship_type} onChange={set('relationship_type')}
                placeholder="Or type custom…" className="cg-form-input" />
              <label className="re-check">
                <input type="checkbox" checked={f.is_romantic} onChange={e => setF(p => ({ ...p, is_romantic: e.target.checked }))} />
                Romantic (a love interest)
              </label>
            </>
          )}
          <div className="re-modal-row">
            <div><Label htmlFor={idOf('connection_mode')}>Mode</Label><Select id={idOf('connection_mode')} value={f.connection_mode} onChange={set('connection_mode')}>{CONN_MODES.map(m => <option key={m} value={m}>{m}</option>)}</Select></div>
            <div><Label htmlFor={idOf('status')}>Status</Label><Select id={idOf('status')} value={f.status} onChange={set('status')}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</Select></div>
          </div>
          <Label htmlFor={idOf('tension_state')}>Tension State</Label>
          <Select id={idOf('tension_state')} value={f.tension_state} onChange={set('tension_state')}>
            <option value="">None</option>
            {TENSIONS.map(t => <option key={t} value={t}>{humanize(t)}</option>)}
          </Select>
          <Label htmlFor={idOf('situation')}>Situation</Label>
          <Input id={idOf('situation')} value={f.situation} onChange={set('situation')} placeholder="Describe the dynamic…" multiline />
        </div>
        <div className="re-modal-footer">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={() => valid && onAdd(company.any ? { ...f, is_romantic: false } : f)} disabled={!valid}>
            {isDupe ? 'Already exists' : 'Create'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

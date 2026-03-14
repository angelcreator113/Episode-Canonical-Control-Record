/**
 * AddModal — create a new relationship
 * Prime Studios · LalaVerse
 */
import { useState, useEffect, useRef } from 'react';
import { CONN_MODES, STATUSES, TENSIONS, REL_PRESETS, cname, compatible } from './tokens';
import { Btn, Label, Input, Select } from './primitives';

export default function AddModal({ chars, rels = [], onAdd, onClose }) {
  const [f, setF] = useState({
    character_id_a: '', character_id_b: '', relationship_type: '',
    connection_mode: 'IRL', status: 'Active', tension_state: '', situation: '',
  });
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const charA = chars.find(c => c.id === f.character_id_a);
  const bOpts = chars.filter(c => c.id !== f.character_id_a && (!charA || compatible(charA, c)));

  /* check if chosen pair + type already exists (either direction) */
  const isDupe = f.character_id_a && f.character_id_b && f.relationship_type && rels.some(r =>
    r.relationship_type?.toLowerCase() === f.relationship_type.toLowerCase() && (
      (r.character_id_a === f.character_id_a && r.character_id_b === f.character_id_b) ||
      (r.character_id_a === f.character_id_b && r.character_id_b === f.character_id_a)
    )
  );
  const valid = f.character_id_a && f.character_id_b && f.relationship_type && !isDupe;

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
              <Label>{label}</Label>
              <Select value={f[key]} onChange={set(key)}>
                <option value="">Select…</option>
                {opts.map(c => <option key={c.id} value={c.id}>{cname(c)} · {c.role_type}</option>)}
              </Select>
            </div>
          ))}
          <Label>Relationship Type</Label>
          <div className="re-preset-grid">
            {REL_PRESETS.map(p => (
              <button key={p} onClick={() => setF(fr => ({ ...fr, relationship_type: p.toLowerCase() }))}
                className={`cg-preset-btn ${f.relationship_type === p.toLowerCase() ? 'is-active' : ''}`}>
                {p}
              </button>
            ))}
          </div>
          <input value={f.relationship_type} onChange={set('relationship_type')}
            placeholder="Or type custom…" className="cg-form-input" aria-label="Custom relationship type" />
          <div className="re-modal-row">
            <div><Label>Mode</Label><Select value={f.connection_mode} onChange={set('connection_mode')}>{CONN_MODES.map(m => <option key={m} value={m}>{m}</option>)}</Select></div>
            <div><Label>Status</Label><Select value={f.status} onChange={set('status')}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</Select></div>
          </div>
          <Label>Tension State</Label>
          <Select value={f.tension_state} onChange={set('tension_state')}>
            <option value="">None</option>
            {TENSIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Label>Situation</Label>
          <Input value={f.situation} onChange={set('situation')} placeholder="Describe the dynamic…" multiline />
        </div>
        <div className="re-modal-footer">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={() => valid && onAdd(f)} disabled={!valid}>
            {isDupe ? 'Already exists' : 'Create'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/**
 * Inspector — relationship detail, its story so far, and the editor.
 * Prime Studios · LalaVerse
 *
 * On a phone (sheet) it is a bottom sheet: focus stays inside, Escape or
 * the close button closes it.
 */
import { useState, useEffect, useRef } from 'react';
import { Heart } from 'lucide-react';
import {
  TENSION, CONN_MODES, STATUSES, TENSIONS, LALA_CONN, initials,
  sideName, typeLabel, humanize, stageLabel, STAGE_TONE, isLoveInterest,
} from './tokens';
import { Btn, Field, Label, Input, Select, Pill, useFocusTrap } from './primitives';
import StoryTimeline from './StoryTimeline';
import WhoKnows from './WhoKnows';

const formOf = rel => ({
  relationship_type:    rel.relationship_type || '',
  connection_mode:      rel.connection_mode || 'IRL',
  lala_connection:      rel.lala_connection || 'none',
  status:               rel.status || 'Active',
  tension_state:        rel.tension_state || '',
  pain_point_category:  rel.pain_point_category || '',
  situation:            rel.situation || '',
  lala_mirror:          rel.lala_mirror || '',
  career_echo_potential: rel.career_echo_potential || '',
  notes:                rel.notes || '',
  family_role:          rel.family_role || '',
  conflict_summary:     rel.conflict_summary || '',
  source_knows:         rel.source_knows || '',
  target_knows:         rel.target_knows || '',
  reader_knows:         rel.reader_knows || '',
  is_romantic:          !!rel.is_romantic,
});

export default function Inspector({ rel, charById = {}, onClose, onUpdate, onDelete, onSaved, sheet = false }) {
  const [edit, setEdit] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [f, setF] = useState(() => formOf(rel));
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const trapRef = useFocusTrap(sheet, onClose);

  // A new relationship resets the form; edits to this one do not. Only a
  // change of relationship does: on mount the state is already fresh, and a
  // reset there could land after a first click and undo it (Edit, Delete).
  const shownId = useRef(rel.id);
  useEffect(() => {
    if (shownId.current === rel.id) return;
    shownId.current = rel.id;
    setF(formOf(rel));
    setEdit(false);
    setConfirming(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rel.id]);

  const nameA = sideName(rel, 'a', charById);
  const nameB = sideName(rel, 'b', charById);
  const lalaConn = LALA_CONN.find(o => o.v === rel.lala_connection);
  const tc = rel.tension_state && TENSION[rel.tension_state];
  const romantic = isLoveInterest(rel);
  // A value not in the list (written elsewhere) stays selectable as itself.
  const lalaOptions = LALA_CONN.some(o => o.v === f.lala_connection)
    ? LALA_CONN : [...LALA_CONN, { v: f.lala_connection, l: humanize(f.lala_connection) }];

  return (
    <div ref={trapRef} className={`re-inspector ${sheet ? 'is-sheet' : ''}`}
      role={sheet ? 'dialog' : 'complementary'} aria-modal={sheet ? 'true' : undefined}
      aria-label={`${nameA} and ${nameB}`}>
      {sheet && <span className="re-sheet-grip" aria-hidden />}
      {/* header */}
      <div className="re-inspector-header">
        <div className="re-inspector-header-top">
          <span className="re-inspector-title">{romantic && <Heart size={14} fill="currentColor" aria-hidden />} {typeLabel(rel)}</span>
          <button onClick={onClose} className="re-close-btn" aria-label="Close inspector" data-autofocus>×</button>
        </div>
        <div className="re-inspector-pair">
          {[nameA, nameB].map((nm, i) => (
            <div key={i} className="re-inspector-char">
              <div className="re-inspector-avatar">{initials(nm || '?')}</div>
              <div className="re-inspector-char-name">{nm}</div>
            </div>
          ))}
          <div className="re-inspector-link-icon">
            <span className="re-inspector-arrow">↔</span>
            {rel.stage && <span className={`re-stage ${STAGE_TONE[rel.stage] || ''} is-current`}>{stageLabel(rel.stage)}</span>}
            {tc && <Pill color={tc.color} bg={tc.bg}>{humanize(rel.tension_state)}</Pill>}
          </div>
        </div>
      </div>

      {/* body */}
      <div className="re-inspector-body">
        {edit ? (
          <>
            <Label>Relationship Type</Label>
            <Input value={f.relationship_type} onChange={set('relationship_type')} placeholder="love_interest, rival, mentor…" />
            <label className="re-check">
              <input type="checkbox" checked={f.is_romantic} onChange={e => setF(p => ({ ...p, is_romantic: e.target.checked }))} />
              Romantic (a love interest)
            </label>
            <Label>Connection Mode</Label>
            <Select value={f.connection_mode} onChange={set('connection_mode')}>
              {CONN_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
            <Label>Status</Label>
            <Select value={f.status} onChange={set('status')}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Label>Tension State</Label>
            <Select value={f.tension_state} onChange={set('tension_state')}>
              <option value="">None</option>
              {TENSIONS.map(t => <option key={t} value={t}>{humanize(t)}</option>)}
            </Select>
            <Label>Pain Point</Label>
            <Input value={f.pain_point_category} onChange={set('pain_point_category')} placeholder="identity, loyalty, trust…" />
            <Label>Situation</Label>
            <Input value={f.situation} onChange={set('situation')} multiline />
            {!f.is_romantic && (
              <>
                <Label>Family Role</Label>
                <Input value={f.family_role} onChange={set('family_role')} placeholder="mother, brother…" />
              </>
            )}
            <Label>Conflict Summary</Label>
            <Input value={f.conflict_summary} onChange={set('conflict_summary')} multiline />
            <hr className="re-inspector-divider" />
            <Label>{nameA} knows</Label>
            <Input value={f.source_knows} onChange={set('source_knows')} multiline />
            <Label>{nameB} knows</Label>
            <Input value={f.target_knows} onChange={set('target_knows')} multiline />
            <Label>Reader knows</Label>
            <Input value={f.reader_knows} onChange={set('reader_knows')} multiline />
            <hr className="re-inspector-divider" />
            <Label>Lala Mirror</Label>
            <Input value={f.lala_mirror} onChange={set('lala_mirror')} multiline />
            <Label>Career Echo</Label>
            <Input value={f.career_echo_potential} onChange={set('career_echo_potential')} multiline />
            <Label>Lala Connection</Label>
            <Select value={f.lala_connection} onChange={set('lala_connection')}>
              {lalaOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </Select>
            <Label>Notes</Label>
            <Input value={f.notes} onChange={set('notes')} multiline />
          </>
        ) : (
          <>
            <StoryTimeline relId={rel.id} />
            <hr className="re-inspector-divider-light" />
            <WhoKnows rel={rel} charById={charById} onSaved={onSaved} />
            <hr className="re-inspector-divider-light" />
            <Field label="Type" value={typeLabel(rel)} />
            <Field label="Mode" value={rel.connection_mode} />
            <Field label="Status" value={rel.status} />
            <Field label="With Lala" value={rel.lala_connection && rel.lala_connection !== 'none' ? (lalaConn?.l || humanize(rel.lala_connection)) : null} />
            <Field label="Pain Point" value={rel.pain_point_category} />
            <Field label="Situation" value={rel.situation} />
            <Field label="Family Role" value={rel.family_role} />
            <Field label="Conflict" value={rel.conflict_summary} />
            {(rel.source_knows || rel.target_knows || rel.reader_knows) && <hr className="re-inspector-divider-light" />}
            <Field label={`${nameA} knows`} value={rel.source_knows} />
            <Field label={`${nameB} knows`} value={rel.target_knows} />
            <Field label="Reader knows" value={rel.reader_knows} />
            {(rel.lala_mirror || rel.career_echo_potential) && <hr className="re-inspector-divider-light" />}
            <Field label="Lala Mirror" value={rel.lala_mirror} />
            <Field label="Career Echo" value={rel.career_echo_potential} />
            <Field label="Notes" value={rel.notes} />
          </>
        )}
      </div>

      {/* footer */}
      <div className="re-inspector-footer">
        {edit ? (
          <>
            <Btn variant="primary" disabled={!f.relationship_type.trim()}
              onClick={() => { onUpdate({ ...f, family_role: f.is_romantic ? rel.family_role || '' : f.family_role }); setEdit(false); }}
              className="re-inspector-save">Save</Btn>
            <Btn variant="ghost" onClick={() => setEdit(false)}>Cancel</Btn>
          </>
        ) : confirming ? (
          <div className="re-inspector-confirm" role="alert">
            <span>Delete {nameA} and {nameB}? Their story so far is kept, and you can undo.</span>
            <span className="re-inspector-confirm-actions">
              <Btn variant="rose" onClick={() => { setConfirming(false); onDelete(); }}>Yes, delete</Btn>
              <Btn variant="ghost" onClick={() => setConfirming(false)}>Keep it</Btn>
            </span>
          </div>
        ) : (
          <>
            <Btn variant="outline" onClick={() => setEdit(true)} className="re-inspector-edit">Edit</Btn>
            <Btn variant="rose" onClick={() => setConfirming(true)} aria-label="Delete this relationship">Delete</Btn>
          </>
        )}
      </div>
    </div>
  );
}

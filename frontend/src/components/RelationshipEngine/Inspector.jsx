/**
 * Inspector — relationship detail, its story so far, and the editor.
 * Prime Studios · LalaVerse
 *
 * On a phone (sheet) it is a bottom sheet: focus stays inside, Escape or
 * the close button closes it.
 */
import { useState, useEffect, useRef, useId } from 'react';
import { Heart } from 'lucide-react';
import {
  T, TENSION, CONN_MODES, STATUSES, TENSIONS, LALA_CONN,
  sideName, typeLabel, humanize, stageLabel, STAGE_TONE, isLoveInterest,
} from './tokens';
import { Btn, Field, Label, Input, Select, Pill, useFocusTrap } from './primitives';
import StoryTimeline from './StoryTimeline';
import WhoKnows from './WhoKnows';
import './Inspector.css';

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
  // Each edit field has an id its label names (screen readers read it).
  const uid = useId();
  const idOf = k => `${uid}-${k}`;

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
  // Who may not know: shown at the top, not only inside Who knows.
  const secrecy = { secret: 'Secret', rumoured: 'Rumoured' }[rel.public_state] || null;
  // A value not in the list (written elsewhere) stays selectable as itself.
  const lalaOptions = LALA_CONN.some(o => o.v === f.lala_connection)
    ? LALA_CONN : [...LALA_CONN, { v: f.lala_connection, l: humanize(f.lala_connection) }];

  return (
    <div ref={trapRef} className={`re-inspector ${sheet ? 'is-sheet' : ''}`}
      role={sheet ? 'dialog' : 'complementary'} aria-modal={sheet ? 'true' : undefined}
      aria-label={`${nameA} and ${nameB}`}>
      {sheet && <span className="re-sheet-grip" aria-hidden />}
      {/* header: who, then what it is, then where they stand */}
      <div className="re-inspector-header">
        <div className="re-inspector-header-top">
          <h2 className="re-inspector-pair" aria-label={`${nameA} and ${nameB}`}>
            {romantic && <Heart size={14} fill="currentColor" aria-hidden className="re-inspector-heart" />}
            <span className="re-inspector-char-name">{nameA}</span>
            <span className="re-inspector-arrow" aria-hidden>↔</span>
            <span className="re-inspector-char-name">{nameB}</span>
          </h2>
          <button onClick={onClose} className="re-close-btn" aria-label="Close inspector" data-autofocus>×</button>
        </div>
        <div className="re-inspector-pills" role="group" aria-label="What it is">
          <span className="re-inspector-title">{typeLabel(rel)}</span>
          {rel.stage && <span className={`re-stage ${STAGE_TONE[rel.stage] || ''} is-current`}>{stageLabel(rel.stage)}</span>}
          {romantic && <Pill color={T.roseDeep} bg={T.roseFog}>Romance</Pill>}
          {tc && <Pill color={tc.color} bg={tc.bg}>{humanize(rel.tension_state)}</Pill>}
          {secrecy && <Pill color={T.orchidDeep} bg={T.orchidFog}>{secrecy}</Pill>}
        </div>
        {rel.situation && <p className="re-inspector-situation">{rel.situation}</p>}
      </div>

      {/* body */}
      <div className="re-inspector-body">
        {edit ? (
          <>
            <Label htmlFor={idOf('relationship_type')}>Relationship Type</Label>
            <Input id={idOf('relationship_type')} value={f.relationship_type} onChange={set('relationship_type')} placeholder="love_interest, rival, mentor…" />
            <label className="re-check">
              <input type="checkbox" checked={f.is_romantic} onChange={e => setF(p => ({ ...p, is_romantic: e.target.checked }))} />
              Romantic (a love interest)
            </label>
            <Label htmlFor={idOf('connection_mode')}>Connection Mode</Label>
            <Select id={idOf('connection_mode')} value={f.connection_mode} onChange={set('connection_mode')}>
              {CONN_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
            <Label htmlFor={idOf('status')}>Status</Label>
            <Select id={idOf('status')} value={f.status} onChange={set('status')}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Label htmlFor={idOf('tension_state')}>Tension State</Label>
            <Select id={idOf('tension_state')} value={f.tension_state} onChange={set('tension_state')}>
              <option value="">None</option>
              {TENSIONS.map(t => <option key={t} value={t}>{humanize(t)}</option>)}
            </Select>
            <Label htmlFor={idOf('pain_point_category')}>Pain Point</Label>
            <Input id={idOf('pain_point_category')} value={f.pain_point_category} onChange={set('pain_point_category')} placeholder="identity, loyalty, trust…" />
            <Label htmlFor={idOf('situation')}>Situation</Label>
            <Input id={idOf('situation')} value={f.situation} onChange={set('situation')} multiline />
            {!f.is_romantic && (
              <>
                <Label htmlFor={idOf('family_role')}>Family Role</Label>
                <Input id={idOf('family_role')} value={f.family_role} onChange={set('family_role')} placeholder="mother, brother…" />
              </>
            )}
            <Label htmlFor={idOf('conflict_summary')}>Conflict Summary</Label>
            <Input id={idOf('conflict_summary')} value={f.conflict_summary} onChange={set('conflict_summary')} multiline />
            <hr className="re-inspector-divider" />
            <Label htmlFor={idOf('source_knows')}>{nameA} knows</Label>
            <Input id={idOf('source_knows')} value={f.source_knows} onChange={set('source_knows')} multiline />
            <Label htmlFor={idOf('target_knows')}>{nameB} knows</Label>
            <Input id={idOf('target_knows')} value={f.target_knows} onChange={set('target_knows')} multiline />
            <Label htmlFor={idOf('reader_knows')}>Reader knows</Label>
            <Input id={idOf('reader_knows')} value={f.reader_knows} onChange={set('reader_knows')} multiline />
            <hr className="re-inspector-divider" />
            <Label htmlFor={idOf('lala_mirror')}>Lala Mirror</Label>
            <Input id={idOf('lala_mirror')} value={f.lala_mirror} onChange={set('lala_mirror')} multiline />
            <Label htmlFor={idOf('career_echo_potential')}>Career Echo</Label>
            <Input id={idOf('career_echo_potential')} value={f.career_echo_potential} onChange={set('career_echo_potential')} multiline />
            <Label htmlFor={idOf('lala_connection')}>Lala Connection</Label>
            <Select id={idOf('lala_connection')} value={f.lala_connection} onChange={set('lala_connection')}>
              {lalaOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </Select>
            <Label htmlFor={idOf('notes')}>Notes</Label>
            <Input id={idOf('notes')} value={f.notes} onChange={set('notes')} multiline />
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

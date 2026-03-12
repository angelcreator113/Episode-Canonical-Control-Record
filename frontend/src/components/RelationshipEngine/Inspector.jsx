/**
 * Inspector — right-panel relationship detail & editor
 * Prime Studios · LalaVerse
 */
import { useState } from 'react';
import { T, TENSION, CONN_MODES, STATUSES, TENSIONS, LALA_CONN, initials } from './tokens';
import { Btn, Field, Label, Input, Select, Pill } from './primitives';

export default function Inspector({ rel, onClose, onUpdate, onDelete }) {
  const [edit, setEdit] = useState(false);
  const [f, setF]       = useState({
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
  });
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="re-inspector" role="complementary" aria-label="Relationship inspector">
      {/* header */}
      <div className="re-inspector-header">
        <div className="re-inspector-header-top">
          <span className="re-inspector-title">Detail</span>
          <button onClick={onClose} className="re-close-btn" aria-label="Close inspector">×</button>
        </div>
        {/* character pair */}
        <div className="re-inspector-pair">
          {[rel.character_a_name, rel.character_b_name].map((nm, i) => (
            <div key={i} className="re-inspector-char">
              <div className="re-inspector-avatar">{initials(nm || '?')}</div>
              <div className="re-inspector-char-name">{nm}</div>
            </div>
          ))}
          <div className="re-inspector-link-icon">
            <span className="re-inspector-arrow">↔</span>
            {rel.tension_state && TENSION[rel.tension_state] && (
              <Pill color={TENSION[rel.tension_state].color} bg={TENSION[rel.tension_state].bg}>
                {rel.tension_state}
              </Pill>
            )}
          </div>
        </div>
      </div>

      {/* body */}
      <div className="re-inspector-body">
        {edit ? (
          <>
            <Label>Relationship Type</Label>
            <Input value={f.relationship_type} onChange={set('relationship_type')} />
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
              {TENSIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Label>Pain Point</Label>
            <Input value={f.pain_point_category} onChange={set('pain_point_category')} placeholder="identity, loyalty, trust…" />
            <Label>Situation</Label>
            <Input value={f.situation} onChange={set('situation')} multiline />
            <Label>Family Role</Label>
            <Input value={f.family_role} onChange={set('family_role')} placeholder="mother, brother…" />
            <Label>Conflict Summary</Label>
            <Input value={f.conflict_summary} onChange={set('conflict_summary')} multiline />
            <hr className="re-inspector-divider" />
            <Label>{rel.character_a_name || 'A'} knows</Label>
            <Input value={f.source_knows} onChange={set('source_knows')} multiline />
            <Label>{rel.character_b_name || 'B'} knows</Label>
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
              {LALA_CONN.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </Select>
            <Label>Notes</Label>
            <Input value={f.notes} onChange={set('notes')} multiline />
          </>
        ) : (
          <>
            <Field label="Type" value={rel.relationship_type} />
            <Field label="Mode" value={rel.connection_mode} />
            <Field label="Status" value={rel.status} />
            <Field label="Pain Point" value={rel.pain_point_category} />
            <Field label="Situation" value={rel.situation} />
            <Field label="Family Role" value={rel.family_role} />
            <Field label="Conflict" value={rel.conflict_summary} />
            {(rel.source_knows || rel.target_knows || rel.reader_knows) && <hr className="re-inspector-divider-light" />}
            <Field label={`${rel.character_a_name || 'A'} knows`} value={rel.source_knows} />
            <Field label={`${rel.character_b_name || 'B'} knows`} value={rel.target_knows} />
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
            <Btn variant="primary" onClick={() => { onUpdate(f); setEdit(false); }} className="re-inspector-save">Save</Btn>
            <Btn variant="ghost" onClick={() => setEdit(false)}>Cancel</Btn>
          </>
        ) : (
          <>
            <Btn variant="outline" onClick={() => setEdit(true)} className="re-inspector-edit">Edit</Btn>
            <Btn variant="rose" onClick={onDelete} aria-label="Delete this relationship">Delete</Btn>
          </>
        )}
      </div>
    </div>
  );
}

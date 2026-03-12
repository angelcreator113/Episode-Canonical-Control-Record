/**
 * FamilyView — family bond cards with inline editing
 * Prime Studios · LalaVerse
 */
import { useState } from 'react';
import { T } from './tokens';
import { Btn, Spinner } from './primitives';

export default function FamilyView({ data, genning, onGenerate, onUpdateRole, onRelClick }) {
  const [editId, setEditId]     = useState(null);
  const [editRole, setEditRole] = useState('');

  if (!data) return <Spinner />;

  const { characters = [], family_bonds = [], romantic_bonds = [] } = data;
  const seen = new Set();
  const bonds = [...family_bonds, ...romantic_bonds].filter(b => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
  const connIds = new Set();
  bonds.forEach(b => { connIds.add(b.character_id_a); connIds.add(b.character_id_b); });
  const unconn = characters.filter(c => !connIds.has(c.id));

  if (!bonds.length) return (
    <div className="re-empty" role="status">
      <div className="re-empty-icon">⬡</div>
      <div className="re-empty-title">No Family Bonds Yet</div>
      <div className="re-empty-desc">
        Let AI analyze your characters and build family connections — parents, siblings, spouses, extended family.
      </div>
      <Btn variant="primary" onClick={onGenerate} disabled={genning}>
        {genning ? 'Generating…' : '⬡ Auto-Generate Family Tree'}
      </Btn>
    </div>
  );

  const bondColor = b => {
    const r = b.family_role || '';
    if (r.includes('wife') || r.includes('husband') || r.includes('spouse') || b.is_romantic) return T.rose;
    if (b.is_blood_relation) return T.orchid;
    return T.steel;
  };

  return (
    <div className="re-family" role="list" aria-label="Family bonds">
      {/* legend */}
      <div className="re-family-legend">
        {[[T.orchid, 'Blood'], [T.rose, 'Romantic/Married'], [T.steel, 'Step/Other']].map(([c, l]) => (
          <span key={l} className="re-family-legend-item">
            <span className="re-family-legend-dot" style={{ background: c }} />
            {l}
          </span>
        ))}
      </div>

      <div className="re-family-list">
        {bonds.map(b => {
          const col = bondColor(b);
          const nA = b.character_a_name || b.character_a_selected || '?';
          const nB = b.character_b_name || b.character_b_selected || '?';
          return (
            <div key={b.id} className="re-family-card" role="listitem"
              onClick={() => onRelClick(b)}
              onKeyDown={ev => { if (ev.key === 'Enter') onRelClick(b); }}
              tabIndex={0}>
              <div className="re-family-card-accent" style={{ background: col }} />
              <div className="re-family-card-body">
                <div className="re-family-card-pair">
                  <span className="re-family-card-name">{nA}</span>
                  <span className="re-family-card-arrow">→</span>
                  <span className="re-family-card-name">{nB}</span>
                </div>
                <div className="re-family-card-meta">
                  {editId === b.id ? (
                    <div className="re-family-edit" onClick={e => e.stopPropagation()}>
                      <input value={editRole} onChange={e => setEditRole(e.target.value)}
                        placeholder="mother, cousin…" autoFocus
                        className="cg-form-input re-family-edit-input"
                        aria-label="Family role"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && editRole.trim()) {
                            onUpdateRole(b.id, { family_role: editRole.trim() });
                            setEditId(null);
                          }
                          if (e.key === 'Escape') setEditId(null);
                        }} />
                      <Btn variant="outline" onClick={() => { onUpdateRole(b.id, { family_role: editRole.trim() }); setEditId(null); }}
                        className="re-family-edit-save">Save</Btn>
                    </div>
                  ) : (
                    <>
                      <span className="re-family-card-role" style={{ color: col }}>
                        {b.family_role || b.relationship_type || '—'}
                      </span>
                      <button className="re-family-card-edit-btn"
                        aria-label={`Edit role for ${nA} and ${nB}`}
                        onClick={e => { e.stopPropagation(); setEditId(b.id); setEditRole(b.family_role || ''); }}>
                        edit
                      </button>
                    </>
                  )}
                </div>
                {b.conflict_summary && <div className="re-family-card-conflict">{b.conflict_summary}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {unconn.length > 0 && (
        <div className="re-family-unconn">
          <div className="re-label">Not In Family Tree · {unconn.length}</div>
          <div className="re-family-unconn-list">
            {unconn.map(c => (
              <span key={c.id} className="re-family-unconn-chip">{c.display_name || c.selected_name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * FamilyView — the cast's family bonds, with inline role editing.
 * Prime Studios · LalaVerse
 *
 * It reads the page's relationships (the cast's confirmed, live pairs), so
 * it shows the same people as every other tab. A romantic relationship is
 * never family: it is listed apart, and its "edit" is not offered (the
 * 2026-10-23 audit found the edit writing "mother" onto a love interest).
 * Above the ties, the family tree (FamilyTree: the named families and the
 * ties, generations top to bottom; Evoni, 2026-10-23).
 */
import { useState } from 'react';
import { Heart } from 'lucide-react';
import { T, cname, sideName, typeLabel, isRomance } from './tokens';
import { Btn } from './primitives';
import FamilyTree, { useFamilies } from './FamilyTree';
import { isFamilyTie, isDashed } from './familyTree';

export default function FamilyView({ chars = [], rels = [], charById = {}, genning, onGenerate, onUpdateRole, onRelClick }) {
  const [editId, setEditId]     = useState(null);
  const [editRole, setEditRole] = useState('');

  const families = useFamilies();
  const family = rels.filter(isFamilyTie);
  // Romance, spouses and partners included, is listed apart (tokens' isRomance).
  const romantic = rels.filter(isRomance);
  const connIds = new Set();
  family.forEach(b => { connIds.add(b.character_id_a); connIds.add(b.character_id_b); });
  const unconn = chars.filter(c => !connIds.has(c.id));

  const save = b => {
    onUpdateRole(b.id, { family_role: editRole.trim() });
    setEditId(null);
  };

  const bondColor = b => (isDashed(b.family_kind) || (!b.family_kind && !b.is_blood_relation) ? T.steel : T.orchid);

  return (
    <div className="re-family" aria-label="Family bonds">
      <FamilyTree rels={family} charById={charById} families={families} onRelClick={onRelClick} />
      {family.length === 0 && families.length === 0 ? (
        <div className="re-empty" role="status">
          <div className="re-empty-icon">⬡</div>
          <div className="re-empty-title">No Family Bonds Yet</div>
          <div className="re-empty-desc">
            Let AI propose family for the cast (parents, siblings, extended family). They arrive as seeds for you to confirm.
          </div>
          <Btn variant="primary" onClick={onGenerate} disabled={genning}>
            {genning ? 'Generating…' : '⬡ Propose Family'}
          </Btn>
        </div>
      ) : family.length === 0 ? null : (
        <>
          <div className="re-label">Family ties · {family.length}</div>
          <div className="re-family-legend">
            {[[T.orchid, 'Blood, adoptive, married in'], [T.steel, 'Step, chosen, not known']].map(([c, l]) => (
              <span key={l} className="re-family-legend-item">
                <span className="re-family-legend-dot" style={{ background: c }} />
                {l}
              </span>
            ))}
          </div>
          <div className="re-family-list" role="list" aria-label="Family ties">
            {family.map(b => {
              const col = bondColor(b);
              const nA = sideName(b, 'a', charById);
              const nB = sideName(b, 'b', charById);
              return (
                <div key={b.id} className="re-family-card" role="listitem"
                  onClick={() => onRelClick(b)}
                  // Only Enter on the card itself: Enter in the role box or on
                  // its buttons must not open the Inspector too.
                  onKeyDown={ev => { if (ev.key === 'Enter' && ev.target === ev.currentTarget) onRelClick(b); }}
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
                              e.stopPropagation();
                              if (e.key === 'Enter') save(b);
                              if (e.key === 'Escape') setEditId(null);
                            }} />
                          <Btn variant="outline" onClick={() => save(b)} className="re-family-edit-save">Save</Btn>
                        </div>
                      ) : (
                        <>
                          <span className="re-family-card-role" style={{ color: col }}>
                            {b.family_role || typeLabel(b)}{b.family_kind ? ` · ${b.family_kind}` : ''}
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
        </>
      )}

      {romantic.length > 0 && (
        <div className="re-family-romance" aria-label="Love interests and partners">
          <div className="re-label">Love interests &amp; partners · not family</div>
          <div className="re-family-unconn-list">
            {romantic.map(r => (
              <button key={r.id} type="button" className="re-family-unconn-chip is-romantic" onClick={() => onRelClick(r)}>
                <Heart size={12} fill="currentColor" aria-hidden /> {sideName(r, 'a', charById)} &amp; {sideName(r, 'b', charById)}
                {r.family_role ? ` · ${r.family_role}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {unconn.length > 0 && (
        <div className="re-family-unconn">
          <div className="re-label">Not In Family Tree · {unconn.length}</div>
          <div className="re-family-unconn-list">
            {unconn.map(c => (
              <span key={c.id} className="re-family-unconn-chip">{cname(c)}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

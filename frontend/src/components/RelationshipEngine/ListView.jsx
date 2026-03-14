/**
 * ListView — tabular relationship view
 * Prime Studios · LalaVerse
 */
import { TENSION } from './tokens';
import { Pill } from './primitives';

export default function ListView({ rels, onSelect }) {
  if (!rels.length) return (
    <div className="re-empty" role="status">
      <div className="re-empty-icon" style={{ fontSize: 32 }}>≡</div>
      <div className="re-empty-title">No Confirmed Relationships</div>
      <div className="re-empty-desc">Confirm candidate seeds or add manually</div>
    </div>
  );

  return (
    <div className="re-list-wrap">
      <table className="cg-table" role="grid" aria-label="Relationships list">
        <thead>
          <tr>
            {['Character A', 'Type', 'Character B', 'Mode', 'Tension', 'Status'].map(h => (
              <th key={h} scope="col">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rels.map(r => {
            const tc = r.tension_state && TENSION[r.tension_state];
            return (
              <tr key={r.id} onClick={() => onSelect(r)} tabIndex={0}
                onKeyDown={ev => { if (ev.key === 'Enter') onSelect(r); }}
                aria-label={`${r.character_a_name} ${r.relationship_type} ${r.character_b_name}`}>
                <td className="re-list-name">{r.character_a_name}</td>
                <td><Pill color="#a889c8">{r.relationship_type}</Pill></td>
                <td className="re-list-name">{r.character_b_name}</td>
                <td className="re-list-dim">{r.connection_mode}</td>
                <td>{tc && <Pill color={tc.color} bg={tc.bg}>{r.tension_state}</Pill>}</td>
                <td className="re-list-dim">{r.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

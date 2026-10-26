/**
 * ListView — every confirmed relationship: a table, and cards on a phone
 * (the CSS shows one or the other under 600px). On a tablet the table drops
 * Mode and Status (the Inspector has them) so it fits without scrolling.
 * Prime Studios · LalaVerse
 */
import { Heart } from 'lucide-react';
import { T, TENSION, STAGE_TONE, sideName, typeLabel, stageLabel, humanize, isLoveInterest } from './tokens';
import { Pill } from './primitives';

function Stage({ stage }) {
  if (!stage) return <span className="re-list-dim">—</span>;
  return <span className={`re-stage ${STAGE_TONE[stage] || ''}`}>{stageLabel(stage)}</span>;
}

// Columns a tablet's table leaves out (RelationshipEngine.css).
const OPTIONAL = { Mode: 're-col-optional', Status: 're-col-optional' };

export default function ListView({ rels, charById = {}, onSelect, selectedId = null }) {
  if (!rels.length) return (
    <div className="re-empty" role="status">
      <div className="re-empty-icon" style={{ fontSize: 32 }}>≡</div>
      <div className="re-empty-title">No Confirmed Relationships</div>
      <div className="re-empty-desc">Confirm candidate seeds or add manually</div>
    </div>
  );

  const rows = rels.map(r => ({ r, a: sideName(r, 'a', charById), b: sideName(r, 'b', charById), tc: r.tension_state && TENSION[r.tension_state] }));

  return (
    <div className="re-list-wrap">
      <table className="cg-table re-list-table" aria-label="Relationships list">
        <thead>
          <tr>
            {['Character A', 'Type', 'Character B', 'Stage', 'Mode', 'Tension', 'Status'].map(h => (
              <th key={h} scope="col" className={OPTIONAL[h] || undefined}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ r, a, b, tc }) => (
            <tr key={r.id} onClick={() => onSelect(r)} tabIndex={0}
              className={r.id === selectedId ? 'is-selected' : undefined}
              onKeyDown={ev => { if (ev.key === 'Enter') onSelect(r); }}
              aria-label={`${a} ${typeLabel(r)} ${b}`}>
              <td className="re-list-name">{a}</td>
              <td><Pill color={T.orchid}>{isLoveInterest(r) && <Heart size={10} fill="currentColor" aria-hidden />} {typeLabel(r)}</Pill></td>
              <td className="re-list-name">{b}</td>
              <td><Stage stage={r.stage} /></td>
              <td className="re-list-dim re-col-optional">{r.connection_mode}</td>
              <td>{tc && <Pill color={tc.color} bg={tc.bg}>{humanize(r.tension_state)}</Pill>}</td>
              <td className="re-list-dim re-col-optional">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="re-list-cards" aria-label="Relationships">
        {rows.map(({ r, a, b, tc }) => (
          <li key={r.id}>
            <button type="button" className={`re-list-card ${r.id === selectedId ? 'is-selected' : ''}`} onClick={() => onSelect(r)}>
              <span className="re-list-card-pair">{a} <span aria-hidden>↔</span> {b}</span>
              <span className="re-list-card-meta">
                <Pill color={T.orchid}>{isLoveInterest(r) && <Heart size={10} fill="currentColor" aria-hidden />} {typeLabel(r)}</Pill>
                {r.stage && <Stage stage={r.stage} />}
                {tc && <Pill color={tc.color} bg={tc.bg}>{humanize(r.tension_state)}</Pill>}
              </span>
              {r.situation && <span className="re-list-card-note">{r.situation}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

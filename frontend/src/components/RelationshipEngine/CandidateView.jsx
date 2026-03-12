/**
 * CandidateView — AI-proposed relationship seed cards
 * Prime Studios · LalaVerse
 */
import { T, TENSION } from './tokens';
import { Btn, Pill } from './primitives';

export default function CandidateView({ cands, onConfirm, onDismiss, busy }) {
  if (!cands.length) return (
    <div className="re-empty" role="status">
      <div className="re-empty-icon">◈</div>
      <div className="re-empty-title">No Proposed Seeds</div>
      <div className="re-empty-desc">
        Let AI analyse your registry and suggest relationships with tension states, LalaVerse mirrors, and career echoes.
      </div>
    </div>
  );

  return (
    <div className="cg-seed-grid" role="list" aria-label="Candidate relationships">
      {cands.map(c => {
        const tc = c.tension_state && TENSION[c.tension_state];
        return (
          <div key={c.id} className="re-candidate-card re-fade-in" role="listitem">
            <div className="re-accent-bar" />
            <div className="re-candidate-body">
              {/* names */}
              <div className="re-candidate-pair">
                <span className="re-candidate-name">{c.character_a_name || 'Character A'}</span>
                <span className="re-candidate-arrow">↔</span>
                <span className="re-candidate-name">{c.character_b_name || 'Character B'}</span>
              </div>
              {/* type */}
              <div className="re-candidate-type">{c.relationship_type}</div>
              {/* situation */}
              {c.situation && <p className="re-candidate-situation">{c.situation}</p>}
              {/* pills */}
              <div className="re-candidate-pills">
                {tc && <Pill color={tc.color} bg={tc.bg}>{c.tension_state}</Pill>}
                {c.connection_mode && <Pill color={T.steel} bg={T.steelFog}>{c.connection_mode}</Pill>}
                {c.pain_point_category && <Pill color={T.rose} bg={T.roseFog}>{c.pain_point_category}</Pill>}
              </div>
              {/* meta */}
              {c.lala_mirror && (
                <div className="re-candidate-meta">
                  <span className="re-candidate-meta-key" style={{ color: T.orchid }}>Mirror · </span>{c.lala_mirror}
                </div>
              )}
              {c.career_echo_potential && (
                <div className="re-candidate-meta">
                  <span className="re-candidate-meta-key" style={{ color: '#b89060' }}>Echo · </span>{c.career_echo_potential}
                </div>
              )}
              {/* actions */}
              <div className="re-candidate-actions">
                <Btn variant="primary" onClick={() => onConfirm(c.id)} disabled={busy}
                  className="re-candidate-confirm" aria-label={`Confirm ${c.character_a_name} ↔ ${c.character_b_name}`}>
                  ✓ Confirm
                </Btn>
                <Btn variant="ghost" onClick={() => onDismiss(c.id)} disabled={busy}
                  aria-label={`Dismiss ${c.character_a_name} ↔ ${c.character_b_name}`}>
                  ✕
                </Btn>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

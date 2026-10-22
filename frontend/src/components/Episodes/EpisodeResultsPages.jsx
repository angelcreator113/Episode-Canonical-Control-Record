// Results → Evaluation and Results → Story (the Results redesign,
// 2026-10-08). They were inline in EpisodeDetail in the old look; they now
// wear the Summary's card language (EpisodeResultsSummary.css, Evoni's
// Episode mock). What they read and call is unchanged.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Smartphone, Scissors, RotateCcw, Library } from 'lucide-react';
import api from '../../services/api';
import EpisodeBookSteps, { Why } from './EpisodeBookSteps';
import './EpisodeResultsSummary.css';

const TIER_STYLES = {
  slay: { color: 'var(--lala-gold-text)', bg: 'var(--lala-gold-soft)', emoji: '👑', label: 'Slay' },
  pass: { color: 'var(--success-text)', bg: 'var(--success-bg)', emoji: '✨', label: 'Pass' },
  safe: { color: 'var(--warning-text)', bg: 'var(--warning-bg)', emoji: '😐', label: 'Safe' },
  fail: { color: 'var(--danger-text)', bg: 'var(--danger-bg)', emoji: '💔', label: 'Fail' },
};

const STATS = [
  { key: 'coins', label: 'Coins', icon: '🪙' },
  { key: 'reputation', label: 'Reputation', icon: '⭐' },
  { key: 'brand_trust', label: 'Brand Trust', icon: '🤝' },
  { key: 'influence', label: 'Influence', icon: '📣' },
  { key: 'stress', label: 'Stress', icon: '😰' },
];

const signed = (n) => `${n > 0 ? '+' : ''}${n}`;

function parseEvaluation(raw) {
  if (!raw) return null;
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch (err) {
    console.error('[EpisodeResults] evaluation_json is not JSON:', err);
    return null;
  }
}

/**
 * The evaluation. `embedded` (under Results › Summary since Evoni's layout
 * list of 2026-10-22, Evaluation was its own pill): the score breakdown,
 * the social tasks and the outfit only, as the Summary already shows the
 * verdict, the stat changes and the money; nothing before there is one.
 */
export function EpisodeResultsEvaluation({ episode, embedded = false }) {
  const evalJson = parseEvaluation(episode?.evaluation_json);

  if (!evalJson && embedded) return null;
  if (!evalJson) {
    return (
      <div className="ers">
        <section className="ers-empty" data-testid="results-evaluation-empty">
          <Crown size={30} className="ers-empty-icon" aria-hidden="true" />
          <h3 className="ers-empty-title">Not evaluated yet</h3>
          <p className="ers-note">
            Complete this episode from the event panel to evaluate it. Evaluation scores the outfit match,
            the event, the social tasks and the money.
          </p>
        </section>
      </div>
    );
  }

  const tier = TIER_STYLES[evalJson.tier_final] || TIER_STYLES.safe;
  const breakdown = evalJson.breakdown || {};
  const deltas = evalJson.stat_deltas || {};
  const narrative = evalJson.narrative_lines || {};
  const social = evalJson.social_task_bonuses?.detail || {};
  const wardrobe = evalJson.wardrobe_bonuses?.detail || {};
  const financials = evalJson.financial_summary || {};
  const income = financials.total_income || 0;
  const expenses = financials.total_expenses || 0;
  const net = income - expenses;
  const hasSocial = social.total > 0;
  const hasWardrobe = wardrobe.brands?.length > 0;
  const hasMoney = income > 0 || expenses > 0;

  if (embedded) {
    return (
      <section className="ers-evaluation" id="results-evaluation" aria-labelledby="results-evaluation-title" data-testid="results-evaluation">
        <div className="ers-head">
          <h3 className="ers-card-title" id="results-evaluation-title">The evaluation</h3>
          <span className="ers-sub">How the episode scored</span>
        </div>
        <div className={`ers-grid${hasSocial || hasWardrobe ? ' is-three' : ''}`}>
          <section className="ers-card">
            <h3 className="ers-label">Score breakdown</h3>
            <ul className="ers-rows">
              {Object.entries(breakdown).map(([key, entry]) => (
                <li key={key}>
                  <span className="ers-row-name">
                    <span className="ers-cap">{key.replace(/_/g, ' ')}</span>
                    {entry?.detail && <em>{entry.detail}</em>}
                  </span>
                  <strong className={entry?.value >= 0 ? 'is-up' : 'is-down'}>{signed(entry?.value ?? 0)}</strong>
                </li>
              ))}
              <li className="ers-total"><span>Total</span><strong style={{ color: tier.color }}>{evalJson.score}</strong></li>
            </ul>
          </section>
          {hasSocial && (
            <section className="ers-card">
              <h3 className="ers-label">Social tasks</h3>
              <div className="ers-big">{social.completed}/{social.total}</div>
              <p className="ers-note">
                {social.completion_rate}% complete
                {social.all_required_done && <span className="ers-good"> · All required done</span>}
              </p>
            </section>
          )}
          {hasWardrobe && (
            <section className="ers-card">
              <h3 className="ers-label">Outfit</h3>
              <p className="ers-text">Brands: {wardrobe.brands.join(', ')}</p>
              <p className="ers-note">
                Tier gap: {wardrobe.tier_gap > 0 ? 'overdressed' : wardrobe.tier_gap < 0 ? 'underdressed' : 'perfect match'}
              </p>
            </section>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="ers" data-testid="results-evaluation">
      <div className="ers-head">
        <h2 className="ers-title">Evaluation</h2>
        <span className="ers-sub">How the episode scored</span>
      </div>

      <section className="ers-verdict" style={{ '--tier-color': tier.color, '--tier-bg': tier.bg }}>
        <span className="ers-verdict-emoji" aria-hidden="true">{tier.emoji}</span>
        <div className="ers-verdict-text">
          <div className="ers-verdict-tier">{tier.label}</div>
          <div className="ers-verdict-score">{evalJson.score}<span>/100</span></div>
          {(narrative.short || narrative.dramatic) && <p className="ers-verdict-line">{narrative.short || narrative.dramatic}</p>}
        </div>
      </section>

      <div className="ers-grid">
        <section className="ers-card">
          <h3 className="ers-label">Score breakdown</h3>
          <ul className="ers-rows">
            {Object.entries(breakdown).map(([key, entry]) => (
              <li key={key}>
                <span className="ers-row-name">
                  <span className="ers-cap">{key.replace(/_/g, ' ')}</span>
                  {entry?.detail && <em>{entry.detail}</em>}
                </span>
                <strong className={entry?.value >= 0 ? 'is-up' : 'is-down'}>{signed(entry?.value ?? 0)}</strong>
              </li>
            ))}
            <li className="ers-total"><span>Total</span><strong style={{ color: tier.color }}>{evalJson.score}</strong></li>
          </ul>
        </section>

        <section className="ers-card">
          <h3 className="ers-label ers-label-pink">Lala's stat changes</h3>
          <div className="ers-deltas">
            {STATS.map((stat) => {
              const val = deltas[stat.key] || 0;
              const good = stat.key === 'stress' ? val < 0 : val > 0;
              const bad = stat.key === 'stress' ? val > 0 : val < 0;
              return (
                <div key={stat.key} className={`ers-delta${good ? ' is-good' : bad ? ' is-bad' : ''}`}>
                  <span className="ers-delta-icon" aria-hidden="true">{stat.icon}</span>
                  <span className="ers-delta-value">{signed(val)}</span>
                  <span className="ers-delta-label">{stat.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {(hasSocial || hasWardrobe || hasMoney) && (
        <div className="ers-grid is-three">
          {hasSocial && (
            <section className="ers-card">
              <h3 className="ers-label">Social tasks</h3>
              <div className="ers-big">{social.completed}/{social.total}</div>
              <p className="ers-note">
                {social.completion_rate}% complete
                {social.all_required_done && <span className="ers-good"> · All required done</span>}
              </p>
            </section>
          )}
          {hasWardrobe && (
            <section className="ers-card">
              <h3 className="ers-label">Outfit</h3>
              <p className="ers-text">Brands: {wardrobe.brands.join(', ')}</p>
              <p className="ers-note">
                Tier gap: {wardrobe.tier_gap > 0 ? 'overdressed' : wardrobe.tier_gap < 0 ? 'underdressed' : 'perfect match'}
              </p>
            </section>
          )}
          {hasMoney && (
            <section className="ers-card">
              <h3 className="ers-label">Money</h3>
              <ul className="ers-rows">
                <li><span>Income</span><strong className="is-up">+{income}</strong></li>
                <li><span>Expenses</span><strong className="is-down">−{expenses}</strong></li>
                <li className="ers-total"><span>Net</span><strong className={net >= 0 ? 'is-up' : 'is-down'}>{signed(net)}</strong></li>
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// The other ways to tell it; the short story is step 2 of the path
// (EpisodeBookSteps), written there only (Evoni, 2026-10-22 layout list).
const STORY_FORMATS = [
  { format: 'social_fiction', Icon: Smartphone, label: 'Social fiction', desc: 'Posts and DMs' },
  { format: 'snippet', Icon: Scissors, label: 'Snippet', desc: '400–600 words' },
  { format: 'recap', Icon: RotateCcw, label: 'Recap', desc: 'A casual retelling' },
];

/**
 * Results › Story: one path from the episode to the book (EpisodeBookSteps:
 * record, short story, canon check, beat 11 piece, chapter), the other
 * formats as a small row under it, and "Plan the next chapters" folded at the
 * bottom (Evoni, 2026-10-22 layout list).
 */
export function EpisodeResultsStory({ episode }) {
  const showId = episode?.show_id || episode?.showId;
  // format -> 'busy' | 'done' | 'failed'; one generation at a time.
  const [state, setState] = useState({});
  const [error, setError] = useState(null);
  const busy = Object.values(state).includes('busy');

  const generate = async (format) => {
    setError(null);
    setState((s) => ({ ...s, [format]: 'busy' }));
    try {
      await api.post(`/api/v1/world/${showId}/episodes/${episode.id}/generate-story`, { format });
      setState((s) => ({ ...s, [format]: 'done' }));
    } catch (err) {
      console.error('[EpisodeResults] story generation failed:', err);
      setState((s) => ({ ...s, [format]: 'failed' }));
      setError(err?.response?.data?.error || 'The story could not be generated.');
    }
  };

  return (
    <div className="ers" data-testid="results-story">
      <div className="ers-head">
        <h2 className="ers-title">Stories</h2>
        <span className="ers-sub">From the episode to the book</span>
        <Why id="ers-story-why" label="What the story path is">
          The episode is what the viewer sees, the short story is the event in full, and the chapter is
          everything the viewer does not see, in JustAWoman's point of view.
        </Why>
        <Link className="ers-btn" to="/stories"><Library size={14} aria-hidden="true" /> Open Stories Library</Link>
      </div>

      <EpisodeBookSteps episode={episode}>
        <section className="ers-card ers-more" aria-labelledby="ers-more-title">
          <div className="ers-more-head">
            <h3 className="ers-label" id="ers-more-title">More ways to tell it</h3>
            <span className="ers-sub">Each goes to the Stories Library</span>
          </div>
          <div className="ers-formats is-row">
            {STORY_FORMATS.map(({ format, Icon, label, desc }) => {
              const s = state[format];
              return (
                <button
                  key={format}
                  type="button"
                  className={`ers-format is-chip${s === 'done' ? ' is-done' : s === 'failed' ? ' is-failed' : ''}`}
                  data-testid={`results-story-${format}`}
                  disabled={busy}
                  onClick={() => generate(format)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span className="ers-format-label">{label}</span>
                  <span className="ers-format-desc">
                    {s === 'busy' ? 'Writing…' : s === 'done' ? 'Done · in Stories' : s === 'failed' ? 'Failed · try again' : desc}
                  </span>
                </button>
              );
            })}
          </div>
          {error && <p className="ers-error" role="alert">{error}</p>}
        </section>
      </EpisodeBookSteps>
    </div>
  );
}

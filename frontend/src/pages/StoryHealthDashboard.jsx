/**
 * StoryHealthDashboard.jsx — Story Health Metrics & Quality Overview
 *
 * Visualizes: story quality scores, pacing curves, character arc %,
 * thread resolution rates, content velocity (stories/week),
 * evaluation scores, recent activity.
 */
import { useState, useEffect, useMemo } from 'react';
import apiClient from '../services/api';
import './StoryHealthDashboard.css';

const API = '/api/v1/story-health';

// ─── Track 6 CP7 module-scope helper (Pattern F prophylactic — Api suffix) ───
export const getStoryHealthDashboardApi = () => apiClient.get(`${API}/dashboard`);

// Each arc phase is a token family: the name reads 4.5:1 on white as the
// text twin, the progress bar is the family fill.
export const PHASE_TONES = {
  establishment: { text: 'var(--lala-gold-text)',      fill: 'var(--lala-gold)' },
  pressure:      { text: 'var(--danger-text)',         fill: 'var(--danger)' },
  crisis:        { text: 'var(--lala-lavender-text)',  fill: 'var(--lala-lavender)' },
  integration:   { text: 'var(--success-text)',        fill: 'var(--success)' },
};
const NEUTRAL_TONE = { text: 'var(--text-secondary)', fill: 'var(--text-secondary)' };

// The stat tiles' numbers, each a text token that reads 4.5:1 on white.
export const STAT_TONES = {
  total:    'var(--lala-gold-text)',
  approved: 'var(--success-text)',
  drafts:   'var(--info-text)',
  rejected: 'var(--danger-text)',
  words:    'var(--lala-lavender-text)',
  avgWords: 'var(--primary-text)',
  evalAvg:  'var(--warning-text)',
  threads:  'var(--accent-dark)',
};

const STATUS_DOT = { approved: 'success', rejected: 'danger' };

export default function StoryHealthDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStoryHealthDashboardApi()
      .then(res => setData(res.data))
      .catch(err => console.error('Story health dashboard load failed:', err))
      .finally(() => setLoading(false));
  }, []);

  const velocityMax = useMemo(() => {
    if (!data?.velocity?.length) return 1;
    return Math.max(...data.velocity.map(v => v.stories_created || 0), 1);
  }, [data]);

  if (loading) {
    return (
      <div className="shd-page">
        <div className="shd-loading">Loading dashboard…</div>
      </div>
    );
  }

  const s = data?.stories || {};
  const threads = data?.threads || {};
  const evalData = data?.evaluation || {};

  return (
    <div className="shd-page">
      <div className="shd-inner">
        <h1 className="shd-title">Story Health Dashboard</h1>
        <p className="shd-lede">
          Quality metrics, pacing curves, and content velocity across your narrative universe.
        </p>

        {/* ── Top Stats Grid ── */}
        <div className="shd-stats">
          {[
            { label: 'Total Stories', value: s.total_stories || 0, color: STAT_TONES.total },
            { label: 'Approved', value: s.approved_stories || 0, color: STAT_TONES.approved },
            { label: 'Drafts', value: s.draft_stories || 0, color: STAT_TONES.drafts },
            { label: 'Rejected', value: s.rejected_stories || 0, color: STAT_TONES.rejected },
            { label: 'Total Words', value: (s.total_words || 0).toLocaleString(), color: STAT_TONES.words },
            { label: 'Avg Words/Story', value: s.avg_words_per_story || 0, color: STAT_TONES.avgWords },
            { label: 'Avg Eval Score', value: evalData.avg_score || '—', color: STAT_TONES.evalAvg },
            { label: 'Threads Active', value: threads.active || 0, color: STAT_TONES.threads },
          ].map(stat => (
            <div key={stat.label} className="shd-card shd-stat">
              <div className="shd-stat-value" style={{ color: stat.color }}>{stat.value}</div>
              <div className="shd-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ── Phase Arc Progress ── */}
        <Section title="Arc Phase Progress">
          <div className="shd-phases">
            {(data?.phases || []).map(p => {
              const total = p.total || 1;
              const pct = Math.round((p.approved / total) * 100);
              const tone = PHASE_TONES[p.phase] || NEUTRAL_TONE;
              return (
                <div key={p.phase} className="shd-card shd-phase">
                  <div className="shd-phase-head">
                    <span className="shd-phase-name" style={{ color: tone.text }}>{p.phase}</span>
                    <span className="shd-count">{p.approved}/{total}</span>
                  </div>
                  <div className="shd-track">
                    <div className="shd-fill" style={{ background: tone.fill, width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {(!data?.phases || data.phases.length === 0) && (
              <div className="shd-empty">No phase data yet. Generate and approve stories to see arc progress.</div>
            )}
          </div>
        </Section>

        {/* ── Content Velocity ── */}
        <Section title="Content Velocity (Last 8 Weeks)">
          {data?.velocity?.length > 0 ? (
            <div className="shd-velocity">
              {data.velocity.map((v, i) => {
                const h = Math.max(4, (v.stories_created / velocityMax) * 100);
                const ah = Math.max(2, (v.stories_approved / velocityMax) * 100);
                const weekLabel = new Date(v.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <div key={i} className="shd-week">
                    <div className="shd-bars">
                      <div className="shd-bar created" style={{ height: h }} title={`${v.stories_created} created`} />
                      <div className="shd-bar approved" style={{ height: ah }} title={`${v.stories_approved} approved`} />
                    </div>
                    <span className="shd-week-label">{weekLabel}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="shd-empty">No velocity data yet.</div>
          )}
          <div className="shd-legend">
            <span><span className="shd-swatch created" />Created</span>
            <span><span className="shd-swatch approved" />Approved</span>
          </div>
        </Section>

        {/* ── Character Arc Completion ── */}
        <Section title="Character Arc Completion">
          {(data?.characterArcs || []).length > 0 ? (
            <div className="shd-arcs">
              {data.characterArcs.slice(0, 10).map(c => {
                const pct = Math.min(100, Math.round((c.approved / 50) * 100));
                return (
                  <div key={c.character_key} className="shd-arc">
                    <span className="shd-arc-name">{c.character_key}</span>
                    <div className="shd-track">
                      <div className="shd-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="shd-arc-count">
                      {c.approved}/50 · {(c.words || 0).toLocaleString()}w
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="shd-empty">No character data yet.</div>
          )}
        </Section>

        {/* ── Thread Resolution ── */}
        <Section title="Thread Resolution">
          <div className="shd-threads">
            <div className="shd-ring">
              <svg viewBox="0 0 36 36">
                <circle className="shd-ring-track" cx="18" cy="18" r="15.9" fill="none" strokeWidth="3" />
                <circle className="shd-ring-value" cx="18" cy="18" r="15.9" fill="none" strokeWidth="3"
                  strokeDasharray={`${threads.total > 0 ? (threads.resolved / threads.total) * 100 : 0} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="shd-ring-pct">
                {threads.total > 0 ? Math.round((threads.resolved / threads.total) * 100) : 0}%
              </div>
            </div>
            <div className="shd-thread-lines">
              <div><strong>{threads.total || 0}</strong> total threads</div>
              <div><span className="shd-dot success" /> {threads.resolved || 0} resolved</div>
              <div><span className="shd-dot warning" /> {threads.active || 0} active</div>
            </div>
          </div>
        </Section>

        {/* ── Recent Activity ── */}
        <Section title="Recent Activity">
          {(data?.recentActivity || []).length > 0 ? (
            <div className="shd-activity">
              {data.recentActivity.map(s => (
                <div key={s.id} className="shd-row">
                  <span className={`shd-dot ${STATUS_DOT[s.status] || 'warning'}`} title={s.status} />
                  <span className="shd-row-title">{s.title}</span>
                  <span className="shd-row-meta">{s.character_key}</span>
                  <span className="shd-row-meta phase">{s.phase}</span>
                  <span className="shd-row-meta date">{new Date(s.updated_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="shd-empty">No recent activity.</div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="shd-section">
      <h3 className="shd-section-title">{title}</h3>
      {children}
    </div>
  );
}

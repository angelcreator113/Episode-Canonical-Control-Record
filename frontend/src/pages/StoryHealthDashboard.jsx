/**
 * StoryHealthDashboard.jsx — Story Health Metrics & Quality Overview
 *
 * Visualizes: story quality scores, pacing curves, character arc %,
 * thread resolution rates, content velocity (stories/week),
 * evaluation scores, recent activity.
 */
import { useState, useEffect, useMemo } from 'react';
import apiClient from '../services/api';
import './StoryEngine.css';

const API = '/api/v1/story-health';

// ─── Track 6 CP7 module-scope helper (Pattern F prophylactic — Api suffix) ───
export const getStoryHealthDashboardApi = () => apiClient.get(`${API}/dashboard`);

const PHASE_COLORS = {
  establishment: '#c9a84c',
  pressure:      '#d46070',
  crisis:        '#7b4ecf',
  integration:   '#3a9e5c',
};

export default function StoryHealthDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStoryHealthDashboardApi()
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const velocityMax = useMemo(() => {
    if (!data?.velocity?.length) return 1;
    return Math.max(...data.velocity.map(v => v.stories_created || 0), 1);
  }, [data]);

  if (loading) {
    return (
      <div className="se-page">
        <div style={{ textAlign: 'center', padding: 80, color: '#999' }}>Loading dashboard…</div>
      </div>
    );
  }

  const s = data?.stories || {};
  const threads = data?.threads || {};
  const evalData = data?.evaluation || {};

  return (
    <div className="se-page">
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 40px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 500, color: 'var(--se-text)', margin: '20px 0 8px' }}>
          Story Health Dashboard
        </h1>
        <p style={{ color: 'var(--se-text-muted)', fontSize: 13, marginBottom: 24 }}>
          Quality metrics, pacing curves, and content velocity across your narrative universe.
        </p>

        {/* ── Top Stats Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Total Stories', value: s.total_stories || 0, color: '#b0922e' },
            { label: 'Approved', value: s.approved_stories || 0, color: '#10b981' },
            { label: 'Drafts', value: s.draft_stories || 0, color: '#3b82f6' },
            { label: 'Rejected', value: s.rejected_stories || 0, color: '#ef4444' },
            { label: 'Total Words', value: (s.total_words || 0).toLocaleString(), color: '#8b5cf6' },
            { label: 'Avg Words/Story', value: s.avg_words_per_story || 0, color: '#6366f1' },
            { label: 'Avg Eval Score', value: evalData.avg_score || '—', color: '#f59e0b' },
            { label: 'Threads Active', value: threads.active || 0, color: '#06b6d4' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: '#fff', borderRadius: 12, padding: '16px 14px',
              border: '1px solid #e8e5de', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: stat.color, fontFamily: "'DM Sans',sans-serif" }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Phase Arc Progress ── */}
        <Section title="Arc Phase Progress">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {(data?.phases || []).map(p => {
              const total = p.total || 1;
              const pct = Math.round((p.approved / total) * 100);
              const color = PHASE_COLORS[p.phase] || '#999';
              return (
                <div key={p.phase} style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #e8e5de' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color, textTransform: 'capitalize' }}>{p.phase}</span>
                    <span style={{ fontSize: 12, color: '#888' }}>{p.approved}/{total}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: '#f0ede7' }}>
                    <div style={{ height: 6, borderRadius: 3, background: color, width: `${pct}%`, transition: 'width 0.5s' }} />
                  </div>
                </div>
              );
            })}
            {(!data?.phases || data.phases.length === 0) && (
              <div style={{ color: '#999', fontSize: 13 }}>No phase data yet. Generate and approve stories to see arc progress.</div>
            )}
          </div>
        </Section>

        {/* ── Content Velocity ── */}
        <Section title="Content Velocity (Last 8 Weeks)">
          {data?.velocity?.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, padding: '0 8px' }}>
              {data.velocity.map((v, i) => {
                const h = Math.max(4, (v.stories_created / velocityMax) * 100);
                const ah = Math.max(2, (v.stories_approved / velocityMax) * 100);
                const weekLabel = new Date(v.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 100 }}>
                      <div style={{ width: 14, height: h, background: '#b0922e', borderRadius: '3px 3px 0 0', opacity: 0.6 }} title={`${v.stories_created} created`} />
                      <div style={{ width: 14, height: ah, background: '#10b981', borderRadius: '3px 3px 0 0' }} title={`${v.stories_approved} approved`} />
                    </div>
                    <span style={{ fontSize: 9, color: '#999' }}>{weekLabel}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: '#999', fontSize: 13 }}>No velocity data yet.</div>
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10, color: '#999' }}>
            <span>■ Created</span>
            <span style={{ color: '#10b981' }}>■ Approved</span>
          </div>
        </Section>

        {/* ── Character Arc Completion ── */}
        <Section title="Character Arc Completion">
          {(data?.characterArcs || []).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.characterArcs.slice(0, 10).map(c => {
                const pct = Math.min(100, Math.round((c.approved / 50) * 100));
                return (
                  <div key={c.character_key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, width: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.character_key}
                    </span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#f0ede7' }}>
                      <div style={{ height: 8, borderRadius: 4, background: '#b0922e', width: `${pct}%`, transition: 'width 0.5s' }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#888', width: 80, textAlign: 'right' }}>
                      {c.approved}/50 · {(c.words || 0).toLocaleString()}w
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: '#999', fontSize: 13 }}>No character data yet.</div>
          )}
        </Section>

        {/* ── Thread Resolution ── */}
        <Section title="Thread Resolution">
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 80, height: 80 }}>
              <svg viewBox="0 0 36 36" style={{ width: 80, height: 80, transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f0ede7" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" strokeWidth="3"
                  strokeDasharray={`${threads.total > 0 ? (threads.resolved / threads.total) * 100 : 0} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#333' }}>
                {threads.total > 0 ? Math.round((threads.resolved / threads.total) * 100) : 0}%
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#666', lineHeight: 1.8 }}>
              <div><strong>{threads.total || 0}</strong> total threads</div>
              <div><span style={{ color: '#10b981' }}>●</span> {threads.resolved || 0} resolved</div>
              <div><span style={{ color: '#f59e0b' }}>●</span> {threads.active || 0} active</div>
            </div>
          </div>
        </Section>

        {/* ── Recent Activity ── */}
        <Section title="Recent Activity">
          {(data?.recentActivity || []).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.recentActivity.map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                  background: '#fafaf8', borderRadius: 8, fontSize: 12,
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: s.status === 'approved' ? '#10b981' : s.status === 'rejected' ? '#ef4444' : '#f59e0b',
                  }} />
                  <span style={{ fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title}
                  </span>
                  <span style={{ color: '#999', fontSize: 11 }}>{s.character_key}</span>
                  <span style={{ color: '#bbb', fontSize: 10 }}>
                    {s.phase}
                  </span>
                  <span style={{ color: '#ccc', fontSize: 10 }}>
                    {new Date(s.updated_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#999', fontSize: 13 }}>No recent activity.</div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
        color: 'var(--se-text)', textTransform: 'uppercase', letterSpacing: 0.8,
        marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e8e5de',
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

/**
 * SiteOrganizer.jsx — Site Organizer & Steps Agent Dashboard
 * Route: /site-organizer
 *
 * Four sub-agents: Navigation Auditor, Page Purpose, Flow Analyzer, Steps Planner
 */
import React, { useState, useEffect, useCallback } from 'react';
import './SiteOrganizer.css';

const API = '/api/v1/site-organizer';

// ──────────────────────────────────────────────────
// ScoreRing — reusable SVG donut
// ──────────────────────────────────────────────────
function ScoreRing({ score, size = 120 }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 85 ? '#22c55e' : score >= 65 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dy=".35em" fill={color}
        fontSize={size * 0.28} fontWeight="700">{score}</text>
    </svg>
  );
}

// ──────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────
const AGENT_META = {
  navigation_auditor: { icon: '🧭', label: 'Navigation Auditor', desc: 'Sidebar ↔ route alignment, dead links, orphan pages' },
  page_purpose:       { icon: '📋', label: 'Page Purpose',       desc: 'Page categorisation, redundancy, completeness' },
  flow_analyzer:      { icon: '🔀', label: 'Flow Analyzer',      desc: 'Zone coherence, user journeys, depth' },
  steps_planner:      { icon: '📝', label: 'Steps Planner',      desc: 'Prioritised improvement action items' },
};

const STATUS_COLORS = { healthy: '#22c55e', 'needs-attention': '#f59e0b', critical: '#ef4444' };
const LEVEL_ICONS   = { critical: '🔴', warning: '🟡', info: 'ℹ️', success: '✅' };
const LEVEL_COLORS  = { critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6', success: '#22c55e' };

// ──────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────
export default function SiteOrganizer() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quickStats, setQuickStats] = useState(null);
  const [tab, setTab] = useState('overview');
  const [agentLoading, setAgentLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState(null);
  const [agentResult, setAgentResult] = useState(null);

  // Load quick summary on mount
  useEffect(() => {
    fetch(`${API}/quick`).then(r => r.json()).then(setQuickStats).catch(() => {});
  }, []);

  const runScan = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch(`${API}/scan`).then(r => r.json());
      setReport(data);
      setTab('overview');
    } catch (err) { console.error('Scan failed:', err); }
    setLoading(false);
  }, []);

  const runAgent = useCallback(async (name) => {
    setAgentLoading(true);
    setActiveAgent(name);
    setAgentResult(null);
    try {
      const data = await fetch(`${API}/agent/${name}`).then(r => r.json());
      setAgentResult(data);
    } catch (err) { console.error(`Agent ${name} failed:`, err); }
    setAgentLoading(false);
  }, []);

  // ── Styles ──
  const page = { padding: 32, maxWidth: 1200, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#1f2937' };
  const card = { background: '#ffffff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
  const tabBar = { display: 'flex', gap: 4, marginBottom: 20, background: '#f3f4f6', padding: 4, borderRadius: 10 };
  const tabBtn = (active) => ({
    padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500,
    background: active ? '#ffffff' : 'transparent', color: active ? '#1f2937' : '#6b7280',
  });
  const btn = (variant) => ({
    padding: '10px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
    background: variant === 'primary' ? '#8b5cf6' : '#f3f4f6', color: variant === 'primary' ? '#fff' : '#374151', opacity: loading ? 0.6 : 1,
  });

  const TABS = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'findings', label: '🔍 Findings' },
    { key: 'agents',   label: '🤖 Sub-Agents' },
    { key: 'steps',    label: '📝 Steps' },
    { key: 'map',      label: '🗺️ Site Map' },
  ];

  return (
    <div className="so-page" style={page}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>🗺️ Site Organizer</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
            Navigation, purpose & flow analysis — your website's architect agent
          </p>
        </div>
        <button className="so-btn-primary" onClick={runScan} disabled={loading} style={btn('primary')}>
          {loading ? '⏳ Scanning…' : '🔍 Run Full Scan'}
        </button>
      </div>

      {/* Quick Stats */}
      {quickStats && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Routes', value: quickStats.routes, color: '#8b5cf6' },
            { label: 'Sidebar Links', value: quickStats.sidebar_links, color: '#3b82f6' },
            { label: 'Page Files', value: quickStats.page_files, color: '#f59e0b' },
            { label: 'Zones', value: quickStats.zones, color: '#22c55e' },
          ].map((s, i) => (
            <div key={i} style={{ ...card, flex: 1, textAlign: 'center', padding: 14 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!report && !loading && (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
          <h2 style={{ margin: '0 0 8px', fontWeight: 600 }}>Site Organizer Ready</h2>
          <p style={{ color: '#6b7280', margin: '0 0 24px', maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
            Run a full scan to analyse navigation structure, page purposes, user flow,
            and get prioritised improvement steps.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {Object.entries(AGENT_META).map(([key, meta]) => (
              <button key={key} className="so-agent-btn" onClick={() => runAgent(key)}
                style={{ ...card, padding: '14px 18px', cursor: 'pointer', border: '1px solid #d1d5db', textAlign: 'left', minWidth: 180 }}>
                <div style={{ fontSize: 20 }}>{meta.icon}</div>
                <div style={{ fontWeight: 600, marginTop: 4, fontSize: 13 }}>{meta.label}</div>
                <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>{meta.desc}</div>
              </button>
            ))}
          </div>
          {agentLoading && <p style={{ color: '#6b7280', marginTop: 24 }}>⏳ Running {AGENT_META[activeAgent]?.label}…</p>}
          {agentResult && activeAgent && (
            <div style={{ ...card, marginTop: 24, textAlign: 'left' }}>
              <AgentCard name={activeAgent} data={agentResult} card={card} />
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: 'spin 2s linear infinite' }}>⚙️</div>
          <h2 style={{ margin: '0 0 8px', fontWeight: 600 }}>Running Full Scan…</h2>
          <p style={{ color: '#6b7280' }}>4 sub-agents analysing navigation, pages, flow, and creating your steps plan</p>
        </div>
      )}

      {/* Report loaded — tabbed */}
      {report && !loading && (
        <>
          <div style={tabBar}>
            {TABS.map(t => (
              <button key={t.key} className={`so-tab-btn${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)} style={tabBtn(tab === t.key)}>{t.label}</button>
            ))}
          </div>
          {tab === 'overview' && <OverviewTab report={report} card={card} />}
          {tab === 'findings' && <FindingsTab report={report} card={card} />}
          {tab === 'agents'   && <AgentsTab report={report} card={card} onRunAgent={runAgent} agentLoading={agentLoading} />}
          {tab === 'steps'    && <StepsTab report={report} card={card} />}
          {tab === 'map'      && <SiteMapTab report={report} card={card} quickStats={quickStats} />}
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────
// Overview Tab
// ──────────────────────────────────────────────────
function OverviewTab({ report, card }) {
  return (
    <div>
      {/* Score Ring + status */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 24, flex: 1 }}>
          <ScoreRing score={report.overall_score} />
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>
              Site Health:&nbsp;
              <span style={{ color: STATUS_COLORS[report.overall_status] }}>
                {report.overall_status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
            </h2>
            <p style={{ color: '#6b7280', margin: '6px 0 0', fontSize: 13 }}>
              {report.all_findings.filter(f => f.level === 'critical').length} critical •
              {report.all_findings.filter(f => f.level === 'warning').length} warnings •
              {report.all_recommendations.length} recommendations
            </p>
            <p style={{ color: '#9ca3af', margin: '4px 0 0', fontSize: 12 }}>
              Scanned at {new Date(report.ran_at).toLocaleString()} ({report.duration_ms}ms)
            </p>
          </div>
        </div>
      </div>

      {/* Agent score cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {Object.entries(report.agents).map(([key, agent]) => {
          const meta = AGENT_META[key];
          return (
            <div key={key} style={{ ...card, flex: '1 1 180px', textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 24 }}>{meta.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>{meta.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: STATUS_COLORS[agent.status] || '#6b7280', marginTop: 8 }}>
                {agent.score}
              </div>
              <div style={{ fontSize: 11, color: STATUS_COLORS[agent.status], textTransform: 'uppercase', marginTop: 2 }}>
                {agent.status}
              </div>
            </div>
          );
        })}
      </div>

      {/* Top issues */}
      <div style={card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>🚨 Top Issues</h3>
        {report.all_findings.filter(f => f.level === 'critical' || f.level === 'warning').length === 0 && (
          <p style={{ color: '#22c55e', margin: 0 }}>✅ No critical issues — site structure looks great!</p>
        )}
        {report.all_findings.filter(f => f.level === 'critical' || f.level === 'warning').slice(0, 8).map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
            <span>{LEVEL_ICONS[f.level]}</span>
            <div>
              <div style={{ fontSize: 13 }}>{f.msg}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{AGENT_META[f.agent]?.label || f.agent}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────
// Findings Tab
// ──────────────────────────────────────────────────
function FindingsTab({ report, card }) {
  const [filter, setFilter] = useState('all');
  const findings = filter === 'all' ? report.all_findings : report.all_findings.filter(f => f.level === filter);

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>All Findings ({findings.length})</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'critical', 'warning', 'info', 'success'].map(l => (
            <button key={l} className="so-filter-btn" onClick={() => setFilter(l)}
              style={{ padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 12, cursor: 'pointer',
                background: filter === l ? (LEVEL_COLORS[l] || '#374151') : '#f3f4f6',
                color: filter === l ? '#fff' : '#6b7280' }}>
              {l === 'all' ? 'All' : l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {findings.map((f, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid #e5e7eb', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{LEVEL_ICONS[f.level]}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13 }}>{f.msg}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              {AGENT_META[f.agent]?.icon} {AGENT_META[f.agent]?.label || f.agent}
            </div>
          </div>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: (LEVEL_COLORS[f.level] || '#3b82f6') + '22', color: LEVEL_COLORS[f.level] || '#3b82f6', fontWeight: 600 }}>
            {f.level.toUpperCase()}
          </span>
        </div>
      ))}
      {findings.length === 0 && <p style={{ color: '#9ca3af', textAlign: 'center', padding: 24 }}>No findings match this filter.</p>}
    </div>
  );
}

// ──────────────────────────────────────────────────
// Agents Tab
// ──────────────────────────────────────────────────
function AgentsTab({ report, card, onRunAgent, agentLoading }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Object.entries(report.agents).map(([key, agent]) => (
        <AgentCard key={key} name={key} data={agent} card={card} onRerun={() => onRunAgent(key)} rerunLoading={agentLoading} />
      ))}
    </div>
  );
}

function AgentCard({ name, data, card, onRerun, rerunLoading }) {
  const meta = AGENT_META[name];
  const [expanded, setExpanded] = useState(true);
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>{meta.icon}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 15 }}>{meta.label}</h3>
            <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{meta.desc}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: STATUS_COLORS[data.status] }}>{data.score}</span>
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6,
            background: (STATUS_COLORS[data.status] || '#9ca3af') + '22',
            color: STATUS_COLORS[data.status] || '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>
            {data.status}
          </span>
          {onRerun && (
            <button className="so-rerun-btn" onClick={(e) => { e.stopPropagation(); onRerun(); }} disabled={rerunLoading}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: 12 }}>
              🔄
            </button>
          )}
          <span style={{ color: '#9ca3af', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 16 }}>
          {data.findings.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 13 }}>
              <span>{LEVEL_ICONS[f.level]}</span>
              <span>{f.msg}</span>
            </div>
          ))}
          {data.recommendations.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, background: '#f3f4f6', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#8b5cf6', marginBottom: 6 }}>💡 Recommendations</div>
              {data.recommendations.map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: '#4b5563', padding: '3px 0' }}>→ {r}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────
// Steps Tab (from steps_planner)
// ──────────────────────────────────────────────────
function StepsTab({ report, card }) {
  const stepsData = report.agents.steps_planner?.data?.steps || [];
  const PRIO_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#3b82f6' };

  return (
    <div style={card}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📝 Improvement Steps ({stepsData.length})</h3>
      {stepsData.length === 0 && (
        <p style={{ color: '#22c55e', textAlign: 'center', padding: 24 }}>🎉 No improvement steps — everything looks great!</p>
      )}
      {stepsData.map((s) => (
        <div key={s.step} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid #e5e7eb', alignItems: 'center' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#d1d5db', minWidth: 36 }}>#{s.step}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{s.action}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              {AGENT_META[s.source]?.icon} {AGENT_META[s.source]?.label}
            </div>
          </div>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
            background: PRIO_COLORS[s.priority] + '22', color: PRIO_COLORS[s.priority],
          }}>
            {s.priority.toUpperCase()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────
// Site Map Tab — visual zone/route map
// ──────────────────────────────────────────────────
function SiteMapTab({ report, card, quickStats }) {
  const flowData  = report.agents.flow_analyzer?.data?.zoneCounts || {};
  const categories = report.agents.page_purpose?.data?.categories || {};
  const ZONE_COLORS = { WORLD: '#8b5cf6', WRITE: '#3b82f6', STUDIO: '#f59e0b', PRODUCE: '#ef4444', MANAGE: '#22c55e' };

  return (
    <div>
      {/* Zone breakdown */}
      <div style={{ ...card, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>🗺️ Zone Map</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(flowData).map(([zone, count]) => (
            <div key={zone} style={{ flex: '1 1 150px', padding: 16, borderRadius: 10, background: (ZONE_COLORS[zone] || '#9ca3af') + '15',
              border: `1px solid ${ZONE_COLORS[zone] || '#9ca3af'}44`, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: ZONE_COLORS[zone] || '#6b7280' }}>{zone}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1f2937', marginTop: 4 }}>{count}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>sidebar items</div>
            </div>
          ))}
        </div>
      </div>

      {/* Page categories */}
      <div style={card}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📋 Page Categories</h3>
        {Object.entries(categories).filter(([, v]) => v.length).map(([cat, pages]) => (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, textTransform: 'capitalize', color: '#4b5563' }}>
              {cat} ({pages.length})
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {pages.map(p => (
                <span key={p} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#f3f4f6', color: '#6b7280' }}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

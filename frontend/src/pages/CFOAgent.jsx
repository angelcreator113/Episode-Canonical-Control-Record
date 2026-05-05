/**
 * CFOAgent.jsx — Chief Financial Officer Agent Dashboard
 * Route: /cfo
 *
 * Five sub-agents: Cost Watchdog, Dependency Audit, Resource Monitor,
 * Lights-Off, Health Patrol. Full audit or individual runs.
 */
import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/api';

const API = '/api/v1/cfo';

// ─── Track 6 CP7 module-scope helpers (Pattern F prophylactic — Api suffix) ───
// 7 helpers covering 8 fetch sites on /cfo/* (getQuickStatsApi covers 2 sites
// — the initial-mount and post-save refresh). Mixed idiom: thenable for
// fire-and-forget GETs (lines 70, 71, 140) and async for state-bearing
// handlers. setBudgetApi is PUT (not POST per backend contract).
export const getQuickStatsApi = () => apiClient.get(`${API}/quick`);
export const getSchedulerApi = () => apiClient.get(`${API}/scheduler`);
export const getAuditApi = () => apiClient.get(`${API}/audit`);
export const getAgentApi = (name) => apiClient.get(`${API}/agent/${name}`);
export const triggerSchedulerActionApi = (action, payload) =>
  apiClient.post(`${API}/scheduler/${action}`, payload);
export const getHistoryApi = () => apiClient.get(`${API}/history`);
export const setBudgetApi = (payload) => apiClient.put(`${API}/budget`, payload);

const LEVEL_COLORS = {
  critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6', success: '#22c55e',
};
const LEVEL_ICONS = {
  critical: '🚨', warning: '⚠️', info: 'ℹ️', success: '✅',
};
const STATUS_COLORS = {
  healthy: '#22c55e', 'needs-attention': '#f59e0b', critical: '#ef4444',
  error: '#ef4444', 'no-data': '#6b7280',
};
const AGENT_META = {
  cost_watchdog:    { icon: '💰', label: 'Cost Watchdog',    desc: 'AI spend & model optimization' },
  dependency_audit: { icon: '📦', label: 'Dependency Audit', desc: 'Package security & freshness' },
  resource_monitor: { icon: '🗄️', label: 'Resource Monitor', desc: 'Database & storage health' },
  lights_off:       { icon: '💡', label: 'Lights-Off',       desc: 'Waste & idle feature detection' },
  health_patrol:    { icon: '🩺', label: 'Health Patrol',    desc: 'Performance & uptime' },
};

function ScoreRing({ score, size = 120 }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x={size/2} y={size/2 - 6} textAnchor="middle" fill={color} fontSize={size/3.5} fontWeight={700}>{score}</text>
      <text x={size/2} y={size/2 + 16} textAnchor="middle" fill="#9ca3af" fontSize={11}>/ 100</text>
    </svg>
  );
}

export default function CFOAgent() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState(null);
  const [agentResult, setAgentResult] = useState(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [tab, setTab] = useState('overview');
  const [quickStats, setQuickStats] = useState(null);
  const [scheduler, setScheduler] = useState(null);
  const [history, setHistory] = useState([]);
  const [budgetEdit, setBudgetEdit] = useState(null); // null = closed, object = editing
  const [error, setError] = useState(null);

  // Auto-clear error after 6 seconds
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  // Load quick stats + scheduler status on mount
  useEffect(() => {
    getQuickStatsApi().then(res => setQuickStats(res.data)).catch(() => {});
    getSchedulerApi().then(res => setScheduler(res.data)).catch(() => {});
  }, []);

  const runAudit = useCallback(async () => {
    setLoading(true);
    setReport(null);
    setError(null);
    try {
      const res = await getAuditApi();
      setReport(res.data);
      setTab('overview');
    } catch (err) {
      console.error('CFO audit failed:', err);
      setError('Full audit failed — is the backend running on port 3002?');
    }
    setLoading(false);
  }, []);

  const runAgent = useCallback(async (name) => {
    setAgentLoading(true);
    setActiveAgent(name);
    setAgentResult(null);
    setError(null);
    try {
      const res = await getAgentApi(name);
      setAgentResult(res.data);
    } catch (err) {
      console.error(`Agent ${name} failed:`, err);
      setError(`${AGENT_META[name]?.label || name} failed — is the backend running?`);
    }
    setAgentLoading(false);
  }, []);

  const toggleScheduler = useCallback(async () => {
    try {
      const action = scheduler?.running ? 'stop' : 'start';
      const res = await triggerSchedulerActionApi(action, { interval_hours: 6 });
      setScheduler(res.data);
    } catch (err) {
      setError('Scheduler toggle failed — is the backend running?');
    }
  }, [scheduler]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await getHistoryApi();
      setHistory(res.data);
    } catch (err) {
      setError('Failed to load audit history.');
    }
  }, []);

  const saveBudget = useCallback(async (vals) => {
    try {
      const res = await setBudgetApi(vals);
      const data = res.data;
      setBudgetEdit(null);
      getQuickStatsApi().then(r => setQuickStats(r.data)).catch(() => {});
      return data;
    } catch (err) {
      setError('Failed to save budget — is the backend running?');
    }
  }, []);

  // Styles — light theme
  const page = { padding: '24px 32px', minHeight: '100vh', color: '#1f2937', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' };
  const card = { background: '#ffffff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
  const tabBar = { display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 };
  const tabBtn = (active) => ({ padding: '8px 16px', background: active ? '#ffffff' : 'transparent', color: active ? '#1f2937' : '#6b7280', border: active ? '1px solid #e5e7eb' : '1px solid transparent', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: active ? 600 : 400, boxShadow: active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' });
  const btn = (variant) => ({
    padding: '10px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
    background: variant === 'primary' ? '#3b82f6' : variant === 'danger' ? '#ef4444' : '#f3f4f6',
    color: variant === 'primary' || variant === 'danger' ? '#fff' : '#374151',
    opacity: loading ? 0.6 : 1,
  });

  const TABS = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'findings', label: '🔍 All Findings' },
    { key: 'agents',   label: '🤖 Sub-Agents' },
    { key: 'actions',  label: '⚡ Actions' },
    { key: 'budget',   label: '💰 Budget' },
    { key: 'history',  label: '📜 History' },
  ];

  return (
    <div style={page}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>
            💼 CFO Agent
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
            Business health, cost optimization & operational longevity
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {scheduler && (
            <span style={{ fontSize: 12, color: scheduler.running ? '#22c55e' : '#9ca3af', marginRight: 4 }}>
              {scheduler.running ? `⏱ Every ${scheduler.interval_hours}h` : '⏸ Paused'}
            </span>
          )}
          <button onClick={async () => { await toggleScheduler(); }} style={btn(scheduler?.running ? 'danger' : 'secondary')}>
            {scheduler?.running ? '⏹ Stop Scheduler' : '▶ Start Scheduler'}
          </button>
          <button onClick={runAudit} disabled={loading} style={btn('primary')}>
            {loading ? '⏳ Running Full Audit…' : '🔍 Run Full Audit'}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ ...card, padding: '12px 20px', marginBottom: 16, borderColor: '#ef4444', background: '#fef2f2', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>❌</span>
          <span style={{ flex: 1, fontSize: 13, color: '#991b1b' }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Budget Alert Banner */}
      {quickStats?.budget && (quickStats.budget.daily_exceeded || quickStats.budget.monthly_exceeded) && (
        <div style={{ ...card, padding: '14px 20px', marginBottom: 16, borderColor: '#ef4444', background: '#fef2f2', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🚨</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#991b1b', fontSize: 14 }}>Budget Exceeded</div>
            <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 2 }}>
              {quickStats.budget.daily_exceeded && `Daily: $${quickStats.today_cost.toFixed(4)} / $${quickStats.budget.daily_limit.toFixed(2)} (${quickStats.budget.daily_pct}%) `}
              {quickStats.budget.monthly_exceeded && `Monthly: $${quickStats.monthly_cost?.toFixed(2)} / $${quickStats.budget.monthly_limit.toFixed(2)} (${quickStats.budget.monthly_pct}%)`}
            </div>
          </div>
          <button onClick={() => setBudgetEdit({ daily_limit: quickStats.budget.daily_limit, monthly_limit: quickStats.budget.monthly_limit, warn_pct: quickStats.budget.warn_pct })}
            style={{ ...btn('secondary'), fontSize: 12, padding: '6px 14px' }}>Adjust Budget</button>
        </div>
      )}
      {quickStats?.budget && !quickStats.budget.daily_exceeded && !quickStats.budget.monthly_exceeded && (quickStats.budget.daily_warning || quickStats.budget.monthly_warning) && (
        <div style={{ ...card, padding: '14px 20px', marginBottom: 16, borderColor: '#f59e0b', background: '#fffbeb', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#92400e', fontSize: 14 }}>Budget Warning</div>
            <div style={{ fontSize: 13, color: '#a16207', marginTop: 2 }}>
              {quickStats.budget.daily_warning && `Daily spend at ${quickStats.budget.daily_pct}% of $${quickStats.budget.daily_limit.toFixed(2)} limit. `}
              {quickStats.budget.monthly_warning && `Monthly at ${quickStats.budget.monthly_pct}% of $${quickStats.budget.monthly_limit.toFixed(2)} limit.`}
              {quickStats.budget.days_remaining !== null && ` ~${quickStats.budget.days_remaining} days of budget remaining.`}
            </div>
          </div>
          <button onClick={() => setBudgetEdit({ daily_limit: quickStats.budget.daily_limit, monthly_limit: quickStats.budget.monthly_limit, warn_pct: quickStats.budget.warn_pct })}
            style={{ ...btn('secondary'), fontSize: 12, padding: '6px 14px' }}>Adjust Budget</button>
        </div>
      )}

      {/* Quick Stats Bar (always visible) */}
      {quickStats && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {[
            { label: "Today's AI Spend", value: `$${quickStats.today_cost.toFixed(4)}`, color: quickStats.budget?.daily_exceeded ? '#ef4444' : quickStats.today_cost > 1 ? '#f59e0b' : '#22c55e' },
            { label: 'Monthly Spend', value: `$${(quickStats.monthly_cost || 0).toFixed(2)}`, color: quickStats.budget?.monthly_exceeded ? '#ef4444' : quickStats.budget?.monthly_warning ? '#f59e0b' : '#3b82f6' },
            { label: 'Budget Left', value: quickStats.budget?.days_remaining !== null ? `~${quickStats.budget.days_remaining}d` : 'N/A', color: quickStats.budget?.days_remaining !== null && quickStats.budget.days_remaining < 7 ? '#ef4444' : '#22c55e' },
            { label: 'Errors (1h)', value: quickStats.errors_last_hour, color: quickStats.errors_last_hour > 3 ? '#ef4444' : '#22c55e' },
            { label: 'Memory', value: `${quickStats.memory_mb} MB`, color: quickStats.memory_mb > 1000 ? '#f59e0b' : '#3b82f6' },
          ].map((s, i) => (
            <div key={i} style={{ ...card, flex: 1, textAlign: 'center', padding: 14 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* No report yet */}
      {!report && !loading && (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💼</div>
          <h2 style={{ margin: '0 0 8px', fontWeight: 600 }}>CFO Agent Ready</h2>
          <p style={{ color: '#6b7280', margin: '0 0 24px', maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
            Run a full audit to get a comprehensive report on AI costs, dependencies, database health,
            unused features, and system performance. Or run individual sub-agents below.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {Object.entries(AGENT_META).map(([key, meta]) => (
              <button key={key} onClick={() => runAgent(key)}
                style={{ ...card, padding: '14px 18px', cursor: 'pointer', border: '1px solid #d1d5db', textAlign: 'left', minWidth: 180 }}>
                <div style={{ fontSize: 20 }}>{meta.icon}</div>
                <div style={{ fontWeight: 600, marginTop: 4, fontSize: 13 }}>{meta.label}</div>
                <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>{meta.desc}</div>
              </button>
            ))}
          </div>
          {/* Individual agent result */}
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
          <h2 style={{ margin: '0 0 8px', fontWeight: 600 }}>Running Full Audit…</h2>
          <p style={{ color: '#6b7280' }}>5 sub-agents scanning costs, dependencies, resources, waste, and health</p>
        </div>
      )}

      {/* Report loaded — tabbed view */}
      {report && !loading && (
        <>
          <div style={tabBar}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={tabBtn(tab === t.key)}>{t.label}</button>
            ))}
          </div>

          {tab === 'overview' && <OverviewTab report={report} card={card} />}
          {tab === 'findings' && <FindingsTab report={report} card={card} />}
          {tab === 'agents'   && <AgentsTab report={report} card={card} onRunAgent={runAgent} agentLoading={agentLoading} />}
          {tab === 'actions'  && <ActionsTab report={report} card={card} />}
          {tab === 'budget'   && <BudgetTab quickStats={quickStats} card={card} onEdit={() => setBudgetEdit({ daily_limit: quickStats?.budget?.daily_limit || 5, monthly_limit: quickStats?.budget?.monthly_limit || 100, warn_pct: quickStats?.budget?.warn_pct || 80 })} report={report} />}
          {tab === 'history' && <HistoryTab history={history} loadHistory={loadHistory} card={card} />}
        </>
      )}

      {/* Budget Edit Modal */}
      {budgetEdit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setBudgetEdit(null)}>
          <div style={{ ...card, width: 420, padding: 28 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>💰 Budget Settings</h3>
            {[
              { key: 'daily_limit', label: 'Daily Limit ($)', step: '0.50' },
              { key: 'monthly_limit', label: 'Monthly Limit ($)', step: '5.00' },
              { key: 'warn_pct', label: 'Warning Threshold (%)', step: '5' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{f.label}</label>
                <input type="number" step={f.step} min="0" value={budgetEdit[f.key]}
                  onChange={e => setBudgetEdit(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setBudgetEdit(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151' }}>Cancel</button>
              <button onClick={() => saveBudget(budgetEdit)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Save Budget</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────
// Overview Tab
// ──────────────────────────────────────────────────
function OverviewTab({ report, card }) {
  const costData = report.agents.cost_watchdog?.data || {};
  return (
    <div>
      {/* Score Ring + overall status */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 24, flex: 1 }}>
          <ScoreRing score={report.overall_score} />
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>
              Overall Health:&nbsp;
              <span style={{ color: STATUS_COLORS[report.overall_status] }}>
                {report.overall_status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
            </h2>
            <p style={{ color: '#6b7280', margin: '6px 0 0', fontSize: 13 }}>
              {report.all_findings.filter(f => f.level === 'critical').length} critical issues •&nbsp;
              {report.all_findings.filter(f => f.level === 'warning').length} warnings •&nbsp;
              {report.all_recommendations.length} recommendations
            </p>
            <p style={{ color: '#9ca3af', margin: '4px 0 0', fontSize: 12 }}>
              Ran at {new Date(report.ran_at).toLocaleString()} ({report.duration_ms}ms)
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
              <div style={{ fontSize: 11, color: STATUS_COLORS[agent.status] || '#6b7280', textTransform: 'uppercase', marginTop: 2 }}>
                {agent.status}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cost highlights */}
      {costData.monthlyCost !== undefined && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Today', value: `$${(costData.todayCost || 0).toFixed(4)}` },
            { label: 'Daily Avg', value: `$${(costData.avgDailyCost || 0).toFixed(4)}` },
            { label: '30-Day Total', value: `$${(costData.monthlyCost || 0).toFixed(2)}` },
            { label: 'Annual Projection', value: `$${(costData.projectedAnnual || 0).toFixed(2)}` },
          ].map((s, i) => (
            <div key={i} style={{ ...card, flex: 1, textAlign: 'center', padding: 14 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Top critical findings */}
      <div style={card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>🚨 Top Issues</h3>
        {report.all_findings.filter(f => f.level === 'critical' || f.level === 'warning').length === 0 && (
          <p style={{ color: '#22c55e', margin: 0 }}>✅ No critical issues found — system is running well!</p>
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
  const findings = filter === 'all'
    ? report.all_findings
    : report.all_findings.filter(f => f.level === filter);

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>All Findings ({findings.length})</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'critical', 'warning', 'info', 'success'].map(l => (
            <button key={l} onClick={() => setFilter(l)}
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
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: LEVEL_COLORS[f.level] + '22', color: LEVEL_COLORS[f.level], fontWeight: 600 }}>
            {f.level.toUpperCase()}
          </span>
        </div>
      ))}
      {findings.length === 0 && <p style={{ color: '#9ca3af', textAlign: 'center', padding: 24 }}>No findings match this filter.</p>}
    </div>
  );
}

// ──────────────────────────────────────────────────
// Sub-Agents Tab
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
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: (STATUS_COLORS[data.status] || '#9ca3af') + '22',
            color: STATUS_COLORS[data.status] || '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>
            {data.status}
          </span>
          {onRerun && (
            <button onClick={(e) => { e.stopPropagation(); onRerun(); }} disabled={rerunLoading}
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
              <div style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', marginBottom: 6 }}>💡 Recommendations</div>
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
// Budget Tab
// ──────────────────────────────────────────────────
function BudgetTab({ quickStats, card, onEdit, report }) {
  const b = quickStats?.budget;
  const costData = report?.agents?.cost_watchdog?.data;

  const ProgressBar = ({ pct, color }) => (
    <div style={{ height: 10, borderRadius: 5, background: '#f3f4f6', overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 5, transition: 'width 0.4s ease' }} />
    </div>
  );

  if (!b) return (
    <div style={{ ...card, textAlign: 'center', padding: 48 }}>
      <p style={{ color: '#9ca3af' }}>Loading budget data…</p>
    </div>
  );

  const dailyColor = b.daily_pct >= 100 ? '#ef4444' : b.daily_pct >= b.warn_pct ? '#f59e0b' : '#22c55e';
  const monthlyColor = b.monthly_pct >= 100 ? '#ef4444' : b.monthly_pct >= b.warn_pct ? '#f59e0b' : '#22c55e';

  return (
    <div>
      {/* Budget Overview */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div style={{ ...card, flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>📅 Daily Budget</h3>
            <span style={{ fontSize: 13, fontWeight: 700, color: dailyColor }}>{b.daily_pct}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <ProgressBar pct={b.daily_pct} color={dailyColor} />
          </div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            ${quickStats.today_cost.toFixed(4)} spent of ${b.daily_limit.toFixed(2)} limit
          </div>
        </div>
        <div style={{ ...card, flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>📆 Monthly Budget</h3>
            <span style={{ fontSize: 13, fontWeight: 700, color: monthlyColor }}>{b.monthly_pct}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <ProgressBar pct={b.monthly_pct} color={monthlyColor} />
          </div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            ${(quickStats.monthly_cost || 0).toFixed(2)} spent of ${b.monthly_limit.toFixed(2)} limit
          </div>
        </div>
      </div>

      {/* Projections */}
      <div style={{ ...card, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📊 Projections & Runway</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Avg Daily Cost', value: costData ? `$${(costData.avgDailyCost || 0).toFixed(4)}` : 'N/A', color: '#3b82f6' },
            { label: 'Days of Budget Left', value: b.days_remaining !== null ? `~${b.days_remaining}` : 'N/A', color: b.days_remaining !== null && b.days_remaining < 7 ? '#ef4444' : '#22c55e' },
            { label: '30-Day Projection', value: costData ? `$${(costData.monthlyCost || 0).toFixed(2)}` : 'N/A', color: '#8b5cf6' },
            { label: 'Annual Projection', value: costData ? `$${(costData.projectedAnnual || 0).toFixed(2)}` : 'N/A', color: '#f59e0b' },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Budget Config */}
      <div style={{ ...card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>⚙️ Budget Configuration</h3>
          <button onClick={onEdit} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>
            ✏️ Edit Budget
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div style={{ padding: 14, background: '#f9fafb', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>Daily Limit</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1f2937' }}>${b.daily_limit.toFixed(2)}</div>
          </div>
          <div style={{ padding: 14, background: '#f9fafb', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>Monthly Limit</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1f2937' }}>${b.monthly_limit.toFixed(2)}</div>
          </div>
          <div style={{ padding: 14, background: '#f9fafb', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>Warning At</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1f2937' }}>{b.warn_pct}%</div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '14px 0 0', lineHeight: 1.5 }}>
          Budget limits are tracked from local AI usage logs (Anthropic API calls). Alerts appear as banners
          when spending hits the warning threshold, and as critical findings in audit reports.
          Set via environment variables (CFO_DAILY_BUDGET, CFO_MONTHLY_BUDGET) or adjust here.
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────
// History Tab
// ──────────────────────────────────────────────────
function HistoryTab({ history, loadHistory, card }) {
  useEffect(() => { loadHistory(); }, [loadHistory]);
  if (!history.length) return (
    <div style={{ ...card, textAlign: 'center', padding: 48 }}>
      <p style={{ color: '#9ca3af' }}>No audit history yet. Scheduler will populate this automatically.</p>
    </div>
  );
  return (
    <div style={card}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📜 Audit History ({history.length} runs)</h3>
      {history.map((h, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #e5e7eb', alignItems: 'center' }}>
          <ScoreRing score={h.overall_score} size={40} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              Score: {h.overall_score} — <span style={{ color: STATUS_COLORS[h.overall_status] }}>{h.overall_status}</span>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              {new Date(h.ran_at).toLocaleString()} • {h.duration_ms}ms •
              {h.all_findings.filter(f => f.level === 'critical').length} critical,
              {h.all_findings.filter(f => f.level === 'warning').length} warnings
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(h.agents).map(([k, a]) => (
              <span key={k} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4,
                background: (STATUS_COLORS[a.status] || '#9ca3af') + '22',
                color: STATUS_COLORS[a.status] || '#9ca3af' }}>
                {AGENT_META[k]?.icon} {a.score}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────
// Actions Tab (prioritized list of things to do)
// ──────────────────────────────────────────────────
function ActionsTab({ report, card }) {
  const priorityWeight = { cost_watchdog: 3, health_patrol: 3, dependency_audit: 2, resource_monitor: 2, lights_off: 1 };
  const actions = report.all_recommendations
    .map((r, i) => ({ ...r, priority: priorityWeight[r.agent] || 1, id: i }))
    .sort((a, b) => b.priority - a.priority);

  return (
    <div style={card}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>⚡ Prioritized Action Items ({actions.length})</h3>
      {actions.length === 0 && (
        <p style={{ color: '#22c55e', textAlign: 'center', padding: 24 }}>🎉 No action items — everything looks great!</p>
      )}
      {actions.map((a, i) => (
        <div key={a.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid #e5e7eb', alignItems: 'center' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#d1d5db', minWidth: 28 }}>#{i + 1}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{a.recommendation}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              {AGENT_META[a.agent]?.icon} {AGENT_META[a.agent]?.label}
            </div>
          </div>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
            background: a.priority >= 3 ? '#ef444422' : a.priority >= 2 ? '#f59e0b22' : '#3b82f622',
            color: a.priority >= 3 ? '#ef4444' : a.priority >= 2 ? '#f59e0b' : '#3b82f6',
          }}>
            {a.priority >= 3 ? 'HIGH' : a.priority >= 2 ? 'MEDIUM' : 'LOW'}
          </span>
        </div>
      ))}
    </div>
  );
}

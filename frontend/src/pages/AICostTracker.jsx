/**
 * AICostTracker.jsx — AI Spend Dashboard
 * Route: /ai-costs
 */
import React, { useState, useEffect, useCallback } from 'react';

const API = '/api/v1/ai-usage';

const TIER_COLORS = { opus: '#ef4444', sonnet: '#f59e0b', haiku: '#22c55e', unknown: '#6b7280' };
const TIER_LABELS = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku', unknown: 'Other' };
const SEVERITY_COLORS = { high: '#ef4444', medium: '#f59e0b', info: '#3b82f6' };

function fmt$(v) { return '$' + Number(v || 0).toFixed(4); }
function fmtK(v) { const n = Number(v || 0); return n >= 1_000_000 ? (n/1_000_000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'k' : n.toString(); }

export default function AICostTracker() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [byModel, setByModel] = useState([]);
  const [byRoute, setByRoute] = useState([]);
  const [daily, setDaily] = useState([]);
  const [recent, setRecent] = useState([]);
  const [optimizations, setOptimizations] = useState(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m, r, d, opt] = await Promise.all([
        fetch(`${API}/summary?days=${days}`).then(r => r.json()),
        fetch(`${API}/by-model?days=${days}`).then(r => r.json()),
        fetch(`${API}/by-route?days=${days}`).then(r => r.json()),
        fetch(`${API}/daily?days=${days}`).then(r => r.json()),
        fetch(`${API}/optimizations`).then(r => r.json()),
      ]);
      setSummary(s);
      setByModel(m);
      setByRoute(r);
      setDaily(d);
      setOptimizations(opt);
    } catch (err) {
      console.error('Failed to load AI usage data:', err);
    }
    setLoading(false);
  }, [days]);

  const loadRecent = useCallback(async () => {
    try {
      const data = await fetch(`${API}/recent?limit=100`).then(r => r.json());
      setRecent(data);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'log') loadRecent(); }, [tab, loadRecent]);

  const TABS = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'models',   label: '🤖 By Model' },
    { key: 'routes',   label: '🔀 By Feature' },
    { key: 'optimize', label: '💡 Optimize' },
    { key: 'log',      label: '📋 Recent Calls' },
  ];

  // Styles — light theme
  const pageStyle = { padding: '24px 32px', minHeight: '100vh', color: '#1f2937', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' };
  const cardStyle = { background: '#ffffff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
  const statCard = { ...cardStyle, textAlign: 'center', flex: 1, minWidth: 140 };
  const tabBar = { display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 };
  const tabBtn = (active) => ({ padding: '8px 16px', background: active ? '#ffffff' : 'transparent', color: active ? '#1f2937' : '#6b7280', border: active ? '1px solid #e5e7eb' : '1px solid transparent', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: active ? 600 : 400, boxShadow: active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' });
  const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
  const thStyle = { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 500 };
  const tdStyle = { padding: '8px 12px', borderBottom: '1px solid #f3f4f6' };
  const selectStyle = { background: '#ffffff', color: '#1f2937', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13 };

  // Bar helper
  const Bar = ({ value, max, color }) => (
    <div style={{ background: '#e5e7eb', borderRadius: 4, height: 8, width: '100%', overflow: 'hidden' }}>
      <div style={{ background: color || '#3b82f6', height: '100%', width: `${Math.min(100, max > 0 ? (value / max) * 100 : 0)}%`, borderRadius: 4, transition: 'width 0.3s' }} />
    </div>
  );

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>💰 AI Cost Tracker</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>Monitor spend, optimize models, save money</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={days} onChange={e => setDays(Number(e.target.value))} style={selectStyle}>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button onClick={load} style={{ ...selectStyle, cursor: 'pointer' }}>↻ Refresh</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={tabBar}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={tabBtn(tab === t.key)}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>Loading AI usage data...</div>
      ) : tab === 'overview' ? (
        /* ─── OVERVIEW ──────────────────────────────── */
        <div>
          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={statCard}>
              <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Total Spend ({days}d)</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>{fmt$(summary?.total_cost)}</div>
            </div>
            <div style={statCard}>
              <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Today</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e', marginTop: 4 }}>{fmt$(summary?.today_cost)}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{summary?.today_calls || 0} calls</div>
            </div>
            <div style={statCard}>
              <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>API Calls</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{fmtK(summary?.total_calls)}</div>
            </div>
            <div style={statCard}>
              <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Tokens Used</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{fmtK((summary?.total_input_tokens || 0) + (summary?.total_output_tokens || 0))}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>in: {fmtK(summary?.total_input_tokens)} · out: {fmtK(summary?.total_output_tokens)}</div>
            </div>
            <div style={statCard}>
              <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Avg Speed</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{((summary?.avg_duration_ms || 0) / 1000).toFixed(1)}s</div>
            </div>
            <div style={statCard}>
              <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Errors</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: (summary?.total_errors || 0) > 0 ? '#ef4444' : '#22c55e', marginTop: 4 }}>{summary?.total_errors || 0}</div>
            </div>
          </div>

          {/* Daily spend chart (simple text-based) */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Daily Spend</h3>
            {daily.length === 0 ? (
              <div style={{ color: '#6b7280', padding: 20, textAlign: 'center' }}>No data yet — costs will appear here once AI calls are made</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {daily.slice(0, 14).map(d => {
                  const maxCost = Math.max(...daily.map(x => Number(x.cost)));
                  return (
                    <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 80, fontSize: 12, color: '#6b7280', flexShrink: 0 }}>{new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</div>
                      <div style={{ flex: 1 }}><Bar value={Number(d.cost)} max={maxCost} color="#f59e0b" /></div>
                      <div style={{ width: 70, fontSize: 12, textAlign: 'right', color: '#f59e0b' }}>{fmt$(d.cost)}</div>
                      <div style={{ width: 60, fontSize: 11, textAlign: 'right', color: '#6b7280' }}>{d.calls} calls</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      ) : tab === 'models' ? (
        /* ─── BY MODEL ──────────────────────────────── */
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Cost by Model</h3>
          {byModel.length === 0 ? (
            <div style={{ color: '#6b7280', padding: 20, textAlign: 'center' }}>No usage data yet</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Model</th>
                  <th style={thStyle}>Tier</th>
                  <th style={thStyle}>Calls</th>
                  <th style={thStyle}>Input Tokens</th>
                  <th style={thStyle}>Output Tokens</th>
                  <th style={thStyle}>Cost</th>
                  <th style={thStyle}>Avg Speed</th>
                </tr>
              </thead>
              <tbody>
                {byModel.map(r => (
                  <tr key={r.model_name}>
                    <td style={tdStyle}><code style={{ fontSize: 12 }}>{r.model_name}</code></td>
                    <td style={tdStyle}><span style={{ color: TIER_COLORS[r.tier], fontWeight: 600, fontSize: 12 }}>{TIER_LABELS[r.tier]}</span></td>
                    <td style={tdStyle}>{r.calls}</td>
                    <td style={tdStyle}>{fmtK(r.input_tokens)}</td>
                    <td style={tdStyle}>{fmtK(r.output_tokens)}</td>
                    <td style={{ ...tdStyle, color: '#f59e0b', fontWeight: 600 }}>{fmt$(r.cost)}</td>
                    <td style={tdStyle}>{(r.avg_ms / 1000).toFixed(1)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      ) : tab === 'routes' ? (
        /* ─── BY ROUTE/FEATURE ──────────────────────── */
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Cost by Feature / Route</h3>
          {byRoute.length === 0 ? (
            <div style={{ color: '#6b7280', padding: 20, textAlign: 'center' }}>No usage data yet</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Feature</th>
                  <th style={thStyle}>Calls</th>
                  <th style={thStyle}>Input</th>
                  <th style={thStyle}>Output</th>
                  <th style={thStyle}>Cost</th>
                  <th style={thStyle}>Avg Speed</th>
                  <th style={thStyle}>Models</th>
                  <th style={thStyle}>Cost Share</th>
                </tr>
              </thead>
              <tbody>
                {(() => { const totalCost = byRoute.reduce((s, r) => s + Number(r.cost), 0); return byRoute.map(r => (
                  <tr key={r.route_name}>
                    <td style={tdStyle}><strong>{r.route_name}</strong></td>
                    <td style={tdStyle}>{r.calls}</td>
                    <td style={tdStyle}>{fmtK(r.input_tokens)}</td>
                    <td style={tdStyle}>{fmtK(r.output_tokens)}</td>
                    <td style={{ ...tdStyle, color: '#f59e0b', fontWeight: 600 }}>{fmt$(r.cost)}</td>
                    <td style={tdStyle}>{(r.avg_ms / 1000).toFixed(1)}s</td>
                    <td style={tdStyle}>{r.models_used}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Bar value={Number(r.cost)} max={totalCost} color="#3b82f6" />
                        <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>{totalCost > 0 ? ((Number(r.cost) / totalCost) * 100).toFixed(0) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                )); })()}
              </tbody>
            </table>
          )}
        </div>

      ) : tab === 'optimize' ? (
        /* ─── OPTIMIZATIONS ─────────────────────────── */
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {optimizations?.tips?.map((tip, i) => (
              <div key={i} style={{ ...cardStyle, borderLeft: `3px solid ${SEVERITY_COLORS[tip.severity] || '#6b7280'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: SEVERITY_COLORS[tip.severity], letterSpacing: 1 }}>{tip.severity}</span>
                  {tip.potential_savings && <span style={{ fontSize: 11, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 4 }}>Save ~{tip.potential_savings}</span>}
                </div>
                <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>{tip.title}</h4>
                <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>{tip.detail}</p>
                {tip.routes && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                    {tip.routes.map(r => (
                      <span key={r.route_name} style={{ display: 'inline-block', background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, marginRight: 6, marginBottom: 4 }}>
                        {r.route_name} ({fmt$(r.cost)})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {(!optimizations?.tips || optimizations.tips.length === 0) && (
              <div style={{ ...cardStyle, textAlign: 'center', color: '#6b7280' }}>No optimization suggestions yet — data will populate as API calls are tracked</div>
            )}
          </div>

          {/* Top spenders table */}
          {optimizations?.top_spenders?.length > 0 && (
            <div style={{ ...cardStyle, marginTop: 24 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Top 10 Cost Centers</h3>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Feature</th>
                    <th style={thStyle}>Model</th>
                    <th style={thStyle}>Calls</th>
                    <th style={thStyle}>Avg Input</th>
                    <th style={thStyle}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {optimizations.top_spenders.map((r, i) => (
                    <tr key={i}>
                      <td style={tdStyle}><strong>{r.route_name}</strong></td>
                      <td style={tdStyle}><code style={{ fontSize: 11 }}>{r.model_name}</code></td>
                      <td style={tdStyle}>{r.calls}</td>
                      <td style={tdStyle}>{fmtK(r.avg_input)} tokens</td>
                      <td style={{ ...tdStyle, color: '#f59e0b', fontWeight: 600 }}>{fmt$(r.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      ) : tab === 'log' ? (
        /* ─── RECENT CALLS ──────────────────────────── */
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Recent API Calls</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Time</th>
                <th style={thStyle}>Feature</th>
                <th style={thStyle}>Model</th>
                <th style={thStyle}>In</th>
                <th style={thStyle}>Out</th>
                <th style={thStyle}>Cost</th>
                <th style={thStyle}>Speed</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(r => (
                <tr key={r.id} style={r.is_error ? { background: '#fef2f2' } : {}}>
                  <td style={{ ...tdStyle, fontSize: 11, color: '#6b7280' }}>{new Date(r.created_at).toLocaleString()}</td>
                  <td style={tdStyle}>{r.route_name}</td>
                  <td style={tdStyle}><code style={{ fontSize: 11 }}>{r.model_name?.split('-').slice(-1)[0]}</code></td>
                  <td style={tdStyle}>{fmtK(r.input_tokens)}</td>
                  <td style={tdStyle}>{fmtK(r.output_tokens)}</td>
                  <td style={{ ...tdStyle, color: '#f59e0b' }}>{fmt$(r.cost_usd)}</td>
                  <td style={tdStyle}>{((r.duration_ms || 0) / 1000).toFixed(1)}s</td>
                  <td style={tdStyle}>{r.is_error ? <span style={{ color: '#ef4444' }}>✗ {r.error_type}</span> : <span style={{ color: '#22c55e' }}>✓</span>}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>No calls logged yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

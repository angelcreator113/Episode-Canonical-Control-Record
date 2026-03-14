import React, { useState, useCallback } from 'react';

const API = '/api/v1/design-agent';
const AGENTS = [
  { key: 'responsive_auditor',  icon: '📱', label: 'Responsive Auditor', desc: 'Media-query coverage & breakpoint consistency' },
  { key: 'token_compliance',    icon: '🎨', label: 'Token Compliance',   desc: 'Design-token usage vs hard-coded values' },
  { key: 'consistency_checker', icon: '🔗', label: 'Consistency Checker', desc: 'Inline-style sprawl, variable naming, visual uniformity' },
  { key: 'accessibility_scout', icon: '♿', label: 'Accessibility Scout', desc: 'Touch targets, font sizing, focus styles, contrast' },
];

const badge = s => s === 'healthy' ? '🟢' : s === 'needs-attention' ? '🟡' : s === 'critical' ? '🔴' : '⚪';
const levelIcon = l => l === 'critical' ? '🔴' : l === 'warning' ? '🟡' : l === 'success' ? '🟢' : 'ℹ️';

export default function DesignAgent() {
  const [tab, setTab]         = useState('overview');
  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [soloAgent, setSoloAgent] = useState(null);

  const runScan = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API}/scan`);
      if (!r.ok) throw new Error(`Scan failed (${r.status})`);
      setReport(await r.json());
      setTab('overview');
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  const runOne = useCallback(async (name) => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API}/agent/${encodeURIComponent(name)}`);
      if (!r.ok) throw new Error(`Agent failed (${r.status})`);
      setSoloAgent({ name, ...(await r.json()) });
      setTab('agents');
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  /* ─── inline styles ─── */
  const page = { minHeight: '100vh', color: '#1f2937', padding: '32px 40px', fontFamily: 'system-ui, -apple-system, sans-serif' };
  const hdr  = { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 };
  const pill = (active) => ({ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: active ? '#3b82f6' : '#f3f4f6', color: active ? '#ffffff' : '#6b7280', transition: 'all .15s' });
  const card = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
  const btn  = { padding: '10px 22px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', background: 'linear-gradient(135deg, #a855f7, #6366f1)', color: '#fff', transition: 'transform .1s' };

  return (
    <div style={page}>
      {/* Header */}
      <div style={hdr}>
        <span style={{ fontSize: 36 }}>🎨</span>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Design Agent</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>Keeps the site visually consistent & responsive on every device</p>
        </div>
        <div style={{ flex: 1 }} />
        <button style={btn} onClick={runScan} disabled={loading}>
          {loading ? '⏳ Scanning…' : '🔍 Run Full Audit'}
        </button>
      </div>

      {error && <div style={{ ...card, borderColor: '#f85149', color: '#f85149' }}>⚠️ {error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['overview', 'findings', 'agents', 'recommendations'].map(t => (
          <button key={t} style={pill(tab === t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── No data yet ── */}
      {!report && !soloAgent && tab !== 'agents' && (
        <div style={{ ...card, textAlign: 'center', padding: 48, color: '#6b7280' }}>
          <p style={{ fontSize: 48, margin: 0 }}>🎨</p>
          <p>Click <strong>Run Full Audit</strong> to scan the entire frontend for visual & responsive issues.</p>
        </div>
      )}

      {/* ═══ OVERVIEW ═══ */}
      {tab === 'overview' && report && <OverviewTab report={report} />}

      {/* ═══ FINDINGS ═══ */}
      {tab === 'findings' && report && <FindingsTab findings={report.all_findings} />}

      {/* ═══ AGENTS ═══ */}
      {tab === 'agents' && (
        <AgentsTab agents={AGENTS} report={report} soloAgent={soloAgent} onRun={runOne} loading={loading} />
      )}

      {/* ═══ RECOMMENDATIONS ═══ */}
      {tab === 'recommendations' && report && <RecsTab recs={report.all_recommendations} />}
    </div>
  );
}

/* ─── OVERVIEW ─────────────────────────────────────────── */
function OverviewTab({ report }) {
  const scoreColor = report.overall_score >= 85 ? '#3fb950' : report.overall_score >= 65 ? '#d29922' : '#f85149';
  const card = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
  return (
    <>
      <div style={{ ...card, textAlign: 'center' }}>
        <div style={{ fontSize: 56, fontWeight: 800, color: scoreColor }}>{report.overall_score}</div>
        <div style={{ color: '#6b7280', fontSize: 13 }}>{badge(report.overall_status)} {report.overall_status} · scanned {new Date(report.ran_at).toLocaleTimeString()} · {report.duration_ms}ms</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {Object.entries(report.agents).map(([k, a]) => {
          const sc = a.score >= 85 ? '#3fb950' : a.score >= 65 ? '#d29922' : '#f85149';
          return (
            <div key={k} style={{ ...card }}>
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>{k.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: sc }}>{a.score}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{badge(a.status)} {a.status} · {a.findings.length} findings · {a.recommendations.length} recs</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ─── FINDINGS ─────────────────────────────────────────── */
function FindingsTab({ findings }) {
  const card = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? findings : findings.filter(f => f.level === filter);
  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['all', 'critical', 'warning', 'info', 'success'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: filter === f ? '#3b82f6' : '#f3f4f6', color: filter === f ? '#ffffff' : '#6b7280', fontWeight: 600, fontSize: 12 }}>
            {f === 'all' ? `All (${findings.length})` : `${levelIcon(f)} ${f}`}
          </button>
        ))}
      </div>
      {filtered.map((f, i) => (
        <div key={i} style={{ ...card, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span>{levelIcon(f.level)}</span>
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 2 }}>{f.agent?.replace(/_/g, ' ')}</div>
            <div style={{ fontSize: 14 }}>{f.msg}</div>
          </div>
        </div>
      ))}
    </>
  );
}

/* ─── AGENTS ───────────────────────────────────────────── */
function AgentsTab({ agents, report, soloAgent, onRun, loading }) {
  const card = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {agents.map(a => {
          const data = report?.agents?.[a.key];
          return (
            <div key={a.key} style={card}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{a.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{a.label}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>{a.desc}</div>
              {data && <div style={{ fontSize: 13, marginBottom: 8 }}>{badge(data.status)} Score: <strong>{data.score}</strong></div>}
              <button onClick={() => onRun(a.key)} disabled={loading} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#f3f4f6', color: '#3b82f6', fontWeight: 600, fontSize: 12 }}>
                Run Solo
              </button>
            </div>
          );
        })}
      </div>
      {soloAgent && (
        <div style={{ ...card, marginTop: 14 }}>
          <h3 style={{ margin: '0 0 10px' }}>{badge(soloAgent.status)} {soloAgent.name.replace(/_/g, ' ')} — {soloAgent.score}/100</h3>
          {soloAgent.findings?.map((f, i) => (
            <div key={i} style={{ fontSize: 13, padding: '4px 0', display: 'flex', gap: 8 }}>
              <span>{levelIcon(f.level)}</span><span>{f.msg}</span>
            </div>
          ))}
          {soloAgent.recommendations?.length > 0 && (
            <>
              <h4 style={{ marginTop: 12, marginBottom: 6, color: '#d29922' }}>Recommendations</h4>
              {soloAgent.recommendations.map((r, i) => <div key={i} style={{ fontSize: 13, padding: '3px 0', color: '#6b7280' }}>• {r}</div>)}
            </>
          )}
        </div>
      )}
    </>
  );
}

/* ─── RECOMMENDATIONS ──────────────────────────────────── */
function RecsTab({ recs }) {
  const card = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
  if (!recs.length) return <div style={{ ...card, color: '#6b7280', textAlign: 'center' }}>✅ No recommendations — the site looks great!</div>;
  return recs.map((r, i) => (
    <div key={i} style={{ ...card, padding: '12px 16px' }}>
      <div style={{ fontSize: 12, color: '#3b82f6', marginBottom: 2 }}>{r.agent?.replace(/_/g, ' ')}</div>
      <div style={{ fontSize: 14 }}>💡 {r.recommendation}</div>
    </div>
  ));
}

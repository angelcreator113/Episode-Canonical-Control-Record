// AmberCommandCenter.jsx
// Route: /amber (add to your router and sidebar nav)
//
// Add to sidebar nav:
//   { path: '/amber', label: 'Amber', icon: '✦' }
//
// Add to router:
//   import AmberCommandCenter from './pages/AmberCommandCenter';
//   <Route path="/amber" element={<AmberCommandCenter />} />

import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || '';

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const SEVERITY_COLOR = {
  critical: '#d47878',
  high:     '#d4a878',
  medium:   '#d4789a',
  low:      '#a889c8',
  info:     '#7ab3d4',
};
const STATUS_COLOR = {
  detected:   '#9a94a8',
  surfaced:   '#d4789a',
  approved:   '#7ab3d4',
  executing:  '#c9a96e',
  applied:    '#78b89a',
  failed:     '#d47878',
  dismissed:  '#3a3a42',
  escalated:  '#d47878',
};
const PRIORITY_COLOR = {
  urgent: '#d47878',
  high:   '#d4a878',
  medium: '#d4789a',
  low:    '#9a94a8',
};

// ── Shared styles (light theme) ──────────────────────────────────────────────
const s = {
  page: {
    minHeight:   '100vh',
    background:  '#fafaf9',
    padding:     '32px',
    fontFamily:  "'DM Sans', system-ui, -apple-system, sans-serif",
    color:       '#2a1f2d',
  },
  card: {
    background:   '#fff',
    border:       '1px solid #ede8e3',
    borderRadius: '12px',
    padding:      '20px 24px',
    marginBottom: '12px',
  },
  pill: (color) => ({
    display:       'inline-block',
    padding:       '2px 8px',
    borderRadius:  '20px',
    fontSize:      '10px',
    fontWeight:    '700',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color,
    background:    color + '14',
    border:        `1px solid ${color}30`,
  }),
  btn: (bg, color = '#fff') => ({
    padding:      '8px 16px',
    background:   bg,
    border:       'none',
    borderRadius: '8px',
    color,
    fontSize:     '12px',
    fontWeight:   '600',
    cursor:       'pointer',
    transition:   'opacity 0.15s',
  }),
  btnGhost: {
    padding:      '8px 16px',
    background:   'transparent',
    border:       '1px solid #ede8e3',
    borderRadius: '8px',
    color:        '#9a8c9e',
    fontSize:     '12px',
    cursor:       'pointer',
  },
};

// ── Finding card ──────────────────────────────────────────────────────────────
function FindingCard({ finding, onApprove, onExecute, onDismiss, executing }) {
  const [expanded, setExpanded] = useState(finding.severity === 'critical');
  const sColor  = SEVERITY_COLOR[finding.severity] || '#9a94a8';
  const stColor = STATUS_COLOR[finding.status]      || '#9a94a8';

  return (
    <div style={{
      ...s.card,
      borderLeft: `3px solid ${sColor}`,
      opacity:    finding.status === 'dismissed' ? 0.4 : 1,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
            <span style={s.pill(sColor)}>{finding.severity}</span>
            <span style={s.pill(stColor)}>{finding.status}</span>
            {finding.urgent && <span style={s.pill('#d47878')}>urgent</span>}
            {finding.fix_category && <span style={s.pill('#5a5468')}>{finding.fix_category.replace(/_/g, ' ')}</span>}
            {finding.auto_approve_eligible && (
              <span style={s.pill('#78b89a')} title="Eligible for Level 2 auto-approve when unlocked">L2 eligible</span>
            )}
          </div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#2a1f2d', lineHeight: '1.4' }}>
            {finding.title}
          </div>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ ...s.btnGhost, padding: '4px 8px', flexShrink: 0 }}
        >
          {expanded ? '\u2191' : '\u2193'}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ marginTop: '14px' }}>
          <p style={{ fontSize: '13px', color: '#666', lineHeight: '1.7', margin: '0 0 12px' }}>
            {finding.description}
          </p>

          {finding.affected_file && (
            <div style={{ fontSize: '11px', color: '#9a8c9e', marginBottom: '8px', fontFamily: 'monospace' }}>
              {finding.affected_file}
            </div>
          )}
          {finding.affected_route && (
            <div style={{ fontSize: '11px', color: '#9a8c9e', marginBottom: '8px', fontFamily: 'monospace' }}>
              {finding.affected_route}
            </div>
          )}

          {/* Proposed fix */}
          {finding.proposed_fix && (
            <div style={{ background: '#fdf9f5', border: '1px solid #f0e4d0', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', color: '#d4789a', fontWeight: '700', letterSpacing: '0.1em', marginBottom: '6px' }}>
                AMBER'S PROPOSED FIX
              </div>
              <p style={{ fontSize: '12px', color: '#555', lineHeight: '1.7', margin: 0 }}>
                {finding.proposed_fix}
              </p>
            </div>
          )}

          {/* Diff */}
          {finding.proposed_diff && (
            <div style={{ background: '#f5f3f8', border: '1px solid #e8dff0', borderRadius: '8px', padding: '12px', marginBottom: '12px', overflowX: 'auto' }}>
              <div style={{ fontSize: '10px', color: '#7ab3d4', fontWeight: '700', letterSpacing: '0.1em', marginBottom: '6px' }}>
                CODE CHANGE
              </div>
              <pre style={{ fontSize: '11px', color: '#555', margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                {finding.proposed_diff}
              </pre>
            </div>
          )}

          {/* Confidence */}
          {finding.fix_confidence != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', color: '#9a8c9e' }}>Amber's confidence:</span>
              <div style={{ flex: 1, height: '4px', background: '#ede8e3', borderRadius: '2px', maxWidth: '120px' }}>
                <div style={{
                  height: '100%',
                  width: `${finding.fix_confidence}%`,
                  background: finding.fix_confidence > 70 ? '#78b89a' : finding.fix_confidence > 40 ? '#c9a96e' : '#d47878',
                  borderRadius: '2px',
                }} />
              </div>
              <span style={{ fontSize: '11px', color: '#888' }}>{finding.fix_confidence}%</span>
            </div>
          )}

          {/* Amber verdict after execution */}
          {finding.amber_verdict && (
            <div style={{ background: '#fdf0f4', borderLeft: '3px solid #d4789a', padding: '10px 14px', borderRadius: '0 8px 8px 0', marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', color: '#d4789a', fontWeight: '700', letterSpacing: '0.1em', marginBottom: '4px' }}>AMBER</div>
              <p style={{ fontSize: '12px', color: '#555', margin: 0, fontStyle: 'italic', lineHeight: '1.6' }}>
                {finding.amber_verdict}
              </p>
            </div>
          )}

          {/* Action buttons */}
          {['detected', 'surfaced'].includes(finding.status) && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => onApprove(finding.id)} style={s.btn('#d4789a')}>
                Approve Fix
              </button>
              <button onClick={() => onDismiss(finding.id)} style={s.btnGhost}>
                Dismiss
              </button>
            </div>
          )}

          {finding.status === 'approved' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => onExecute(finding.id)}
                disabled={executing === finding.id}
                style={s.btn(executing === finding.id ? '#ede8e3' : '#7ab3d4', executing === finding.id ? '#9a8c9e' : '#fff')}
              >
                {executing === finding.id ? 'Sending to Claude Code...' : 'Execute via Claude Code'}
              </button>
              <span style={{ fontSize: '11px', color: '#9a8c9e' }}>
                Approved — Claude Code will apply this change to your codebase
              </span>
            </div>
          )}

          {finding.status === 'executing' && (
            <div style={{ fontSize: '12px', color: '#c9a96e', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>&#x21BB;</span>
              Claude Code is running...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Task card ─────────────────────────────────────────────────────────────────
function TaskCard({ task }) {
  const pColor = PRIORITY_COLOR[task.priority] || '#9a94a8';
  return (
    <div style={{ ...s.card, borderLeft: `3px solid ${pColor}` }}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span style={s.pill(pColor)}>{task.priority}</span>
        <span style={s.pill('#5a5468')}>{task.type}</span>
        <span style={s.pill('#3a3a42')}>{task.status}</span>
      </div>
      <div style={{ fontSize: '14px', fontWeight: '600', color: '#2a1f2d' }}>{task.title}</div>
      {task.description && (
        <p style={{ fontSize: '12px', color: '#666', margin: '6px 0 0', lineHeight: '1.6' }}>
          {task.description}
        </p>
      )}
      {task.amber_notes && (
        <p style={{ fontSize: '11px', color: '#d4789a', margin: '8px 0 0', fontStyle: 'italic', lineHeight: '1.5' }}>
          {task.amber_notes}
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AmberCommandCenter() {
  const [tab,        setTab]        = useState('findings');
  const [findings,   setFindings]   = useState([]);
  const [tasks,      setTasks]      = useState([]);
  const [scanning,   setScanning]   = useState(false);
  const [executing,  setExecuting]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [scanResult, setScanResult] = useState(null);
  const [filter,     setFilter]     = useState('active');
  const [toast,      setToast]      = useState(null);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4000);
  }

  const loadFindings = useCallback(async () => {
    try {
      const statusMap = {
        active:  'detected,surfaced,approved,executing',
        applied: 'applied',
        all:     '',
      };
      const q   = statusMap[filter] ? `?status=${statusMap[filter]}` : '';
      const res = await fetch(`${API}/api/v1/amber/diagnostic/findings${q}`);
      const data = await res.json();
      setFindings(Array.isArray(data) ? data : []);
    } catch { setFindings([]); }
  }, [filter]);

  const loadTasks = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/v1/amber/diagnostic/queue`);
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch { setTasks([]); }
  }, []);

  useEffect(() => {
    Promise.all([loadFindings(), loadTasks()]).finally(() => setLoading(false));
  }, [loadFindings, loadTasks]);

  async function runScan() {
    setScanning(true);
    setScanResult(null);
    try {
      const res  = await fetch(`${API}/api/v1/amber/diagnostic/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' }),
      });
      const data = await res.json();
      setScanResult(data);
      await loadFindings();
    } catch {
      setScanResult({ error: 'Scan failed' });
    } finally {
      setScanning(false);
    }
  }

  async function approveFinding(id) {
    try {
      const res = await fetch(`${API}/api/v1/amber/diagnostic/findings/${id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      await loadFindings();
    } catch (err) {
      showToast(`Approve failed: ${err.message}`, true);
    }
  }

  async function executeFinding(id) {
    setExecuting(id);
    try {
      const res = await fetch(`${API}/api/v1/amber/diagnostic/findings/${id}/execute`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      showToast('Fix applied via Claude Code');
      await loadFindings();
    } catch (err) {
      showToast(`Execution failed: ${err.message}`, true);
    } finally {
      setExecuting(null);
    }
  }

  async function dismissFinding(id) {
    try {
      const res = await fetch(`${API}/api/v1/amber/diagnostic/findings/${id}/dismiss`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      await loadFindings();
    } catch (err) {
      showToast(`Dismiss failed: ${err.message}`, true);
    }
  }

  const active    = findings.filter(f => ['detected', 'surfaced', 'approved', 'executing'].includes(f.status));
  const critical  = active.filter(f => f.severity === 'critical' || f.urgent);
  const displayed = filter === 'active' ? active
    : filter === 'applied' ? findings.filter(f => f.status === 'applied')
    : findings;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#d4789a', fontWeight: '700', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>
            Amber
          </div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '28px', fontWeight: '700', color: '#2a1f2d', margin: 0 }}>
            Command Center
          </h1>
          <p style={{ fontSize: '13px', color: '#9a8c9e', margin: '6px 0 0', lineHeight: '1.6' }}>
            Amber's findings, proposed fixes, and the build queue. You approve. She executes.
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          style={s.btn(scanning ? '#ede8e3' : '#d4789a', scanning ? '#9a8c9e' : '#fff')}
        >
          {scanning ? 'Scanning...' : 'Run Diagnostic Scan'}
        </button>
      </div>

      {/* Scan result banner */}
      {scanResult && !scanResult.error && (
        <div style={{ ...s.card, borderLeft: '3px solid #78b89a', background: '#f0f7ee', marginBottom: '20px' }}>
          <span style={{ fontSize: '13px', color: '#5a8a50' }}>
            Scan complete — {scanResult.newFindings} new finding{scanResult.newFindings !== 1 ? 's' : ''}
            {scanResult.criticalCount > 0 && `, ${scanResult.criticalCount} critical`}
          </span>
        </div>
      )}

      {/* Critical alert */}
      {critical.length > 0 && (
        <div style={{ ...s.card, borderLeft: '3px solid #d47878', background: '#fdf0f0', marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', color: '#d47878', fontWeight: '700', letterSpacing: '0.1em', marginBottom: '4px' }}>
            {critical.length} CRITICAL / URGENT
          </div>
          <p style={{ fontSize: '13px', color: '#555', margin: 0, lineHeight: '1.6' }}>
            {critical.map(f => f.title).join(' \u00B7 ')}
          </p>
        </div>
      )}

      {/* Stat row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {[
          { label: 'Active findings',      value: active.length,                                                             color: '#d4789a' },
          { label: 'Awaiting approval',     value: active.filter(f => ['detected', 'surfaced'].includes(f.status)).length,   color: '#c9a96e' },
          { label: 'Ready to execute',      value: active.filter(f => f.status === 'approved').length,                       color: '#7ab3d4' },
          { label: 'Applied this session',  value: findings.filter(f => f.status === 'applied').length,                      color: '#78b89a' },
          { label: 'Build queue',           value: tasks.length,                                                              color: '#a889c8' },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#fff', border: '1px solid #ede8e3', borderRadius: '10px', padding: '14px 20px', minWidth: '120px' }}>
            <div style={{ fontSize: '22px', fontWeight: '700', color: stat.color, fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: '#9a8c9e', marginTop: '2px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[
          { key: 'findings', label: `Findings (${active.length})` },
          { key: 'queue',    label: `Build Queue (${tasks.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding:      '7px 16px',
            background:   tab === t.key ? 'rgba(168, 137, 200, 0.08)' : '#fff',
            border:       `1px solid ${tab === t.key ? '#a889c8' : '#ede8e3'}`,
            borderRadius: '8px',
            color:        tab === t.key ? '#a889c8' : '#9a8c9e',
            fontSize:     '13px',
            fontWeight:   tab === t.key ? '600' : '500',
            cursor:       'pointer',
            transition:   'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Findings tab */}
      {tab === 'findings' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {['active', 'applied', 'all'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                ...s.btnGhost,
                color:       filter === f ? '#d4789a' : '#9a8c9e',
                borderColor: filter === f ? '#d4789a44' : '#ede8e3',
                background:  filter === f ? '#d4789a10' : 'transparent',
              }}>
                {f}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#9a8c9e', padding: '40px' }}>Loading...</div>
          ) : displayed.length === 0 ? (
            <div style={{ ...s.card, textAlign: 'center', color: '#9a8c9e', padding: '40px' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>&#x2726;</div>
              {filter === 'active' ? 'No active findings. Run a scan to check the system.' : 'Nothing here yet.'}
            </div>
          ) : (
            displayed
              .sort((a, b) => (SEVERITY_ORDER[a.severity] || 9) - (SEVERITY_ORDER[b.severity] || 9))
              .map(f => (
                <FindingCard
                  key={f.id}
                  finding={f}
                  onApprove={approveFinding}
                  onExecute={executeFinding}
                  onDismiss={dismissFinding}
                  executing={executing}
                />
              ))
          )}
        </div>
      )}

      {/* Queue tab */}
      {tab === 'queue' && (
        <div>
          {tasks.length === 0 ? (
            <div style={{ ...s.card, textAlign: 'center', color: '#9a8c9e', padding: '40px' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>&#x2726;</div>
              Build queue is empty. Tell Amber what you want to build next.
            </div>
          ) : (
            tasks.map(t => <TaskCard key={t.id} task={t} />)
          )}
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
          padding: '12px 20px', borderRadius: '10px',
          background: toast.isError ? '#fdf0f0' : '#f0f7ee',
          border: `1px solid ${toast.isError ? '#d47878' : '#78b89a'}`,
          color: toast.isError ? '#d47878' : '#5a8a50',
          fontSize: '13px', fontWeight: '500',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        }}>
          {toast.msg}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

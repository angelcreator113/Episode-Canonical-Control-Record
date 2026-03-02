/* ─────────────────────────────────────────────────────────────────────────────
   SidebarProgress.jsx — Setup-Wizard progress tracker for the Sidebar
   Shows 5 onboarding steps with a progress bar, collapsible, and
   a "next action" button that navigates to /setup if incomplete.
   ──────────────────────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api/v1';

const STEPS = [
  { key: 'universe',      icon: '◎', label: 'Universe' },
  { key: 'protagonist',   icon: '♛', label: 'Protagonist' },
  { key: 'core_cast',     icon: '◉', label: 'Core Cast' },
  { key: 'relationships', icon: '⊕', label: 'Relationship Web' },
  { key: 'first_book',    icon: '📖', label: 'First Book' },
];

function SidebarProgress({ showId, collapsed: sidebarCollapsed }) {
  const [status, setStatus]     = useState(null);
  const [open, setOpen]         = useState(true);
  const [loading, setLoading]   = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!showId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`${API_BASE}/onboarding/status/${showId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [showId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Derive step completion from the steps array or flat fields
  const stepsArr = status?.steps || [];
  const stepMap = {};
  stepsArr.forEach(s => { stepMap[s.id] = s.complete; });

  const stepDone = {
    universe:      stepMap.universe ?? !!status?.universe,
    protagonist:   stepMap.protagonist ?? (status?.characters || 0) > 0,
    core_cast:     stepMap.cast ?? (status?.characters || 0) >= 3,
    relationships: stepMap.web ?? (status?.relationships || 0) > 0,
    first_book:    stepMap.book ?? (status?.books || 0) > 0,
  };

  const doneCount  = Object.values(stepDone).filter(Boolean).length;
  const totalSteps = STEPS.length;
  const pct        = Math.round((doneCount / totalSteps) * 100);

  // Find next incomplete step for the action button
  const nextStep = STEPS.find(s => !stepDone[s.key]);

  // Priority color
  const priorityColor = pct === 100 ? '#2E8B57' : pct >= 40 ? '#b0922e' : '#C0392B';

  // Don't render if no showId or fully done and collapsed
  if (!showId || !status) return null;
  if (pct === 100 && !open) return null;

  // If sidebar is collapsed, show a minimal pip
  if (sidebarCollapsed) {
    return (
      <div
        style={{
          padding: '10px 0',
          display: 'flex',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
        title={`Setup: ${pct}% complete`}
        onClick={() => window.location.href = '/setup'}
      >
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: `2px solid ${priorityColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: priorityColor,
          fontFamily: 'DM Sans, sans-serif',
        }}>
          {pct}%
        </div>
      </div>
    );
  }

  return (
    <div style={{
      margin: '8px 12px',
      borderRadius: 8,
      border: '1px solid #E0D9CC',
      background: '#F5F2EC',
      overflow: 'hidden',
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 12,
    }}>
      {/* Header — collapsible */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 10px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{ fontWeight: 600, color: '#1C1814', fontSize: 11, letterSpacing: '0.04em' }}>
          SETUP PROGRESS
        </span>
        <span style={{ fontSize: 10, color: '#7A7268' }}>
          {open ? '▾' : '▸'} {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: '#E0D9CC', margin: '0 10px 6px 10px', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: priorityColor,
          borderRadius: 2,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Step list (collapsible) */}
      {open && (
        <div style={{ padding: '0 10px 8px 10px' }}>
          {STEPS.map(step => {
            const done = stepDone[step.key];
            return (
              <div key={step.key} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '3px 0',
                color: done ? '#2E8B57' : '#B8AFA2',
                fontSize: 11,
              }}>
                <span style={{ width: 16, textAlign: 'center', fontSize: 12 }}>
                  {done ? '✓' : step.icon}
                </span>
                <span style={{
                  textDecoration: done ? 'line-through' : 'none',
                  opacity: done ? 0.6 : 1,
                }}>
                  {step.label}
                </span>
              </div>
            );
          })}

          {/* Next-action button */}
          {nextStep && (
            <button
              onClick={() => window.location.href = '/setup'}
              style={{
                width: '100%',
                marginTop: 8,
                padding: '6px 0',
                border: 'none',
                borderRadius: 6,
                background: priorityColor,
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.02em',
                fontFamily: 'DM Sans, sans-serif',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.target.style.opacity = '0.85'}
              onMouseLeave={e => e.target.style.opacity = '1'}
            >
              Continue: {nextStep.label}
            </button>
          )}

          {pct === 100 && (
            <div style={{
              textAlign: 'center',
              marginTop: 6,
              fontSize: 11,
              color: '#2E8B57',
              fontWeight: 500,
            }}>
              ✓ Setup complete
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SidebarProgress;

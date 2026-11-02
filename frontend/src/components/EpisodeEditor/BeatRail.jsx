/**
 * The collapsible 14-beat rail (plan §3.7). Each beat shows its number, its
 * canonical name, a readiness dot from the server's findings, and its visual
 * mode (Gameplay by default: timed Gameplay/Cinematic modes arrive with
 * Gate 2). Clicking a beat enters Beat Focus: the timeline zooms to it, the
 * playhead goes to its start, the inspector shows its card and the media
 * panel shows its clips and takes.
 */
import React from 'react';
import { ChevronDown, ChevronUp, Gamepad2 } from 'lucide-react';

const STATUS_TEXT = {
  blocked: 'Blocking findings',
  warning: 'Warnings only',
  empty: 'Nothing placed yet',
  clear: 'No findings',
};

export default function BeatRail({ beats, readiness, focusBeat, onFocus, collapsed, onToggle }) {
  const byBeat = new Map((readiness?.beats || []).map((r) => [r.beat, r]));
  return (
    <div className={`tle-rail${collapsed ? ' is-collapsed' : ''}`} data-testid="beat-rail">
      <button type="button" className="tle-rail-toggle" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Show the beat rail' : 'Hide the beat rail'}>
        {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />} Beats
      </button>
      <ol className="tle-rail-list">
        {beats.map((b) => {
          const r = byBeat.get(b.beat) || { status: 'clear', blocking: 0, warning: 0 };
          const label = `Beat ${b.beat}: ${b.name}. ${STATUS_TEXT[r.status]}${r.blocking ? ` (${r.blocking} blocking)` : ''}${r.warning ? ` (${r.warning} warnings)` : ''}. Gameplay (default)`;
          return (
            <li key={b.beat}>
              <button type="button" className={`tle-rail-beat is-${r.status}${focusBeat === b.beat ? ' is-focus' : ''}`} onClick={() => onFocus(b.beat)}
                aria-pressed={focusBeat === b.beat} aria-label={label} title={`${label}. Readiness from findings; full beat status arrives with Gate 2`}>
                <span className="tle-rail-dot" aria-hidden="true" />
                <span className="tle-rail-num">{b.beat}</span>
                {!collapsed && <span className="tle-rail-name">{b.name}</span>}
                {!collapsed && <Gamepad2 className="tle-rail-mode" size={12} aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * StoryHubNav — Persistent mini-nav bar for all story system pages.
 * Links: Story Engine | Evaluation | Scene Proposer | Storyteller | Assembler
 */
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const LINKS = [
  { path: '/story-engine',     label: 'Story Engine',  icon: '◎' },
  { path: '/story-evaluation', label: 'Evaluation',    icon: '◈' },
  { path: '/scene-proposer',   label: 'Scene Proposer',icon: '✦' },
  { path: '/storyteller',      label: 'Storyteller',   icon: '◇' },
  { path: '/assembler',        label: 'Assembler',     icon: '⊕' },
  { path: '/story-threads',    label: 'Threads',       icon: '⧖' },
  { path: '/story-calendar',   label: 'Timeline',      icon: '◉' },
  { path: '/world-studio',     label: 'World',         icon: '🌍' },
  { path: '/story-health',     label: 'Health',        icon: '❤' },
];

export default function StoryHubNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const current = location.pathname;
  const [pulse, setPulse] = useState(null);

  useEffect(() => {
    fetch('/api/v1/world/context-summary')
      .then(r => r.json())
      .then(d => setPulse({ threads: d.activeThreadCount || 0, tensions: d.tensionCount || 0 }))
      .catch(() => {});
  }, []);

  return (
    <nav style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '6px 12px', marginBottom: 12,
      background: '#fafaf8', border: '1px solid #e8e5de',
      borderRadius: 8, fontFamily: "'DM Sans', sans-serif",
      overflowX: 'auto',
    }}>
      <span style={{ fontSize: 10, color: '#999', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginRight: 8, whiteSpace: 'nowrap' }}>
        Story Hub
      </span>
      {pulse && (pulse.threads > 0 || pulse.tensions > 0) && (
        <span style={{ fontSize: 10, color: '#c9a96e', fontWeight: 600, marginRight: 8, whiteSpace: 'nowrap' }}>
          {pulse.threads > 0 ? `${pulse.threads} threads` : ''}{pulse.threads > 0 && pulse.tensions > 0 ? ' · ' : ''}{pulse.tensions > 0 ? `${pulse.tensions} ⚡` : ''}
        </span>
      )}
      {LINKS.map(l => {
        const active = current === l.path;
        return (
          <button
            key={l.path}
            onClick={() => navigate(l.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', fontSize: 12, fontWeight: active ? 600 : 400,
              color: active ? '#1a1a1a' : '#888',
              background: active ? '#fff' : 'transparent',
              border: active ? '1px solid #e0dcd4' : '1px solid transparent',
              borderRadius: 6, cursor: 'pointer',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            <span style={{ fontSize: 13 }}>{l.icon}</span>
            {l.label}
          </button>
        );
      })}
    </nav>
  );
}

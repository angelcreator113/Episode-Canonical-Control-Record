/**
 * ShowWorldView.jsx
 * frontend/src/pages/ShowWorldView.jsx
 *
 * The full show world — accessed from Universe Admin → Shows tab.
 * Replaces the Settings → Producer Mode entry point.
 *
 * Contains all show tabs:
 * Control Hub | Producer Mode | Events Library | Career Goals
 * Wardrobe | Characters | Episode Ledger | Decision Log
 *
 * Usage inside UniversePage.jsx ShowsTab:
 *
 *   import ShowWorldView from './ShowWorldView';
 *
 *   // In ShowsTab, when a show is selected:
 *   const [selectedShow, setSelectedShow] = useState(null);
 *
 *   if (selectedShow) {
 *     return (
 *       <ShowWorldView
 *         show={selectedShow}
 *         onBack={() => setSelectedShow(null)}
 *       />
 *     );
 *   }
 *
 * URL: stays at /universe — no route change needed.
 * The show world slides in as a view state, not a new page.
 * Back navigation returns to Shows tab in Universe Admin.
 */

import { useState, useEffect } from 'react';

const SHOWS_API = '/api/v1/shows';

const SHOW_TABS = [
  { id: 'hub',        label: '🏠 Control Hub',     desc: 'Overview and quick links' },
  { id: 'producer',   label: '🌐 Producer Mode',   desc: 'World rules, economy, canon' },
  { id: 'events',     label: '❤️ Events Library',  desc: 'Create and manage events' },
  { id: 'goals',      label: '🎯 Career Goals',    desc: 'Goal management' },
  { id: 'wardrobe',   label: '👗 Wardrobe',        desc: 'Wardrobe items' },
  { id: 'characters', label: '👑 Characters',      desc: 'Show characters' },
  { id: 'episodes',   label: '📋 Episode Ledger',  desc: 'All episodes with scores' },
  { id: 'decisions',  label: '💭 Decision Log',    desc: 'Canon decisions' },
];

export default function ShowWorldView({ show, onBack }) {
  const [activeTab, setActiveTab] = useState('hub');
  const [showData, setShowData]   = useState(show);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    fetchStats();
  }, [show.id]);

  async function fetchStats() {
    try {
      const res = await fetch(`${SHOWS_API}/${show.id}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (_) {}
  }

  return (
    <div style={s.shell}>

      {/* Back nav */}
      <button style={s.backBtn} onClick={onBack} type='button'>
        ← Universe
      </button>

      {/* Show header */}
      <div style={s.showHeader}>
        <div style={s.showHeaderLeft}>
          <div style={s.showLabel}>SHOW</div>
          <div style={s.showName}>{show.name || show.title}</div>
          {show.description && (
            <div style={s.showDesc}>{show.description}</div>
          )}
        </div>
        {stats && (
          <div style={s.showStats}>
            <StatChip label='Episodes' value={stats.episode_count || 0} />
            <StatChip label='Events'   value={stats.event_count   || 0} />
            <StatChip label='Goals'    value={stats.goal_count    || 0} />
            <StatChip label='Wardrobe' value={stats.wardrobe_count|| 0} />
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={s.tabBar}>
        {SHOW_TABS.map(tab => (
          <button
            key={tab.id}
            style={{
              ...s.tabBtn,
              color: activeTab === tab.id
                ? '#14100c'
                : 'rgba(26,21,16,0.35)',
              borderBottom: activeTab === tab.id
                ? '2px solid #14100c'
                : '2px solid transparent',
            }}
            onClick={() => setActiveTab(tab.id)}
            type='button'
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={s.tabContent}>
        {activeTab === 'hub'        && <ControlHubTab show={show} stats={stats} onNavigate={setActiveTab} />}
        {activeTab === 'producer'   && <ProducerModeFrame show={show} tab='producer' />}
        {activeTab === 'events'     && <ProducerModeFrame show={show} tab='events' />}
        {activeTab === 'goals'      && <ProducerModeFrame show={show} tab='goals' />}
        {activeTab === 'wardrobe'   && <ProducerModeFrame show={show} tab='wardrobe' />}
        {activeTab === 'characters' && <ProducerModeFrame show={show} tab='characters' />}
        {activeTab === 'episodes'   && <ProducerModeFrame show={show} tab='episodes' />}
        {activeTab === 'decisions'  && <ProducerModeFrame show={show} tab='decisions' />}
      </div>

    </div>
  );
}

// ── Control Hub Tab ────────────────────────────────────────────────────────

function ControlHubTab({ show, stats, onNavigate }) {
  const quickLinks = [
    { id: 'producer',   icon: '🌐', label: 'Producer Mode',   desc: 'World rules, economy, canon' },
    { id: 'episodes',   icon: '📋', label: 'Episode Ledger',  desc: 'All episodes with scores' },
    { id: 'events',     icon: '❤️', label: 'Events Library',  desc: 'Create and inject events' },
    { id: 'goals',      icon: '🎯', label: 'Career Goals',    desc: 'Goal management' },
    { id: 'wardrobe',   icon: '👗', label: 'Wardrobe',        desc: 'Wardrobe management' },
    { id: 'characters', icon: '👑', label: 'Characters',      desc: 'Show characters' },
    { id: 'decisions',  icon: '💭', label: 'Decision Log',    desc: 'Canon decisions' },
  ];

  return (
    <div style={s.hubShell}>
      <div style={s.hubTitle}>🏠 Control Hub</div>
      <div style={s.hubSub}>Quick overview and links to everything in your show.</div>

      {/* Stats row */}
      {stats && (
        <div style={s.hubStatsRow}>
          <HubStat icon='📋' value={stats.episode_count || 0} label='EPISODES' sub={`${stats.episodes_evaluated || 0} evaluated`} />
          <HubStat icon='❤️' value={stats.event_count   || 0} label='EVENTS'   sub='in library' />
          <HubStat icon='🎯' value={stats.goal_count    || 0} label='GOALS'    sub={`${stats.goals_active || 0} active`} />
          <HubStat icon='👗' value={stats.wardrobe_count|| 0} label='WARDROBE' sub={`${stats.wardrobe_owned || 0} owned`} />
        </div>
      )}

      {/* Quick links */}
      <div style={s.hubLinksLabel}>Quick Links</div>
      <div style={s.hubLinksGrid}>
        {quickLinks.map(link => (
          <button
            key={link.id}
            style={s.hubLinkCard}
            onClick={() => onNavigate(link.id)}
            type='button'
          >
            <div style={s.hubLinkIcon}>{link.icon}</div>
            <div style={s.hubLinkLabel}>{link.label}</div>
            <div style={s.hubLinkDesc}>{link.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── ProducerModeFrame ──────────────────────────────────────────────────────
// Renders the existing show world UI via iframe pointing to current Settings path.
// This is the bridge — existing functionality works immediately.
// When Settings pages are refactored, swap iframe for direct component import.

function ProducerModeFrame({ show, tab }) {
  const showId = show.id;

  // Map our tab IDs to the existing Settings URL tab params
  const TAB_MAP = {
    producer:   'producer',
    events:     'events',
    goals:      'goals',
    wardrobe:   'wardrobe',
    characters: 'characters',
    episodes:   'episodes',
    decisions:  'decisions',
  };

  const tabParam = TAB_MAP[tab] || tab;

  // Option A: If the existing show world is at /shows/:id/world
  const existingUrl = `/shows/${showId}/world?tab=${tabParam}`;

  // Option B: If it's at /shows/:id/settings
  // const existingUrl = `/shows/${showId}/settings?tab=${tabParam}`;

  return (
    <div style={s.frameShell}>
      {/* 
        INTEGRATION NOTE:
        
        The cleanest path forward is one of three options:
        
        OPTION 1 — IFRAME BRIDGE (fastest, works now):
        Render the existing show world in an iframe.
        No code changes needed. Just a navigation change.
        
        OPTION 2 — COMPONENT IMPORT (cleanest long-term):
        Import the existing show world component directly.
        Replace this entire component with:
          import ShowSettings from './ShowSettings'; // or wherever it lives
          return <ShowSettings showId={show.id} initialTab={tab} hideBackNav />;
        
        OPTION 3 — REDIRECT (simplest):
        Instead of embedding, navigate to the existing URL.
        In ShowWorldView, replace ProducerModeFrame with a useEffect
        that navigates to the existing path when a tab is selected.
        
        RECOMMENDED: Option 2 when you refactor.
        For now, implement Option 3 — it works immediately with zero risk.
      */}
      <IframeBridge url={existingUrl} showId={showId} tab={tab} />
    </div>
  );
}

function IframeBridge({ url, showId, tab }) {
  return (
    <div style={s.bridgeShell}>
      <div style={s.bridgeNote}>
        <div style={s.bridgeNoteIcon}>◈</div>
        <div>
          <div style={s.bridgeNoteTitle}>Integration point</div>
          <div style={s.bridgeNoteText}>
            This tab connects to the existing show world at{' '}
            <code style={s.bridgeCode}>/shows/{showId}/world?tab={tab}</code>.
            Import the component directly or use a router redirect.
          </div>
        </div>
      </div>
      <iframe
        src={url}
        style={s.iframe}
        title={`Show ${tab}`}
        frameBorder='0'
      />
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────

function StatChip({ label, value }) {
  return (
    <div style={s.statChip}>
      <span style={s.statChipValue}>{value}</span>
      <span style={s.statChipLabel}>{label}</span>
    </div>
  );
}

function HubStat({ icon, value, label, sub }) {
  return (
    <div style={s.hubStat}>
      <div style={s.hubStatIcon}>{icon}</div>
      <div style={s.hubStatValue}>{value}</div>
      <div style={s.hubStatLabel}>{label}</div>
      {sub && <div style={s.hubStatSub}>{sub}</div>}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    minHeight: '100vh',
    background: '#faf8f5',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.1em',
    color: 'rgba(26,21,16,0.35)',
    cursor: 'pointer',
    padding: '16px 24px 8px',
    textAlign: 'left',
    transition: 'color 0.12s',
  },
  showHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '8px 24px 20px',
    borderBottom: '1px solid rgba(26,21,16,0.08)',
  },
  showHeaderLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  showLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.2em',
    color: 'rgba(26,21,16,0.35)',
  },
  showName: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 28,
    fontStyle: 'italic',
    color: '#14100c',
  },
  showDesc: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: 'rgba(26,21,16,0.4)',
    letterSpacing: '0.04em',
    lineHeight: 1.5,
    maxWidth: 400,
  },
  showStats: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    paddingTop: 8,
  },
  statChip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    background: 'rgba(26,21,16,0.03)',
    border: '1px solid rgba(26,21,16,0.08)',
    borderRadius: 3,
    padding: '8px 14px',
  },
  statChipValue: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 20,
    color: '#14100c',
    lineHeight: 1,
  },
  statChipLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 7,
    letterSpacing: '0.1em',
    color: 'rgba(26,21,16,0.35)',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid rgba(26,21,16,0.08)',
    padding: '0 16px',
    overflowX: 'auto',
    gap: 0,
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.08em',
    padding: '14px 16px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'color 0.12s',
  },
  tabContent: {
    flex: 1,
    overflow: 'auto',
  },
  // Control Hub
  hubShell: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  hubTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 22,
    color: '#14100c',
  },
  hubSub: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: 'rgba(26,21,16,0.4)',
    letterSpacing: '0.05em',
    marginTop: -14,
  },
  hubStatsRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  hubStat: {
    background: '#fff',
    border: '1px solid rgba(26,21,16,0.08)',
    borderRadius: 4,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    minWidth: 120,
    flex: 1,
  },
  hubStatIcon: { fontSize: 24, marginBottom: 4 },
  hubStatValue: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 32,
    color: '#14100c',
    lineHeight: 1,
  },
  hubStatLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.14em',
    color: 'rgba(26,21,16,0.35)',
  },
  hubStatSub: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(26,21,16,0.25)',
    letterSpacing: '0.04em',
  },
  hubLinksLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.14em',
    color: 'rgba(26,21,16,0.35)',
  },
  hubLinksGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 10,
  },
  hubLinkCard: {
    background: '#fff',
    border: '1px solid rgba(26,21,16,0.07)',
    borderRadius: 4,
    padding: '16px',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    transition: 'background 0.12s, border-color 0.12s',
  },
  hubLinkIcon: { fontSize: 20 },
  hubLinkLabel: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 14,
    color: '#14100c',
  },
  hubLinkDesc: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(26,21,16,0.35)',
    letterSpacing: '0.04em',
    lineHeight: 1.4,
  },
  // Frame
  frameShell: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 180px)',
  },
  bridgeShell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  bridgeNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '12px 20px',
    background: 'rgba(26,21,16,0.02)',
    borderBottom: '1px solid rgba(26,21,16,0.06)',
  },
  bridgeNoteIcon: {
    color: '#14100c',
    fontSize: 12,
    flexShrink: 0,
    marginTop: 1,
  },
  bridgeNoteTitle: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.12em',
    color: '#14100c',
    marginBottom: 3,
  },
  bridgeNoteText: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(26,21,16,0.4)',
    letterSpacing: '0.04em',
    lineHeight: 1.5,
  },
  bridgeCode: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    background: 'rgba(26,21,16,0.05)',
    padding: '1px 4px',
    borderRadius: 2,
    color: '#14100c',
  },
  iframe: {
    flex: 1,
    width: '100%',
    height: '100%',
    border: 'none',
    background: '#fff',
  },
};

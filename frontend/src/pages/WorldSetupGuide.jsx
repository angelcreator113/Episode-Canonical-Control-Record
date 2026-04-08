import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './WorldLocations.css';

const API = import.meta.env.VITE_API_URL || '/api/v1';

const STEPS = [
  {
    num: 1,
    key: 'infrastructure',
    icon: '🏗️',
    title: 'Power Structures',
    route: '/world-infrastructure',
    description: 'Define the cities, companies, universities, and legendary figures of the LalaVerse. This is the foundation — who runs what, where power lives.',
    feeds: ['Cultural Calendar', 'Locations', 'Feed profiles'],
    action: 'Set up cities, corporations, and schools → Push to Brain',
    checkField: 'infrastructure',
  },
  {
    num: 2,
    key: 'influencer',
    icon: '⭐',
    title: 'Fame & Influence Rules',
    route: '/influencer-systems',
    description: 'How does influence work? Creator archetypes, relationship types, income streams, trend cycles. These rules determine how feed profiles behave.',
    feeds: ['Feed profile generation', 'Event automation', 'Story evaluation'],
    action: 'Review archetypes and economy → Push to Brain',
    checkField: 'influencer',
  },
  {
    num: 3,
    key: 'calendar',
    icon: '📅',
    title: 'Cultural Calendar',
    route: '/cultural-calendar',
    description: 'The yearly rhythm — Fashion Week, award shows, micro events. These cultural moments auto-spawn world events that Lala might get invited to.',
    feeds: ['Events Library (auto-spawn)', 'Feed activity', 'Episode planning'],
    action: 'Review events on Timeline + Micro tabs → Create Events from them',
    checkField: 'calendar',
  },
  {
    num: 4,
    key: 'memory',
    icon: '📜',
    title: 'Cultural Memory',
    route: '/cultural-memory',
    description: 'How the world remembers its past — legends, feuds, anniversaries. Gives characters shared history to reference in dialogue and content.',
    feeds: ['Character dialogue', 'Feed post generation', 'Story depth'],
    action: 'Review memory types → Push to Brain',
    checkField: 'memory',
  },
  {
    num: 5,
    key: 'locations',
    icon: '📍',
    title: 'Locations & Venues',
    route: '/world-locations',
    description: 'The map — streets, districts, venues, properties. Events need venues. Characters need homes. Scenes need settings.',
    feeds: ['Event venues', 'Scene Sets', 'HOME_BASE properties'],
    action: 'Create locations for your key venues and character homes',
    checkField: 'locations',
  },
  {
    num: 6,
    key: 'feed',
    icon: '👥',
    title: "Generate Lala's Feed",
    route: null, // handled by show-specific route
    description: "The people — content creators, influencers, rivals, friends. They host events, attend parties, and populate Lala's social world.",
    feeds: ['Event hosts', 'Guest lists', 'Story characters', 'Social drama'],
    action: 'Go to Producer Mode → Lala\'s Feed tab → Generate 20 creators',
    checkField: 'feed',
  },
  {
    num: 7,
    key: 'events',
    icon: '🎉',
    title: 'Create World Events',
    route: '/cultural-calendar',
    description: 'Cultural Calendar events auto-spawn world events with hosts from the Feed, venues from Locations, and guest lists from profile relationships.',
    feeds: ['Episode injection', 'Invitation generation', 'Scene creation'],
    action: 'Open a Calendar event → Click "Create Event from This"',
    checkField: 'events',
  },
];

export default function WorldSetupGuide() {
  const navigate = useNavigate();
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const checks = {};

        // Check infrastructure
        try {
          const r = await fetch(`${API}/page-data/world_infrastructure`);
          const d = await r.json();
          checks.infrastructure = d?.data && Object.keys(d.data).length > 0;
        } catch { checks.infrastructure = false; }

        // Check influencer systems
        try {
          const r = await fetch(`${API}/page-data/influencer_systems`);
          const d = await r.json();
          checks.influencer = d?.data && Object.keys(d.data).length > 0;
        } catch { checks.influencer = false; }

        // Check cultural calendar events
        try {
          const r = await fetch(`${API}/calendar/events?event_type=lalaverse_cultural`);
          const d = await r.json();
          checks.calendar = (d.events || []).length > 0;
        } catch { checks.calendar = false; }

        // Check cultural memory
        try {
          const r = await fetch(`${API}/page-data/cultural_memory`);
          const d = await r.json();
          checks.memory = d?.data && Object.keys(d.data).length > 0;
        } catch { checks.memory = false; }

        // Check locations
        try {
          const r = await fetch(`${API}/world/locations`);
          const d = await r.json();
          checks.locations = (d.locations || []).length > 0;
        } catch { checks.locations = false; }

        // Check feed profiles
        try {
          const r = await fetch(`${API}/social-profiles?feed_layer=lalaverse&limit=1`);
          const d = await r.json();
          checks.feed = (d.count || 0) > 0;
        } catch { checks.feed = false; }

        // Check world events
        try {
          const r = await fetch(`${API}/shows`);
          const shows = await r.json();
          const showId = (shows.data || [])[0]?.id;
          if (showId) {
            const er = await fetch(`${API}/world/${showId}/events?status=draft`);
            const ed = await er.json();
            checks.events = (ed.events || []).length > 0;
          } else {
            checks.events = false;
          }
        } catch { checks.events = false; }

        setStatus(checks);
      } catch (e) {
        console.error('Status check failed:', e);
      }
      setLoading(false);
    };
    checkStatus();
  }, []);

  const completedCount = Object.values(status).filter(Boolean).length;
  const totalCount = STEPS.length;

  return (
    <div className="wl-page">
      <div className="wl-container" style={{ maxWidth: 800 }}>
        <div className="wl-header">
          <div>
            <h1 className="wl-title">World Setup Guide</h1>
            <p className="wl-subtitle">Build the LalaVerse step by step — each layer feeds into the next</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: completedCount === totalCount ? '#16a34a' : '#B8962E' }}>
              {loading ? '...' : `${completedCount}/${totalCount}`}
            </div>
            <div style={{ fontSize: 11, color: '#888' }}>steps complete</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background: '#eee', borderRadius: 8, height: 8, marginBottom: 32, overflow: 'hidden' }}>
          <div style={{ background: completedCount === totalCount ? '#16a34a' : '#B8962E', height: '100%', width: `${(completedCount / totalCount) * 100}%`, borderRadius: 8, transition: 'width 0.3s' }} />
        </div>

        {/* How it connects */}
        <div style={{ background: '#FAF7F0', border: '1px solid #e8e0d0', borderRadius: 10, padding: '16px 20px', marginBottom: 28, fontSize: 13, color: '#555', lineHeight: 1.6 }}>
          <strong style={{ color: '#B8962E' }}>How it all connects:</strong> Infrastructure defines the world → Influencer rules govern how people behave → Cultural Calendar creates yearly events → Memory gives depth → Locations are where things happen → Feed profiles are the people → Events are the story moments. Each layer feeds into the next. Push each to Franchise Brain so the AI uses your rules.
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {STEPS.map((step) => {
            const done = status[step.checkField];
            return (
              <div
                key={step.key}
                style={{
                  background: '#fff',
                  border: `1px solid ${done ? '#d4edda' : '#eee'}`,
                  borderRadius: 10,
                  padding: '16px 20px',
                  cursor: step.route ? 'pointer' : 'default',
                  transition: 'border-color 0.15s',
                }}
                onClick={() => step.route && navigate(step.route)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: done ? '#d4edda' : '#FAF7F0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                    border: `2px solid ${done ? '#16a34a' : '#e8e0d0'}`,
                  }}>
                    {done ? '✓' : step.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#B8962E' }}>STEP {step.num}</span>
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#2C2C2C' }}>{step.title}</span>
                      {done && <span style={{ fontSize: 9, padding: '2px 6px', background: '#d4edda', color: '#166534', borderRadius: 4, fontWeight: 600 }}>DONE</span>}
                    </div>
                    <p style={{ fontSize: 12, color: '#666', margin: '0 0 8px', lineHeight: 1.5 }}>{step.description}</p>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>
                      <strong style={{ color: '#B8962E' }}>Feeds into:</strong> {step.feeds.join(' · ')}
                    </div>
                    <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>
                      → {step.action}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

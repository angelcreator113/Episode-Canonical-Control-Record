/**
 * ShowSettings — Simplified (Config + Advanced only)
 *
 * Route: /shows/:id/settings
 *
 * After Producer Mode moved to Universe Admin, Settings has one job:
 * technical show configuration. Two tabs only.
 *
 * ⚙️  Config   — Show title, status, era, season settings, economy model
 * 🔧  Advanced — Seed data, export, reset stats
 *
 * Everything else (events, wardrobe, goals, characters, hub) lives in:
 * Universe Admin → Shows → ShowWorldView
 *
 * REPLACES: frontend/src/pages/ShowSettings.jsx
 * CSS FILE:  No external CSS needed — all inline styles
 * REMOVE:    ShowSettings.css import
 */

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

const TABS = [
  { key: 'config',   icon: '⚙️',  label: 'Config'   },
  { key: 'advanced', icon: '🔧',  label: 'Advanced'  },
];

const ERAS = [
  'Pre-Prime Era',
  'Prime Era',
  'Post-Prime Era',
];

const ECONOMY_MODELS = [
  'Prime Coins + Dream Fund',
  'Coins Only',
  'Custom',
];

export default function ShowSettings() {
  const { id: showId }          = useParams();
  const navigate                = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTabState] = useState(searchParams.get('tab') || 'config');
  const [show, setShow]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);

  // Config form
  const [form, setForm] = useState({
    title:          '',
    status:         'active',
    era:            'Pre-Prime Era',
    season_length:  24,
    economy_model:  'Prime Coins + Dream Fund',
    description:    '',
  });
  const [dirty, setDirty] = useState(false);

  // Advanced state
  const [seeding,    setSeeding]    = useState(false);
  const [resetting,  setResetting]  = useState(false);
  const [exporting,  setExporting]  = useState(false);

  function setTab(tab) {
    setActiveTabState(tab);
    setSearchParams({ tab });
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  }

  useEffect(() => { load(); }, [showId]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/api/v1/shows/${showId}`);
      const s   = res.data?.show || res.data;
      setShow(s);
      setForm({
        title:         s.title        || s.name || '',
        status:        s.status       || 'active',
        era:           s.era          || 'Pre-Prime Era',
        season_length: s.season_length || 24,
        economy_model: s.economy_model || 'Prime Coins + Dream Fund',
        description:   s.description  || '',
      });
    } catch (err) {
      showToast('Failed to load show', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      await api.put(`/api/v1/shows/${showId}`, form);
      setDirty(false);
      showToast('Settings saved');
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function seedAll() {
    if (!window.confirm('Seed goals (24), wardrobe (40 items), and events? Existing records will be skipped.')) return;
    setSeeding(true);
    try {
      await Promise.allSettled([
        api.post(`/api/v1/world/${showId}/goals/seed`, { activate_tier: 1 }),
        api.post('/api/v1/wardrobe/seed', { show_id: showId }),
      ]);
      showToast('Seeded goals + wardrobe');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSeeding(false);
    }
  }

  async function exportData() {
    setExporting(true);
    try {
      const [epsRes, eventsRes, goalsRes, wardrobeRes] = await Promise.allSettled([
        api.get(`/api/v1/episodes?show_id=${showId}&limit=200`),
        api.get(`/api/v1/world/${showId}/events`),
        api.get(`/api/v1/world/${showId}/goals`),
        api.get(`/api/v1/wardrobe?show_id=${showId}&limit=500`),
      ]);

      const payload = {
        show:     show,
        exported: new Date().toISOString(),
        episodes: epsRes.status    === 'fulfilled' ? (epsRes.value.data?.episodes    || []) : [],
        events:   eventsRes.status === 'fulfilled' ? (eventsRes.value.data?.events   || []) : [],
        goals:    goalsRes.status  === 'fulfilled' ? (goalsRes.value.data?.goals     || []) : [],
        wardrobe: wardrobeRes.status === 'fulfilled' ? (wardrobeRes.value.data?.data || []) : [],
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${(show?.title || 'show').replace(/\s+/g, '-').toLowerCase()}-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Export downloaded');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setExporting(false);
    }
  }

  async function resetStats() {
    if (!window.confirm("Reset Lala's stats to defaults?\n\nCoins: 500, Reputation: 1, Brand Trust: 1, Influence: 1, Stress: 0\n\nThis cannot be undone.")) return;
    setResetting(true);
    try {
      await api.post('/api/v1/characters/lala/state/update', {
        show_id:    showId,
        coins:      500,
        reputation: 1,
        brand_trust: 1,
        influence:  1,
        stress:     0,
        source:     'manual',
        notes:      'Reset from Settings page',
      });
      showToast("Lala's stats reset to defaults");
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <div style={s.page}>
        <div style={s.loadingText}>Loading settings…</div>
      </div>
    );
  }

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <Link to={`/shows/${showId}`} style={s.backLink}>← Back to Show</Link>
        <div style={s.headerMain}>
          <h1 style={s.title}>⚙️ Settings</h1>
          <div style={s.subtitle}>{show?.title || show?.name || 'Show'}</div>
        </div>
        <div style={s.headerNote}>
          World-building tools have moved to{' '}
          <button
            style={s.universeLink}
            onClick={() => navigate('/universe')}
            type='button'
          >
            Universe Admin →
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={s.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            style={{
              ...s.tabBtn,
              color: activeTab === tab.key
                ? '#1a1a2e'
                : '#94a3b8',
              borderBottom: activeTab === tab.key
                ? '2px solid #1a1a2e'
                : '2px solid transparent',
              fontWeight: activeTab === tab.key ? 600 : 400,
            }}
            onClick={() => setTab(tab.key)}
            type='button'
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={s.content}>

        {/* ══ CONFIG ══════════════════════════════════════════════════ */}
        {activeTab === 'config' && (
          <div style={s.section}>

            <div style={s.sectionHeader}>
              <div>
                <div style={s.sectionTitle}>Show Configuration</div>
                <div style={s.sectionDesc}>Basic show settings and season parameters.</div>
              </div>
              {dirty && (
                <button
                  style={s.saveBtn}
                  onClick={saveConfig}
                  disabled={saving}
                  type='button'
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              )}
            </div>

            {/* Show Details */}
            <ConfigBlock title='Show Details'>
              <Field label='Title'>
                <input
                  style={s.input}
                  value={form.title}
                  onChange={e => setField('title', e.target.value)}
                  placeholder='Styling Adventures'
                />
              </Field>
              <Field label='Description'>
                <textarea
                  style={{ ...s.input, ...s.textarea }}
                  value={form.description}
                  onChange={e => setField('description', e.target.value)}
                  placeholder='Short show description…'
                  rows={3}
                />
              </Field>
              <Field label='Status'>
                <select
                  style={s.select}
                  value={form.status}
                  onChange={e => setField('status', e.target.value)}
                >
                  <option value='active'>Active</option>
                  <option value='paused'>Paused</option>
                  <option value='archived'>Archived</option>
                </select>
              </Field>
              <ReadOnlyField label='Show ID' value={showId} mono />
            </ConfigBlock>

            {/* Season Settings */}
            <ConfigBlock title='Season Settings'>
              <Field label='Era'>
                <select
                  style={s.select}
                  value={form.era}
                  onChange={e => setField('era', e.target.value)}
                >
                  {ERAS.map(era => (
                    <option key={era} value={era}>{era}</option>
                  ))}
                </select>
              </Field>
              <Field label='Planned episodes'>
                <input
                  style={{ ...s.input, maxWidth: 100 }}
                  type='number'
                  value={form.season_length}
                  onChange={e => setField('season_length', parseInt(e.target.value) || 24)}
                  min={1}
                  max={100}
                />
              </Field>
              <Field label='Economy model'>
                <select
                  style={s.select}
                  value={form.economy_model}
                  onChange={e => setField('economy_model', e.target.value)}
                >
                  {ECONOMY_MODELS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Field>
            </ConfigBlock>

            {dirty && (
              <div style={s.saveBtnBottom}>
                <button
                  style={s.saveBtn}
                  onClick={saveConfig}
                  disabled={saving}
                  type='button'
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            )}

          </div>
        )}

        {/* ══ ADVANCED ════════════════════════════════════════════════ */}
        {activeTab === 'advanced' && (
          <div style={s.section}>

            <div style={s.sectionHeader}>
              <div>
                <div style={s.sectionTitle}>Advanced</div>
                <div style={s.sectionDesc}>Data management and resets.</div>
              </div>
            </div>

            {/* Seed Data */}
            <ActionCard
              color='#6366f1'
              icon='🌱'
              title='Seed Data'
              desc='Populate goals (24), wardrobe (40 items), and events from built-in libraries. Existing records are skipped — safe to run again.'
            >
              <button
                style={{ ...s.actionBtn, borderColor: '#c7d2fe', color: '#4338ca', background: '#eef2ff' }}
                onClick={seedAll}
                disabled={seeding}
                type='button'
              >
                {seeding ? 'Seeding…' : '🌱 Seed All'}
              </button>
            </ActionCard>

            {/* Export */}
            <ActionCard
              color='#eab308'
              icon='📤'
              title='Export Data'
              desc='Download all episodes, events, goals, and wardrobe items as a single JSON file.'
            >
              <button
                style={{ ...s.actionBtn, borderColor: '#fde68a', color: '#92400e', background: '#fef3c7' }}
                onClick={exportData}
                disabled={exporting}
                type='button'
              >
                {exporting ? 'Exporting…' : '📤 Export JSON'}
              </button>
            </ActionCard>

            {/* Reset stats — danger */}
            <ActionCard
              color='#dc2626'
              icon='⚠️'
              title="Reset Lala's Stats"
              desc='Resets all character stats to defaults: 500 coins, 1 reputation, 1 brand trust, 1 influence, 0 stress. This cannot be undone.'
              danger
            >
              <button
                style={{ ...s.actionBtn, borderColor: '#fecaca', color: '#dc2626', background: '#fef2f2' }}
                onClick={resetStats}
                disabled={resetting}
                type='button'
              >
                {resetting ? 'Resetting…' : '⚠️ Reset Stats'}
              </button>
            </ActionCard>

          </div>
        )}

      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          ...s.toast,
          background: toast.type === 'error' ? '#dc2626' : '#16a34a',
        }}>
          {toast.msg}
        </div>
      )}

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function ConfigBlock({ title, children }) {
  return (
    <div style={cb.block}>
      <div style={cb.title}>{title}</div>
      <div style={cb.fields}>{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={cb.field}>
      <label style={cb.label}>{label}</label>
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value, mono }) {
  return (
    <div style={cb.field}>
      <label style={cb.label}>{label}</label>
      <div style={{
        ...cb.readOnly,
        fontFamily: mono ? 'DM Mono, monospace' : 'inherit',
        fontSize: mono ? 11 : 13,
      }}>
        {value}
      </div>
    </div>
  );
}

function ActionCard({ color, icon, title, desc, danger, children }) {
  return (
    <div style={{
      ...ac.card,
      borderLeft: `4px solid ${color}`,
      background: danger ? '#fffbfb' : '#fff',
    }}>
      <div style={ac.header}>
        <span style={ac.icon}>{icon}</span>
        <div style={ac.body}>
          <div style={{ ...ac.title, color: danger ? '#dc2626' : '#1a1a2e' }}>{title}</div>
          <div style={ac.desc}>{desc}</div>
        </div>
      </div>
      <div style={ac.actions}>{children}</div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const s = {
  page: {
    maxWidth: 680,
    margin: '0 auto',
    padding: '24px 24px 60px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  loadingText: {
    textAlign: 'center',
    padding: 60,
    color: '#94a3b8',
    fontSize: 14,
  },
  header: {
    marginBottom: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  backLink: {
    color: '#6366f1',
    fontSize: 13,
    textDecoration: 'none',
    fontWeight: 500,
    marginBottom: 4,
    display: 'inline-block',
  },
  headerMain: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    color: '#1a1a2e',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: 400,
  },
  headerNote: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  universeLink: {
    background: 'none',
    border: 'none',
    color: '#6366f1',
    fontSize: 12,
    cursor: 'pointer',
    padding: 0,
    fontWeight: 500,
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid #e2e8f0',
    marginBottom: 28,
    gap: 0,
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    padding: '10px 20px',
    fontSize: 13,
    cursor: 'pointer',
    letterSpacing: '0.01em',
    transition: 'color 0.12s',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: 2,
  },
  sectionDesc: {
    fontSize: 13,
    color: '#64748b',
  },
  saveBtn: {
    background: '#1a1a2e',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    padding: '8px 18px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  saveBtnBottom: {
    display: 'flex',
    justifyContent: 'flex-end',
    paddingTop: 4,
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: 13,
    color: '#1a1a2e',
    background: '#fff',
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.12s',
  },
  textarea: {
    resize: 'vertical',
    minHeight: 72,
  },
  select: {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: 13,
    color: '#1a1a2e',
    background: '#fff',
    boxSizing: 'border-box',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  actionBtn: {
    border: '1px solid',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    padding: '8px 16px',
    cursor: 'pointer',
    transition: 'opacity 0.12s',
  },
  toast: {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    padding: '10px 20px',
    borderRadius: 8,
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    zIndex: 9999,
    whiteSpace: 'nowrap',
  },
};

// ConfigBlock styles
const cb = {
  block: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    color: '#94a3b8',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#64748b',
  },
  readOnly: {
    padding: '9px 12px',
    background: '#f8fafc',
    border: '1px solid #f1f5f9',
    borderRadius: 6,
    fontSize: 13,
    color: '#64748b',
    userSelect: 'all',
  },
};

// ActionCard styles
const ac = {
  card: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  icon: {
    fontSize: 20,
    flexShrink: 0,
    marginTop: 1,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 3,
  },
  desc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    gap: 8,
  },
};

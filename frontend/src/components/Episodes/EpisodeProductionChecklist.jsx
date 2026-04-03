import { useState, useEffect } from 'react';
import api from '../../services/api';

/**
 * EpisodeProductionChecklist
 *
 * Replaces the generic progress bar in EpisodeOverviewTab.
 * Checks real production gates and shows exactly what's missing
 * before the Generate Script button unlocks.
 */

const CHECKLIST_SECTIONS = [
  {
    id: 'brief',
    icon: '📋',
    label: 'Episode Brief',
    items: [
      { id: 'arc_position',      label: 'Arc position set',           required: true  },
      { id: 'archetype',         label: 'Episode archetype chosen',   required: true  },
      { id: 'designed_intent',   label: 'Designed intent set',        required: true  },
      { id: 'narrative_purpose', label: 'Narrative purpose written',  required: false },
      { id: 'forward_hook',      label: 'Forward hook written',       required: false },
    ],
  },
  {
    id: 'world',
    icon: '🎬',
    label: 'World',
    items: [
      { id: 'event_linked',      label: 'Event linked to episode',    required: true  },
      { id: 'scene_sets',        label: 'Scene sets assigned',        required: true  },
      { id: 'scene_plan',        label: 'Scene plan generated',       required: true  },
      { id: 'scene_plan_locked', label: 'Scene plan locked',          required: false },
      { id: 'invitation_exists', label: 'Invitation generated',       required: false },
    ],
  },
  {
    id: 'lala',
    icon: '👗',
    label: 'Lala',
    items: [
      { id: 'wardrobe_ready',    label: 'Wardrobe items available',        required: true  },
      { id: 'character_state',   label: 'Character state loaded',          required: true  },
    ],
  },
  {
    id: 'intelligence',
    icon: '🧠',
    label: 'Intelligence',
    items: [
      { id: 'show_brain',        label: 'Show Brain accessible',      required: false },
    ],
  },
];

function CheckItem({ item, checked, loading }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '5px 0',
      opacity: loading ? 0.5 : 1,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
        border: checked ? 'none' : `1.5px solid ${item.required ? '#E57373' : '#CCC'}`,
        background: checked ? '#16a34a' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && <span style={{ color: '#FFF', fontSize: 11, fontWeight: 700 }}>✓</span>}
      </div>
      <span style={{
        fontSize: 13,
        color: checked ? '#555' : item.required ? '#C62828' : '#999',
        fontWeight: item.required && !checked ? 600 : 400,
        textDecoration: checked ? 'line-through' : 'none',
      }}>
        {item.label}
        {item.required && !checked && (
          <span style={{ marginLeft: 6, fontSize: 9, color: '#E57373', fontWeight: 700, textTransform: 'uppercase' }}>
            required
          </span>
        )}
      </span>
    </div>
  );
}

export default function EpisodeProductionChecklist({ episode, showId, onScriptGenerate }) {
  const [checks, setChecks] = useState({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!episode?.id) return;
    checkReadiness();
  }, [episode?.id]);

  const checkReadiness = async () => {
    setLoading(true);
    const results = {};

    try {
      // ── Check Episode Brief ──
      try {
        const { data } = await api.get(`/api/v1/episode-brief/${episode.id}`);
        const brief = data.data;
        results.arc_position      = !!(brief?.arc_number && brief?.position_in_arc);
        results.archetype         = !!brief?.episode_archetype;
        results.designed_intent   = !!brief?.designed_intent;
        results.narrative_purpose = !!brief?.narrative_purpose;
        results.forward_hook      = !!brief?.forward_hook;
      } catch {
        Object.assign(results, { arc_position: false, archetype: false, designed_intent: false, narrative_purpose: false, forward_hook: false });
      }

      // ── Check Event linked (via world_events.used_in_episode_id) ──
      try {
        if (showId) {
          const { data } = await api.get(`/api/v1/world/${showId}/events`);
          const events = data?.events || [];
          const linkedEvent = events.find(ev => ev.used_in_episode_id === episode.id);
          results.event_linked = !!linkedEvent;
          results.invitation_exists = !!linkedEvent?.invitation_asset_id;
        } else {
          results.event_linked = false;
        }
      } catch {
        results.event_linked = false;
      }

      // ── Check Scene Sets assigned ──
      try {
        const { data } = await api.get(`/api/v1/episodes/${episode.id}/scene-sets`);
        const sets = data?.data || data?.sceneSets || [];
        results.scene_sets = Array.isArray(sets) ? sets.length > 0 : false;
      } catch {
        results.scene_sets = false;
      }

      // ── Check Scene Plan ──
      try {
        const { data } = await api.get(`/api/v1/episode-brief/${episode.id}/plan`);
        const plan = data?.data || [];
        results.scene_plan        = plan.length > 0;
        results.scene_plan_locked = plan.length > 0 && plan.every(b => b.locked);
      } catch {
        results.scene_plan = results.scene_plan_locked = false;
      }

      // ── Check Wardrobe ──
      try {
        const { data } = await api.get(`/api/v1/wardrobe?show_id=${showId}&limit=5`);
        const items = data?.data || [];
        results.wardrobe_ready = items.length > 0;
      } catch {
        results.wardrobe_ready = false;
      }

      // ── Check Character state ──
      try {
        const { data } = await api.get(`/api/v1/characters/lala/state?show_id=${showId}`);
        results.character_state = !!(data?.state || data?.data);
      } catch {
        results.character_state = false;
      }

      // ── Check Show Brain ──
      try {
        const { data } = await api.get('/api/v1/franchise-brain/entries?category=franchise_law&status=active&limit=1');
        const entries = data?.data || [];
        results.show_brain = Array.isArray(entries) ? entries.length > 0 : false;
      } catch {
        results.show_brain = false;
      }
    } catch (err) {
      console.error('[Checklist] Error:', err);
    } finally {
      setChecks(results);
      setLoading(false);
    }
  };

  const handleGenerateScript = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/api/v1/episode-brief/${episode.id}/generate-script`, { showId });
      setToast({ msg: '✅ Script generated! Check the Script tab.', type: 'success' });
      setTimeout(() => setToast(null), 4000);
      if (onScriptGenerate) onScriptGenerate(res.data);
    } catch (err) {
      setToast({ msg: err.response?.data?.error || 'Script generation failed', type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setGenerating(false);
    }
  };

  const allRequired = CHECKLIST_SECTIONS
    .flatMap(s => s.items)
    .filter(i => i.required)
    .every(i => checks[i.id]);

  const completedCount = Object.values(checks).filter(Boolean).length;
  const totalCount = CHECKLIST_SECTIONS.flatMap(s => s.items).length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div style={{ marginTop: 20 }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'error' ? '#FFEBEE' : '#E8F5E9',
          color: toast.type === 'error' ? '#C62828' : '#16a34a',
          border: `1px solid ${toast.type === 'error' ? '#FFCDD2' : '#A5D6A7'}`,
          borderRadius: 10, padding: '12px 18px', fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>Production Checklist</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{completedCount}/{totalCount}</span>
          <button onClick={checkReadiness} disabled={loading} style={{
            background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
            padding: '3px 10px', fontSize: 11, color: '#94a3b8', cursor: 'pointer',
          }}>↻</button>
        </div>
      </div>

      <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3, width: `${pct}%`,
          background: pct === 100 ? '#16a34a' : pct >= 60 ? '#B8962E' : '#E57373',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {CHECKLIST_SECTIONS.map(section => (
        <div key={section.id} style={{
          background: '#fafaf7', border: '1px solid #f0ede6',
          borderRadius: 10, padding: '12px 14px', marginBottom: 8,
        }}>
          <h4 style={{
            margin: '0 0 6px', fontSize: 12, fontWeight: 600,
            color: '#64748b', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {section.icon} {section.label}
          </h4>
          {section.items.map(item => (
            <CheckItem key={item.id} item={item} checked={!!checks[item.id]} loading={loading} />
          ))}
        </div>
      ))}

      <div style={{ marginTop: 16 }}>
        {!allRequired && (
          <p style={{ fontSize: 12, color: '#E57373', marginBottom: 6 }}>
            Complete all required items to unlock script generation.
          </p>
        )}
        <button onClick={handleGenerateScript} disabled={!allRequired || generating} style={{
          width: '100%',
          background: allRequired && !generating ? 'linear-gradient(135deg, #C9A83A, #B8962E)' : '#e2e8f0',
          color: allRequired && !generating ? '#fff' : '#94a3b8',
          border: 'none', borderRadius: 10, padding: '12px 0',
          fontSize: 14, fontWeight: 600, cursor: allRequired && !generating ? 'pointer' : 'not-allowed',
          boxShadow: allRequired ? '0 2px 8px rgba(184,150,46,0.25)' : 'none',
          transition: 'all 0.2s',
        }}>
          {generating ? '⏳ Generating Script...' : '✦ Generate Script'}
        </button>
      </div>
    </div>
  );
}

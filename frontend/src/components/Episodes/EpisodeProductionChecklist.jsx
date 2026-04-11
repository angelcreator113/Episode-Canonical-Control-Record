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
    icon: '🌍',
    label: 'Event & Venue',
    items: [
      { id: 'event_linked',      label: 'Event linked to episode',    required: true  },
      { id: 'venue_set',         label: 'Venue assigned',             required: false },
      { id: 'venue_image',       label: 'Venue image generated',      required: false },
      { id: 'invitation_exists', label: 'Invitation generated',       required: false },
    ],
  },
  {
    id: 'scene',
    icon: '🎬',
    label: 'Scene Plan',
    items: [
      { id: 'scene_sets',        label: 'Scene sets assigned',        required: true  },
      { id: 'scene_plan',        label: 'Scene plan generated (14 beats)', required: true  },
      { id: 'scene_plan_locked', label: 'Scene plan locked',          required: false },
    ],
  },
  {
    id: 'wardrobe',
    icon: '👗',
    label: 'Wardrobe & Outfit',
    items: [
      { id: 'wardrobe_ready',    label: 'Wardrobe pieces uploaded',   required: true  },
      { id: 'outfit_picked',     label: 'Outfit picked for event',    required: false },
    ],
  },
  {
    id: 'overlays',
    icon: '✨',
    label: 'UI Overlays',
    items: [
      { id: 'overlays_generated', label: 'UI overlays generated',     required: false },
    ],
  },
  {
    id: 'social',
    icon: '📱',
    label: 'Social & Content',
    items: [
      { id: 'social_checklist',  label: 'Social media checklist',     required: false },
      { id: 'title_generated',   label: 'Episode title (AI-generated)', required: false },
    ],
  },
  {
    id: 'intelligence',
    icon: '🧠',
    label: 'Intelligence',
    items: [
      { id: 'character_state',   label: 'Character state loaded',     required: true  },
      { id: 'show_brain',        label: 'Show Brain accessible',      required: false },
    ],
  },
];

function CheckItem({ item, checked, loading, onAction, actionLabel }) {
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
        fontSize: 13, flex: 1,
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
      {!checked && onAction && (
        <button onClick={onAction} style={{
          padding: '2px 8px', borderRadius: 4, border: 'none',
          background: '#B8962E', color: '#fff', fontSize: 9,
          fontWeight: 600, cursor: 'pointer', flexShrink: 0,
        }}>{actionLabel || 'Fix'}</button>
      )}
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

      // ── Check Event, Venue, Invitation, Outfit ──
      try {
        if (showId) {
          const { data } = await api.get(`/api/v1/world/${showId}/events`);
          const events = data?.events || [];
          const linkedEvent = events.find(ev => ev.used_in_episode_id === episode.id);
          results.event_linked = !!linkedEvent;
          results.invitation_exists = !!linkedEvent?.invitation_asset_id;
          const auto = linkedEvent?.canon_consequences?.automation || {};
          results.venue_set = !!(linkedEvent?.venue_name || auto.venue_name || linkedEvent?.scene_set_id);
          results.venue_image = !!linkedEvent?.scene_set_id;
          const outfit = typeof linkedEvent?.outfit_pieces === 'string' ? JSON.parse(linkedEvent.outfit_pieces || '[]') : (linkedEvent?.outfit_pieces || []);
          results.outfit_picked = outfit.length > 0;
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

      // ── Check UI Overlays ──
      try {
        if (showId) {
          const { data } = await api.get(`/api/v1/ui-overlays/${showId}`);
          results.overlays_generated = (data?.generated_count || 0) >= 5;
        }
      } catch {
        results.overlays_generated = false;
      }

      // ── Check Social Checklist ──
      try {
        results.social_checklist = false;
        // Check if episode has a social checklist asset
        const { data } = await api.get(`/api/v1/assets?asset_type=SOCIAL_CHECKLIST&episode_id=${episode.id}&limit=1`);
        results.social_checklist = (data?.data?.length || 0) > 0;
      } catch {
        results.social_checklist = false;
      }

      // ── Check Episode Title (AI-generated vs default) ──
      results.title_generated = !!(episode.title && !episode.title.startsWith('Episode ') && episode.title !== episode.description?.split(' — ')?.[0]);

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

  // Action handlers for checklist items
  const actions = {
    arc_position: { action: () => window.location.href = `/episodes/${episode.id}/plan`, label: 'Set up' },
    archetype: { action: () => window.location.href = `/episodes/${episode.id}/plan`, label: 'Set up' },
    designed_intent: { action: () => window.location.href = `/episodes/${episode.id}/plan`, label: 'Set up' },
    event_linked: { action: () => window.location.href = `/shows/${showId}/world?tab=events`, label: 'Events' },
    venue_set: { action: () => window.location.href = `/shows/${showId}/world?tab=events`, label: 'Add venue' },
    scene_sets: { action: () => window.location.href = `/scene-library`, label: 'Scene Library' },
    scene_plan: { action: () => window.location.href = `/episodes/${episode.id}/plan`, label: 'Generate' },
    wardrobe_ready: { action: () => window.location.href = `/shows/${showId}/world?tab=wardrobe`, label: 'Upload' },
    outfit_picked: { action: () => window.location.href = `/shows/${showId}/world?tab=events`, label: 'Pick outfit' },
    overlays_generated: { action: () => window.location.href = `/scene-library?tab=overlays`, label: 'Generate' },
    character_state: { action: () => window.location.href = `/shows/${showId}/world?tab=overview`, label: 'Set up' },
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
            <CheckItem key={item.id} item={item} checked={!!checks[item.id]} loading={loading}
              onAction={actions[item.id]?.action} actionLabel={actions[item.id]?.label} />
          ))}
        </div>
      ))}

      <div style={{ marginTop: 16 }}>
        {!allRequired && (
          <p style={{ fontSize: 12, color: '#E57373', marginBottom: 6 }}>
            Complete all required items to unlock script generation.
          </p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.location.href = `/episodes/${episode.id}/script-writer`} style={{
            flex: 1,
            background: allRequired ? 'linear-gradient(135deg, #C9A83A, #B8962E)' : '#e2e8f0',
            color: allRequired ? '#fff' : '#94a3b8',
            border: 'none', borderRadius: 10, padding: '12px 0',
            fontSize: 14, fontWeight: 600, cursor: allRequired ? 'pointer' : 'not-allowed',
            boxShadow: allRequired ? '0 2px 8px rgba(184,150,46,0.25)' : 'none',
          }}>
            ✦ Write Script
          </button>
          <button onClick={() => window.location.href = `/episodes/${episode.id}/plan`} style={{
            padding: '12px 16px', border: '1px solid #e0d9cc', borderRadius: 10,
            background: '#fff', color: '#666', fontSize: 12, cursor: 'pointer',
          }}>
            🎬 Scene Plan
          </button>
        </div>
      </div>
    </div>
  );
}

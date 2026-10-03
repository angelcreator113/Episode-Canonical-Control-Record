// frontend/src/components/Episodes/EpisodePhoneMissionsTab.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import MissionEditor from '../phone-editor/MissionEditor';

/**
 * EpisodePhoneMissionsTab — per-episode missions surface. Since issue
 * #1908 it renders as the Missions section of EpisodeLalasPhoneTab rather
 * than as the whole Production → Phone tab.
 *
 * Lists every mission visible to this episode (show-wide + episode-scoped),
 * with inline is_active toggles and a one-click jump into the existing
 * MissionEditor modal scoped to this episodeId. The editor handles full
 * CRUD; this tab keeps the episode page focused on at-a-glance status.
 *
 * Scope semantics (per phoneMissionRoutes.js GET handler):
 *   episode_id IS NULL  → show-wide  (active on every episode)
 *   episode_id = X      → episode-specific (this episode only)
 */

function EpisodePhoneMissionsTab({ episode }) {
  const showId = episode?.show_id || episode?.show?.id;
  const episodeId = episode?.id;
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const reload = useCallback(async () => {
    if (!showId || !episodeId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/api/v1/ui-overlays/${showId}/missions?episode_id=${episodeId}`);
      setMissions(data?.missions || []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [showId, episodeId]);

  useEffect(() => { reload(); }, [reload]);

  // Inline toggle — flips is_active without opening the editor. Keeps the
  // PUT payload minimal (just the existing mission fields with is_active
  // swapped) so we don't accidentally clobber objectives via missing fields
  // in validateMissionPayload.
  const toggleActive = async (mission) => {
    setTogglingId(mission.id);
    try {
      const { name, description, icon_url, start_condition, objectives, reward_actions, display_order, episode_id } = mission;
      await api.put(`/api/v1/ui-overlays/${showId}/missions/${mission.id}`, {
        name,
        description: description || null,
        icon_url: icon_url || null,
        start_condition: start_condition || null,
        objectives: objectives || [],
        reward_actions: reward_actions || [],
        display_order: display_order || 0,
        episode_id: episode_id || null,
        is_active: !mission.is_active,
      });
      setMissions(prev => prev.map(m => m.id === mission.id ? { ...m, is_active: !m.is_active } : m));
    } catch (err) {
      alert('Toggle failed: ' + (err?.response?.data?.error || err.message));
    } finally {
      setTogglingId(null);
    }
  };

  // ── Counts for the header summary ──
  const showWide = missions.filter(m => !m.episode_id);
  const episodeOnly = missions.filter(m => m.episode_id === episodeId);
  const activeCount = missions.filter(m => m.is_active).length;

  const S = {
    card: { background: 'var(--surface-card)', borderRadius: 10, border: '1px solid var(--lala-parchment-3)', padding: '14px 16px', marginBottom: 12 },
    sectionTitle: { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: "'DM Mono', monospace" },
    scopeBadge: (showWide) => ({
      padding: '1px 6px',
      borderRadius: 3,
      fontSize: 9,
      fontWeight: 700,
      fontFamily: "'DM Mono', monospace",
      letterSpacing: 0.4,
      background: showWide ? 'var(--primary-subtle)' : 'var(--accent-subtle)',
      color: showWide ? 'var(--primary-text)' : 'var(--accent-dark)',
    }),
    primaryBtn: { padding: '6px 14px', borderRadius: 6, background: 'var(--primary)', border: 'none', color: 'var(--text-inverse)', fontSize: 11, fontWeight: 600, cursor: 'pointer' },
    ghostBtn: { padding: '5px 10px', borderRadius: 6, background: 'transparent', border: '1px solid var(--lala-parchment-3)', color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, cursor: 'pointer' },
    statPill: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 4, fontSize: 11, fontFamily: "'DM Mono', monospace", fontWeight: 600 },
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header + manage button. Rendered as a section of Lala's Phone
          (EpisodeLalasPhoneTab, issue #1908), so the heading is an h3. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: "'DM Mono', monospace" }}>Missions</h3>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Read-only observers that watch playthrough state and report progress. Show-wide missions run on every episode; episode-scoped missions only run here.
          </div>
        </div>
        <button onClick={() => setEditorOpen(true)} style={S.primaryBtn} disabled={!showId || !episodeId}>
          ✦ Manage missions
        </button>
      </div>

      {/* Stats bar */}
      {!loading && !error && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ ...S.statPill, background: 'var(--success-bg)', color: 'var(--success-text)' }}>✓ {activeCount} active</span>
          <span style={{ ...S.statPill, background: 'var(--primary-subtle)', color: 'var(--primary-text)' }}>🌍 {showWide.length} show-wide</span>
          <span style={{ ...S.statPill, background: 'var(--accent-subtle)', color: 'var(--accent-dark)' }}>📍 {episodeOnly.length} this episode</span>
        </div>
      )}

      {/* Mission list */}
      {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading missions…</div>}
      {error && <div style={{ padding: 20, color: 'var(--danger-text)', background: 'var(--danger-bg)', borderRadius: 8, fontSize: 12 }}>Error: {error}</div>}
      {!loading && !error && missions.length === 0 && (
        <div style={S.card}>
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 13, marginBottom: 6 }}>No missions yet.</div>
            <div style={{ fontSize: 11, lineHeight: 1.5 }}>Click <strong>Manage missions</strong> to create one — show-wide for cross-episode goals (onboarding, follow Lala) or episode-scoped for one-off objectives (find the invite, complete the date).</div>
          </div>
        </div>
      )}

      {!loading && !error && missions.map(m => {
        const isShowWide = !m.episode_id;
        const objectivesCount = Array.isArray(m.objectives) ? m.objectives.length : 0;
        return (
          <div key={m.id} style={{ ...S.card, opacity: m.is_active ? 1 : 0.55 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{m.name}</div>
                  <span style={S.scopeBadge(isShowWide)}>{isShowWide ? 'SHOW-WIDE' : 'THIS EPISODE'}</span>
                  {!m.is_active && <span style={{ ...S.scopeBadge(false), background: 'var(--lala-parchment-2)', color: 'var(--text-secondary)' }}>INACTIVE</span>}
                </div>
                {m.description && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>{m.description}</div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>
                  <span>🎯 {objectivesCount} {objectivesCount === 1 ? 'objective' : 'objectives'}</span>
                  {Array.isArray(m.reward_actions) && m.reward_actions.length > 0 && (
                    <span>🎁 {m.reward_actions.length} reward {m.reward_actions.length === 1 ? 'action' : 'actions'}</span>
                  )}
                  {m.start_condition && <span>🔒 gated</span>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <button
                  onClick={() => toggleActive(m)}
                  disabled={togglingId === m.id}
                  title={m.is_active ? 'Deactivate this mission' : 'Activate this mission'}
                  style={{ ...S.ghostBtn, color: m.is_active ? 'var(--success-text)' : 'var(--text-secondary)', borderColor: m.is_active ? 'var(--success-border)' : 'var(--lala-parchment-3)' }}
                >
                  {togglingId === m.id ? '…' : (m.is_active ? '● Active' : '○ Inactive')}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Reuse existing show-wide editor scoped to this episode. The host
          owns open/close; reload after the modal closes so toggles + edits
          performed inside reflect immediately. */}
      <MissionEditor
        open={editorOpen}
        showId={showId}
        episodeId={episodeId}
        onClose={() => { setEditorOpen(false); reload(); }}
      />
    </div>
  );
}

export default EpisodePhoneMissionsTab;

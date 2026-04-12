import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

/**
 * EpisodeAssetsTab — Production Readiness Checklist
 *
 * Shows every production asset needed for this episode with status:
 * - Title Card, Invitation, Venue, Outfit, Wardrobe List,
 *   Social Tasks, Career List, Stats Panel, Feed Posts, Script
 *
 * Each item shows: generated/approved/missing status, thumbnail, quick action
 */

const STATUS_STYLES = {
  approved: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', icon: '✅', label: 'Approved' },
  generated: { bg: '#eef2ff', color: '#6366f1', border: '#c7d2fe', icon: '🔵', label: 'Generated' },
  pending: { bg: '#fef3c7', color: '#92400e', border: '#fde68a', icon: '⏳', label: 'Pending' },
  missing: { bg: '#f8f8f8', color: '#94a3b8', border: '#e2e8f0', icon: '⬜', label: 'Not generated' },
};

function EpisodeAssetsTab({ episode, show }) {
  const navigate = useNavigate();
  const [checklist, setChecklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [readiness, setReadiness] = useState({ ready: 0, total: 0 });

  const showId = show?.id || episode?.show_id || episode?.showId;
  const episodeId = episode?.id;

  useEffect(() => {
    if (episodeId && showId) loadChecklist();
  }, [episodeId, showId]);

  const loadChecklist = async () => {
    setLoading(true);
    try {
      // Load all data sources in parallel
      const [eventRes, todoRes, assetsRes, scriptRes, feedRes] = await Promise.allSettled([
        api.get(`/api/v1/world/${showId}/events`).then(r => {
          const events = r.data?.events || [];
          return events.find(e => e.used_in_episode_id === episodeId) || null;
        }),
        api.get(`/api/v1/episodes/${episodeId}/todo`).catch(() => ({ data: null })),
        api.get(`/api/v1/assets?episode_id=${episodeId}&limit=100`).catch(() => ({ data: { data: [] } })),
        api.get(`/api/v1/episodes/${episodeId}`).catch(() => ({ data: {} })),
        api.get(`/api/v1/feed-posts?episode_id=${episodeId}&limit=50`).catch(() => ({ data: { data: [] } })),
      ]);

      const event = eventRes.status === 'fulfilled' ? eventRes.value : null;
      const todoList = todoRes.status === 'fulfilled' ? (todoRes.value.data?.data || null) : null;
      const assets = assetsRes.status === 'fulfilled' ? (assetsRes.value.data?.data || []) : [];
      const epData = scriptRes.status === 'fulfilled' ? (scriptRes.value.data?.data || scriptRes.value.data || {}) : {};
      const feedPosts = feedRes.status === 'fulfilled' ? (feedRes.value.data?.data || []) : [];

      // Parse event data
      let cc = event?.canon_consequences;
      if (typeof cc === 'string') try { cc = JSON.parse(cc); } catch { cc = {}; }
      const auto = cc?.automation || {};

      let outfitPieces = event?.outfit_pieces;
      if (typeof outfitPieces === 'string') try { outfitPieces = JSON.parse(outfitPieces); } catch { outfitPieces = []; }
      if (!Array.isArray(outfitPieces)) outfitPieces = [];

      let socialTasks = todoList?.social_tasks;
      if (typeof socialTasks === 'string') try { socialTasks = JSON.parse(socialTasks); } catch { socialTasks = []; }
      if (!Array.isArray(socialTasks)) socialTasks = [];
      const socialCompleted = socialTasks.filter(t => t.completed).length;

      // Find specific assets
      const findAsset = (role) => assets.find(a => (a.asset_role || '').includes(role));
      const titleAsset = findAsset('EPISODE_TITLE');
      const invitationAsset = findAsset('INVITATION');
      const wardrobeOverlay = findAsset('WARDROBE_LIST');
      const socialOverlay = findAsset('SOCIAL');
      const careerOverlay = findAsset('CAREER_LIST');
      const statsOverlay = findAsset('STATS');

      // Build checklist
      const items = [
        {
          id: 'title_card', icon: '🎬', name: 'Episode Title Card',
          status: titleAsset ? 'approved' : 'missing',
          detail: titleAsset ? 'Generated' : 'Generate from event panel',
          thumbnail: titleAsset?.s3_url_processed || titleAsset?.s3_url_raw,
          action: event ? { label: 'Generate', url: `/shows/${showId}/world?tab=events` } : null,
        },
        {
          id: 'invitation', icon: '💌', name: 'Invitation',
          status: invitationAsset || event?.invitation_asset_id ? 'approved' : event ? 'missing' : 'missing',
          detail: invitationAsset ? 'Approved' : event ? 'Generate from event panel' : 'No event linked',
          thumbnail: invitationAsset?.s3_url_processed || event?.invitation_url,
          action: event ? { label: 'Event Panel', url: `/shows/${showId}/world?tab=events` } : null,
        },
        {
          id: 'venue', icon: '📍', name: 'Venue Images',
          status: event?.scene_set_id ? 'approved' : event ? 'missing' : 'missing',
          detail: event?.scene_set_id
            ? `Scene set linked${event?.video_clip_url ? ' + video' : ''}`
            : 'Generate venue from event panel',
          action: { label: 'Scene Library', url: `/shows/${showId}/scene-library` },
        },
        {
          id: 'outfit', icon: '👗', name: 'Outfit',
          status: outfitPieces.length > 0 ? 'approved' : 'missing',
          detail: outfitPieces.length > 0
            ? `${outfitPieces.length} pieces ($${outfitPieces.reduce((s, p) => s + (parseFloat(p.price) || 0), 0).toLocaleString()})`
            : 'Pick outfit from event panel',
          thumbnail: outfitPieces[0]?.image_url,
          action: event ? { label: 'Pick Outfit', url: `/shows/${showId}/world?tab=events` } : null,
        },
        {
          id: 'wardrobe_list', icon: '📋', name: 'Wardrobe Shopping List',
          status: wardrobeOverlay || auto.wardrobe_overlay_url ? 'approved' : todoList?.tasks ? 'generated' : 'missing',
          detail: wardrobeOverlay ? 'Overlay approved' : todoList?.tasks ? `${(typeof todoList.tasks === 'string' ? JSON.parse(todoList.tasks) : todoList.tasks).length} tasks` : 'Generate from event panel',
          thumbnail: auto.wardrobe_overlay_url || wardrobeOverlay?.s3_url_processed,
        },
        {
          id: 'social_tasks', icon: '📱', name: 'Social Tasks',
          status: socialOverlay || auto.social_checklist_url ? 'approved' : socialTasks.length > 0 ? 'generated' : 'missing',
          detail: socialTasks.length > 0 ? `${socialCompleted}/${socialTasks.length} completed` : 'Generate from event panel',
          thumbnail: auto.social_checklist_url || socialOverlay?.s3_url_processed,
        },
        {
          id: 'career_list', icon: '🎯', name: 'Career Checklist',
          status: careerOverlay ? 'approved' : 'missing',
          detail: careerOverlay ? 'Overlay approved' : 'Optional — generate from event panel',
        },
        {
          id: 'stats_panel', icon: '🪙', name: 'Stats Panel',
          status: statsOverlay ? 'approved' : 'missing',
          detail: statsOverlay ? 'Generated' : 'Optional — shows financial reveal',
        },
        {
          id: 'script', icon: '📝', name: 'Script',
          status: epData.script_content ? 'approved' : 'missing',
          detail: epData.script_content ? 'Script written' : 'Write from episode detail',
          action: { label: 'Write Script', url: `/episodes/${episodeId}?tab=scripts` },
        },
        {
          id: 'feed_posts', icon: '👥', name: 'Feed Posts',
          status: feedPosts.length > 0 ? 'approved' : 'missing',
          detail: feedPosts.length > 0 ? `${feedPosts.length} posts generated` : 'Generate after script is written',
        },
      ];

      setChecklist(items);
      const readyCount = items.filter(i => i.status === 'approved' || i.status === 'generated').length;
      setReadiness({ ready: readyCount, total: items.length });
    } catch (err) {
      console.error('[EpisodeAssets] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!episode) {
    return <div style={{ padding: 24, color: '#94a3b8' }}>Loading episode...</div>;
  }

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading production checklist...</div>;
  }

  const pct = readiness.total > 0 ? Math.round((readiness.ready / readiness.total) * 100) : 0;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Production Readiness</h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
            {readiness.ready}/{readiness.total} assets ready — {pct}% complete
          </p>
        </div>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: `conic-gradient(${pct >= 80 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#dc2626'} ${pct * 3.6}deg, #f1f5f9 0deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%', background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color: pct >= 80 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#dc2626',
          }}>
            {pct}%
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2, transition: 'width 0.3s',
          width: `${pct}%`,
          background: pct >= 80 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#dc2626',
        }} />
      </div>

      {/* Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {checklist.map(item => {
          const st = STATUS_STYLES[item.status] || STATUS_STYLES.missing;

          return (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: st.bg, borderRadius: 8, border: `1px solid ${st.border}`,
            }}>
              {/* Status icon + item icon */}
              <span style={{ fontSize: 14, flexShrink: 0 }}>{st.icon}</span>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>

              {/* Name + detail */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{item.name}</div>
                <div style={{ fontSize: 10, color: st.color }}>{item.detail}</div>
              </div>

              {/* Thumbnail */}
              {item.thumbnail && (
                <img src={item.thumbnail} alt="" style={{
                  width: 32, height: 32, borderRadius: 6, objectFit: 'cover',
                  border: '1px solid #e2e8f0', flexShrink: 0,
                }} onError={e => e.target.style.display = 'none'} />
              )}

              {/* Action button */}
              {item.action && item.status === 'missing' && (
                <button onClick={() => navigate(item.action.url)} style={{
                  fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                  border: '1px solid #c7d2fe', background: '#eef2ff', color: '#6366f1',
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {item.action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EpisodeAssetsTab;

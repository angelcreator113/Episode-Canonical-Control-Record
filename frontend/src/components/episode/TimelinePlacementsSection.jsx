/**
 * TimelinePlacementsSection — episode-page section that lists every
 * video UI overlay placement on the timeline (the invite, the wardrobe
 * checklist, etc.) and lets creators add/remove them and tune duration.
 *
 * Backed by the existing timeline-placements API:
 *   GET    /api/v1/episodes/:id/timeline/placements
 *   POST   /api/v1/episodes/:id/timeline/placements
 *   PATCH  /api/v1/episodes/:id/timeline/placements/:placementId
 *   DELETE /api/v1/episodes/:id/timeline/placements/:placementId
 *
 * The "Add overlay" dropdown is populated from the episode's
 * UI_OVERLAY-typed Assets that aren't already placed. When the video
 * composition pipeline lands later, these placements drive when each
 * overlay appears on the rendered video. Until then, this UI is the
 * single source of truth for overlay timing on the episode.
 */
import { useEffect, useState, useCallback } from 'react';
import { Clapperboard } from 'lucide-react';
import api from '../../services/api';

export default function TimelinePlacementsSection({ episodeId }) {
  const [placements, setPlacements] = useState([]);
  const [availableAssets, setAvailableAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!episodeId) return;
    setLoading(true);
    setError(null);
    try {
      const [placeRes, assetRes] = await Promise.all([
        api.get(`/api/v1/episodes/${episodeId}/timeline/placements`),
        // Asset list filtered to UI overlay rows on this episode. Errors
        // here are non-fatal — the section still works without an "Add"
        // dropdown if the asset endpoint doesn't exist yet.
        api.get(`/api/v1/assets?episode_id=${episodeId}&asset_type=UI_OVERLAY`).catch(() => ({ data: { data: [] } })),
      ]);
      setPlacements(placeRes.data?.data || []);
      const assets = assetRes.data?.data || assetRes.data?.assets || [];
      setAvailableAssets(assets);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load placements');
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => { load(); }, [load]);

  const updateDuration = async (placement, nextDuration) => {
    setBusyId(placement.id);
    try {
      await api.patch(`/api/v1/episodes/${episodeId}/timeline/placements/${placement.id}`, {
        duration: nextDuration,
      });
      setPlacements((rows) => rows.map((p) => (p.id === placement.id ? { ...p, duration: nextDuration } : p)));
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to update');
    } finally {
      setBusyId(null);
    }
  };

  const removePlacement = async (placement) => {
    if (!window.confirm('Remove this overlay from the timeline? The asset itself stays in the library.')) return;
    setBusyId(placement.id);
    try {
      await api.delete(`/api/v1/episodes/${episodeId}/timeline/placements/${placement.id}`);
      setPlacements((rows) => rows.filter((p) => p.id !== placement.id));
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to remove');
    } finally {
      setBusyId(null);
    }
  };

  const addPlacement = async (assetId) => {
    if (!assetId) return;
    setBusyId('adding');
    try {
      await api.post(`/api/v1/episodes/${episodeId}/timeline/placements`, {
        placement_type: 'asset',
        asset_id: assetId,
        attachment_point: 'scene-start',
        offset_seconds: 0,
        duration: 5,
        track_number: 2,
        z_index: 10,
        visual_role: 'overlay',
      });
      await load();
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to add');
    } finally {
      setBusyId(null);
    }
  };

  // "Available to add" = overlay assets not already placed.
  const placedAssetIds = new Set(placements.map((p) => p.asset_id).filter(Boolean));
  const addable = availableAssets.filter((a) => !placedAssetIds.has(a.id));

  // Friendly label for a placement's role — uses asset_role if it's the
  // canonical UI.OVERLAY.* enum, else falls back to properties.kind, else
  // the asset name. Keeps the row scannable.
  const roleLabel = (p) => {
    const role = p.asset?.asset_role || '';
    if (role.startsWith('UI.OVERLAY.')) {
      return role.replace('UI.OVERLAY.', '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return p.properties?.kind || p.asset?.name || 'Overlay';
  };

  return (
    // Card and title in the Overview's card language (EpisodeOverviewSections.css).
    <div className="eov-card">
      <div className="eov-card-head is-wrap">
        <div>
          <h4 className="eov-card-title"><Clapperboard size={16} aria-hidden="true" /> Video UI overlays</h4>
          <p className="eov-card-note">
            Where invites, checklists, and other on-screen graphics appear in the rendered video.
          </p>
        </div>
        {addable.length > 0 && (
          <select
            value=""
            disabled={busyId === 'adding'}
            onChange={(e) => { if (e.target.value) addPlacement(e.target.value); e.target.value = ''; }}
            className="eov-select is-inline"
            aria-label="Add overlay"
          >
            <option value="">+ Add overlay…</option>
            {addable.map((a) => (
              <option key={a.id} value={a.id}>
                {a.asset_role?.replace('UI.OVERLAY.', '') || a.name || 'Asset'}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p className="eov-empty">Loading…</p>
      ) : error ? (
        <p className="eov-warn">{error}</p>
      ) : placements.length === 0 ? (
        <p className="eov-empty">
          No overlays placed yet. Approve an invitation or lock the wardrobe checklist to auto-place one{addable.length > 0 ? ', or add a previously generated overlay from the list above' : ''}.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {placements.map((p) => {
            const thumb = p.asset?.s3_url_processed || p.asset?.s3_url_raw;
            const sceneName = p.scene?.title_override || (p.scene_id ? `Scene ${p.scene?.scene_order ?? ''}`.trim() : 'Time-based');
            return (
              <div
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto auto',
                  alignItems: 'center',
                  gap: 10,
                  padding: 8,
                  background: 'var(--lala-gold-soft)',
                  border: '1px solid var(--lala-gold-line)',
                  borderRadius: 8,
                }}
              >
                {thumb ? (
                  <img src={thumb} alt="" style={{ width: 48, height: 32, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--lala-gold-line)' }} />
                ) : (
                  <div style={{ width: 48, height: 32, background: 'var(--surface-card)', borderRadius: 4, border: '1px solid var(--lala-gold-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🎬</div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {roleLabel(p)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>
                    {sceneName} · {p.attachment_point || 'scene-start'} · z{p.z_index ?? 10}
                  </div>
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={p.duration ?? ''}
                    disabled={busyId === p.id}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v)) {
                        setPlacements((rows) => rows.map((row) => (row.id === p.id ? { ...row, duration: v } : row)));
                      }
                    }}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v) && v !== Number(p.duration)) updateDuration(p, v);
                    }}
                    style={{ width: 56, padding: '3px 6px', border: '1px solid var(--lala-gold-line)', borderRadius: 4, fontSize: 11, background: 'var(--surface-card)' }}
                  />
                  <span>s</span>
                </label>
                <button
                  type="button"
                  onClick={() => removePlacement(p)}
                  disabled={busyId === p.id}
                  title="Remove this overlay placement (asset stays in the library)"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
                >×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

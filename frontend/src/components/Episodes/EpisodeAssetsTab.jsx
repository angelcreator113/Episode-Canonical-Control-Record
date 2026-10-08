import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import { getEpisodeAnchorEvent } from '../../services/episodeEventsApi';
import { sceneSetPath } from '../../utils/sceneSets';
import { Clapperboard, Mail, MapPin, Shirt, ClipboardList, Smartphone, Target, Coins, FileText, Users, Images, Package } from 'lucide-react';
import EpisodeTodoList from './EpisodeTodoList';
import './EpisodeAssetsTab.css';

/**
 * EpisodeAssetsTab — Production Readiness Checklist
 *
 * Shows every production asset needed for this episode with status:
 * - Title Card, Invitation, Venue, Outfit, Wardrobe List,
 *   Social Tasks, Career List, Stats Panel, Feed Posts, Script
 *
 * Each item shows: generated/approved/missing status, thumbnail, quick action
 */

// Each status is a pill on the row (the Assets redesign, 2026-10-08);
// colours in EpisodeAssetsTab.css (.eat-pill.is-<status>).
const STATUS_LABELS = {
  approved: 'Ready',
  generated: 'Drafted',
  pending: 'Pending',
  missing: 'Not yet',
};

// A lucide icon per checklist item, in place of the emoji.
const ITEM_ICONS = {
  title_card: Clapperboard,
  invitation: Mail,
  venue: MapPin,
  outfit: Shirt,
  wardrobe_list: ClipboardList,
  social_tasks: Smartphone,
  career_list: Target,
  stats_panel: Coins,
  script: FileText,
  feed_posts: Users,
};

/**
 * Where the venue's Fix button goes (audit LINK-03, 2026-10-03): the
 * event's scene set in this show's Scene Sets, with this tab as the way
 * back; the event panel when the event has no set yet; nowhere without an
 * event. Never the clip library, which it used to open at a route that does
 * not exist.
 */
export function venueFixTarget({ event, episode, showId } = {}) {
  if (!event || !showId) return null;
  if (event.scene_set_id) {
    const from = episode?.id ? `/episodes/${episode.id}?tab=assets` : null;
    return { label: 'Open in Scene Sets', url: sceneSetPath(showId, event.scene_set_id, { from, fromLabel: episode?.title || 'the episode assets', need: 'Venue image' }) };
  }
  return { label: 'Event Panel', url: `/shows/${showId}/world?tab=events` };
}

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
        // The episode's source event (Task #1906): anchor from the brief,
        // never a scan of the show's event list.
        getEpisodeAnchorEvent(episodeId),
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
          id: 'title_card', name: 'Episode Title Card',
          status: titleAsset ? 'approved' : 'missing',
          detail: titleAsset ? 'Generated' : 'Generate from event panel',
          thumbnail: titleAsset?.s3_url_processed || titleAsset?.s3_url_raw,
          action: event ? { label: 'Generate', url: `/shows/${showId}/world?tab=events` } : null,
        },
        {
          id: 'invitation', name: 'Invitation',
          status: invitationAsset || event?.invitation_asset_id ? 'approved' : event ? 'missing' : 'missing',
          detail: invitationAsset ? 'Approved' : event ? 'Generate from event panel' : 'No event linked',
          thumbnail: invitationAsset?.s3_url_processed || event?.invitation_url,
          action: event ? { label: 'Event Panel', url: `/shows/${showId}/world?tab=events` } : null,
        },
        {
          id: 'venue', name: 'Venue Images',
          status: event?.scene_set_id ? 'approved' : event ? 'missing' : 'missing',
          detail: event?.scene_set_id
            ? `Scene set linked${event?.video_clip_url ? ' + video' : ''}`
            : 'Generate venue from event panel',
          action: venueFixTarget({ event, episode, showId }),
        },
        {
          id: 'outfit', name: 'Outfit',
          status: outfitPieces.length > 0 ? 'approved' : 'missing',
          detail: outfitPieces.length > 0
            ? `${outfitPieces.length} piece${outfitPieces.length === 1 ? '' : 's'} ($${outfitPieces.reduce((s, p) => s + (parseFloat(p.price) || 0), 0).toLocaleString()})`
            : 'Pick outfit from event panel',
          thumbnail: outfitPieces[0]?.image_url,
          action: event ? { label: 'Pick Outfit', url: `/shows/${showId}/world?tab=events` } : null,
        },
        {
          id: 'wardrobe_list', name: 'Wardrobe Shopping List',
          status: wardrobeOverlay || auto.wardrobe_overlay_url ? 'approved' : todoList?.tasks ? 'generated' : 'missing',
          detail: wardrobeOverlay ? 'Overlay approved' : todoList?.tasks ? `${(typeof todoList.tasks === 'string' ? JSON.parse(todoList.tasks) : todoList.tasks).length} tasks` : 'Generate from event panel',
          thumbnail: auto.wardrobe_overlay_url || wardrobeOverlay?.s3_url_processed,
        },
        {
          id: 'social_tasks', name: 'Social Tasks',
          status: socialOverlay || auto.social_checklist_url ? 'approved' : socialTasks.length > 0 ? 'generated' : 'missing',
          detail: socialTasks.length > 0 ? `${socialCompleted}/${socialTasks.length} completed` : 'Generate from event panel',
          thumbnail: auto.social_checklist_url || socialOverlay?.s3_url_processed,
        },
        {
          id: 'career_list', name: 'Career Checklist',
          status: careerOverlay ? 'approved' : 'missing',
          detail: careerOverlay ? 'Overlay approved' : 'Optional — generate from event panel',
        },
        {
          id: 'stats_panel', name: 'Stats Panel',
          status: statsOverlay ? 'approved' : 'missing',
          detail: statsOverlay ? 'Generated' : 'Optional — shows financial reveal',
        },
        {
          id: 'script', name: 'Script',
          status: epData.script_content ? 'approved' : 'missing',
          detail: epData.script_content ? 'Script written' : 'Write from episode detail',
          action: { label: 'Write Script', url: `/episodes/${episodeId}?tab=scripts` },
        },
        {
          id: 'feed_posts', name: 'Feed Posts',
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
    return <div className="eat"><p className="eat-note">Loading episode...</p></div>;
  }

  if (loading) {
    return <div className="eat"><p className="eat-note">Loading production checklist...</p></div>;
  }

  const pct = readiness.total > 0 ? Math.round((readiness.ready / readiness.total) * 100) : 0;
  const tone = pct >= 80 ? 'is-high' : pct >= 50 ? 'is-mid' : 'is-low';

  return (
    <div className="eat">
      {/* The page's card: how ready the assets are, and the thumbnails. */}
      <section className="eat-head" data-testid="assets-head">
        <div className="eat-head-text">
          <h2 className="eat-title">Assets</h2>
          <p className="eat-sub">
            {readiness.ready} of {readiness.total} ready · {pct}%
          </p>
          <div className={`eat-bar ${tone}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Assets ready">
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
        {/* The episode's thumbnails (audit LINK-02): the gallery that reads
            them. The builder that makes one is the release workflow, batch 5. */}
        <Link to={`/thumbnails/${episodeId}`} data-testid="episode-thumbnails-link" className="eat-btn">
          <Images size={15} aria-hidden="true" /> Thumbnails
        </Link>
      </section>

      {/* Checklist */}
      <section className="eat-card">
        <h3 className="eat-label">Production checklist</h3>
        <ul className="eat-list">
          {checklist.map(item => {
            const Icon = ITEM_ICONS[item.id] || Package;
            const status = STATUS_LABELS[item.status] ? item.status : 'missing';
            return (
              <li key={item.id} className={`eat-row is-${status}`} data-testid={`asset-row-${item.id}`}>
                <span className="eat-icon" aria-hidden="true"><Icon size={18} /></span>
                <div className="eat-row-text">
                  <div className="eat-row-name">{item.name}</div>
                  <div className="eat-row-detail">{item.detail}</div>
                </div>
                {item.thumbnail && (
                  <img src={item.thumbnail} alt="" className="eat-thumb" onError={e => { e.target.style.display = 'none'; }} />
                )}
                <span className={`eat-pill is-${status}`}>{STATUS_LABELS[status]}</span>
                {item.action && item.status === 'missing' && (
                  <button type="button" className="eat-btn is-small" onClick={() => navigate(item.action.url)}>
                    {item.action.label}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="eat-section">
        <div className="eat-section-head">
          <h3 className="eat-section-title">On-screen to-do lists</h3>
          <p className="eat-note">What the audience sees during the episode, not the production checklist above.</p>
        </div>
        <EpisodeTodoList episodeId={episode.id} showId={show.id} />
      </section>
    </div>
  );
}

export default EpisodeAssetsTab;

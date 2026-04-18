/**
 * ScreenContentRenderer — Renders live show data inside phone screen content zones.
 *
 * Each uploaded screen image becomes a "template". Content zones are drawn on top
 * and filled with real show data (feed posts, profiles, DMs, wardrobe, etc.).
 *
 * Props:
 *   zones         — array of { id, x, y, w, h, content_type, content_config }
 *   showId        — current show ID for data fetching
 *   episodeId     — optional episode filter
 *   interactive   — if true, clicking zones triggers navigation/actions
 */
import { useState, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ChevronRight } from 'lucide-react';
import api from '../services/api';
import { evaluate as evaluatePhoneConditions } from '../lib/phoneRuntime';

// ── Content type registry — maps type keys to renderer components and metadata ──
export const CONTENT_TYPES = [
  { key: 'feed_posts', label: 'Feed Posts', icon: '📰', desc: 'Social timeline posts', group: 'social' },
  { key: 'profile_header', label: 'Profile Header', icon: '👤', desc: 'Name, handle, avatar, bio', group: 'social' },
  { key: 'profile_stats', label: 'Profile Stats', icon: '📊', desc: 'Followers, posts, following', group: 'social' },
  { key: 'dm_thread', label: 'DM Thread', icon: '💬', desc: 'Message conversation', group: 'messages' },
  { key: 'notifications', label: 'Notifications', icon: '🔔', desc: 'Alert list', group: 'messages' },
  { key: 'story_ring', label: 'Story Avatars', icon: '⭕', desc: 'Row of story circles', group: 'social' },
  { key: 'wardrobe_grid', label: 'Wardrobe Grid', icon: '👗', desc: 'Outfit item thumbnails', group: 'wardrobe' },
  { key: 'outfit_card', label: 'Outfit Card', icon: '👠', desc: 'Single outfit set', group: 'wardrobe' },
  { key: 'comments_list', label: 'Comments', icon: '💭', desc: 'Post comment thread', group: 'social' },
  { key: 'engagement_stats', label: 'Engagement Stats', icon: '📈', desc: 'Likes, reach, trending', group: 'stats' },
  { key: 'custom_text', label: 'Custom Text', icon: '✏️', desc: 'Static text overlay', group: 'other' },
];

export const CONTENT_TYPE_MAP = Object.fromEntries(CONTENT_TYPES.map(t => [t.key, t]));

// ── Main renderer — renders all content zones over a screen ──
// `runtimeContext` is the optional phone-runtime context used to filter zones by
// their `conditions` array. When absent, all zones render (editor "author view").
export default function ScreenContentRenderer({ zones = [], showId, episodeId, interactive = false, runtimeContext = null }) {
  if (!zones.length) return null;

  // Filter zones by `conditions` when a runtime context is provided. Editor/author
  // view passes no context, so zones without conditions always render — and zones
  // WITH conditions also render (so creators can see them while editing). The
  // player runtime passes a context, which gates visibility.
  const visibleZones = runtimeContext
    ? zones.filter(z => evaluateZoneConditions(z, runtimeContext))
    : zones;

  return (
    <>
      {visibleZones.map(zone => (
        <div
          key={zone.id}
          style={{
            position: 'absolute',
            left: `${zone.x}%`,
            top: `${zone.y}%`,
            width: `${zone.w}%`,
            height: `${zone.h}%`,
            overflow: 'hidden',
            pointerEvents: interactive ? 'auto' : 'none',
            zIndex: 3,
          }}
        >
          <ContentZoneRenderer
            zone={zone}
            showId={showId}
            episodeId={episodeId}
          />
        </div>
      ))}
    </>
  );
}

// Delegates to the single phoneRuntime evaluator so content-zone gating, tap-zone
// gating, and mission-progress checks all behave identically.
function evaluateZoneConditions(zone, ctx) {
  return evaluatePhoneConditions(zone.conditions, ctx);
}

// ── Dispatch to the right sub-renderer based on content_type ──
function ContentZoneRenderer({ zone, showId, episodeId }) {
  const config = zone.content_config || {};

  switch (zone.content_type) {
    case 'feed_posts':
      return <FeedPostsRenderer showId={showId} episodeId={episodeId} config={config} />;
    case 'profile_header':
      return <ProfileHeaderRenderer showId={showId} config={config} />;
    case 'profile_stats':
      return <ProfileStatsRenderer showId={showId} config={config} />;
    case 'dm_thread':
      return <DMThreadRenderer showId={showId} episodeId={episodeId} config={config} />;
    case 'notifications':
      return <NotificationsRenderer showId={showId} episodeId={episodeId} config={config} />;
    case 'story_ring':
      return <StoryRingRenderer showId={showId} config={config} />;
    case 'wardrobe_grid':
      return <WardrobeGridRenderer showId={showId} config={config} />;
    case 'outfit_card':
      return <OutfitCardRenderer showId={showId} config={config} />;
    case 'comments_list':
      return <CommentsRenderer showId={showId} config={config} />;
    case 'engagement_stats':
      return <EngagementStatsRenderer showId={showId} config={config} />;
    case 'custom_text':
      return <CustomTextRenderer config={config} />;
    default:
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>
          <span style={{ fontSize: 8, color: '#fff', fontFamily: "'DM Mono', monospace" }}>
            {zone.content_type || 'No type'}
          </span>
        </div>
      );
  }
}

// ── Helper: fetch with cache ──
function useContentData(url, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!url) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    api.get(url)
      .then(r => { if (!cancelled) setData(r.data); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url, ...deps]);

  return { data, loading };
}

// ════════════════════════════════════════════════════════════
// SUB-RENDERERS — Each renders a specific content type
// All are designed to fit inside their zone's bounding box
// ════════════════════════════════════════════════════════════

// ── Feed Posts ──
function FeedPostsRenderer({ showId, episodeId, config }) {
  const maxPosts = config.max_items || 3;
  const url = showId
    ? (episodeId ? `/api/v1/feed-posts/episode/${episodeId}` : `/api/v1/feed-posts/${showId}/timeline`)
    : null;
  const { data, loading } = useContentData(url);

  if (loading) return <ZoneLoader />;
  const posts = (data?.data || data?.posts || []).slice(0, maxPosts);
  if (!posts.length) return <ZoneEmpty label="No posts" />;

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {posts.map((post, i) => (
        <div key={post.id || i} style={{ padding: '4px 5px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: config.bg || 'rgba(0,0,0,0.4)' }}>
          {/* Post header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'linear-gradient(135deg, #e8a0b4, #b8a9d4)', flexShrink: 0 }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {post.poster_handle || post.poster_display_name || 'user'}
            </span>
            <MoreHorizontal size={7} color="rgba(255,255,255,0.4)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
          </div>
          {/* Post content */}
          {post.content_text && (
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3, marginBottom: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {post.content_text}
            </div>
          )}
          {/* Engagement row */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Heart size={7} color="rgba(255,255,255,0.5)" />
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{post.likes || 0}</span>
            <MessageCircle size={7} color="rgba(255,255,255,0.5)" />
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{post.comments_count || 0}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Profile Header ──
function ProfileHeaderRenderer({ showId, config }) {
  const profileId = config.profile_id;
  const url = profileId ? `/api/v1/social-profiles/${profileId}` : null;
  const { data, loading } = useContentData(url);

  if (loading) return <ZoneLoader />;
  const profile = data?.data || data;
  if (!profile) return <ZoneEmpty label="No profile" />;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 4, background: config.bg || 'rgba(0,0,0,0.35)' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #e8a0b4, #b8a9d4)', marginBottom: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 700, border: '1.5px solid rgba(255,255,255,0.3)' }}>
        {(profile.display_name || profile.handle || '?')[0].toUpperCase()}
      </div>
      <div style={{ fontSize: 8, fontWeight: 700, color: '#fff', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
        {profile.display_name || profile.handle}
      </div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
        @{profile.handle}
      </div>
      {profile.vibe_sentence && (
        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 2, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {profile.vibe_sentence}
        </div>
      )}
    </div>
  );
}

// ── Profile Stats ──
function ProfileStatsRenderer({ showId, config }) {
  const profileId = config.profile_id;
  const url = profileId ? `/api/v1/social-profiles/${profileId}` : null;
  const { data, loading } = useContentData(url);

  if (loading) return <ZoneLoader />;
  const profile = data?.data || data;
  if (!profile) return <ZoneEmpty label="No profile" />;

  const stats = [
    { label: 'Posts', value: profile.platform_metrics?.total_posts || '—' },
    { label: 'Followers', value: profile.follower_count_approx || '—' },
    { label: 'Following', value: profile.platform_metrics?.following || '—' },
  ];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '2px 4px', background: config.bg || 'rgba(0,0,0,0.3)' }}>
      {stats.map(s => (
        <div key={s.label} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── DM Thread ──
function DMThreadRenderer({ showId, episodeId, config }) {
  const maxMessages = config.max_items || 6;
  const url = showId && episodeId
    ? `/api/v1/feed-enhanced/${showId}/moments/${episodeId}`
    : null;
  const { data, loading } = useContentData(url);

  if (loading) return <ZoneLoader />;
  const moments = (data?.data || data?.moments || [])
    .filter(m => m.phone_screen_type === 'dm')
    .slice(0, maxMessages);
  if (!moments.length) return <ZoneEmpty label="No DMs" />;

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, padding: 3 }}>
      {moments.map((m, i) => {
        const isOutgoing = m.justawoman_line && !m.trigger_handle;
        return (
          <div key={m.id || i} style={{
            alignSelf: isOutgoing ? 'flex-end' : 'flex-start',
            maxWidth: '80%',
            padding: '3px 5px',
            borderRadius: 6,
            background: isOutgoing ? 'rgba(88,101,242,0.7)' : 'rgba(255,255,255,0.12)',
            fontSize: 8,
            color: '#fff',
            lineHeight: 1.3,
          }}>
            {!isOutgoing && (
              <div style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 1 }}>
                {m.trigger_handle || 'them'}
              </div>
            )}
            {m.screen_content || m.justawoman_line || m.lala_line || '...'}
          </div>
        );
      })}
    </div>
  );
}

// ── Notifications ──
function NotificationsRenderer({ showId, episodeId, config }) {
  const maxItems = config.max_items || 5;
  const url = showId && episodeId
    ? `/api/v1/feed-enhanced/${showId}/moments/${episodeId}`
    : null;
  const { data, loading } = useContentData(url);

  if (loading) return <ZoneLoader />;
  const notifs = (data?.data || data?.moments || [])
    .filter(m => m.phone_screen_type === 'notification')
    .slice(0, maxItems);
  if (!notifs.length) return <ZoneEmpty label="No notifications" />;

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {notifs.map((n, i) => (
        <div key={n.id || i} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '3px 4px',
          background: config.bg || 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(232,160,180,0.6)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>
            🔔
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 8, color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {n.trigger_handle || 'Someone'}
            </div>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {n.screen_content || n.trigger_action || 'notification'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Story Ring ──
function StoryRingRenderer({ showId, config }) {
  const url = showId ? `/api/v1/social-profiles?show_id=${showId}` : null;
  const { data, loading } = useContentData(url);

  if (loading) return <ZoneLoader />;
  const profiles = (data?.data || data?.profiles || []).slice(0, config.max_items || 8);
  if (!profiles.length) return <ZoneEmpty label="No stories" />;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px', overflowX: 'auto' }}>
      {profiles.map((p, i) => (
        <div key={p.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, gap: 1 }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            background: 'linear-gradient(135deg, #e8a0b4, #b8a9d4, #7ab3d4)',
            padding: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, color: '#fff', fontWeight: 600,
            }}>
              {(p.display_name || p.handle || '?')[0].toUpperCase()}
            </div>
          </div>
          <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.5)', maxWidth: 26, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
            {p.handle || p.display_name}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Wardrobe Grid ──
function WardrobeGridRenderer({ showId, config }) {
  const url = showId ? `/api/v1/wardrobe?show_id=${showId}&limit=${config.max_items || 6}` : null;
  const { data, loading } = useContentData(url);

  if (loading) return <ZoneLoader />;
  const items = (data?.data || data?.items || []).slice(0, config.max_items || 6);
  if (!items.length) return <ZoneEmpty label="No wardrobe" />;

  return (
    <div style={{
      width: '100%', height: '100%', display: 'grid',
      gridTemplateColumns: `repeat(${config.columns || 3}, 1fr)`,
      gap: 2, padding: 2, overflowY: 'auto',
    }}>
      {items.map((item, i) => (
        <div key={item.id || i} style={{
          aspectRatio: '1/1', borderRadius: 3, overflow: 'hidden',
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {(item.s3_url || item.thumbnail_url) ? (
            <img src={item.thumbnail_url || item.s3_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>👗</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Outfit Card ──
function OutfitCardRenderer({ showId, config }) {
  const url = showId ? `/api/v1/outfit-sets?show_id=${showId}` : null;
  const { data, loading } = useContentData(url);

  if (loading) return <ZoneLoader />;
  const sets = data?.data || data?.sets || [];
  const outfit = config.outfit_index !== undefined ? sets[config.outfit_index] : sets[0];
  if (!outfit) return <ZoneEmpty label="No outfits" />;

  return (
    <div style={{ width: '100%', height: '100%', padding: 4, background: config.bg || 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#fff', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {outfit.name}
      </div>
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>
        {outfit.occasion || outfit.season || 'Outfit'}
      </div>
      {outfit.synergy_score !== undefined && (
        <div style={{ fontSize: 8, color: '#a8d5a2', fontWeight: 600 }}>
          {outfit.synergy_score}% match
        </div>
      )}
    </div>
  );
}

// ── Comments List ──
function CommentsRenderer({ showId, config }) {
  // Uses feed posts with sample_comments
  const url = showId ? `/api/v1/feed-posts/${showId}/timeline` : null;
  const { data, loading } = useContentData(url);

  if (loading) return <ZoneLoader />;
  const posts = data?.data || data?.posts || [];
  // Collect comments from posts
  const comments = [];
  for (const post of posts) {
    if (post.sample_comments?.length) {
      for (const c of post.sample_comments.slice(0, 3)) {
        comments.push(typeof c === 'string' ? { text: c } : c);
      }
    }
    if (comments.length >= (config.max_items || 5)) break;
  }
  if (!comments.length) return <ZoneEmpty label="No comments" />;

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {comments.slice(0, config.max_items || 5).map((c, i) => (
        <div key={i} style={{ display: 'flex', gap: 3, padding: '2px 4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 8, fontWeight: 700, color: '#fff', marginRight: 3 }}>{c.handle || c.user || 'user'}</span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>{c.text || c.content || ''}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Engagement Stats ──
function EngagementStatsRenderer({ showId, config }) {
  const url = showId ? `/api/v1/feed-enhanced/${showId}/momentum` : null;
  const { data, loading } = useContentData(url);

  if (loading) return <ZoneLoader />;
  const stats = data?.data || data;
  if (!stats) return <ZoneEmpty label="No stats" />;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, padding: 4, background: config.bg || 'rgba(0,0,0,0.3)' }}>
      {stats.total_posts !== undefined && (
        <StatRow label="Total Posts" value={stats.total_posts} />
      )}
      {stats.total_engagement !== undefined && (
        <StatRow label="Engagement" value={stats.total_engagement} />
      )}
      {stats.viral_count !== undefined && (
        <StatRow label="Viral Posts" value={stats.viral_count} />
      )}
      {stats.avg_sentiment && (
        <StatRow label="Sentiment" value={stats.avg_sentiment} />
      )}
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{value}</span>
    </div>
  );
}

// ── Custom Text ──
function CustomTextRenderer({ config }) {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 3, background: config.bg || 'transparent',
    }}>
      <span style={{
        fontSize: config.font_size || 8,
        fontWeight: config.bold ? 700 : 400,
        color: config.color || '#fff',
        fontFamily: config.font === 'serif' ? "'Playfair Display', serif" : config.font === 'mono' ? "'DM Mono', monospace" : "'DM Sans', sans-serif",
        textAlign: 'center',
        lineHeight: 1.3,
      }}>
        {config.text || 'Text'}
      </span>
    </div>
  );
}

// ── Shared utility components ──
function ZoneLoader() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
      <div style={{ width: 10, height: 10, border: '1.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'overlays-spin 0.8s linear infinite' }} />
    </div>
  );
}

function ZoneEmpty({ label }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: 3 }}>
      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', fontFamily: "'DM Mono', monospace" }}>{label}</span>
    </div>
  );
}

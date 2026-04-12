import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Wand2, Trash2, ArrowLeft,
  Clock, Smile, Frown, AlertTriangle, Star, Filter, Flame, TrendingUp,
  BarChart3, Eye, Activity, Link2 } from 'lucide-react';
import api from '../services/api';
import './FeedTimelinePage.css';

const TIMELINE_LABELS = {
  before_episode: 'Before Episode',
  during_episode: 'During Episode',
  after_episode: 'After Episode',
  next_day: 'Next Day',
  week_later: 'Week Later',
};

const EMOTION_ICONS = {
  confidence_boost: { icon: Star, color: '#B8962E', label: 'Confidence Boost' },
  anxiety: { icon: AlertTriangle, color: '#f59e0b', label: 'Anxiety' },
  jealousy: { icon: Frown, color: '#dc2626', label: 'Jealousy' },
  validation: { icon: Heart, color: '#ec4899', label: 'Validation' },
  indifference: { icon: Clock, color: '#9ca3af', label: 'Indifference' },
  anger: { icon: AlertTriangle, color: '#ef4444', label: 'Anger' },
};

const FUNCTION_COLORS = {
  reaction: '#6366f1',
  bts: '#B8962E',
  flex: '#ec4899',
  shade: '#ef4444',
  support: '#22c55e',
  comparison: '#f59e0b',
  gossip: '#8b5cf6',
  brand_content: '#0ea5e9',
  callback: '#6b7280',
};

function FeedPostCard({ post, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const EmotionIcon = EMOTION_ICONS[post.emotional_impact]?.icon || Smile;
  const emotionColor = EMOTION_ICONS[post.emotional_impact]?.color || '#888';

  return (
    <div className="feed-post-card">
      <div className="feed-post-header">
        <div className="feed-post-avatar">
          {(post.poster_handle || '?')[0].toUpperCase()}
        </div>
        <div className="feed-post-user">
          <span className="feed-post-display-name">
            {post.poster_creator_name || post.poster_display_name || post.poster_handle}
          </span>
          <span className="feed-post-handle">
            @{post.poster_handle}{post.poster_creator_name && post.poster_display_name && post.poster_display_name !== post.poster_creator_name ? ` · ${post.poster_display_name}` : ''}
          </span>
          <span className="feed-post-platform">{post.poster_platform}</span>
        </div>
        {post.narrative_function && (
          <span
            className="feed-post-function"
            style={{ background: FUNCTION_COLORS[post.narrative_function] + '18',
                     color: FUNCTION_COLORS[post.narrative_function] }}
          >
            {post.narrative_function}
          </span>
        )}
      </div>

      <div className="feed-post-content">
        <p className="feed-post-text">{post.content_text}</p>
        {post.image_description && (
          <div className="feed-post-image-desc">
            {post.image_url ? (
              <img src={post.image_url} alt={post.image_description} />
            ) : (
              <div className="feed-post-image-placeholder">
                <span>{post.image_description}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Viral / trending badges */}
      {(post.is_viral || post.trending_topic) && (
        <div className="feed-post-badges">
          {post.is_viral && (
            <span className="feed-post-viral-badge">
              <Flame size={11} /> Viral
              {post.viral_reach > 0 && <span> &middot; {post.viral_reach.toLocaleString()} reach</span>}
            </span>
          )}
          {post.trending_topic && (
            <span className="feed-post-trending-badge">
              <TrendingUp size={11} /> {post.trending_topic}
            </span>
          )}
          {post.audience_sentiment && (
            <span className={`feed-post-sentiment ${post.audience_sentiment}`}>
              {post.audience_sentiment}
            </span>
          )}
        </div>
      )}

      <div className="feed-post-engagement">
        <span><Heart size={14} /> {(post.likes || 0).toLocaleString()}</span>
        <span><MessageCircle size={14} /> {(post.comments_count || 0).toLocaleString()}</span>
        <span><Share2 size={14} /> {(post.shares || 0).toLocaleString()}</span>
        {post.engagement_velocity > 0 && (
          <span className="feed-post-velocity"><Activity size={12} /> {post.engagement_velocity}/hr</span>
        )}
        <span className="feed-post-type">{post.post_type}</span>
      </div>

      {/* Thread indicator */}
      {post.thread_id && (
        <div className="feed-post-thread">
          <Link2 size={11} /> Part of a thread
          {post.ripple_effect?.spawned_posts > 0 && (
            <span> &middot; {post.ripple_effect.spawned_posts} replies</span>
          )}
        </div>
      )}

      {/* Lala's reaction */}
      {(post.lala_reaction || post.lala_internal_thought) && (
        <div className="feed-post-lala" onClick={() => setExpanded(!expanded)}>
          <div className="feed-post-lala-header">
            <EmotionIcon size={14} color={emotionColor} />
            <span style={{ color: emotionColor }}>
              {EMOTION_ICONS[post.emotional_impact]?.label || 'Lala sees this'}
            </span>
          </div>
          {expanded && (
            <div className="feed-post-lala-body">
              {post.lala_reaction && (
                <p className="feed-post-lala-says">
                  Lala: &ldquo;{post.lala_reaction}&rdquo;
                </p>
              )}
              {post.lala_internal_thought && (
                <p className="feed-post-lala-thinks">
                  <em>*thinks: {post.lala_internal_thought}*</em>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Comments preview */}
      {post.sample_comments?.length > 0 && expanded && (
        <div className="feed-post-comments">
          {post.sample_comments.slice(0, 3).map((c, i) => (
            <div key={i} className={`feed-comment ${c.is_lala ? 'lala-comment' : ''}`}>
              <span className="feed-comment-handle">@{c.handle}</span>
              <span className="feed-comment-text">{c.text}</span>
              {c.likes > 0 && <span className="feed-comment-likes">{c.likes}</span>}
            </div>
          ))}
        </div>
      )}

      {onDelete && (
        <button className="feed-post-delete" onClick={() => onDelete(post.id)}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

export default function FeedTimelinePage() {
  const { showId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const episodeId = searchParams.get('episode');

  const [posts, setPosts] = useState([]);
  const [grouped, setGrouped] = useState({});
  const [stats, setStats] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);

  const loadPosts = useCallback(() => {
    if (episodeId) {
      api.get(`/api/v1/feed-posts/episode/${episodeId}`)
        .then(r => {
          setPosts(r.data.data || []);
          setGrouped(r.data.grouped || {});
          setStats(r.data.stats || null);
        })
        .catch(err => setError(err.message));
    } else if (showId) {
      api.get(`/api/v1/feed-posts/${showId}/timeline`)
        .then(r => setPosts(r.data.data || []))
        .catch(err => setError(err.message));
    }
  }, [showId, episodeId]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleGenerate = async () => {
    if (!episodeId || !showId) return;
    setGenerating(true);
    setError(null);
    try {
      await api.post(`/api/v1/feed-posts/${episodeId}/generate`, { showId });
      loadPosts();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (postId) => {
    try {
      await api.delete(`/api/v1/feed-posts/${postId}`);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredPosts = filter === 'all'
    ? posts
    : posts.filter(p => p.timeline_position === filter || p.narrative_function === filter);

  const timelineGroups = Object.entries(TIMELINE_LABELS)
    .map(([key, label]) => ({
      key,
      label,
      posts: (grouped[key] || []).length > 0
        ? grouped[key]
        : filteredPosts.filter(p => p.timeline_position === key),
    }))
    .filter(g => g.posts.length > 0);

  return (
    <div className="feed-timeline-page">
      <div className="feed-timeline-header">
        <button className="feed-timeline-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Back
        </button>
        <div className="feed-timeline-title">
          <h1>Feed Timeline</h1>
          {episodeId && <p className="feed-timeline-subtitle">Episode activity feed</p>}
        </div>
        <div className="feed-timeline-actions">
          <button
            className="feed-timeline-btn dashboard"
            onClick={() => navigate(`/shows/${showId}/feed-dashboard`)}
          >
            <BarChart3 size={16} /> Dashboard
          </button>
          {episodeId && (
            <button
              className="feed-timeline-btn generate"
              onClick={handleGenerate}
              disabled={generating}
            >
              <Wand2 size={16} />
              {generating ? 'Generating...' : 'Generate Posts'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="feed-timeline-error">{error}</div>}

      {stats && (
        <div className="feed-timeline-stats">
          <span><Heart size={14} /> {stats.total_likes?.toLocaleString()} total likes</span>
          <span><MessageCircle size={14} /> {stats.total_comments?.toLocaleString()} comments</span>
          <span>{posts.length} posts</span>
          {stats.narrative_functions?.length > 0 && (
            <span>Types: {stats.narrative_functions.join(', ')}</span>
          )}
        </div>
      )}

      <div className="feed-timeline-filters">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >All</button>
        {Object.entries(TIMELINE_LABELS).map(([key, label]) => (
          <button
            key={key}
            className={filter === key ? 'active' : ''}
            onClick={() => setFilter(key)}
          >{label}</button>
        ))}
        <span className="feed-timeline-divider">|</span>
        {['reaction', 'shade', 'support', 'flex', 'gossip'].map(fn => (
          <button
            key={fn}
            className={filter === fn ? 'active' : ''}
            onClick={() => setFilter(fn)}
            style={{ color: FUNCTION_COLORS[fn] }}
          >{fn}</button>
        ))}
      </div>

      <div className="feed-timeline-content">
        {episodeId && timelineGroups.length > 0 ? (
          timelineGroups.map(group => (
            <div key={group.key} className="feed-timeline-group">
              <h3 className="feed-timeline-group-label">{group.label}</h3>
              {group.posts.map(post => (
                <FeedPostCard key={post.id} post={post} onDelete={handleDelete} />
              ))}
            </div>
          ))
        ) : (
          filteredPosts.length > 0 ? (
            filteredPosts.map(post => (
              <FeedPostCard key={post.id} post={post} onDelete={handleDelete} />
            ))
          ) : (
            <div className="feed-timeline-empty">
              <MessageCircle size={48} />
              <p>No feed posts yet</p>
              {episodeId && <p>Generate posts to see the timeline activity after this episode.</p>}
            </div>
          )
        )}
      </div>
    </div>
  );
}

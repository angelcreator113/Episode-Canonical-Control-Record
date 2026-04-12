import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  TrendingUp, Zap, Flame, Link2, MessageCircle, Heart,
  Share2, ArrowLeft, RefreshCw, ChevronRight, Activity,
  Eye, Globe, Sparkles, AlertTriangle, BarChart3
} from 'lucide-react';
import api from '../../services/api';
import './EventFeedDashboard.css';

const VIRAL_TIER_CONFIG = {
  nano:  { label: 'Micro-viral', color: '#22c55e', icon: TrendingUp },
  mid:   { label: 'Going Viral', color: '#f59e0b', icon: Flame },
  mega:  { label: 'Viral Moment', color: '#ef4444', icon: Zap },
  ultra: { label: 'Cultural Moment', color: '#8b5cf6', icon: Sparkles },
};

const SENTIMENT_CONFIG = {
  supportive:  { label: 'Supportive', color: '#22c55e', bg: '#f0fdf4' },
  divided:     { label: 'Divided', color: '#f59e0b', bg: '#fffbeb' },
  hostile:     { label: 'Hostile', color: '#ef4444', bg: '#fef2f2' },
  curious:     { label: 'Curious', color: '#6366f1', bg: '#eef2ff' },
  indifferent: { label: 'Indifferent', color: '#9ca3af', bg: '#f9fafb' },
};

function MomentumBar({ score, max = 100 }) {
  const pct = Math.min(100, (score / max) * 100);
  const color = pct > 70 ? '#ef4444' : pct > 40 ? '#f59e0b' : '#22c55e';
  return (
    <div className="efd-momentum-bar">
      <div className="efd-momentum-fill" style={{ width: `${pct}%`, background: color }} />
      <span className="efd-momentum-label">{score}</span>
    </div>
  );
}

function TrendingTopicCard({ topic }) {
  return (
    <div className="efd-trending-card">
      <span className="efd-trending-topic">{topic.topic}</span>
      <div className="efd-trending-meta">
        <span>{topic.post_count} posts</span>
        <span><Heart size={11} /> {topic.total_engagement.toLocaleString()}</span>
        {topic.events?.length > 0 && <span>{topic.events.length} events</span>}
      </div>
      {topic.functions?.length > 0 && (
        <div className="efd-trending-functions">
          {topic.functions.map(f => (
            <span key={f} className="efd-tag">{f}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function ViralPostCard({ post }) {
  const tier = post.viral_tier || (post.is_viral ? 'nano' : null);
  const config = tier ? VIRAL_TIER_CONFIG[tier] : null;
  const sentimentCfg = SENTIMENT_CONFIG[post.audience_sentiment] || SENTIMENT_CONFIG.curious;

  return (
    <div className={`efd-viral-card ${tier || ''}`}>
      {config && (
        <div className="efd-viral-badge" style={{ background: config.color }}>
          <config.icon size={12} /> {config.label}
        </div>
      )}
      <div className="efd-viral-header">
        <div className="efd-viral-avatar">
          {(post.poster_creator_name || post.poster_handle || '?')[0].toUpperCase()}
        </div>
        <div>
          {post.poster_creator_name && <span className="efd-viral-name" style={{ fontWeight: 700, fontSize: 13, display: 'block' }}>{post.poster_creator_name}</span>}
          <span className="efd-viral-handle">@{post.poster_handle}</span>
          <span className="efd-viral-platform">{post.poster_platform}</span>
        </div>
        <span className="efd-sentiment-badge" style={{ background: sentimentCfg.bg, color: sentimentCfg.color }}>
          {sentimentCfg.label}
        </span>
      </div>
      <p className="efd-viral-text">{post.content_text}</p>
      <div className="efd-viral-stats">
        <span><Heart size={12} /> {(post.likes || 0).toLocaleString()}</span>
        <span><MessageCircle size={12} /> {(post.comments_count || 0).toLocaleString()}</span>
        <span><Share2 size={12} /> {(post.shares || 0).toLocaleString()}</span>
        {post.viral_reach > 0 && (
          <span className="efd-reach"><Eye size={12} /> {post.viral_reach.toLocaleString()} reach</span>
        )}
        {post.engagement_velocity > 0 && (
          <span className="efd-velocity"><Activity size={12} /> {post.engagement_velocity}/hr</span>
        )}
      </div>
      {post.ripple_effect?.spawned_posts > 0 && (
        <div className="efd-ripple-info">
          <Link2 size={12} /> Spawned {post.ripple_effect.spawned_posts} reply threads
          {post.ripple_effect.opportunity_triggers?.length > 0 && (
            <span className="efd-opp-trigger">
              <Sparkles size={11} /> Brand noticed
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function EventMomentumCard({ event, onChain }) {
  return (
    <div className={`efd-event-card ${event.should_chain ? 'chainable' : ''}`}>
      <div className="efd-event-header">
        <h4>{event.name}</h4>
        <span className="efd-event-type">{event.event_type}</span>
      </div>
      <div className="efd-event-stats">
        <span>{event.post_count} posts</span>
        <span><Heart size={11} /> {event.total_likes.toLocaleString()}</span>
        <span><MessageCircle size={11} /> {event.total_comments.toLocaleString()}</span>
        {event.viral_posts > 0 && (
          <span className="efd-viral-count"><Flame size={11} /> {event.viral_posts} viral</span>
        )}
      </div>
      <div className="efd-event-momentum">
        <span>Momentum</span>
        <MomentumBar score={event.momentum} />
      </div>
      {event.should_chain && event.chain_recommendations?.length > 0 && (
        <div className="efd-chain-recs">
          <h5>Chain Opportunities</h5>
          {event.chain_recommendations.map((rec, i) => (
            <div key={i} className="efd-chain-rec">
              <div className="efd-chain-rec-info">
                <span className="efd-chain-type">{rec.type.replace(/_/g, ' ')}</span>
                <span className="efd-chain-reason">{rec.reason}</span>
                <span className="efd-chain-prestige">Prestige {rec.suggested_prestige}/10</span>
              </div>
              <button
                className="efd-chain-btn"
                onClick={() => onChain(event.event_id, rec)}
              >
                <Link2 size={12} /> Chain
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventChainView({ chain }) {
  if (!chain?.events?.length) return null;

  return (
    <div className="efd-chain-view">
      <h4><Link2 size={14} /> Event Chain ({chain.chain_length} events)</h4>
      <div className="efd-chain-timeline">
        {chain.events.map((event, i) => (
          <div key={event.id} className={`efd-chain-node ${event.status}`}>
            <div className="efd-chain-dot" />
            {i < chain.events.length - 1 && <div className="efd-chain-line" />}
            <div className="efd-chain-content">
              <span className="efd-chain-name">{event.name}</span>
              <div className="efd-chain-details">
                <span>{event.event_type}</span>
                <span>Prestige {event.prestige}</span>
                <span className={`efd-status ${event.status}`}>{event.status}</span>
                {event.momentum_score > 0 && <span>Momentum: {event.momentum_score}</span>}
              </div>
              {event.chain_reason && (
                <p className="efd-chain-node-reason">{event.chain_reason}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EventFeedDashboard() {
  const { showId } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('momentum');
  const [momentum, setMomentum] = useState(null);
  const [trending, setTrending] = useState([]);
  const [viralPosts, setViralPosts] = useState([]);
  const [selectedChain, setSelectedChain] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadMomentum = useCallback(async () => {
    try {
      const r = await api.get(`/api/v1/feed-enhanced/${showId}/momentum`);
      setMomentum(r.data.data);
    } catch (err) {
      console.error('Failed to load momentum:', err);
    }
  }, [showId]);

  const loadTrending = useCallback(async () => {
    try {
      const r = await api.get(`/api/v1/feed-enhanced/${showId}/trending`);
      setTrending(r.data.data || []);
    } catch (err) {
      console.error('Failed to load trending:', err);
    }
  }, [showId]);

  const loadViral = useCallback(async () => {
    try {
      const r = await api.get(`/api/v1/feed-enhanced/${showId}/viral`);
      setViralPosts(r.data.data || []);
    } catch (err) {
      console.error('Failed to load viral posts:', err);
    }
  }, [showId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadMomentum(), loadTrending(), loadViral()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [loadMomentum, loadTrending, loadViral]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleChain = async (eventId, rec) => {
    try {
      setLoading(true);
      await api.post(`/api/v1/feed-enhanced/${showId}/chain/${eventId}`, {
        type: rec.type,
        reason: rec.reason,
        suggested_prestige: rec.suggested_prestige,
      });
      await loadMomentum();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewChain = async (eventId) => {
    try {
      const r = await api.get(`/api/v1/feed-enhanced/${showId}/chain/${eventId}`);
      setSelectedChain(r.data.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleRipple = async (postId) => {
    try {
      setLoading(true);
      await api.post(`/api/v1/feed-enhanced/post/${postId}/ripple`);
      await loadViral();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const TABS = [
    { key: 'momentum', label: 'Momentum', icon: BarChart3 },
    { key: 'trending', label: 'Trending', icon: TrendingUp },
    { key: 'viral', label: 'Viral', icon: Flame },
    { key: 'chains', label: 'Chains', icon: Link2 },
  ];

  return (
    <div className="efd-page">
      <div className="efd-header">
        <button className="efd-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="efd-title">
          <h1>Event Feed Dashboard</h1>
          <p className="efd-subtitle">Engagement analytics, trending topics, viral detection, event chains</p>
        </div>
        <button className="efd-refresh" onClick={loadAll} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="efd-error"><AlertTriangle size={14} /> {error}</div>}

      {/* Summary bar */}
      {momentum && (
        <div className="efd-summary">
          <div className="efd-summary-item">
            <BarChart3 size={16} />
            <span>Total Momentum</span>
            <strong>{momentum.total_momentum}</strong>
          </div>
          <div className="efd-summary-item">
            <Flame size={16} />
            <span>Viral Events</span>
            <strong>{momentum.viral_event_count}</strong>
          </div>
          <div className="efd-summary-item">
            <Link2 size={16} />
            <span>Chain Candidates</span>
            <strong>{momentum.chain_candidates}</strong>
          </div>
          <div className="efd-summary-item">
            <TrendingUp size={16} />
            <span>Trending Topics</span>
            <strong>{trending.length}</strong>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="efd-tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`efd-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="efd-content">
        {activeTab === 'momentum' && momentum && (
          <div className="efd-momentum-tab">
            {momentum.events.length === 0 ? (
              <div className="efd-empty">
                <BarChart3 size={40} />
                <p>No events with feed engagement yet.</p>
                <p>Generate feed posts after episodes to build momentum.</p>
              </div>
            ) : (
              momentum.events.map(event => (
                <EventMomentumCard
                  key={event.event_id}
                  event={event}
                  onChain={handleChain}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'trending' && (
          <div className="efd-trending-tab">
            {trending.length === 0 ? (
              <div className="efd-empty">
                <TrendingUp size={40} />
                <p>No trending topics yet.</p>
                <p>Feed posts with hashtags will appear here.</p>
              </div>
            ) : (
              <div className="efd-trending-grid">
                {trending.map((topic, i) => (
                  <TrendingTopicCard key={i} topic={topic} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'viral' && (
          <div className="efd-viral-tab">
            {viralPosts.length === 0 ? (
              <div className="efd-empty">
                <Flame size={40} />
                <p>No viral posts yet.</p>
                <p>Posts that exceed engagement thresholds appear here.</p>
              </div>
            ) : (
              viralPosts.map(post => (
                <div key={post.id}>
                  <ViralPostCard post={post} />
                  <button className="efd-ripple-btn" onClick={() => handleRipple(post.id)}>
                    <Globe size={12} /> Generate Ripple Effects
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'chains' && (
          <div className="efd-chains-tab">
            {selectedChain ? (
              <>
                <button className="efd-chain-back" onClick={() => setSelectedChain(null)}>
                  <ArrowLeft size={14} /> All Events
                </button>
                <EventChainView chain={selectedChain} />
              </>
            ) : (
              momentum?.events.length > 0 ? (
                <div className="efd-chain-list">
                  {momentum.events.map(event => (
                    <button
                      key={event.event_id}
                      className="efd-chain-list-item"
                      onClick={() => handleViewChain(event.event_id)}
                    >
                      <div>
                        <span className="efd-chain-list-name">{event.name}</span>
                        <span className="efd-chain-list-type">{event.event_type} &middot; Prestige {event.prestige}</span>
                      </div>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="efd-empty">
                  <Link2 size={40} />
                  <p>No events to show chains for.</p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * EpisodeWorkspace.jsx
 * /episodes — Central hub for all episodes across shows.
 * Quick-launch into Scene Composer, Timeline, WriteMode, or Episode Details.
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { episodeService } from '../services/episodeService';
import { showService } from '../services/showService';
import LoadingSkeleton from '../components/LoadingSkeleton';
import './EpisodeWorkspace.css';

const STATUS_GROUPS = [
  { key: 'active',    label: 'In Progress',  icon: '🔥', statuses: ['in_progress', 'in_build', 'editing'] },
  { key: 'draft',     label: 'Drafts',       icon: '📝', statuses: ['draft'] },
  { key: 'review',    label: 'In Review',    icon: '👁️',  statuses: ['review', 'pending_review'] },
  { key: 'published', label: 'Published',    icon: '✅',       statuses: ['published', 'completed', 'aired'] },
  { key: 'archived',  label: 'Archived',     icon: '📦', statuses: ['archived', 'cancelled'] },
];

function statusLabel(s) {
  return (s || 'draft').replace(/_/g, ' ');
}

function relTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function EpisodeWorkspace() {
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState([]);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterShow, setFilterShow] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // grid | list

  useEffect(() => {
    Promise.allSettled([
      episodeService.getEpisodes(1, 200).then(r => r?.data || []),
      showService.getAllShows().then(r => Array.isArray(r) ? r : r?.data || []),
    ]).then(([epRes, showRes]) => {
      if (epRes.status === 'fulfilled') setEpisodes(Array.isArray(epRes.value) ? epRes.value : []);
      if (showRes.status === 'fulfilled') setShows(Array.isArray(showRes.value) ? showRes.value : []);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    let list = episodes;
    if (filterShow !== 'all') list = list.filter(ep => String(ep.show_id) === filterShow);
    if (filterStatus !== 'all') {
      const group = STATUS_GROUPS.find(g => g.key === filterStatus);
      if (group) list = list.filter(ep => group.statuses.includes(ep.status));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(ep =>
        (ep.title || '').toLowerCase().includes(q) ||
        (ep.show?.name || '').toLowerCase().includes(q) ||
        String(ep.episode_number).includes(q)
      );
    }
    return list.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
  }, [episodes, filterShow, filterStatus, searchQuery]);

  const grouped = useMemo(() => {
    if (filterStatus !== 'all') return null;
    const groups = STATUS_GROUPS.map(g => ({
      ...g,
      episodes: filtered.filter(ep => g.statuses.includes(ep.status)),
    })).filter(g => g.episodes.length > 0);
    return groups;
  }, [filtered, filterStatus]);

  if (loading) return <div className="ew-root"><LoadingSkeleton variant="page" /></div>;

  return (
    <div className="ew-root">
      {/* ── Header ── */}
      <div className="ew-header">
        <div className="ew-header-left">
          <h1 className="ew-title">{'🎬'} Episode Workspace</h1>
          <p className="ew-subtitle">{episodes.length} episode{episodes.length !== 1 ? 's' : ''} across {shows.length} show{shows.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="ew-btn ew-btn-gold" onClick={() => navigate('/episodes/create')}>
          + New Episode
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="ew-filters">
        <input
          className="ew-search"
          type="text"
          placeholder="Search episodes..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <select className="ew-filter-select" value={filterShow} onChange={e => setFilterShow(e.target.value)}>
          <option value="all">All Shows</option>
          {shows.map(s => (
            <option key={s.id} value={String(s.id)}>{s.name}</option>
          ))}
        </select>
        <select className="ew-filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          {STATUS_GROUPS.map(g => (
            <option key={g.key} value={g.key}>{g.icon} {g.label}</option>
          ))}
        </select>
        <div className="ew-view-toggle">
          <button className={`ew-vt-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title="Grid view">{'▦'}</button>
          <button className={`ew-vt-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} title="List view">{'☰'}</button>
        </div>
      </div>

      {/* ── Quick Stats ── */}
      <div className="ew-stats">
        {STATUS_GROUPS.map(g => {
          const count = episodes.filter(ep => g.statuses.includes(ep.status)).length;
          return (
            <button
              key={g.key}
              className={`ew-stat-pill ${filterStatus === g.key ? 'active' : ''}`}
              onClick={() => setFilterStatus(filterStatus === g.key ? 'all' : g.key)}
            >
              <span className="ew-stat-icon">{g.icon}</span>
              <span className="ew-stat-count">{count}</span>
              <span className="ew-stat-label">{g.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Episode Cards ── */}
      {filtered.length === 0 ? (
        <div className="ew-empty">
          <div className="ew-empty-icon">{'🎬'}</div>
          <h3>No episodes found</h3>
          <p>{searchQuery ? 'Try a different search.' : 'Create your first episode to get started.'}</p>
          <button className="ew-btn ew-btn-gold" onClick={() => navigate('/episodes/create')}>Create Episode</button>
        </div>
      ) : grouped && !searchQuery.trim() ? (
        // Grouped by status
        grouped.map(group => (
          <section key={group.key} className="ew-group">
            <h2 className="ew-group-title">
              <span className="ew-group-icon">{group.icon}</span>
              {group.label}
              <span className="ew-group-count">{group.episodes.length}</span>
            </h2>
            <div className={viewMode === 'grid' ? 'ew-grid' : 'ew-list'}>
              {group.episodes.map(ep => (
                <EpisodeCard key={ep.id} ep={ep} viewMode={viewMode} navigate={navigate} />
              ))}
            </div>
          </section>
        ))
      ) : (
        // Flat filtered list
        <div className={viewMode === 'grid' ? 'ew-grid' : 'ew-list'}>
          {filtered.map(ep => (
            <EpisodeCard key={ep.id} ep={ep} viewMode={viewMode} navigate={navigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function EpisodeCard({ ep, viewMode, navigate }) {
  const showName = ep.show?.name || ep.Show?.name || 'Unknown Show';

  if (viewMode === 'list') {
    return (
      <div className="ew-list-row" onClick={() => navigate(`/episodes/${ep.id}`)}>
        <div className="ew-list-main">
          <span className="ew-list-num">Ep {ep.episode_number || '?'}</span>
          <span className="ew-list-title">{ep.title || 'Untitled'}</span>
          <span className="ew-list-show">{showName}</span>
        </div>
        <div className="ew-list-meta">
          <span className={`ew-status ew-status--${ep.status || 'draft'}`}>{statusLabel(ep.status)}</span>
          <span className="ew-list-time">{relTime(ep.updated_at)}</span>
        </div>
        <div className="ew-list-actions" onClick={e => e.stopPropagation()}>
          <button className="ew-action-btn" onClick={() => navigate(`/episodes/${ep.id}/scene-composer`)} title="Scene Composer">{'🎬'}</button>
          <button className="ew-action-btn" onClick={() => navigate(`/episodes/${ep.id}/timeline`)} title="Timeline">{'⏱️'}</button>
          <button className="ew-action-btn" onClick={() => navigate(`/episodes/${ep.id}`)} title="Details">{'📋'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ew-card">
      <div className="ew-card-header">
        <div className="ew-card-ep-num">Episode {ep.episode_number || '?'}</div>
        <span className={`ew-status ew-status--${ep.status || 'draft'}`}>{statusLabel(ep.status)}</span>
      </div>
      <h3 className="ew-card-title">{ep.title || 'Untitled Episode'}</h3>
      <div className="ew-card-show">{showName}</div>
      <div className="ew-card-time">Last edited {relTime(ep.updated_at)}</div>
      <div className="ew-card-actions">
        <button className="ew-card-action" onClick={() => navigate(`/episodes/${ep.id}/scene-composer`)} title="Scene Composer">
          <span className="ew-ca-icon">{'🎬'}</span>
          <span className="ew-ca-label">Compose</span>
        </button>
        <button className="ew-card-action" onClick={() => navigate(`/episodes/${ep.id}/timeline`)} title="Timeline Editor">
          <span className="ew-ca-icon">{'⏱️'}</span>
          <span className="ew-ca-label">Timeline</span>
        </button>
        <button className="ew-card-action ew-card-action--primary" onClick={() => navigate(`/episodes/${ep.id}`)} title="Episode Details">
          <span className="ew-ca-icon">{'➡️'}</span>
          <span className="ew-ca-label">Open</span>
        </button>
      </div>
    </div>
  );
}

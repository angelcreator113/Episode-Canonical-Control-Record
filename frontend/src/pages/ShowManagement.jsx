/**
 * My Shows — every show as a poster card (Evoni's mock, 2026-10-17).
 * Pink-and-gold banner, four stats, status tabs, search and sort, and a
 * card per show: the whole cover (never cropped) over a blurred copy of
 * itself, status, episode count, last update, description, Open Show and
 * a menu with Edit and Delete. Create and edit live at /shows/create and
 * /shows/:id/edit.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Tv, PlayCircle, Clock, BarChart3, Crown, Search, ArrowUpDown,
  Play, MoreHorizontal, Pencil, Trash2, CalendarDays, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config/api';
import apiClient from '../services/api';
import './ShowManagement.css';

// The Show model's statuses, in tab order. in_development reads as
// "Coming Soon", as on the mock.
export const STATUS_TABS = [
  { key: 'all', label: 'All Shows' },
  { key: 'active', label: 'Active' },
  { key: 'in_development', label: 'Coming Soon' },
  { key: 'archived', label: 'Archived' },
  { key: 'cancelled', label: 'Cancelled' },
];
const STATUS_LABEL = {
  active: 'Active', in_development: 'Coming Soon', archived: 'Archived', cancelled: 'Cancelled',
};

export const SORTS = [
  { key: 'updated', label: 'Recently updated' },
  { key: 'name', label: 'Name A–Z' },
  { key: 'episodes', label: 'Most episodes' },
];

// The list route returns model rows (camelCase) or, on its raw-SQL
// fallback, table rows (snake_case); read either.
export const showFields = (s) => ({
  id: s.id,
  name: s.name || 'Untitled Show',
  description: s.description || s.tagline || '',
  status: s.status || 'active',
  cover: s.coverImageUrl || s.cover_image_url || null,
  color: s.color || null,
  icon: s.icon || null,
  episodes: Number(s.episodeCount ?? s.episode_count ?? 0) || 0,
  updated: s.updatedAt || s.updated_at || null,
});

export const showStats = (shows) => ({
  total: shows.length,
  active: shows.filter((s) => s.status === 'active').length,
  comingSoon: shows.filter((s) => s.status === 'in_development').length,
  episodes: shows.reduce((n, s) => n + s.episodes, 0),
});

export function visibleShows(shows, { tab = 'all', query = '', sort = 'updated' } = {}) {
  const q = query.trim().toLowerCase();
  const list = shows.filter((s) => (tab === 'all' || s.status === tab)
    && (!q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)));
  const time = (s) => (s.updated ? new Date(s.updated).getTime() || 0 : 0);
  return [...list].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'episodes') return b.episodes - a.episodes || a.name.localeCompare(b.name);
    return time(b) - time(a) || a.name.localeCompare(b.name);
  });
}

const fmtDate = (d) => {
  if (!d) return null;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : t.toLocaleDateString();
};

function ShowCard({ show, onOpen, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const updated = fmtDate(show.updated);
  return (
    <article className="sm-card" data-testid="sm-card">
      <button type="button" className="sm-cover" onClick={onOpen} aria-label={`Open ${show.name}`}>
        {show.cover ? (
          <>
            <span className="sm-cover-blur" style={{ backgroundImage: `url("${show.cover}")` }} aria-hidden />
            <img className="sm-cover-img" src={show.cover} alt="" loading="lazy" />
          </>
        ) : (
          <span className="sm-cover-empty" style={show.color ? { '--show': show.color } : undefined}>
            {show.icon ? <span className="sm-cover-emoji" aria-hidden>{show.icon}</span> : <Tv size={44} aria-hidden />}
          </span>
        )}
        <span className={`sm-status is-${show.status}`}>{STATUS_LABEL[show.status] || show.status}</span>
      </button>
      <div className="sm-card-body">
        <h3 className="sm-card-name">{show.name}</h3>
        <div className="sm-card-meta">
          <span><PlayCircle size={15} aria-hidden /> {show.episodes} {show.episodes === 1 ? 'Episode' : 'Episodes'}</span>
          {updated && <span><CalendarDays size={15} aria-hidden /> Updated {updated}</span>}
        </div>
        {show.description && <p className="sm-card-desc">{show.description}</p>}
        <div className="sm-card-actions">
          <button type="button" className="sm-btn-open" onClick={onOpen}><Play size={16} aria-hidden /> Open Show</button>
          <div className="sm-menu-wrap" ref={menuRef}>
            <button type="button" className="sm-btn-more" aria-label={`More for ${show.name}`} aria-haspopup="menu"
              aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
              <MoreHorizontal size={20} aria-hidden />
            </button>
            {menuOpen && (
              <div className="sm-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEdit(); }}><Pencil size={15} aria-hidden /> Edit</button>
                <button type="button" role="menuitem" className="is-danger" onClick={() => { setMenuOpen(false); onDelete(); }}><Trash2 size={15} aria-hidden /> Delete</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

const ShowManagement = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updated');

  useEffect(() => {
    if (!isAuthenticated && !authLoading) navigate('/login', { replace: true });
  }, [isAuthenticated, authLoading, navigate]);

  const fetchShows = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`${API_URL}/shows`);
      const rows = response?.data?.data;
      setShows(Array.isArray(rows) ? rows.map(showFields) : []);
      setError(null);
    } catch (err) {
      console.error('Error fetching shows:', err);
      setError('Failed to load shows. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchShows(); }, []);

  const handleDelete = async (show) => {
    if (!window.confirm(`Delete "${show.name}"? This cannot be undone.`)) return;
    try {
      setError(null);
      await apiClient.delete(`${API_URL}/shows/${show.id}`);
      await fetchShows();
    } catch (err) {
      console.error('Error deleting show:', err);
      const body = err?.response?.data;
      setError(body?.message || body?.error || 'Failed to delete show');
    }
  };

  const stats = useMemo(() => showStats(shows), [shows]);
  const list = useMemo(() => visibleShows(shows, { tab, query, sort }), [shows, tab, query, sort]);
  const counts = useMemo(() => {
    const c = { all: shows.length };
    shows.forEach((s) => { c[s.status] = (c[s.status] || 0) + 1; });
    return c;
  }, [shows]);

  const STATS = [
    { key: 'total', label: 'Total Shows', value: stats.total, Icon: Tv },
    { key: 'active', label: 'Active Shows', value: stats.active, Icon: PlayCircle },
    { key: 'soon', label: 'Coming Soon', value: stats.comingSoon, Icon: Clock },
    { key: 'episodes', label: 'Total Episodes', value: stats.episodes, Icon: BarChart3 },
  ];

  return (
    <div className="show-mgmt-page">
      <header className="sm-banner">
        <div className="sm-banner-text">
          <h1 className="sm-title">My Shows</h1>
          <p className="sm-kicker">Create · Produce · Manage · Grow</p>
        </div>
        <button type="button" className="sm-btn-create" onClick={() => navigate('/shows/create')}>
          <Crown size={18} aria-hidden /> Create New Show
        </button>
      </header>

      <section className="sm-stats" aria-label="Show totals">
        {STATS.map(({ key, label, value, Icon }) => (
          <div key={key} className="sm-stat" data-testid={`sm-stat-${key}`}>
            <span className="sm-stat-icon"><Icon size={26} aria-hidden /></span>
            <span className="sm-stat-text">
              <span className="sm-stat-label">{label}</span>
              <span className="sm-stat-value">{value}</span>
            </span>
          </div>
        ))}
      </section>

      <div className="sm-toolbar">
        <div className="sm-tabs" role="tablist" aria-label="Show status">
          {STATUS_TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
              className={`sm-tab${tab === t.key ? ' is-active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}{t.key !== 'all' && counts[t.key] ? <span className="sm-tab-count">{counts[t.key]}</span> : null}
            </button>
          ))}
        </div>
        <div className="sm-tools">
          <label className="sm-search">
            <Search size={18} aria-hidden />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search shows…" aria-label="Search shows" />
          </label>
          <label className="sm-sort">
            <ArrowUpDown size={16} aria-hidden />
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort shows">
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div className="sm-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss"><X size={16} aria-hidden /></button>
        </div>
      )}

      {(authLoading || loading) && shows.length === 0 ? (
        <p className="sm-empty">Loading shows…</p>
      ) : shows.length === 0 ? (
        <div className="sm-empty">
          <Tv size={40} aria-hidden />
          <p>No shows yet. Create your first show to get started.</p>
          <button type="button" className="sm-btn-create" onClick={() => navigate('/shows/create')}><Crown size={18} aria-hidden /> Create First Show</button>
        </div>
      ) : list.length === 0 ? (
        <p className="sm-empty">No shows match.</p>
      ) : (
        <div className="sm-grid">
          {list.map((show) => (
            <ShowCard key={show.id} show={show}
              onOpen={() => navigate(`/shows/${show.id}`)}
              onEdit={() => navigate(`/shows/${show.id}/edit`)}
              onDelete={() => handleDelete(show)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ShowManagement;

// frontend/src/pages/Home.jsx — Creator Command Center
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { episodeService } from '../services/episodeService';
import { showService } from '../services/showService';
import universeService from '../services/universeService';
import storytellerService from '../services/storytellerService';
import './Home.css';

const CHIP_COLORS = ['pink', 'purple', 'blue'];
const BOOK_ICONS = ['📖', '📕', '📗', '📘', '📙'];

function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [universes, setUniverses] = useState([]);
  const [series, setSeries] = useState([]);
  const [books, setBooks] = useState([]);
  const [shows, setShows] = useState([]);
  const [episodes, setEpisodes] = useState([]);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    // Fire all in parallel, swallow individual errors
    const [uniRes, seriesRes, booksRes, showsRes, epRes] = await Promise.allSettled([
      universeService.getUniverses(),
      universeService.getSeries(),
      storytellerService.getBooks(),
      showService.getAllShows(),
      episodeService.getEpisodes(1, 50).then(r => r?.data || []),
    ]);

    if (uniRes.status === 'fulfilled') setUniverses(Array.isArray(uniRes.value) ? uniRes.value : []);
    if (seriesRes.status === 'fulfilled') setSeries(Array.isArray(seriesRes.value) ? seriesRes.value : []);
    if (booksRes.status === 'fulfilled') setBooks(Array.isArray(booksRes.value) ? booksRes.value : []);
    if (showsRes.status === 'fulfilled') setShows(Array.isArray(showsRes.value) ? showsRes.value : []);
    if (epRes.status === 'fulfilled') setEpisodes(Array.isArray(epRes.value) ? epRes.value : []);
    setLoading(false);
  };

  /* ── helpers ── */
  const userName = user?.name || user?.email?.split('@')[0] || 'Creator';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const primaryUniverse = universes[0]; // show the first universe on the card

  const daysSince = (d) => { if (!d) return 999; return Math.floor((Date.now() - new Date(d).getTime()) / 864e5); };
  const relTime = (d) => {
    const n = daysSince(d);
    if (n === 0) return 'Today';
    if (n === 1) return 'Yesterday';
    if (n < 7) return `${n}d ago`;
    if (n < 30) return `${Math.floor(n / 7)}w ago`;
    return `${Math.floor(n / 30)}mo ago`;
  };

  const epStatusClass = (s) => {
    if (['in_build', 'in_progress', 'editing'].includes(s)) return 'progress';
    if (['published', 'complete', 'completed'].includes(s)) return 'complete';
    if (s === 'review') return 'review';
    return 'draft';
  };

  const bookApprovalPct = (b) => {
    const total = b.line_count || 0;
    if (!total) return 0;
    return Math.round(((b.approved_count || 0) / total) * 100);
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="home-loading">
        <div className="loading-spinner" />
        <p>Loading your workspace…</p>
      </div>
    );
  }

  /* ══════════ RENDER ══════════ */
  return (
    <div className="home-page">
      <div className="home-container">

        {/* ─── Welcome Hero Strip ─── */}
        <header className="home-hero">
          <div className="home-hero__inner">
            <div>
              <h1>Welcome back, {userName}</h1>
              <p className="home-hero__tagline">Your universe is waiting.</p>
            </div>
            <span className="home-hero__date">{today}</span>
          </div>
        </header>

        {/* ─── Universe ─── */}
        <section className="hp-section">
          {primaryUniverse ? (() => {
            const desc = primaryUniverse.description || 'A vast narrative universe ready to be shaped.';
            const shortDesc = desc.length > 120 ? desc.slice(0, 120).trimEnd() + '…' : desc;
            return (
            <div className="hp-universe-card" onClick={() => navigate('/universe')} style={{ cursor: 'pointer' }}>
              <div className="hp-universe-header">
                <div>
                  <div className="hp-universe-label">🌌 Your Universe</div>
                  <h3 className="hp-universe-name">{primaryUniverse.name}</h3>
                  <p className="hp-universe-desc">{shortDesc}</p>
                </div>
                <button className="hp-btn-open" onClick={(e) => { e.stopPropagation(); navigate('/universe'); }}>
                  View More →
                </button>
              </div>

              {/* Theme chips */}
              <div className="hp-universe-themes">
                {(primaryUniverse.core_themes || ['Identity', 'Power', 'Legacy']).slice(0, 5).map((t, i) => (
                  <span key={i} className={`hp-theme-chip hp-theme-chip--${CHIP_COLORS[i % 3]}`}>
                    {typeof t === 'string' ? t : t.name || t}
                  </span>
                ))}
              </div>

              <div className="hp-universe-stats">
                <div className="hp-universe-stat">
                  <span className="hp-universe-stat__val">{series.length}</span>
                  <span className="hp-universe-stat__label">Series</span>
                </div>
                <div className="hp-universe-stat">
                  <span className="hp-universe-stat__val">{books.length}</span>
                  <span className="hp-universe-stat__label">Books</span>
                </div>
                <div className="hp-universe-stat">
                  <span className="hp-universe-stat__val">{shows.length}</span>
                  <span className="hp-universe-stat__label">Shows</span>
                </div>
                <div className="hp-universe-stat">
                  <span className="hp-universe-stat__val">{episodes.length}</span>
                  <span className="hp-universe-stat__label">Episodes</span>
                </div>
              </div>
            </div>
            );
          })() : (
            <div className="hp-universe-card">
              <div className="hp-empty">
                <div className="hp-empty__icon">🌌</div>
                <p className="hp-empty__text">No universe created yet</p>
                <button className="hp-empty__btn" onClick={() => navigate('/universe')}>Create Universe →</button>
              </div>
            </div>
          )}
        </section>

        {/* ─── Two-Column: StoryTeller + Shows ─── */}
        <div className="hp-two-col">

          {/* — StoryTeller Books — */}
          <section className="hp-st-card">
            <div className="hp-section__head">
              <h2 className="hp-section__title"><span className="s-icon">📖</span> StoryTeller</h2>
              <button className="hp-section__link" onClick={() => navigate('/storyteller')}>View All →</button>
            </div>

            {books.length > 0 ? (
              <ul className="hp-st-list">
                {books.slice(0, 5).map((book, idx) => {
                  const pct = bookApprovalPct(book);
                  const colorKey = CHIP_COLORS[idx % 3];
                  return (
                    <li key={book.id} className="hp-st-item" onClick={() => navigate(`/storyteller`)}>
                      <div className={`hp-book-icon hp-book-icon--${colorKey}`}>
                        {BOOK_ICONS[idx % BOOK_ICONS.length]}
                      </div>
                      <div className="hp-st-info">
                        <div className="hp-st-title">{book.title}</div>
                        <div className="hp-st-meta">
                          {book.chapter_count || 0} chapters · {book.line_count || 0} lines
                        </div>
                      </div>
                      <div className="hp-st-progress">
                        <div
                          className={`hp-st-progress__fill hp-st-progress__fill--${pct >= 80 ? 'green' : colorKey}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="hp-empty">
                <div className="hp-empty__icon">📖</div>
                <p className="hp-empty__text">No books yet</p>
                <button className="hp-empty__btn" onClick={() => navigate('/storyteller')}>Create a Book →</button>
              </div>
            )}
          </section>

          {/* — Shows — */}
          <section className="hp-shows-card">
            <div className="hp-section__head">
              <h2 className="hp-section__title"><span className="s-icon">📺</span> Shows</h2>
              <button className="hp-section__link" onClick={() => navigate('/shows')}>View All →</button>
            </div>

            {shows.length > 0 ? (
              <ul className="hp-show-list">
                {shows.slice(0, 5).map((show) => {
                  const epCount = episodes.filter(ep => ep.show_id === show.id).length;
                  return (
                    <li key={show.id} className="hp-show-item" onClick={() => navigate('/shows')}>
                      <div className="hp-show-icon">📺</div>
                      <div className="hp-show-info">
                        <div className="hp-show-title">{show.name || show.title}</div>
                        <div className="hp-show-meta">{show.genre || 'Series'}</div>
                      </div>
                      <span className="hp-show-count">{epCount} ep{epCount !== 1 ? 's' : ''}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="hp-empty">
                <div className="hp-empty__icon">📺</div>
                <p className="hp-empty__text">No shows yet</p>
                <button className="hp-empty__btn" onClick={() => navigate('/shows')}>Create a Show →</button>
              </div>
            )}
          </section>
        </div>

        {/* ─── Quick Actions ─── */}
        <section className="hp-actions">
          <div className="hp-action-card hp-action-card--pink" onClick={() => navigate('/storyteller')}>
            <div className="hp-action-icon hp-action-icon--pink">📖</div>
            <span className="hp-action-label">New Book</span>
          </div>
          <div className="hp-action-card hp-action-card--purple" onClick={() => navigate('/episodes/create')}>
            <div className="hp-action-icon hp-action-icon--purple">📺</div>
            <span className="hp-action-label">New Episode</span>
          </div>
          <div className="hp-action-card hp-action-card--blue" onClick={() => navigate('/continuity')}>
            <div className="hp-action-icon hp-action-icon--blue">🧠</div>
            <span className="hp-action-label">Memory Bank</span>
          </div>
        </section>

        {/* ─── In-Progress Episodes ─── */}
        {(() => {
          const active = episodes.filter(ep =>
            ['in_build', 'in_progress', 'editing', 'draft'].includes(ep.status)
          ).slice(0, 6);
          if (!active.length) return null;
          return (
            <section className="hp-section">
              <div className="hp-section__head">
                <h2 className="hp-section__title"><span className="s-icon">🔥</span> In Progress</h2>
                <button className="hp-section__link" onClick={() => navigate('/episodes')}>All Episodes →</button>
              </div>
              <div className="hp-ep-grid">
                {active.map(ep => (
                  <div key={ep.id} className="hp-ep-card">
                    <div className="hp-ep-head">
                      <div>
                        <div className="hp-ep-num">Episode {ep.episode_number}</div>
                        <div className="hp-ep-title">{ep.title}</div>
                        <div className="hp-ep-show">{ep.show?.name || 'Unknown Show'}</div>
                      </div>
                      <span className={`hp-ep-status hp-ep-status--${epStatusClass(ep.status)}`}>
                        {(ep.status || 'draft').replace('_', ' ')}
                      </span>
                    </div>
                    <div className="hp-ep-progress">
                      <div className="hp-ep-pbar">
                        <div className="hp-ep-pfill" style={{ width: '55%' }} />
                      </div>
                    </div>
                    <div className="hp-ep-meta">Last edited {relTime(ep.updated_at)}</div>
                    <button className="hp-ep-btn" onClick={() => navigate(`/episodes/${ep.id}`)}>
                      Continue Working →
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })()}

        {/* ─── Stats Summary ─── */}
        <section className="hp-stats-row">
          <div className="hp-stat-card">
            <div className="hp-stat-val">{episodes.length}</div>
            <div className="hp-stat-label">Episodes</div>
          </div>
          <div className="hp-stat-card">
            <div className="hp-stat-val">{books.length}</div>
            <div className="hp-stat-label">Books</div>
          </div>
          <div className="hp-stat-card">
            <div className="hp-stat-val">
              {books.reduce((a, b) => a + (b.chapter_count || 0), 0)}
            </div>
            <div className="hp-stat-label">Chapters</div>
          </div>
          <div className="hp-stat-card">
            <div className="hp-stat-val">
              {books.reduce((a, b) => a + (b.approved_count || 0), 0)}
            </div>
            <div className="hp-stat-label">Approved Lines</div>
          </div>
        </section>

      </div>
    </div>
  );
}

export default Home;

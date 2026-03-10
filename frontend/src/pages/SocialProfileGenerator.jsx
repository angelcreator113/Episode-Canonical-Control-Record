/**
 * SocialProfileGenerator.jsx — The Feed
 * Parasocial Creator Profile Generator
 *
 * Architecture: Same as Character Spark — minimum input, maximum output.
 * Three fields: handle, platform, vibe_sentence → full AI-generated profile.
 *
 * Props:
 *   embedded  — boolean, if true suppresses page wrapper (for WorldStudio tab)
 *   worldTag  — optional world filter inherited from WorldStudio
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import FeedBulkImport from '../components/FeedBulkImport';
import './SocialProfileGenerator.css';

const API = '/api/v1/social-profiles';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'youtube',   label: 'YouTube' },
  { value: 'twitter',   label: 'Twitter / X' },
  { value: 'onlyfans',  label: 'OnlyFans' },
  { value: 'twitch',    label: 'Twitch' },
  { value: 'substack',  label: 'Substack' },
  { value: 'multi',     label: 'Multi-Platform' },
];

const ARCHETYPE_LABELS = {
  polished_curator:   'Polished Curator',
  messy_transparent:  'Messy Transparent',
  soft_life:          'Soft Life',
  explicitly_paid:    'Explicitly Paid',
  overnight_rise:     'Overnight Rise',
  cautionary:         'Cautionary',
  the_peer:           'The Peer',
  the_watcher:        'The Watcher',
  chaos_creator:      'Chaos Creator',
  community_builder:  'Community Builder',
};

const STATUS_LABELS = {
  draft:     'Draft',
  generated: 'Generated',
  finalized: 'Finalized',
  crossed:   'Crossed',
  archived:  'Archived',
};

// ── Protagonist Contexts ─────────────────────────────────────────────────────
// Each universe/book protagonist has their own character context for AI generation
const PROTAGONISTS = [
  {
    key: 'justawoman',
    label: 'Book 1 · JustAWoman',
    icon: '◈',
    context: {
      name: 'JustAWoman',
      description: 'A Black woman, mother, wife, content creator in fashion/beauty/lifestyle.',
      wound: 'She does everything right and the right room has not found her yet.',
      goal: 'To be legendary.',
      audience: 'Besties',
      detail: 'She posts for women. Men show up with their wallets and something in her responds.\nShe watches certain creators alone, at night, and does not tell her husband.',
    },
  },
  {
    key: 'lala',
    label: 'Book 2 · Lala',
    icon: '✦',
    context: {
      name: 'Lala',
      description: 'The daughter. Born from JustAWoman\'s world but building her own. Young, sharp, digitally native — she sees patterns her mother can\'t.',
      wound: 'She inherited her mother\'s ambition but not her patience. The algorithm sees her before she sees herself.',
      goal: 'To become something that can\'t be copied.',
      audience: 'The generation that learned to perform before they learned to feel',
      detail: 'She grew up watching her mother watch creators. Now she is one — or becoming one. The line between consuming and creating dissolved before she noticed.',
    },
  },
];

function lalaClass(score) {
  if (score >= 7) return 'high';
  if (score >= 4) return 'mid';
  return 'low';
}

function getToken() {
  return localStorage.getItem('authToken') || localStorage.getItem('token') || sessionStorage.getItem('token');
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }
           : { 'Content-Type': 'application/json' };
}

/* ════════════════════════════════════════════════════════════════════════════ */
export default function SocialProfileGenerator({ embedded = false, worldTag }) {
  // ── State ────────────────────────────────────────────────────────────────
  const [profiles, setProfiles]   = useState([]);
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError]         = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [view, setView]           = useState('feed'); // 'feed' | 'bulk'
  const [protagonist, setProtagonist] = useState(PROTAGONISTS[0]);

  // Pagination
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 24;

  // Search & sort
  const [search, setSearch]       = useState('');
  const [sortBy, setSortBy]       = useState('score');
  const searchTimer = useRef(null);

  // Bulk selection
  const [bulkMode, setBulkMode]   = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Spark form
  const [handle, setHandle]       = useState('');
  const [platform, setPlatform]   = useState('instagram');
  const [vibe, setVibe]           = useState('');

  // Active background job tracking
  const [activeJob, setActiveJob] = useState(null);
  const jobPollRef = useRef(null);

  // ── Load profiles ────────────────────────────────────────────────────────
  const loadProfiles = useCallback(async (targetPage) => {
    setLoading(true);
    try {
      const pg = targetPage || page;
      const qs = new URLSearchParams();
      if (filterStatus) qs.set('status', filterStatus);
      if (search.trim()) qs.set('search', search.trim());
      qs.set('sort', sortBy);
      qs.set('page', pg);
      qs.set('limit', PAGE_SIZE);
      const res = await fetch(`${API}?${qs}`, { headers: authHeaders() });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error (${res.status})`);
      }
      const data = await res.json();
      setProfiles(data.profiles || []);
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages || 1);
        setTotalCount(data.pagination.total || 0);
      }
    } catch (err) {
      console.error('Load profiles error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search, sortBy, page]);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  // ── Background job polling ───────────────────────────────────────────────
  const pollJob = useCallback(async (jobId) => {
    try {
      const res = await fetch(`${API}/bulk/jobs/${jobId}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.job) {
        setActiveJob(data.job);
        if (data.job.status === 'completed' || data.job.status === 'failed') {
          clearInterval(jobPollRef.current);
          jobPollRef.current = null;
          localStorage.removeItem('spg_active_job');
          loadProfiles();
        }
      }
    } catch (err) {
      console.error('Job poll error:', err);
    }
  }, [loadProfiles]);

  // On mount, check for an active job from localStorage
  useEffect(() => {
    const savedJobId = localStorage.getItem('spg_active_job');
    if (savedJobId) {
      pollJob(savedJobId);
      jobPollRef.current = setInterval(() => pollJob(savedJobId), 6000);
    }
    return () => { if (jobPollRef.current) clearInterval(jobPollRef.current); };
  }, [pollJob]);

  const startJobPolling = (jobId) => {
    localStorage.setItem('spg_active_job', jobId);
    pollJob(jobId);
    if (jobPollRef.current) clearInterval(jobPollRef.current);
    jobPollRef.current = setInterval(() => pollJob(jobId), 6000);
  };

  const dismissJob = () => {
    setActiveJob(null);
    localStorage.removeItem('spg_active_job');
    if (jobPollRef.current) { clearInterval(jobPollRef.current); jobPollRef.current = null; }
  };

  // Reset to page 1 when filters change
  const changeFilter = (s) => { setFilterStatus(s); setPage(1); setSelectedIds(new Set()); };
  const changeSort = (s) => { setSortBy(s); setPage(1); };
  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setPage(1), 400);
  };

  // ── Bulk selection helpers ───────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllVisible = () => {
    setSelectedIds(new Set(profiles.map(p => p.id)));
  };
  const clearSelection = () => { setSelectedIds(new Set()); setBulkMode(false); };

  const bulkFinalize = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (!window.confirm(`Finalize ${ids.length} profile(s)?`)) return;
    try {
      const res = await fetch(`${API}/bulk/finalize`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelectedIds(new Set());
      loadProfiles();
    } catch (err) { setError(err.message); }
  };

  const bulkDelete = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (!window.confirm(`Permanently delete ${ids.length} profile(s)? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/bulk/delete`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelectedIds(new Set());
      if (selected && ids.includes(selected.id)) setSelected(null);
      loadProfiles();
    } catch (err) { setError(err.message); }
  };

  // ── Generate ─────────────────────────────────────────────────────────────
  const generateProfile = async () => {
    if (!handle.trim() || !vibe.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${API}/generate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          handle: handle.trim(),
          platform,
          vibe_sentence: vibe.trim(),
          character_context: protagonist.context,
          character_key: protagonist.key,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setSelected(data.profile);
      setHandle('');
      setVibe('');
      setPage(1);
      loadProfiles(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Finalize ─────────────────────────────────────────────────────────────
  const finalizeProfile = async (id) => {
    try {
      const res = await fetch(`${API}/${id}/finalize`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfiles(prev => prev.map(p => p.id === id ? data.profile : p));
      if (selected?.id === id) setSelected(data.profile);
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Cross ────────────────────────────────────────────────────────────────
  const crossProfile = async (id) => {
    try {
      const res = await fetch(`${API}/${id}/cross`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfiles(prev => prev.map(p => p.id === id ? data.profile : p));
      if (selected?.id === id) setSelected(data.profile);
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────
  const editProfile = async (id, updates) => {
    try {
      const res = await fetch(`${API}/${id}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfiles(prev => prev.map(p => p.id === id ? data.profile : p));
      if (selected?.id === id) setSelected(data.profile);
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const deleteProfile = async (id) => {
    if (!window.confirm('Delete this profile permanently?')) return;
    try {
      const res = await fetch(`${API}/${id}`, {
        method: 'DELETE', headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfiles(prev => prev.filter(p => p.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Computed ─────────────────────────────────────────────────────────────
  const stats = {
    total: totalCount,
    generated: profiles.filter(p => p.status === 'generated').length,
    finalized: profiles.filter(p => p.status === 'finalized').length,
    crossed:   profiles.filter(p => p.status === 'crossed').length,
  };

  // ── Get full_profile data (AI output stored as JSONB) ────────────────────
  const fp = (profile) => profile?.full_profile || profile || {};

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className={`spg-page ${embedded ? 'spg-embedded' : ''}`}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="spg-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div className="spg-header-title">📱 The Feed</div>
            <div className="spg-header-sub">
              Parasocial Creator Profiles — {protagonist.context.name}'s online world
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="spg-protagonist-selector">
              {PROTAGONISTS.map(p => (
                <button
                  key={p.key}
                  className={`spg-protagonist-btn ${protagonist.key === p.key ? 'spg-protagonist-btn-active' : ''}`}
                  onClick={() => setProtagonist(p)}
                >
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
            <button
              className="spg-btn"
              style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}
              onClick={() => setView(view === 'feed' ? 'bulk' : 'feed')}
            >
              {view === 'feed' ? '⊞ Bulk Import' : '← Back to Feed'}
            </button>
          </div>
        </div>
        <div className="spg-header-stats">
          <div className="spg-stat">
            <span className="spg-stat-value">{stats.total}</span>
            <span className="spg-stat-label">Profiles</span>
          </div>
          <div className="spg-stat">
            <span className="spg-stat-value">{stats.finalized}</span>
            <span className="spg-stat-label">Finalized</span>
          </div>
          <div className="spg-stat">
            <span className="spg-stat-value">{stats.crossed}</span>
            <span className="spg-stat-label">Crossed</span>
          </div>
        </div>
      </div>

      {/* ── Active Job Banner ──────────────────────────────────── */}
      {activeJob && (
        <div className={`spg-job-banner ${activeJob.status === 'completed' ? 'spg-job-done' : activeJob.status === 'failed' ? 'spg-job-failed' : 'spg-job-active'}`}>
          <div className="spg-job-banner-text">
            {activeJob.status === 'processing' && (
              <>⟳ Generating profiles in background... {activeJob.completed || 0}/{activeJob.total || 0} done{activeJob.failed > 0 && `, ${activeJob.failed} failed`}</>
            )}
            {activeJob.status === 'pending' && (
              <>⟳ Job queued — waiting to start ({activeJob.total} profiles)...</>
            )}
            {activeJob.status === 'completed' && (
              <>✓ Background import complete — {activeJob.completed}/{activeJob.total} profiles generated{activeJob.failed > 0 && `, ${activeJob.failed} failed`}</>
            )}
            {activeJob.status === 'failed' && (
              <>✕ Job failed{activeJob.error_message ? `: ${activeJob.error_message}` : ''}</>
            )}
          </div>
          {(activeJob.status === 'processing' || activeJob.status === 'pending') && (
            <div className="spg-job-progress-bar">
              <div className="spg-job-progress-fill" style={{ width: `${activeJob.total ? ((activeJob.completed || 0) / activeJob.total) * 100 : 0}%` }} />
            </div>
          )}
          {(activeJob.status === 'completed' || activeJob.status === 'failed') && (
            <button className="spg-job-dismiss" onClick={dismissJob}>Dismiss</button>
          )}
        </div>
      )}

      {/* ── Bulk Import View ─────────────────────────────────── */}
      {view === 'bulk' && (
        <FeedBulkImport
          onDone={() => { setView('feed'); setPage(1); loadProfiles(1); }}
          characterContext={protagonist.context}
          characterKey={protagonist.key}
          onJobStarted={(jobId) => { setView('feed'); startJobPolling(jobId); }}
        />
      )}

      {/* ── Spark Form ──────────────────────────────────────────── */}
      {view === 'feed' && <div className="spg-spark-form">
        <div className="spg-spark-title">✦ New Creator Spark</div>
        <div className="spg-spark-row">
          <div className="spg-field">
            <span className="spg-label">Handle</span>
            <input
              className="spg-input"
              placeholder="@username"
              value={handle}
              onChange={e => setHandle(e.target.value)}
              disabled={generating}
            />
          </div>
          <div className="spg-field">
            <span className="spg-label">Platform</span>
            <select
              className="spg-input"
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              disabled={generating}
            >
              {PLATFORMS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="spg-field">
            <span className="spg-label">Vibe</span>
            <input
              className="spg-input"
              placeholder="One sentence — who is this creator?"
              value={vibe}
              onChange={e => setVibe(e.target.value)}
              disabled={generating}
              onKeyDown={e => e.key === 'Enter' && generateProfile()}
            />
          </div>
          <button
            className="spg-btn spg-btn-gold"
            onClick={generateProfile}
            disabled={generating || !handle.trim() || !vibe.trim()}
          >
            {generating ? <><span className="spg-spinner" /> Generating…</> : '✦ Generate'}
          </button>
        </div>
        {error && <div style={{ color: 'var(--red)', marginTop: 8, fontSize: '0.82rem' }}>{error}</div>}
      </div>}

      {/* ── Content ─────────────────────────────────────────────── */}
      {view === 'feed' && <div className="spg-content">
        {/* Toolbar: Filters + Search + Sort + Bulk */}
        <div className="spg-toolbar">
          <div className="spg-filters">
            {[null, 'generated', 'finalized', 'crossed', 'archived'].map(s => (
              <button
                key={s || 'all'}
                className={`spg-filter-btn ${filterStatus === s ? 'spg-filter-btn-active' : ''}`}
                onClick={() => changeFilter(s)}
              >
                {s ? STATUS_LABELS[s] : 'All'}
              </button>
            ))}
          </div>
          <div className="spg-toolbar-right">
            <input
              className="spg-search-input"
              placeholder="Search handle or name…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
            <select className="spg-sort-select" value={sortBy} onChange={e => changeSort(e.target.value)}>
              <option value="score">Score ↓</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="handle">Handle A–Z</option>
            </select>
            <button
              className={`spg-btn spg-btn-sm ${bulkMode ? 'spg-btn-gold' : 'spg-btn-outline'}`}
              onClick={() => { const entering = !bulkMode; setBulkMode(entering); setSelectedIds(new Set()); if (entering) setSelected(null); }}
            >
              {bulkMode ? '✕ Cancel' : '☐ Select'}
            </button>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {bulkMode && (
          <div className="spg-bulk-bar">
            <div className="spg-bulk-bar-left">
              <button className="spg-btn spg-btn-sm spg-btn-outline" onClick={selectAllVisible}>
                Select All ({profiles.length})
              </button>
              {selectedIds.size > 0 && (
                <span className="spg-bulk-count">{selectedIds.size} selected</span>
              )}
            </div>
            <div className="spg-bulk-bar-right">
              <button
                className="spg-btn spg-btn-sm spg-btn-green"
                disabled={selectedIds.size === 0}
                onClick={bulkFinalize}
              >
                ✓ Finalize ({selectedIds.size})
              </button>
              <button
                className="spg-btn spg-btn-sm spg-btn-danger"
                disabled={selectedIds.size === 0}
                onClick={bulkDelete}
              >
                ✕ Delete ({selectedIds.size})
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="spg-loading">
            <span className="spg-spinner" /> Loading profiles…
          </div>
        )}

        {/* Empty */}
        {!loading && profiles.length === 0 && (
          <div className="spg-empty">
            <div className="spg-empty-icon">📱</div>
            <div className="spg-empty-text">{search ? 'No matching creators' : 'No creators yet'}</div>
            <div className="spg-empty-sub">
              {search ? 'Try a different search term' : 'Enter a handle, platform, and vibe above to generate a creator profile'}
            </div>
          </div>
        )}

        {/* Card Grid */}
        {!loading && profiles.length > 0 && (
          <div className="spg-grid">
            {profiles.map(p => {
              const data = fp(p);
              const isChecked = selectedIds.has(p.id);
              return (
                <div
                  key={p.id}
                  className={`spg-card ${selected?.id === p.id ? 'spg-card-active' : ''} ${isChecked ? 'spg-card-checked' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => bulkMode ? toggleSelect(p.id) : setSelected(selected?.id === p.id ? null : p)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { bulkMode ? toggleSelect(p.id) : setSelected(selected?.id === p.id ? null : p); } }}
                >
                  {bulkMode && (
                    <div className="spg-card-checkbox">
                      <span className={`spg-checkbox ${isChecked ? 'spg-checkbox-checked' : ''}`}>
                        {isChecked ? '✓' : ''}
                      </span>
                    </div>
                  )}
                  <div className="spg-card-header">
                    <span className="spg-card-handle">{p.handle}</span>
                    <div className="spg-card-header-right">
                      <span className={`spg-status spg-status-${p.status}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                      <span className="spg-card-platform">{p.platform}</span>
                    </div>
                  </div>
                  {(p.display_name || data.display_name) && (
                    <div className="spg-card-display-name">{p.display_name || data.display_name}</div>
                  )}
                  {(p.archetype || data.archetype) && (
                    <div className="spg-card-archetype">
                      {ARCHETYPE_LABELS[p.archetype || data.archetype] || p.archetype || data.archetype}
                    </div>
                  )}
                  {p.adult_content_present && (
                    <span className="spg-adult-badge">18+</span>
                  )}
                  <div className="spg-card-persona">
                    {p.content_persona || data.content_persona || p.vibe_sentence}
                  </div>
                  <div className="spg-card-footer">
                    <span className="spg-card-followers">
                      {p.follower_count_approx || data.follower_count_approx || '—'}
                    </span>
                    {p.followers && p.followers.length > 0 && (
                      <span className="spg-card-followed-by">
                        {p.followers.map(f => (
                          <span key={f.character_key} className="spg-follower-pill" title={`${f.character_name} follows this profile`}>
                            {f.character_key === 'justawoman' ? '◈' : '✦'}
                          </span>
                        ))}
                      </span>
                    )}
                    <span className={`spg-card-lala-score spg-lala-${lalaClass(p.lala_relevance_score || data.lala_relevance_score || 0)}`}>
                      ✦ {p.lala_relevance_score ?? data.lala_relevance_score ?? 0}/10
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pagination ─────────────────────────────────────── */}
        {!loading && totalPages > 1 && (
          <div className="spg-pagination">
            <button
              className="spg-page-btn"
              disabled={page <= 1}
              onClick={() => setPage(1)}
              title="First page"
            >
              «
            </button>
            <button
              className="spg-page-btn"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              ‹ Prev
            </button>
            <span className="spg-page-info">
              Page {page} of {totalPages}
            </span>
            <button
              className="spg-page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Next ›
            </button>
            <button
              className="spg-page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              title="Last page"
            >
              »
            </button>
          </div>
        )}

        {/* ── Detail Panel ──────────────────────────────────────── */}
        {selected && <DetailPanel
          profile={selected}
          fp={fp(selected)}
          onClose={() => setSelected(null)}
          onFinalize={finalizeProfile}
          onCross={crossProfile}
          onEdit={editProfile}
          onDelete={deleteProfile}
          onRefresh={loadProfiles}
          autoScroll
        />}
      </div>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════ */
/* Detail Panel Sub-component                                                 */
/* ════════════════════════════════════════════════════════════════════════════ */
function DetailPanel({ profile, fp, onClose, onFinalize, onCross, onEdit, onDelete, onRefresh, autoScroll }) {
  const p = profile;
  const d = fp;
  const score = p.lala_relevance_score ?? d.lala_relevance_score ?? 0;
  const cls = lalaClass(score);
  const panelRef = useRef(null);

  useEffect(() => {
    if (autoScroll && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [profile?.id, autoScroll]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [followers, setFollowers] = useState(p.followers || []);
  const [followLoading, setFollowLoading] = useState(null);

  // Refresh followers when profile changes
  useEffect(() => { setFollowers(p.followers || []); }, [profile?.id]);

  const toggleFollow = async (protag) => {
    setFollowLoading(protag.key);
    try {
      const isFollowing = followers.some(f => f.character_key === protag.key);
      if (isFollowing) {
        await fetch(`${API}/${p.id}/followers/${protag.key}`, { method: 'DELETE', headers: authHeaders() });
        setFollowers(prev => prev.filter(f => f.character_key !== protag.key));
      } else {
        const res = await fetch(`${API}/${p.id}/followers`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ character_key: protag.key, character_name: protag.context.name }),
        });
        const data = await res.json();
        if (data.follower) setFollowers(prev => [...prev, data.follower]);
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Follow toggle error:', err);
    } finally {
      setFollowLoading(null);
    }
  };

  const startEdit = () => {
    setDraft({
      handle: p.handle || '',
      display_name: p.display_name || d.display_name || '',
      platform: p.platform || '',
      vibe_sentence: p.vibe_sentence || '',
      content_persona: p.content_persona || d.content_persona || '',
      real_signal: p.real_signal || d.real_signal || '',
      posting_voice: p.posting_voice || d.posting_voice || '',
      comment_energy: p.comment_energy || d.comment_energy || '',
      parasocial_function: p.parasocial_function || d.parasocial_function || '',
      emotional_activation: d.emotional_activation || p.emotional_activation || '',
      watch_reason: d.watch_reason || p.watch_reason || '',
      what_it_costs_her: d.what_it_costs_her || p.what_it_costs_her || '',
      current_trajectory: p.current_trajectory || d.current_trajectory || '',
      trajectory_detail: p.trajectory_detail || d.trajectory_detail || '',
      pinned_post: p.pinned_post || d.pinned_post || '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    await onEdit(p.id, draft);
    setEditing(false);
  };

  const field = (label, key, textarea) => {
    if (!editing) return null;
    return (
      <div style={{ marginBottom: 10 }}>
        <div className="spg-section-label">{label}</div>
        {textarea ? (
          <textarea className="spg-input" rows={3} value={draft[key] || ''} onChange={e => setDraft(prev => ({ ...prev, [key]: e.target.value }))} style={{ width: '100%', resize: 'vertical' }} />
        ) : (
          <input className="spg-input" value={draft[key] || ''} onChange={e => setDraft(prev => ({ ...prev, [key]: e.target.value }))} style={{ width: '100%' }} />
        )}
      </div>
    );
  };

  return (
    <div className="spg-detail" ref={panelRef}>
      <div className="spg-detail-header">
        <button className="spg-detail-close" onClick={onClose}>✕ Close</button>
        <div className="spg-detail-handle">{p.handle}</div>
        <div className="spg-detail-meta">
          <span className="spg-detail-meta-item">{p.display_name || d.display_name}</span>
          <span className="spg-detail-meta-item">{p.platform}</span>
          <span className="spg-detail-meta-item">{p.follower_count_approx || d.follower_count_approx}</span>
          <span className="spg-detail-meta-item">{ARCHETYPE_LABELS[p.archetype || d.archetype] || p.archetype || d.archetype}</span>
          {p.adult_content_present && <span className="spg-adult-badge">18+ Content</span>}
        </div>
        <div className="spg-detail-actions">
          {editing ? (
            <>
              <button className="spg-btn spg-btn-sm spg-btn-green" onClick={saveEdit}>✓ Save</button>
              <button className="spg-btn spg-btn-sm spg-btn-outline" onClick={() => setEditing(false)}>Cancel</button>
            </>
          ) : (
            <>
              {p.status === 'generated' && (
                <button className="spg-btn spg-btn-sm spg-btn-green" onClick={() => onFinalize(p.id)}>
                  ✓ Finalize
                </button>
              )}
              {(p.status === 'finalized') && (
                <button className="spg-btn spg-btn-sm spg-btn-purple" onClick={() => onCross(p.id)}>
                  ⚡ Cross Into World
                </button>
              )}
              {p.status === 'crossed' && (
                <span className="spg-btn spg-btn-sm spg-btn-outline" style={{ cursor: 'default' }}>
                  ✦ Crossed {p.crossed_at ? `on ${new Date(p.crossed_at).toLocaleDateString()}` : ''}
                </span>
              )}
              <button className="spg-btn spg-btn-sm spg-btn-outline" onClick={startEdit}>✎ Edit</button>
              <button className="spg-btn spg-btn-sm" onClick={() => onDelete(p.id)} style={{ color: 'var(--red, #c45858)' }}>✕ Delete</button>
            </>
          )}
        </div>
      </div>

      <div className="spg-detail-body">
        {/* Edit form for core fields */}
        {editing && (
          <div className="spg-section" style={{ marginBottom: 20, padding: 16, background: 'var(--surface-alt, #f4f3f7)', borderRadius: 10 }}>
            <div className="spg-section-title" style={{ marginBottom: 12 }}>Edit Profile</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
              {field('Handle', 'handle')}
              {field('Display Name', 'display_name')}
              {field('Platform', 'platform')}
              {field('Vibe Sentence', 'vibe_sentence')}
            </div>
            {field('Content Persona', 'content_persona', true)}
            {field('Real Signal', 'real_signal', true)}
            {field('Posting Voice', 'posting_voice', true)}
            {field('Comment Energy', 'comment_energy', true)}
            {field('Parasocial Function', 'parasocial_function', true)}
            {field('Emotional Activation', 'emotional_activation', true)}
            {field('Why She Watches', 'watch_reason', true)}
            {field('What It Costs Her', 'what_it_costs_her', true)}
            {field('Trajectory', 'current_trajectory')}
            {field('Trajectory Detail', 'trajectory_detail', true)}
            {field('Pinned Post', 'pinned_post', true)}
          </div>
        )}

        {!editing && <div className="spg-detail-grid">
          {/* Left column */}
          <div>
            <div className="spg-section">
              <div className="spg-section-title">Content Persona</div>
              <div className="spg-section-text">{p.content_persona || d.content_persona}</div>
            </div>

            <div className="spg-section">
              <div className="spg-section-title">Real Signal</div>
              <div className="spg-section-text">{p.real_signal || d.real_signal}</div>
            </div>

            <div className="spg-section">
              <div className="spg-section-title">Posting Voice</div>
              <div className="spg-section-text">{p.posting_voice || d.posting_voice}</div>
            </div>

            <div className="spg-section">
              <div className="spg-section-title">Comment Energy</div>
              <div className="spg-section-text">{p.comment_energy || d.comment_energy}</div>
            </div>

            {p.adult_content_present && (
              <div className="spg-section">
                <div className="spg-section-title">Adult Content</div>
                <div className="spg-section-label">Type</div>
                <div className="spg-section-text">{p.adult_content_type || d.adult_content_type}</div>
                <div className="spg-section-label">Framing</div>
                <div className="spg-section-text">{p.adult_content_framing || d.adult_content_framing}</div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div>
            <div className="spg-section">
              <div className="spg-section-title">Parasocial Function</div>
              <div className="spg-section-text">{p.parasocial_function || d.parasocial_function}</div>
              <div className="spg-section-label">Emotional Activation</div>
              <div className="spg-section-text" style={{ fontStyle: 'italic', color: 'var(--purple-deep)' }}>
                {d.emotional_activation || p.emotional_activation}
              </div>
              <div className="spg-section-label">Why She Watches</div>
              <div className="spg-section-text">{d.watch_reason || p.watch_reason}</div>
              <div className="spg-section-label">What It Costs Her</div>
              <div className="spg-section-text">{d.what_it_costs_her || p.what_it_costs_her}</div>
            </div>

            <div className="spg-section">
              <div className="spg-section-title">Trajectory</div>
              <div className="spg-card-archetype" style={{ marginBottom: 8 }}>
                {p.current_trajectory || d.current_trajectory}
              </div>
              <div className="spg-section-text">{p.trajectory_detail || d.trajectory_detail}</div>
            </div>

            {/* Lala Relevance */}
            <div className="spg-section">
              <div className="spg-section-title">Lala Relevance</div>
              <div className="spg-lala-bar">
                <div className="spg-lala-track">
                  <div
                    className={`spg-lala-fill spg-lala-fill-${cls}`}
                    style={{ width: `${score * 10}%` }}
                  />
                </div>
                <span className={`spg-lala-number spg-lala-${cls}`}>{score}/10</span>
              </div>
              <div className="spg-section-text" style={{ marginTop: 6 }}>
                {p.lala_relevance_reason || d.lala_relevance_reason}
              </div>
            </div>
          </div>
        </div>}

        {/* Followers */}
        <div className="spg-section" style={{ marginTop: 24 }}>
          <div className="spg-section-title">Character Followers</div>
          <div className="spg-follower-row">
            {PROTAGONISTS.map(protag => {
              const isFollowing = followers.some(f => f.character_key === protag.key);
              const isLoading = followLoading === protag.key;
              return (
                <button
                  key={protag.key}
                  className={`spg-follow-btn ${isFollowing ? 'spg-follow-btn-active' : ''}`}
                  onClick={() => toggleFollow(protag)}
                  disabled={isLoading}
                >
                  <span className="spg-follow-icon">{protag.icon}</span>
                  <span>{isLoading ? '...' : isFollowing ? `${protag.context.name} follows` : `Add ${protag.context.name}`}</span>
                </button>
              );
            })}
          </div>
          {followers.length > 0 && (
            <div className="spg-follower-details">
              {followers.map(f => (
                <div key={f.character_key} className="spg-follower-detail-item">
                  <span className="spg-follower-detail-name">
                    {f.character_key === 'justawoman' ? '◈' : '✦'} {f.character_name}
                  </span>
                  {f.influence_type && <span className="spg-follower-detail-tag">{f.influence_type}</span>}
                  {f.influence_level && <span className="spg-follower-detail-level">Influence: {f.influence_level}/10</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pinned Post */}
        {(p.pinned_post || d.pinned_post) && (
          <div className="spg-section" style={{ marginTop: 24 }}>
            <div className="spg-section-title">Pinned Post</div>
            <div className="spg-pinned">
              <span className="spg-pinned-label">📌 Pinned</span>
              <div className="spg-pinned-text">{p.pinned_post || d.pinned_post}</div>
            </div>
          </div>
        )}

        {/* Sample Captions */}
        {((p.sample_captions || d.sample_captions) || []).length > 0 && (
          <div className="spg-section" style={{ marginTop: 24 }}>
            <div className="spg-section-title">Sample Captions</div>
            <div className="spg-samples">
              {(p.sample_captions || d.sample_captions || []).map((c, i) => (
                <div key={i} className="spg-sample">{c}</div>
              ))}
            </div>
          </div>
        )}

        {/* Sample Comments */}
        {((p.sample_comments || d.sample_comments) || []).length > 0 && (
          <div className="spg-section" style={{ marginTop: 16 }}>
            <div className="spg-section-title">Sample Comments</div>
            <div className="spg-samples">
              {(p.sample_comments || d.sample_comments || []).map((c, i) => (
                <div key={i} className="spg-sample" style={{ borderLeftColor: 'var(--purple)' }}>{c}</div>
              ))}
            </div>
          </div>
        )}

        {/* Moment Log */}
        {((p.moment_log || d.moment_log) || []).length > 0 && (
          <div className="spg-section" style={{ marginTop: 24 }}>
            <div className="spg-section-title">Moment Log</div>
            <div className="spg-moments">
              {(p.moment_log || d.moment_log || []).map((m, i) => (
                <div key={i} className="spg-moment">
                  <div className="spg-moment-type">
                    {m.moment_type} · {m.platform_format}
                  </div>
                  <div className="spg-moment-text">{m.description}</div>
                  <div className="spg-moment-reaction">{m.justawoman_reaction}</div>
                  {m.lala_seed && (
                    <span className="spg-moment-seed">✦ Lala Seed — {m.lala_seed_reason}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Book Relevance */}
        {((p.book_relevance || d.book_relevance) || []).length > 0 && (
          <div className="spg-section" style={{ marginTop: 24 }}>
            <div className="spg-section-title">Book Relevance</div>
            <div className="spg-samples">
              {(p.book_relevance || d.book_relevance || []).map((b, i) => (
                <div key={i} className="spg-sample" style={{ borderLeftColor: 'var(--cyan)' }}>{b}</div>
              ))}
            </div>
          </div>
        )}

        {/* Crossing Pathway */}
        {(p.crossing_trigger || d.crossing_trigger) && (
          <div className="spg-section" style={{ marginTop: 24 }}>
            <div className="spg-section-title">World Crossing</div>
            <div className="spg-crossing">
              <div className="spg-crossing-title">Crossing Trigger</div>
              <div className="spg-section-text">{p.crossing_trigger || d.crossing_trigger}</div>
              <div className="spg-crossing-title" style={{ marginTop: 12 }}>Mechanism</div>
              <div className="spg-section-text">{p.crossing_mechanism || d.crossing_mechanism}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

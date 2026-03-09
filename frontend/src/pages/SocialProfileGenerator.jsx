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

import React, { useState, useEffect, useCallback } from 'react';
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

  // Spark form
  const [handle, setHandle]       = useState('');
  const [platform, setPlatform]   = useState('instagram');
  const [vibe, setVibe]           = useState('');

  // ── Load profiles ────────────────────────────────────────────────────────
  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterStatus) qs.set('status', filterStatus);
      const res = await fetch(`${API}?${qs}`, { headers: authHeaders() });
      const data = await res.json();
      setProfiles(data.profiles || []);
    } catch (err) {
      console.error('Load profiles error:', err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setProfiles(prev => [data.profile, ...prev]);
      setSelected(data.profile);
      setHandle('');
      setVibe('');
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
    total: profiles.length,
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="spg-header-title">📱 The Feed</div>
            <div className="spg-header-sub">
              Parasocial Creator Profiles — The online world JustAWoman moves through
            </div>
          </div>
          <button
            className="spg-btn"
            style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}
            onClick={() => setView(view === 'feed' ? 'bulk' : 'feed')}
          >
            {view === 'feed' ? '⊞ Bulk Import' : '← Back to Feed'}
          </button>
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

      {/* ── Bulk Import View ─────────────────────────────────── */}
      {view === 'bulk' && (
        <FeedBulkImport onDone={() => { setView('feed'); loadProfiles(); }} />
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
        {/* Filters */}
        <div className="spg-filters" style={{ marginBottom: 4 }}>
          {[null, 'generated', 'finalized', 'crossed', 'archived'].map(s => (
            <button
              key={s || 'all'}
              className={`spg-filter-btn ${filterStatus === s ? 'spg-filter-btn-active' : ''}`}
              onClick={() => setFilterStatus(s)}
            >
              {s ? STATUS_LABELS[s] : 'All'}
            </button>
          ))}
        </div>

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
            <div className="spg-empty-text">No creators yet</div>
            <div className="spg-empty-sub">
              Enter a handle, platform, and vibe above to generate a creator profile
            </div>
          </div>
        )}

        {/* Card Grid */}
        {!loading && profiles.length > 0 && (
          <div className="spg-grid">
            {profiles.map(p => {
              const data = fp(p);
              return (
                <div
                  key={p.id}
                  className={`spg-card ${selected?.id === p.id ? 'spg-card-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(selected?.id === p.id ? null : p)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelected(selected?.id === p.id ? null : p); }}
                >
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
                    <span className={`spg-card-lala-score spg-lala-${lalaClass(p.lala_relevance_score || data.lala_relevance_score || 0)}`}>
                      ✦ {p.lala_relevance_score ?? data.lala_relevance_score ?? 0}/10
                    </span>
                  </div>
                </div>
              );
            })}
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
        />}
      </div>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════ */
/* Detail Panel Sub-component                                                 */
/* ════════════════════════════════════════════════════════════════════════════ */
function DetailPanel({ profile, fp, onClose, onFinalize, onCross, onEdit, onDelete }) {
  const p = profile;
  const d = fp;
  const score = p.lala_relevance_score ?? d.lala_relevance_score ?? 0;
  const cls = lalaClass(score);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});

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
    <div className="spg-detail">
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

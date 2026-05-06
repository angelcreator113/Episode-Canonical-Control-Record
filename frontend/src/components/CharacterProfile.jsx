import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../config/api';
import apiClient from '../services/api';
import './CharacterProfile.css';

// File-local cross-CP duplicates of CP9 helpers per v2.12 §9.11
// (CharacterProfilePage uses same endpoints).
export const getCharacterApi = (id) =>
  apiClient.get(`${API_URL}/character-registry/characters/${id}`).then((r) => r.data);
export const getCharacterRelationshipsApi = (id) =>
  apiClient
    .get(`${API_URL}/character-registry/characters/${id}/relationships`)
    .then((r) => r.data);
export const getSocialProfileApi = (profileId) =>
  apiClient.get(`${API_URL}/social-profiles/${profileId}`).then((r) => r.data);

const DEPTH_CONFIG = {
  sparked:   { label: 'Sparked',   color: '#e8c4a0', bg: '#fdf6ee', dot: '#d4a574' },
  breathing: { label: 'Breathing', color: '#a8c4a0', bg: '#f0f7ee', dot: '#6a9e60' },
  active:    { label: 'Active',    color: '#7ab3d4', bg: '#eef5fb', dot: '#4a8fb5' },
  alive:     { label: 'Alive',     color: '#a889c8', bg: '#f5f0fb', dot: '#8055b8' },
};

const STATE_CONFIG = {
  rising:        { label: 'Rising',        color: '#6a9e60', bg: '#f0f7ee' },
  peaking:       { label: 'Peaking',       color: '#d4789a', bg: '#fdf0f4' },
  plateauing:    { label: 'Plateauing',    color: '#d4a574', bg: '#fdf6ee' },
  declining:     { label: 'Declining',     color: '#a889c8', bg: '#f5f0fb' },
  controversial: { label: 'Controversial', color: '#d47a3a', bg: '#fdf3ee' },
  cancelled:     { label: 'Cancelled',     color: '#c44',    bg: '#fdf0f0' },
  comeback:      { label: 'Comeback',      color: '#7ab3d4', bg: '#eef5fb' },
  gone_dark:     { label: 'Gone Dark',     color: '#888',    bg: '#f5f5f5' },
};

const TABS = [
  { id: 'overview',      label: 'Overview' },
  { id: 'interior',      label: 'Interior' },
  { id: 'connections',   label: 'Connections' },
  { id: 'online',        label: 'Online' },
  { id: 'world',         label: 'World' },
  { id: 'deep_profile',  label: 'Deep Profile' },
];

// ─── Depth Pill ──────────────────────────────────────────────────────────────
function DepthPill({ level }) {
  const cfg = DEPTH_CONFIG[level] || DEPTH_CONFIG.sparked;
  return (
    <span className="depth-pill" style={{ background: cfg.bg, color: cfg.color }}>
      <span className="depth-dot" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function EmptyState({ label, onGenerate }) {
  return (
    <div className="empty-state">
      <p className="empty-label">{label}</p>
      {onGenerate && (
        <button className="btn-generate" onClick={onGenerate}>
          + Generate
        </button>
      )}
    </div>
  );
}

// ─── Tab: Overview ───────────────────────────────────────────────────────────
function TabOverview({ character }) {
  const prose = character.prose_overview;
  const arc   = character.current_arc || character.arc_summary;
  return (
    <div className="tab-content">
      <section className="content-section">
        <h3 className="section-title">Prose Overview</h3>
        {prose
          ? <p className="prose-overview">{prose}</p>
          : <EmptyState label="No prose overview yet. Generate one from the character spark." />
        }
      </section>

      {arc && (
        <section className="content-section">
          <h3 className="section-title">Current Arc</h3>
          <p className="arc-text">{arc}</p>
        </section>
      )}

      <section className="content-section meta-grid">
        <div className="meta-item">
          <span className="meta-label">Role</span>
          <span className="meta-value">{character.role_type || '—'}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Appearance</span>
          <span className="meta-value">{character.appearance_mode || '—'}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">World</span>
          <span className="meta-value">{character.world_exists ? 'Canon' : 'Interior'}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Series</span>
          <span className="meta-value">{character.series_id || '—'}</span>
        </div>
      </section>
    </div>
  );
}

// ─── Tab: Interior ──────────────────────────────────────────────────────────
function TabInterior({ character }) {
  const want    = character.want_architecture;
  const wound   = character.wound;
  const mask    = character.the_mask;
  const dilemma = character.dilemma;
  return (
    <div className="tab-content">
      {/* Want Architecture */}
      <section className="content-section">
        <h3 className="section-title">Want Architecture</h3>
        {want ? (
          <div className="want-stack">
            <div className="want-tier surface">
              <span className="want-label">Surface</span>
              <p>{want.surface_want}</p>
            </div>
            <div className="want-tier real">
              <span className="want-label">Real</span>
              <p>{want.real_want}</p>
            </div>
            <div className="want-tier forbidden">
              <span className="want-label">Forbidden</span>
              <p>{want.forbidden_want}</p>
            </div>
          </div>
        ) : <EmptyState label="Want architecture not generated yet." />}
      </section>

      {/* Wound */}
      <section className="content-section">
        <h3 className="section-title">Wound</h3>
        {wound ? (
          <div className="wound-block">
            <p className="wound-description">{wound.description}</p>
            {wound.origin_period && (
              <p className="wound-meta">Origin: {wound.origin_period}</p>
            )}
            {wound.downstream_effects && (
              <p className="wound-effects">{wound.downstream_effects}</p>
            )}
            {wound.deep_profile_dimensions_affected?.length > 0 && (
              <div className="dimension-tags">
                {wound.deep_profile_dimensions_affected.map(d => (
                  <span key={d} className="dim-tag">{d.replace(/_/g, ' ')}</span>
                ))}
              </div>
            )}
          </div>
        ) : <EmptyState label="Wound not defined yet." />}
      </section>

      {/* The Mask */}
      <section className="content-section">
        <h3 className="section-title">The Mask</h3>
        {mask ? (
          <div className="mask-block">
            <p>{mask.description}</p>
            {mask.divergence_map?.length > 0 && (
              <div className="divergence-list">
                <span className="meta-label">Divergences</span>
                {mask.divergence_map.map((d, i) => (
                  <p key={i} className="divergence-item">&middot; {d}</p>
                ))}
              </div>
            )}
          </div>
        ) : <EmptyState label="Mask not defined yet." />}
      </section>

      {/* Dilemma */}
      <section className="content-section">
        <h3 className="section-title">Central Dilemma</h3>
        {dilemma ? (
          <div className="dilemma-block">
            <p className="dilemma-tension">{dilemma.central_tension}</p>
            <div className="dilemma-options">
              <div className="dilemma-option">
                <span className="option-label">A</span>
                <p>{dilemma.option_a}</p>
              </div>
              <div className="dilemma-vs">vs</div>
              <div className="dilemma-option">
                <span className="option-label">B</span>
                <p>{dilemma.option_b}</p>
              </div>
            </div>
            <p className="dilemma-cost">Either way: {dilemma.what_both_cost}</p>
          </div>
        ) : <EmptyState label="Dilemma not generated yet." />}
      </section>

      {/* Blind Spot — author-only */}
      {character.blind_spot && (
        <section className="content-section author-only">
          <h3 className="section-title">
            Blind Spot
            <span className="author-badge">Author only</span>
          </h3>
          <p className="blind-spot-text">{character.blind_spot}</p>
        </section>
      )}

      {/* Additional interior fields */}
      {(character.self_narrative || character.operative_cosmology ||
        character.foreclosed_possibility || character.experience_of_joy) && (
        <section className="content-section">
          <h3 className="section-title">Interior Architecture</h3>
          <div className="interior-grid">
            {[
              { label: 'Self-Narrative',          value: character.self_narrative },
              { label: 'Operative Cosmology',     value: character.operative_cosmology },
              { label: 'Foreclosed Possibility',  value: character.foreclosed_possibility },
              { label: 'Experience of Joy',       value: character.experience_of_joy },
            ].filter(f => f.value).map(f => (
              <div key={f.label} className="interior-field">
                <span className="meta-label">{f.label}</span>
                <p>{f.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Tab: Connections ────────────────────────────────────────────────────────
function TabConnections({ character, relationships }) {
  if (!relationships?.length) {
    return (
      <div className="tab-content">
        <EmptyState label="No relationships defined yet." />
      </div>
    );
  }
  return (
    <div className="tab-content">
      <section className="content-section">
        <h3 className="section-title">{relationships.length} Relationships</h3>
        <div className="relationships-list">
          {relationships.map((r, i) => (
            <div key={i} className="relationship-row">
              <div className="rel-avatar">
                {(r.related_name || r.name || '?')[0].toUpperCase()}
              </div>
              <div className="rel-info">
                <span className="rel-name">{r.related_name || r.name}</span>
                <span className="rel-type">{r.relationship_type || r.type}</span>
              </div>
              <div className="rel-meta">
                {r.tension_state && (
                  <span className={`tension-badge tension-${r.tension_state}`}>
                    {r.tension_state}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Belonging Map */}
      {character.belonging_map && (
        <section className="content-section">
          <h3 className="section-title">Belonging Map</h3>
          {character.belonging_map.belongs_to?.length > 0 && (
            <div className="belonging-group">
              <span className="meta-label">Belongs To</span>
              {character.belonging_map.belongs_to.map((g, i) => (
                <div key={i} className="belonging-item">
                  <span className="belonging-name">{g.name}</span>
                  <span className="belonging-type">{g.type}</span>
                </div>
              ))}
            </div>
          )}
          {character.belonging_map.excluded_from?.length > 0 && (
            <div className="belonging-group excluded">
              <span className="meta-label">Excluded From</span>
              {character.belonging_map.excluded_from.map((g, i) => (
                <div key={i} className="belonging-item">
                  <span className="belonging-name">{g.name}</span>
                  <p className="belonging-why">{g.why}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ─── Tab: Online ─────────────────────────────────────────────────────────────
function TabOnline({ character, feedProfile }) {
  const hasFeed  = !!feedProfile || character.social_presence;
  const stateCfg = feedProfile?.current_state
    ? STATE_CONFIG[feedProfile.current_state] || STATE_CONFIG.rising
    : null;

  return (
    <div className="tab-content">
      {!hasFeed ? (
        <EmptyState label="This character has no social media presence." />
      ) : (
        <>
          {feedProfile && (
            <section className="content-section feed-profile-section">
              <div className="feed-profile-header">
                <div className="feed-avatar">
                  {(feedProfile.handle || feedProfile.display_name || '?')[0].toUpperCase()}
                </div>
                <div className="feed-identity">
                  <span className="feed-handle">@{feedProfile.handle}</span>
                  <span className="feed-display">{feedProfile.display_name}</span>
                  <span className="feed-platform">{feedProfile.platform}</span>
                </div>
                {stateCfg && (
                  <span
                    className="state-badge"
                    style={{ background: stateCfg.bg, color: stateCfg.color }}
                  >
                    {stateCfg.label}
                  </span>
                )}
              </div>

              {feedProfile.bio && (
                <p className="feed-bio">&ldquo;{feedProfile.bio}&rdquo;</p>
              )}

              {feedProfile.vibe_tags?.length > 0 && (
                <div className="vibe-tags">
                  {feedProfile.vibe_tags.map(t => (
                    <span key={t} className="vibe-tag">{t}</span>
                  ))}
                </div>
              )}

              <div className="feed-stats">
                <div className="feed-stat">
                  <span className="stat-num">
                    {feedProfile.follower_count?.toLocaleString() || '—'}
                  </span>
                  <span className="stat-label">followers</span>
                </div>
                <div className="feed-stat">
                  <span className="stat-num">{feedProfile.post_count || '—'}</span>
                  <span className="stat-label">posts</span>
                </div>
              </div>
            </section>
          )}

          {/* Gap from Deep Profile */}
          {feedProfile?.gap_from_deep_profile && (
            <section className="content-section author-only">
              <h3 className="section-title">
                Persona Gap
                <span className="author-badge">Author only</span>
              </h3>
              <p className="gap-text">{feedProfile.gap_from_deep_profile}</p>
            </section>
          )}

          {/* The Mask connection */}
          {character.the_mask?.feed_profile_is_mask && (
            <section className="content-section">
              <h3 className="section-title">Mask Status</h3>
              <p className="mask-note">
                This character&rsquo;s Feed profile IS their mask. The gap between
                who they perform online and who they actually are is the story.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab: World ─────────────────────────────────────────────────────────────
function TabWorld({ character }) {
  const living = character.living_state || character.living_context;
  return (
    <div className="tab-content">
      <section className="content-section">
        <h3 className="section-title">Living State</h3>
        {living ? (
          <div className="living-grid">
            {living.current_situation && (
              <div className="living-field">
                <span className="meta-label">Current Situation</span>
                <p>{living.current_situation}</p>
              </div>
            )}
            {living.active_tension && (
              <div className="living-field">
                <span className="meta-label">Active Tension</span>
                <p>{living.active_tension}</p>
              </div>
            )}
            {living.momentum && (
              <div className="living-field">
                <span className="meta-label">Momentum</span>
                <p>{living.momentum}</p>
              </div>
            )}
          </div>
        ) : <EmptyState label="Living state not generated yet." />}
      </section>

      {/* Time Orientation */}
      {character.time_orientation && (
        <section className="content-section">
          <h3 className="section-title">Time Orientation</h3>
          <span className="time-badge">
            {character.time_orientation.replace(/_/g, ' ')}
          </span>
        </section>
      )}

      {/* Ghost Characters */}
      {character.ghost_characters?.length > 0 && (
        <section className="content-section">
          <h3 className="section-title">
            Ghost Characters
            <span className="ghost-count">{character.ghost_characters.length}</span>
          </h3>
          <p className="ghost-note">
            Characters mentioned in this character&rsquo;s story who haven&rsquo;t been built yet.
          </p>
          <div className="ghost-list">
            {character.ghost_characters.map((g, i) => (
              <div key={i} className={`ghost-item ${g.promoted ? 'promoted' : ''}`}>
                <span className="ghost-name">{g.name}</span>
                <span className="ghost-relation">{g.relation}</span>
                {!g.promoted && (
                  <button className="btn-promote">Promote</button>
                )}
                {g.promoted && <span className="promoted-badge">&uarr; In Registry</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Family Tree */}
      {character.family_tree && (
        <section className="content-section">
          <h3 className="section-title">Family</h3>
          {character.family_tree.generational_wound && (
            <p className="generational-wound">
              Generational wound: {character.family_tree.generational_wound}
            </p>
          )}
          {character.family_tree.members?.length > 0 && (
            <div className="family-list">
              {character.family_tree.members.map((m, i) => (
                <div key={i} className="family-member">
                  <span className="member-name">{m.name}</span>
                  <span className="member-relation">{m.relation}</span>
                  {m.personality_sketch && (
                    <p className="member-sketch">{m.personality_sketch}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ─── Tab: Deep Profile ───────────────────────────────────────────────────────
const DIMENSION_ICONS = {
  life_stage:           '\u23F3',
  the_body:             '\u270F\uFE0F',
  class_money:          '\uD83D\uDD25',
  religion_meaning:     '\u2726',
  race_culture:         '\uD83C\uDF0D',
  sexuality_desire:     '\uD83D\uDD25',
  family_architecture:  '\uD83C\uDFE0',
  friendship_loyalty:   '\uD83D\uDC9B',
  ambition_identity:    '\uD83C\uDFAF',
  habits_rituals:       '\uD83C\uDF11',
  speech_silence:       '\uD83D\uDCAD',
  grief_loss:           '\uD83C\uDF0A',
  politics_justice:     '\u2696\uFE0F',
  the_unseen:           '\uD83D\uDD2E',
};

function TabDeepProfile({ character }) {
  const dp = character.deep_profile;
  const [open, setOpen] = useState(null);

  if (!dp || Object.keys(dp).length === 0) {
    return (
      <div className="tab-content">
        <EmptyState label="Deep Profile not generated yet." />
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="deep-profile-list">
        {Object.entries(dp).map(([key, value]) => {
          if (!value) return null;
          const label  = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const icon   = DIMENSION_ICONS[key] || '\u00B7';
          const isOpen = open === key;
          return (
            <div
              key={key}
              className={`dp-row ${isOpen ? 'open' : ''}`}
              onClick={() => setOpen(isOpen ? null : key)}
            >
              <div className="dp-row-header">
                <span className="dp-icon">{icon}</span>
                <span className="dp-label">{label}</span>
                <span className="dp-chevron">{isOpen ? '\u2191' : '\u2193'}</span>
              </div>
              {isOpen && <p className="dp-content">{value}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function CharacterProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [character, setCharacter]       = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [feedProfile, setFeedProfile]   = useState(null);
  const [activeTab, setActiveTab]       = useState('overview');
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [charData, relData] = await Promise.all([
        getCharacterApi(id),
        getCharacterRelationshipsApi(id).catch(() => null),
      ]);

      const char = charData.character || charData;
      setCharacter(char);

      if (relData) {
        setRelationships(relData.relationships || relData || []);
      }

      // Load feed profile if linked
      if (char.feed_profile_id) {
        const feedData = await getSocialProfileApi(char.feed_profile_id).catch(() => null);
        if (feedData) {
          setFeedProfile(feedData.profile || feedData);
        }
      }
    } catch (err) {
      setError(err.message || 'Character not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="profile-loading">
      <div className="loading-pulse" />
    </div>
  );

  if (error || !character) return (
    <div className="profile-error">
      <p>{error || 'Character not found'}</p>
      <button onClick={() => navigate(-1)}>&larr; Back</button>
    </div>
  );

  const depth    = character.depth_level || 'sparked';
  const initials = (character.selected_name || character.name || '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="character-profile">
      {/* ── Left Sidebar ── */}
      <aside className="profile-sidebar">
        <button className="back-btn" onClick={() => navigate(-1)}>
          &larr; Registry
        </button>

        <div className="sidebar-avatar">{initials}</div>
        <h2 className="sidebar-name">{character.selected_name || character.name}</h2>
        <p className="sidebar-role">{character.role_type || 'character'}</p>
        <DepthPill level={depth} />

        <div className="sidebar-actions">
          <button
            className="btn-deepen"
            onClick={() => navigate('/world-studio')}
          >
            &uarr; Deepen
          </button>
          {character.feed_profile_id && (
            <button className="btn-view-feed" onClick={() => setActiveTab('online')}>
              Online
            </button>
          )}
          <button className="btn-export" onClick={() => {}}>
            Export
          </button>
        </div>

        {/* Ghost characters indicator */}
        {character.ghost_characters?.filter(g => !g.promoted).length > 0 && (
          <div className="ghost-indicator" onClick={() => setActiveTab('world')}>
            <span className="ghost-num">
              {character.ghost_characters.filter(g => !g.promoted).length}
            </span>
            ghost characters waiting
          </div>
        )}

        {/* Change capacity */}
        {character.change_capacity?.mobility && (
          <div className="sidebar-meta-item">
            <span className="meta-label">Mobility</span>
            <span className="mobility-badge">{character.change_capacity.mobility}</span>
          </div>
        )}

        {/* Time orientation */}
        {character.time_orientation && (
          <div className="sidebar-meta-item">
            <span className="meta-label">Time</span>
            <span className="time-badge-sm">
              {character.time_orientation.replace(/_/g, ' ')}
            </span>
          </div>
        )}
      </aside>

      {/* ── Main Panel ── */}
      <main className="profile-main">
        {/* Tab Bar */}
        <nav className="tab-bar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.id === 'online' && character.feed_profile_id && (
                <span className="tab-dot" />
              )}
            </button>
          ))}
        </nav>

        {/* Tab Content — all render inline, no navigation */}
        <div className="tab-panel">
          {activeTab === 'overview'     && <TabOverview character={character} />}
          {activeTab === 'interior'     && <TabInterior character={character} />}
          {activeTab === 'connections'   && <TabConnections character={character} relationships={relationships} />}
          {activeTab === 'online'       && <TabOnline character={character} feedProfile={feedProfile} />}
          {activeTab === 'world'        && <TabWorld character={character} />}
          {activeTab === 'deep_profile' && <TabDeepProfile character={character} />}
        </div>
      </main>
    </div>
  );
}

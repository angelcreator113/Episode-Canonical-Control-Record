/**
 * CharacterProfilePage.jsx — Character Profile Redesign
 *
 * Route: /character/:id
 * 6-tab editorial layout with fixed sidebar + inline tab content.
 * Reads depth_level instead of status for progression.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../config/api';
import CharacterDepthPanel from '../components/CharacterDepthPanel';
import apiClient from '../services/api';
import './CharacterProfilePage.css';

// ─── Track 6 CP9 module-scope helpers (Pattern F prophylactic — Api suffix) ───
// 5 helpers covering 5 fetch sites across /character-registry, /entanglements,
// and /social-profiles. File-local per Track 6 convention.
export const updateCharacterApi = (id, payload) =>
  apiClient.put(`${API_URL}/character-registry/characters/${id}`, payload);
export const getCharacterApi = (id) =>
  apiClient.get(`${API_URL}/character-registry/characters/${id}`);
export const getCharacterRelationshipsApi = (id) =>
  apiClient.get(`${API_URL}/character-registry/characters/${id}/relationships`);
export const getCharacterEntanglementsApi = (id) =>
  apiClient.get(`${API_URL}/entanglements/character/${id}`);
export const getSocialProfileApi = (profileId) =>
  apiClient.get(`${API_URL}/social-profiles/${profileId}`);

/* ── Config ──────────────────────────────────────────────────────────────────── */

const DEPTH_CONFIG = {
  sparked:   { label: 'Sparked',   color: '#888',    bg: '#f5f5f5',  dot: '#aaa' },
  breathing: { label: 'Breathing', color: '#7ab3d4', bg: '#eef5fb',  dot: '#4a8fb5' },
  active:    { label: 'Active',    color: '#a889c8', bg: '#f5f0fb',  dot: '#8055b8' },
  alive:     { label: 'Alive',     color: '#d4789a', bg: '#fdf0f4',  dot: '#c0527a' },
};

const STATE_CONFIG = {
  rising:        { label: 'Rising',        color: '#6a9e60', bg: '#f0f7ee' },
  peaking:       { label: 'Peaking',       color: '#c9a84c', bg: '#fdf6ee' },
  plateauing:    { label: 'Plateauing',    color: '#888',    bg: '#f5f5f5' },
  controversial: { label: 'Controversial', color: '#d47a3a', bg: '#fdf3ee' },
  cancelled:     { label: 'Cancelled',     color: '#c44',    bg: '#fdf0f0' },
  gone_dark:     { label: 'Gone Dark',     color: '#555',    bg: '#eee' },
  rebuilding:    { label: 'Rebuilding',    color: '#7ab3d4', bg: '#eef5fb' },
  crossed:       { label: 'Crossed',       color: '#d4789a', bg: '#fdf0f4' },
};

const TABS = [
  { id: 'overview',     label: 'Overview' },
  { id: 'interior',     label: 'Interior' },
  { id: 'depth',        label: 'DEPTH' },
  { id: 'connections',  label: 'Connections' },
  { id: 'online',       label: 'Online' },
  { id: 'world',        label: 'World' },
  { id: 'deep_profile', label: 'Deep Profile' },
];

const DIMENSION_KEYS = [
  'life_stage', 'the_body', 'class_money', 'religion_meaning',
  'race_culture', 'sexuality_desire', 'family_architecture', 'friendship_loyalty',
  'ambition_identity', 'habits_rituals', 'speech_silence', 'grief_loss',
  'politics_justice', 'the_unseen',
];

const DIMENSION_ICONS = {
  life_stage:          '\u23F3',
  the_body:            '\u270F\uFE0F',
  class_money:         '\uD83D\uDD25',
  religion_meaning:    '\u2726',
  race_culture:        '\uD83C\uDF0D',
  sexuality_desire:    '\uD83D\uDD25',
  family_architecture: '\uD83C\uDFE0',
  friendship_loyalty:  '\uD83D\uDC9B',
  ambition_identity:   '\uD83C\uDFAF',
  habits_rituals:      '\uD83C\uDF11',
  speech_silence:      '\uD83D\uDCAD',
  grief_loss:          '\uD83C\uDF0A',
  politics_justice:    '\u2696\uFE0F',
  the_unseen:          '\uD83D\uDD2E',
};

/* ── Depth Pill ──────────────────────────────────────────────────────────────── */

function DepthPill({ level }) {
  const cfg = DEPTH_CONFIG[level] || DEPTH_CONFIG.sparked;
  return (
    <span className="cp-depth-pill" style={{ background: cfg.bg, color: cfg.color }}>
      <span className="cp-depth-dot" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

/* ── Empty State ─────────────────────────────────────────────────────────────── */

function EmptyState({ label }) {
  return (
    <div className="cp-empty-state">
      <p className="cp-empty-label">{label}</p>
      <span className="cp-empty-generate">Generate</span>
    </div>
  );
}

/* ── Tab 1: Overview ─────────────────────────────────────────────────────────── */

function TabOverview({ character }) {
  const prose = character.prose_overview;
  const arc   = character.current_arc || character.arc_summary;
  const gen   = character.generation_context;

  return (
    <div className="cp-tab-content">
      {/* Prose overview — hero */}
      <section className="cp-section">
        <h3 className="cp-section-title">Prose Overview</h3>
        {prose
          ? <p className="cp-prose-overview">{prose}</p>
          : <EmptyState label="No prose overview yet. Generate one from the character spark." />}
      </section>

      {/* Current arc */}
      {arc && (
        <section className="cp-section">
          <h3 className="cp-section-title">Current Arc</h3>
          <p className="cp-arc-text">{arc}</p>
        </section>
      )}

      {/* Meta grid */}
      <section className="cp-section cp-meta-grid">
        <div className="cp-meta-item">
          <span className="cp-meta-label">Role</span>
          <span className="cp-meta-value">{character.role_type || '\u2014'}</span>
        </div>
        <div className="cp-meta-item">
          <span className="cp-meta-label">Appearance</span>
          <span className="cp-meta-value">{character.appearance_mode || '\u2014'}</span>
        </div>
        <div className="cp-meta-item">
          <span className="cp-meta-label">World</span>
          <select
            className="cp-meta-select"
            value={character.world || 'book-1'}
            onChange={async (e) => {
              const newWorld = e.target.value;
              try {
                await updateCharacterApi(character.id, { world: newWorld });
                setCharacter(prev => ({ ...prev, world: newWorld }));
              } catch (err) { console.error('Failed to update world:', err); }
            }}
            disabled={character.status === 'finalized'}
            style={{ fontSize: 13, padding: '2px 6px', border: '1px solid var(--cp-border, #333)', borderRadius: 4, background: 'var(--cp-surface, #1a1a1a)', color: 'var(--cp-text, #e0e0e0)' }}
          >
            <option value="book-1">Book 1 — JustAWoman's World</option>
            <option value="lalaverse">LalaVerse</option>
            <option value="series-2">Series 2</option>
          </select>
        </div>
        <div className="cp-meta-item">
          <span className="cp-meta-label">Series</span>
          <span className="cp-meta-value">{character.series_id || '\u2014'}</span>
        </div>
      </section>

      {/* Generation context */}
      {gen && (
        <section className="cp-section">
          <h3 className="cp-section-title">Generation Context</h3>
          <div className="cp-meta-grid">
            {gen.world && (
              <div className="cp-meta-item">
                <span className="cp-meta-label">World</span>
                <span className="cp-meta-value">{gen.world}</span>
              </div>
            )}
            {gen.book_id && (
              <div className="cp-meta-item">
                <span className="cp-meta-label">Book</span>
                <span className="cp-meta-value">Book {gen.book_id}</span>
              </div>
            )}
            {gen.source && (
              <div className="cp-meta-item">
                <span className="cp-meta-label">Source</span>
                <span className="cp-meta-value">{gen.source}</span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Tab 2: Interior ─────────────────────────────────────────────────────────── */

function TabInterior({ character }) {
  const want    = character.want_architecture;
  const wound   = character.wound;
  const mask    = character.the_mask;
  const dilemma = character.dilemma;
  const triggers = character.triggers;

  return (
    <div className="cp-tab-content">
      {/* Want Architecture — three cards */}
      <section className="cp-section">
        <h3 className="cp-section-title">Want Architecture</h3>
        {want ? (
          <div className="cp-want-row">
            <div className="cp-want-card cp-want-surface">
              <span className="cp-want-label">Surface Want</span>
              <p>{want.surface_want}</p>
            </div>
            <div className="cp-want-card cp-want-real">
              <span className="cp-want-label">Real Want</span>
              <p>{want.real_want}</p>
            </div>
            <div className="cp-want-card cp-want-forbidden">
              <span className="cp-want-label">Forbidden Want</span>
              <p>{want.forbidden_want}</p>
            </div>
          </div>
        ) : <EmptyState label="Want architecture not generated yet." />}
      </section>

      {/* Wound */}
      <section className="cp-section">
        <h3 className="cp-section-title">Wound</h3>
        {wound ? (
          <div className="cp-wound-block">
            <p className="cp-wound-desc">{wound.description}</p>
            {wound.origin_period && (
              <p className="cp-wound-meta">Origin: {wound.origin_period}</p>
            )}
            {wound.downstream_effects && (
              <p className="cp-wound-effects">{wound.downstream_effects}</p>
            )}
            {wound.deep_profile_dimensions_affected?.length > 0 && (
              <div className="cp-dim-tags">
                {wound.deep_profile_dimensions_affected.map(d => (
                  <span key={d} className="cp-dim-tag">{d.replace(/_/g, ' ')}</span>
                ))}
              </div>
            )}
          </div>
        ) : <EmptyState label="Wound not defined yet." />}
      </section>

      {/* The Mask */}
      <section className="cp-section">
        <h3 className="cp-section-title">The Mask</h3>
        {mask ? (
          <div className="cp-mask-block">
            <p>{mask.description}</p>
            {mask.feed_profile_is_mask && (
              <div className="cp-mask-callout">
                <span className="cp-mask-dot" /> This character&rsquo;s Feed profile IS their mask
              </div>
            )}
            {mask.divergence_map?.length > 0 && (
              <div className="cp-divergence-list">
                <span className="cp-meta-label">Divergences</span>
                {mask.divergence_map.map((d, i) => (
                  <p key={i} className="cp-divergence-item">&middot; {d}</p>
                ))}
              </div>
            )}
          </div>
        ) : <EmptyState label="Mask not defined yet." />}
      </section>

      {/* Dilemma — two column */}
      <section className="cp-section">
        <h3 className="cp-section-title">Central Dilemma</h3>
        {dilemma ? (
          <div className="cp-dilemma-block">
            <p className="cp-dilemma-tension">{dilemma.central_tension}</p>
            <div className="cp-dilemma-options">
              <div className="cp-dilemma-option">
                <span className="cp-option-label">A</span>
                <p>{dilemma.option_a}</p>
              </div>
              <div className="cp-dilemma-vs">vs</div>
              <div className="cp-dilemma-option">
                <span className="cp-option-label">B</span>
                <p>{dilemma.option_b}</p>
              </div>
            </div>
            <p className="cp-dilemma-cost">Either way: {dilemma.what_both_cost}</p>
          </div>
        ) : <EmptyState label="Dilemma not generated yet." />}
      </section>

      {/* Triggers */}
      <section className="cp-section">
        <h3 className="cp-section-title">Triggers</h3>
        {triggers?.length > 0 ? (
          <div className="cp-trigger-pills">
            {triggers.map((t, i) => (
              <span key={i} className="cp-trigger-pill">{typeof t === 'string' ? t : t.label || t.name}</span>
            ))}
          </div>
        ) : <EmptyState label="Triggers not defined yet." />}
      </section>

      {/* Blind Spot — author only */}
      {character.blind_spot && (
        <section className="cp-section cp-author-only">
          <h3 className="cp-section-title">
            Blind Spot
            <span className="cp-author-badge">Author Only</span>
          </h3>
          <p className="cp-blind-spot-text">{character.blind_spot}</p>
        </section>
      )}

      {/* Interior architecture labeled blocks */}
      {(character.change_capacity || character.self_narrative || character.operative_cosmology ||
        character.foreclosed_possibility || character.experience_of_joy || character.time_orientation) && (
        <section className="cp-section">
          <h3 className="cp-section-title">Interior Architecture</h3>
          <div className="cp-interior-grid">
            {[
              { label: 'Change Capacity',        value: character.change_capacity
                ? (typeof character.change_capacity === 'string'
                  ? character.change_capacity
                  : `${character.change_capacity.mobility || ''} ${character.change_capacity.description || ''}`.trim() || null)
                : null },
              { label: 'Self-Narrative',          value: character.self_narrative },
              { label: 'Operative Cosmology',     value: character.operative_cosmology },
              { label: 'Foreclosed Possibility',  value: character.foreclosed_possibility },
              { label: 'Experience of Joy',       value: character.experience_of_joy },
              { label: 'Time Orientation',        value: character.time_orientation?.replace?.(/_/g, ' ') || character.time_orientation },
            ].filter(f => f.value).map(f => (
              <div key={f.label} className="cp-interior-field">
                <span className="cp-meta-label">{f.label}</span>
                <p>{f.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Tab 3: Connections ──────────────────────────────────────────────────────── */

function TabConnections({ character, relationships, entanglements }) {
  return (
    <div className="cp-tab-content">
      {/* Relationships */}
      <section className="cp-section">
        <h3 className="cp-section-title">
          {relationships.length > 0 ? `${relationships.length} Relationships` : 'Relationships'}
        </h3>
        {relationships.length > 0 ? (
          <div className="cp-rel-list">
            {relationships.map((r, i) => (
              <div key={i} className="cp-rel-row">
                <div className="cp-rel-avatar">
                  {(r.related_name || r.name || '?')[0].toUpperCase()}
                </div>
                <div className="cp-rel-info">
                  <span className="cp-rel-name">{r.related_name || r.name}</span>
                  <span className="cp-rel-type">{r.relationship_type || r.type}</span>
                </div>
                <div className="cp-rel-meta">
                  {r.tension_state && (
                    <span className={`cp-tension-badge cp-tension-${r.tension_state}`}>
                      {r.tension_state}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState label="No relationships defined yet." />}
      </section>

      {/* Entanglements */}
      <section className="cp-section">
        <h3 className="cp-section-title">Entanglements</h3>
        {entanglements.length > 0 ? (
          <div className="cp-entanglement-list">
            {entanglements.map((e, i) => (
              <div key={i} className="cp-entanglement-row">
                <span className="cp-entanglement-dim">{(e.dimension || '').replace(/_/g, ' ')}</span>
                <span className={`cp-entanglement-intensity cp-intensity-${e.intensity || 'low'}`}>
                  {e.intensity || 'low'}
                </span>
                <span className="cp-entanglement-dir">{e.directionality || '\u2014'}</span>
                {!e.resolved && <span className="cp-entanglement-unresolved">unresolved</span>}
              </div>
            ))}
          </div>
        ) : <EmptyState label="No entanglements yet." />}
      </section>

      {/* Belonging Map */}
      {character.belonging_map && (
        <section className="cp-section">
          <h3 className="cp-section-title">Belonging Map</h3>
          {character.belonging_map.belongs_to?.length > 0 && (
            <div className="cp-belonging-group">
              <span className="cp-meta-label">Belongs To</span>
              {character.belonging_map.belongs_to.map((g, i) => (
                <div key={i} className="cp-belonging-item">
                  <span className="cp-belonging-name">{g.name}</span>
                  <span className="cp-belonging-type">{g.type}</span>
                </div>
              ))}
            </div>
          )}
          {character.belonging_map.excluded_from?.length > 0 && (
            <div className="cp-belonging-group cp-excluded">
              <span className="cp-meta-label">Excluded From</span>
              {character.belonging_map.excluded_from.map((g, i) => (
                <div key={i} className="cp-belonging-item">
                  <span className="cp-belonging-name">{g.name}</span>
                  <p className="cp-belonging-why">{g.why}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ── Tab 4: Online ───────────────────────────────────────────────────────────── */

function TabOnline({ character, feedProfile }) {
  const hasFeed  = !!feedProfile || character.social_presence;
  const stateCfg = feedProfile?.current_state
    ? STATE_CONFIG[feedProfile.current_state] || null
    : null;

  // Build persona gap data
  const performAs = feedProfile?.content_persona || feedProfile?.bio || null;
  const realAs    = character.the_mask?.description || character.deep_profile?.ambition_identity || null;

  return (
    <div className="cp-tab-content">
      {/* Social presence indicator */}
      <section className="cp-section">
        <h3 className="cp-section-title">Social Presence</h3>
        <span className={`cp-social-toggle ${character.social_presence ? 'cp-social-on' : 'cp-social-off'}`}>
          {character.social_presence ? 'Active' : 'None'}
        </span>
      </section>

      {!hasFeed ? (
        <section className="cp-section">
          <div className="cp-empty-state">
            <p className="cp-empty-label">No Feed profile</p>
            <p className="cp-offline-note">
              {character.feed_profile_id ? 'This character exists off the grid' : 'Cap was reached at creation — no Feed profile was auto-generated.'}
            </p>
          </div>
        </section>
      ) : (
        <>
          {feedProfile && (
            <section className="cp-section cp-feed-section">
              <div className="cp-feed-header">
                <div className="cp-feed-avatar">
                  {(feedProfile.handle || feedProfile.display_name || '?')[0].toUpperCase()}
                </div>
                <div className="cp-feed-identity">
                  <span className="cp-feed-handle">@{feedProfile.handle}</span>
                  <span className="cp-feed-display">{feedProfile.display_name}</span>
                  <span className="cp-feed-platform">{feedProfile.platform}</span>
                  {feedProfile.registry_character_id && (
                    <span className="cp-registry-badge" title="Linked to registry character" style={{fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:8,background:'#eef0fb',color:'#6366f1',marginLeft:4}}>Registry</span>
                  )}
                </div>
                <a href={`/feed?profile=${feedProfile.id}&layer=${feedProfile.feed_layer}`}
                   style={{fontSize:12,fontWeight:600,color:'#6366f1',textDecoration:'none',marginLeft:'auto',whiteSpace:'nowrap'}}>
                  View in Feed &rarr;
                </a>
                {stateCfg && (
                  <span className="cp-state-badge" style={{ background: stateCfg.bg, color: stateCfg.color }}>
                    {stateCfg.label}
                  </span>
                )}
              </div>

              {feedProfile.bio && (
                <p className="cp-feed-bio">&ldquo;{feedProfile.bio}&rdquo;</p>
              )}

              {feedProfile.content_posture && (
                <div className="cp-feed-posture">
                  <span className="cp-meta-label">Content Posture</span>
                  <p>{feedProfile.content_posture}</p>
                </div>
              )}

              <div className="cp-feed-stats">
                <div className="cp-feed-stat">
                  <span className="cp-stat-num">
                    {feedProfile.follower_count?.toLocaleString() || feedProfile.follower_count_approx || '\u2014'}
                  </span>
                  <span className="cp-stat-label">followers</span>
                </div>
                <div className="cp-feed-stat">
                  <span className="cp-stat-num">{feedProfile.post_count || '\u2014'}</span>
                  <span className="cp-stat-label">posts</span>
                </div>
              </div>

              {feedProfile.vibe_tags?.length > 0 && (
                <div className="cp-vibe-tags">
                  {feedProfile.vibe_tags.map(t => (
                    <span key={t} className="cp-vibe-tag">{t}</span>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Persona Gap — side by side */}
          {(performAs || realAs) && (
            <section className="cp-section cp-author-only">
              <h3 className="cp-section-title">
                Persona Gap
                <span className="cp-author-badge">Author Only</span>
              </h3>
              <div className="cp-persona-gap">
                <div className="cp-gap-side cp-gap-perform">
                  <span className="cp-gap-label">Who they perform</span>
                  <p>{performAs || 'Not defined'}</p>
                </div>
                <div className="cp-gap-divider" />
                <div className="cp-gap-side cp-gap-real">
                  <span className="cp-gap-label">Who they are</span>
                  <p>{realAs || 'Not defined'}</p>
                </div>
              </div>
            </section>
          )}

          {/* Mask connection callout */}
          {character.the_mask?.feed_profile_is_mask && (
            <section className="cp-section">
              <h3 className="cp-section-title">Mask Status</h3>
              <p className="cp-mask-note">
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

/* ── Tab 5: World ────────────────────────────────────────────────────────────── */

function TabWorld({ character }) {
  const living = character.living_state || character.living_context;
  const dp     = character.deep_profile;

  return (
    <div className="cp-tab-content">
      {/* Living State */}
      <section className="cp-section">
        <h3 className="cp-section-title">Living State</h3>
        {living ? (
          <div className="cp-living-grid">
            {living.current_situation && (
              <div className="cp-living-field">
                <span className="cp-meta-label">Current Situation</span>
                <p>{living.current_situation}</p>
              </div>
            )}
            {living.active_tension && (
              <div className="cp-living-field">
                <span className="cp-meta-label">Active Tension</span>
                <p>{living.active_tension}</p>
              </div>
            )}
            {living.momentum && (
              <div className="cp-living-field">
                <span className="cp-meta-label">Momentum</span>
                <p>{living.momentum}</p>
              </div>
            )}
          </div>
        ) : <EmptyState label="Living state not generated yet." />}
      </section>

      {/* Arc Stage */}
      {character.arc_stage && (
        <section className="cp-section">
          <h3 className="cp-section-title">Arc Stage</h3>
          <span className="cp-arc-badge">{character.arc_stage.replace?.(/_/g, ' ') || character.arc_stage}</span>
        </section>
      )}

      {/* Plot Threads */}
      {character.plot_threads?.length > 0 && (
        <section className="cp-section">
          <h3 className="cp-section-title">Plot Threads</h3>
          <div className="cp-thread-list">
            {character.plot_threads.map((t, i) => (
              <div key={i} className="cp-thread-row">
                <span className="cp-thread-name">{typeof t === 'string' ? t : t.name || t.label}</span>
                {t.status && <span className="cp-thread-status">{t.status}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Career / Ambition from deep profile */}
      {dp?.ambition_identity && (
        <section className="cp-section">
          <h3 className="cp-section-title">Career &amp; Ambition</h3>
          <p className="cp-career-text">{dp.ambition_identity}</p>
        </section>
      )}

      {/* Time orientation */}
      {character.time_orientation && (
        <section className="cp-section">
          <h3 className="cp-section-title">Time Orientation</h3>
          <span className="cp-time-badge">
            {character.time_orientation.replace?.(/_/g, ' ') || character.time_orientation}
          </span>
        </section>
      )}

      {/* Ghost Characters */}
      {character.ghost_characters?.length > 0 && (
        <section className="cp-section">
          <h3 className="cp-section-title">
            Ghost Characters
            <span className="cp-ghost-count">{character.ghost_characters.length}</span>
          </h3>
          <p className="cp-ghost-note">
            Characters mentioned in this character&rsquo;s story who haven&rsquo;t been built yet.
          </p>
          <div className="cp-ghost-list">
            {character.ghost_characters.map((g, i) => (
              <div key={i} className={`cp-ghost-item ${g.promoted ? 'cp-ghost-promoted' : ''}`}>
                <span className="cp-ghost-name">{g.name}</span>
                <span className="cp-ghost-relation">{g.relation}</span>
                {!g.promoted && <button className="cp-btn-promote">Promote</button>}
                {g.promoted && <span className="cp-promoted-badge">&uarr; In Registry</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Family Tree */}
      {character.family_tree && (
        <section className="cp-section">
          <h3 className="cp-section-title">Family</h3>
          {character.family_tree.generational_wound && (
            <p className="cp-generational-wound">
              Generational wound: {character.family_tree.generational_wound}
            </p>
          )}
          {character.family_tree.members?.length > 0 && (
            <div className="cp-family-list">
              {character.family_tree.members.map((m, i) => (
                <div key={i} className="cp-family-member">
                  <span className="cp-member-name">{m.name}</span>
                  <span className="cp-member-relation">{m.relation}</span>
                  {m.personality_sketch && <p className="cp-member-sketch">{m.personality_sketch}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ── Tab 6: Deep Profile ─────────────────────────────────────────────────────── */

function TabDeepProfile({ character }) {
  const dp = character.deep_profile;
  const [open, setOpen] = useState(null);

  if (!dp || Object.keys(dp).length === 0) {
    return (
      <div className="cp-tab-content">
        <EmptyState label="Deep Profile not generated yet." />
      </div>
    );
  }

  const populated = DIMENSION_KEYS.filter(k => dp[k]);
  const isComplete = populated.length === 14;

  return (
    <div className="cp-tab-content">
      {/* Completion indicator */}
      <div className="cp-dp-status">
        <span className="cp-dp-count">{populated.length}/14 dimensions</span>
        {isComplete && <span className="cp-dp-complete">Complete</span>}
      </div>

      <div className="cp-dp-list">
        {DIMENSION_KEYS.map(key => {
          const value  = dp[key];
          const label  = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const icon   = DIMENSION_ICONS[key] || '\u00B7';
          const isOpen = open === key;

          return (
            <div
              key={key}
              className={`cp-dp-row ${isOpen ? 'cp-dp-open' : ''} ${!value ? 'cp-dp-empty' : ''}`}
              onClick={() => value && setOpen(isOpen ? null : key)}
            >
              <div className="cp-dp-header">
                <span className="cp-dp-icon">{icon}</span>
                <span className="cp-dp-label">{label}</span>
                {value
                  ? <span className="cp-dp-chevron">{isOpen ? '\u2191' : '\u2193'}</span>
                  : <span className="cp-dp-missing">not generated</span>}
              </div>
              {isOpen && value && <p className="cp-dp-content">{value}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── MAIN COMPONENT ──────────────────────────────────────────────────────────── */

export default function CharacterProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [character, setCharacter]         = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [entanglements, setEntanglements] = useState([]);
  const [feedProfile, setFeedProfile]     = useState(null);
  const [activeTab, setActiveTab]         = useState('overview');
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [charRes, relRes, entRes] = await Promise.all([
        getCharacterApi(id),
        getCharacterRelationshipsApi(id).catch(() => null),
        getCharacterEntanglementsApi(id).catch(() => null),
      ]);

      const charData = charRes.data;
      const char = charData.character || charData;
      setCharacter(char);

      if (relRes) {
        const relData = relRes.data;
        setRelationships(relData.relationships || relData || []);
      }

      if (entRes) {
        const entData = entRes.data;
        setEntanglements(entData.entanglements || entData || []);
      }

      // Load feed profile if linked
      if (char.feed_profile_id) {
        const feedRes = await getSocialProfileApi(char.feed_profile_id).catch(() => null);
        if (feedRes) {
          const feedData = feedRes.data;
          setFeedProfile(feedData.profile || feedData);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Character not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="cp-loading">
      <div className="cp-loading-pulse" />
    </div>
  );

  if (error || !character) return (
    <div className="cp-error">
      <p>{error || 'Character not found'}</p>
      <button onClick={() => navigate(-1)}>&larr; Back</button>
    </div>
  );

  const depth    = character.depth_level || 'sparked';
  const initials = (character.selected_name || character.name || '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const ghostCount = character.ghost_characters?.filter(g => !g.promoted).length || 0;
  const gen = character.generation_context;

  return (
    <div className="cp-page">
      {/* ── Left Sidebar (fixed) ── */}
      <aside className="cp-sidebar">
        <button className="cp-back-btn" onClick={() => navigate(-1)}>
          &larr; Registry
        </button>

        <div className="cp-avatar">{initials}</div>
        <h2 className="cp-name">{character.selected_name || character.name}</h2>
        <p className="cp-role">{character.role_type || 'character'}</p>
        <DepthPill level={depth} />

        {/* Feed linked indicator */}
        {character.feed_profile_id && (
          <span className="cp-feed-linked">&bull; Online</span>
        )}

        {/* Generation context book label */}
        {gen?.book_id && (
          <span className="cp-book-label">Book {gen.book_id}</span>
        )}

        <div className="cp-sidebar-actions">
          {depth !== 'alive' && (
            <button className="cp-btn-deepen" onClick={() => navigate('/world-studio')}>
              &uarr; Deepen
            </button>
          )}
          <button className="cp-btn-export" onClick={() => {}}>
            Export
          </button>
        </div>

        {/* Ghost count */}
        {ghostCount > 0 && (
          <div className="cp-ghost-indicator" onClick={() => setActiveTab('world')}>
            <span className="cp-ghost-num">{ghostCount}</span>
            {ghostCount === 1 ? 'ghost pending' : 'ghosts pending'}
          </div>
        )}

        {/* Sidebar meta */}
        {character.change_capacity?.mobility && (
          <div className="cp-sidebar-meta">
            <span className="cp-meta-label">Mobility</span>
            <span className="cp-sidebar-meta-value">{character.change_capacity.mobility}</span>
          </div>
        )}
        {character.time_orientation && (
          <div className="cp-sidebar-meta">
            <span className="cp-meta-label">Time</span>
            <span className="cp-sidebar-meta-value">
              {character.time_orientation.replace?.(/_/g, ' ') || character.time_orientation}
            </span>
          </div>
        )}
      </aside>

      {/* ── Main Panel ── */}
      <main className="cp-main">
        <nav className="cp-tab-bar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`cp-tab-btn ${activeTab === tab.id ? 'cp-tab-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.id === 'online' && character.feed_profile_id && (
                <span className="cp-tab-dot" />
              )}
            </button>
          ))}
        </nav>

        <div className="cp-tab-panel">
          {activeTab === 'overview'     && <TabOverview character={character} />}
          {activeTab === 'interior'     && <TabInterior character={character} />}
          {activeTab === 'depth'        && <CharacterDepthPanel characterId={character.id} characterName={character.selected_name || character.display_name} />}
          {activeTab === 'connections'   && <TabConnections character={character} relationships={relationships} entanglements={entanglements} />}
          {activeTab === 'online'       && <TabOnline character={character} feedProfile={feedProfile} />}
          {activeTab === 'world'        && <TabWorld character={character} />}
          {activeTab === 'deep_profile' && <TabDeepProfile character={character} />}
        </div>
      </main>
    </div>
  );
}

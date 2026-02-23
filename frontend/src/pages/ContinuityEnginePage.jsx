/**
 * ContinuityEnginePage.jsx
 * frontend/src/pages/ContinuityEnginePage.jsx
 *
 * Route: /continuity
 * Sidebar: StoryTeller → Continuity
 *
 * Three views:
 *   Timeline Strip   — horizontal scrollable beat sequence
 *   Movement Map     — one row per character, shows which beats they appear in
 *   Location Cards   — group beats by location
 *
 * Conflict detection: same character in two locations at same time_tag
 * Conflict indicator: red flag on beat card, topbar badge
 *
 * API base: /api/v1/continuity
 *
 * Theme: dark blueprint — deep navy/charcoal, cyan/teal accents
 * Font: DM Mono for meta/labels, normal sans for beat content
 */

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

const API = '/api/v1/continuity';

const CHAR_COLORS = [
  '#0891B2', '#7C3AED', '#059669', '#DB2777',
  '#EA580C', '#2563EB', '#D97706', '#C026D3',
];

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function ContinuityEnginePage() {
  const [searchParams] = useSearchParams();

  // Show scoping — reads show_id from URL or uses first available
  const showId = searchParams.get('show_id');

  const [timelines,  setTimelines]  = useState([]);
  const [active,     setActive]     = useState(null); // full timeline object
  const [conflicts,  setConflicts]  = useState([]);
  const [view,       setView]       = useState('strip'); // strip | map | locations
  const [loading,    setLoading]    = useState(true);
  const [toast,      setToast]      = useState(null);

  // Forms
  const [showNewTimeline, setShowNewTimeline] = useState(false);
  const [showAddBeat,     setShowAddBeat]     = useState(false);
  const [showAddChar,     setShowAddChar]     = useState(false);
  const [editingBeat,     setEditingBeat]     = useState(null); // beat object
  const [selectedBeat,    setSelectedBeat]    = useState(null); // for detail view

  useEffect(() => { loadTimelines(); }, [showId]);

  useEffect(() => {
    if (active) {
      loadConflicts(active.id);
    }
  }, [active?.id]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  // ── API calls ──────────────────────────────────────────────────────────

  async function loadTimelines() {
    setLoading(true);
    try {
      const url = showId
        ? `${API}/timelines?show_id=${showId}`
        : `${API}/timelines`;
      const res  = await fetch(url);
      if (!res.ok) { setTimelines([]); setLoading(false); return; }
      const data = await res.json();
      const list = data.timelines || data || [];
      setTimelines(list);
      if (list.length > 0 && !active) {
        await loadTimeline(list[0].id);
      }
    } catch (err) {
      showToast('Failed to load timelines', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadTimeline(id) {
    try {
      const res  = await fetch(`${API}/timelines/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setActive(data.timeline || data);
    } catch (err) {
      showToast('Failed to load timeline', 'error');
    }
  }

  async function loadConflicts(id) {
    try {
      const res  = await fetch(`${API}/timelines/${id}/conflicts`);
      if (!res.ok) return;
      const data = await res.json();
      setConflicts(data.conflicts || []);
    } catch (err) {
      // silent — conflicts are supplementary
    }
  }

  async function createTimeline(form) {
    try {
      const res  = await fetch(`${API}/timelines`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title: form.name, description: form.description, show_id: showId }),
      });
      const data = await res.json();
      const t    = data.timeline || data;
      setTimelines(prev => [...prev, t]);
      await loadTimeline(t.id);
      setShowNewTimeline(false);
      showToast('Timeline created');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function addCharacter(form) {
    if (!active) return;
    try {
      const res  = await fetch(`${API}/timelines/${active.id}/characters`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      setActive(prev => ({
        ...prev,
        characters: [...(prev.characters || []), data.character || data],
      }));
      setShowAddChar(false);
      showToast('Character added');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteCharacter(charId) {
    try {
      await fetch(`${API}/characters/${charId}`, { method: 'DELETE' });
      setActive(prev => ({
        ...prev,
        characters: (prev.characters || []).filter(c => c.id !== charId),
        beats: (prev.beats || []).map(b => ({
          ...b,
          characters: (b.characters || []).filter(c => c.id !== charId),
        })),
      }));
      showToast('Character removed');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function addBeat(form) {
    if (!active) return;
    try {
      const res  = await fetch(`${API}/timelines/${active.id}/beats`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      const beat = data.beat || data;
      setActive(prev => ({
        ...prev,
        beats: [...(prev.beats || []), beat].sort((a, b) =>
          (a.sort_order || 0) - (b.sort_order || 0)),
      }));
      setShowAddBeat(false);
      showToast('Beat logged');
      await loadConflicts(active.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function updateBeat(beatId, form) {
    try {
      const res  = await fetch(`${API}/beats/${beatId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      const updated = data.beat || data;
      setActive(prev => ({
        ...prev,
        beats: (prev.beats || [])
          .map(b => b.id === beatId ? updated : b)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
      }));
      setEditingBeat(null);
      showToast('Beat updated');
      await loadConflicts(active.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteBeat(beatId) {
    if (!window.confirm('Delete this beat?')) return;
    try {
      await fetch(`${API}/beats/${beatId}`, { method: 'DELETE' });
      setActive(prev => ({
        ...prev,
        beats: (prev.beats || []).filter(b => b.id !== beatId),
      }));
      setSelectedBeat(null);
      showToast('Beat deleted');
      await loadConflicts(active.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function seedDemo() {
    if (!active) return;
    try {
      await fetch(`${API}/timelines/${active.id}/seed-demo`, { method: 'POST' });
      await loadTimeline(active.id);
      await loadConflicts(active.id);
      showToast('Demo data loaded');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ── Derived data ───────────────────────────────────────────────────────

  const beats      = active?.beats      || [];
  const characters = active?.characters || [];

  const conflictBeatIds = new Set(
    conflicts.flatMap(c => c.beat_ids || [])
  );

  // Beat → conflict lookup
  const beatConflicts = {};
  conflicts.forEach(c => {
    (c.beat_ids || []).forEach(bid => {
      if (!beatConflicts[bid]) beatConflicts[bid] = [];
      beatConflicts[bid].push(c);
    });
  });

  // Group beats by location
  const byLocation = beats.reduce((acc, beat) => {
    const loc = beat.location || 'Unknown';
    if (!acc[loc]) acc[loc] = [];
    acc[loc].push(beat);
    return acc;
  }, {});

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>

      {/* ── Topbar ── */}
      <div style={s.topbar}>
        <div style={s.topbarLeft}>
          <div style={s.pageTitle}>CONTINUITY ENGINE</div>
          {active && (
            <div style={s.timelineName}>{active.title}</div>
          )}
        </div>

        <div style={s.topbarCenter}>
          {/* Conflict badge */}
          <div style={{
            ...s.conflictBadge,
            background: conflicts.length > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(5,150,105,0.06)',
            borderColor: conflicts.length > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(5,150,105,0.25)',
            color: conflicts.length > 0 ? '#DC2626' : '#059669',
          }}>
            {conflicts.length > 0
              ? `⚠ ${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''}`
              : '✓ No conflicts'}
          </div>
        </div>

        <div style={s.topbarRight}>
          {/* View switcher */}
          {['strip', 'map', 'locations'].map(v => (
            <button
              key={v}
              style={{
                ...s.viewBtn,
                background: view === v ? 'rgba(8,145,178,0.08)' : 'transparent',
                color:      view === v ? '#0891B2' : 'rgba(100,116,139,0.6)',
                borderColor: view === v ? 'rgba(8,145,178,0.3)' : 'rgba(203,213,225,0.4)',
              }}
              onClick={() => setView(v)}
              type='button'
            >
              {v === 'strip' ? '⟶ Strip' : v === 'map' ? '⊞ Map' : '◉ Locations'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={s.body}>

        {/* ── Left sidebar ── */}
        <div style={s.sidebar}>

          {/* Timeline selector */}
          <div style={s.sideSection}>
            <div style={s.sideSectionLabel}>TIMELINES</div>
            {timelines.map(t => (
              <button
                key={t.id}
                style={{
                  ...s.timelineBtn,
                  background: active?.id === t.id
                    ? 'rgba(8,145,178,0.06)'
                    : 'transparent',
                  borderLeft: active?.id === t.id
                    ? '2px solid #0891B2'
                    : '2px solid transparent',
                  color: active?.id === t.id
                    ? '#0891B2'
                    : 'rgba(71,85,105,0.8)',
                }}
                onClick={() => loadTimeline(t.id)}
                type='button'
              >
                {t.title}
              </button>
            ))}
            <button
              style={s.addBtn}
              onClick={() => setShowNewTimeline(true)}
              type='button'
            >
              + New timeline
            </button>
          </div>

          {/* Beat list */}
          {active && (
            <div style={s.sideSection}>
              <div style={s.sideSectionLabel}>SCENE BEATS</div>
              <div style={s.beatList}>
                {beats.map(beat => {
                  const hasConflict = conflictBeatIds.has(beat.id);
                  const isSelected  = selectedBeat?.id === beat.id;
                  return (
                    <button
                      key={beat.id}
                      style={{
                        ...s.beatListItem,
                        background: isSelected
                          ? 'rgba(8,145,178,0.05)'
                          : 'transparent',
                        borderLeft: hasConflict
                          ? '2px solid #DC2626'
                          : isSelected
                            ? '2px solid #0891B2'
                            : '2px solid transparent',
                      }}
                      onClick={() => setSelectedBeat(isSelected ? null : beat)}
                      type='button'
                    >
                      <div style={s.beatListName}>
                        {hasConflict && <span style={s.conflictFlag}>⚠</span>}
                        {beat.name}
                      </div>
                      <div style={s.beatListMeta}>
                        {beat.location && <span>{beat.location}</span>}
                        {beat.time_tag && <span style={s.beatTimeDot}>{beat.time_tag}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                style={s.addBtn}
                onClick={() => setShowAddBeat(true)}
                type='button'
              >
                + Log scene beat
              </button>

              {beats.length === 0 && (
                <button
                  style={s.seedBtn}
                  onClick={seedDemo}
                  type='button'
                >
                  Load demo data
                </button>
              )}
            </div>
          )}

          {/* Characters */}
          {active && (
            <div style={s.sideSection}>
              <div style={s.sideSectionLabel}>CHARACTERS</div>
              {characters.map((char, i) => (
                <div key={char.id} style={s.charRow}>
                  <div
                    style={{
                      ...s.charDot,
                      background: char.color || CHAR_COLORS[i % CHAR_COLORS.length],
                    }}
                  />
                  <div style={s.charName}>{char.name}</div>
                  {char.role && (
                    <div style={s.charRole}>{char.role}</div>
                  )}
                  <button
                    style={s.charDelete}
                    onClick={() => deleteCharacter(char.id)}
                    type='button'
                    title='Remove'
                  >×</button>
                </div>
              ))}
              <button
                style={s.addBtn}
                onClick={() => setShowAddChar(true)}
                type='button'
              >
                + Add character
              </button>
            </div>
          )}
        </div>

        {/* ── Main content ── */}
        <div style={s.main}>

          {loading && <CenterMessage>Loading…</CenterMessage>}

          {!loading && !active && (
            <CenterMessage>
              Select a timeline or create one to get started.
            </CenterMessage>
          )}

          {active && view === 'strip' && (
            <TimelineStrip
              beats={beats}
              characters={characters}
              conflictBeatIds={conflictBeatIds}
              beatConflicts={beatConflicts}
              selectedBeat={selectedBeat}
              onSelectBeat={setSelectedBeat}
              onEditBeat={setEditingBeat}
              onDeleteBeat={deleteBeat}
            />
          )}

          {active && view === 'map' && (
            <MovementMap
              beats={beats}
              characters={characters}
              conflictBeatIds={conflictBeatIds}
            />
          )}

          {active && view === 'locations' && (
            <LocationCards
              byLocation={byLocation}
              characters={characters}
              conflictBeatIds={conflictBeatIds}
              onSelectBeat={setSelectedBeat}
            />
          )}

          {/* Conflict panel */}
          {conflicts.length > 0 && (
            <ConflictPanel conflicts={conflicts} characters={characters} />
          )}
        </div>

        {/* ── Beat detail panel ── */}
        {selectedBeat && (
          <BeatDetail
            beat={selectedBeat}
            characters={characters}
            conflicts={beatConflicts[selectedBeat.id] || []}
            onClose={() => setSelectedBeat(null)}
            onEdit={() => { setEditingBeat(selectedBeat); setSelectedBeat(null); }}
            onDelete={() => deleteBeat(selectedBeat.id)}
          />
        )}
      </div>

      {/* ── Modals ── */}
      {showNewTimeline && (
        <NewTimelineModal
          onSubmit={createTimeline}
          onClose={() => setShowNewTimeline(false)}
        />
      )}

      {showAddBeat && active && (
        <AddBeatModal
          characters={characters}
          beats={beats}
          onSubmit={addBeat}
          onClose={() => setShowAddBeat(false)}
        />
      )}

      {editingBeat && (
        <AddBeatModal
          beat={editingBeat}
          characters={characters}
          beats={beats}
          onSubmit={(form) => updateBeat(editingBeat.id, form)}
          onClose={() => setEditingBeat(null)}
        />
      )}

      {showAddChar && (
        <AddCharModal
          existingCount={characters.length}
          onSubmit={addCharacter}
          onClose={() => setShowAddChar(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          ...s.toast,
          background: toast.type === 'error' ? '#FEF2F2' : '#F0FDF4',
          borderColor: toast.type === 'error' ? '#DC2626' : '#059669',
          color:       toast.type === 'error' ? '#DC2626' : '#059669',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Strip — horizontal scrollable beat cards
// ─────────────────────────────────────────────────────────────────────────────

function TimelineStrip({ beats, characters, conflictBeatIds, beatConflicts, selectedBeat, onSelectBeat, onEditBeat, onDeleteBeat }) {
  const scrollRef = useRef(null);

  if (beats.length === 0) {
    return (
      <div style={v.stripEmpty}>
        <div style={v.emptyGlyph}>⟶</div>
        <div style={v.emptyText}>No beats logged yet</div>
        <div style={v.emptySub}>Add your first scene beat using the sidebar</div>
      </div>
    );
  }

  return (
    <div style={v.stripWrap}>
      <div style={v.stripLabel}>SCENE SEQUENCE</div>
      <div style={v.strip} ref={scrollRef}>
        {beats.map((beat, idx) => {
          const hasConflict  = conflictBeatIds.has(beat.id);
          const isSelected   = selectedBeat?.id === beat.id;
          const beatChars    = beat.characters || beat.continuity_characters || [];

          return (
            <div
              key={beat.id}
              style={{
                ...v.beatCard,
                borderColor: hasConflict
                  ? '#DC2626'
                  : isSelected
                    ? '#0891B2'
                    : 'rgba(203,213,225,0.4)',
                background: hasConflict
                  ? '#FEF2F2'
                  : isSelected
                    ? 'rgba(8,145,178,0.04)'
                    : '#FFFFFF',
                boxShadow: isSelected
                  ? '0 0 0 1px rgba(8,145,178,0.2), 0 1px 3px rgba(0,0,0,0.06)'
                  : hasConflict
                    ? '0 0 0 1px rgba(239,68,68,0.15)'
                    : '0 1px 3px rgba(0,0,0,0.06)',
              }}
              onClick={() => onSelectBeat(isSelected ? null : beat)}
            >
              {/* Beat number */}
              <div style={v.beatNum}>
                {hasConflict
                  ? <span style={v.conflictFlag}>⚠</span>
                  : String(idx + 1).padStart(2, '0')}
              </div>

              {/* Beat name */}
              <div style={v.beatName}>{beat.name}</div>

              {/* Location */}
              {beat.location && (
                <div style={v.beatLocation}>
                  <span style={v.locationDot}>◉</span>
                  {beat.location}
                </div>
              )}

              {/* Time tag */}
              {beat.time_tag && (
                <div style={v.beatTimeTag}>{beat.time_tag}</div>
              )}

              {/* Character dots */}
              {beatChars.length > 0 && (
                <div style={v.beatCharDots}>
                  {beatChars.map((bc, ci) => {
                    const full = characters.find(c => c.id === bc.id || c.id === bc.character_id);
                    const color = full?.color || bc.color || CHAR_COLORS[ci % CHAR_COLORS.length];
                    return (
                      <div
                        key={bc.id || ci}
                        style={{ ...v.charDot, background: color }}
                        title={full?.name || bc.name || ''}
                      />
                    );
                  })}
                </div>
              )}

              {/* Note preview */}
              {beat.note && (
                <div style={v.beatNote}>{beat.note.slice(0, 60)}{beat.note.length > 60 ? '…' : ''}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Movement Map — one row per character, dots at beats they appear in
// ─────────────────────────────────────────────────────────────────────────────

function MovementMap({ beats, characters, conflictBeatIds }) {
  if (characters.length === 0 || beats.length === 0) {
    return (
      <div style={v.stripEmpty}>
        <div style={v.emptyText}>Add characters and beats to see the movement map</div>
      </div>
    );
  }

  return (
    <div style={mm.wrap}>
      <div style={v.stripLabel}>CHARACTER MOVEMENT MAP</div>

      {/* Beat headers */}
      <div style={mm.headerRow}>
        <div style={mm.charLabelCol} />
        {beats.map((beat, i) => (
          <div key={beat.id} style={{
            ...mm.beatHeader,
            color: conflictBeatIds.has(beat.id) ? '#DC2626' : 'rgba(8,145,178,0.7)',
          }}>
            <div style={mm.beatHeaderNum}>{String(i + 1).padStart(2, '0')}</div>
            <div style={mm.beatHeaderName}>{beat.name.slice(0, 12)}{beat.name.length > 12 ? '…' : ''}</div>
          </div>
        ))}
      </div>

      {/* Character rows */}
      {characters.map((char, ci) => {
        const color = char.color || CHAR_COLORS[ci % CHAR_COLORS.length];
        return (
          <div key={char.id} style={mm.charRow}>
            {/* Character label */}
            <div style={mm.charLabelCol}>
              <div style={{ ...mm.charDot, background: color }} />
              <div style={{ ...mm.charLabel, color }}>{char.name}</div>
            </div>

            {/* Beat presence */}
            {beats.map(beat => {
              const beatChars = beat.characters || beat.continuity_characters || [];
              const present = beatChars.some(bc =>
                bc.id === char.id || bc.character_id === char.id
              );
              const conflict = conflictBeatIds.has(beat.id) && present;

              return (
                <div key={beat.id} style={mm.beatCell}>
                  {present && (
                    <div style={{
                      ...mm.presenceDot,
                      background: conflict ? '#DC2626' : color,
                      boxShadow:  `0 0 6px ${conflict ? '#DC262640' : color + '40'}`,
                    }} />
                  )}
                  {!present && (
                    <div style={mm.absentLine} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Location Cards — group beats by location
// ─────────────────────────────────────────────────────────────────────────────

function LocationCards({ byLocation, characters, conflictBeatIds, onSelectBeat }) {
  const locations = Object.keys(byLocation).sort();

  if (locations.length === 0) {
    return (
      <div style={v.stripEmpty}>
        <div style={v.emptyText}>No beats logged yet</div>
      </div>
    );
  }

  return (
    <div style={lc.wrap}>
      <div style={v.stripLabel}>LOCATIONS</div>
      <div style={lc.grid}>
        {locations.map(loc => {
          const locBeats   = byLocation[loc];
          const hasConflict = locBeats.some(b => conflictBeatIds.has(b.id));

          // All unique characters across all beats in this location
          const charIds = new Set();
          locBeats.forEach(b => {
            (b.characters || b.continuity_characters || []).forEach(bc => {
              charIds.add(bc.id || bc.character_id);
            });
          });
          const locChars = characters.filter(c => charIds.has(c.id));

          return (
            <div
              key={loc}
              style={{
                ...lc.card,
                borderColor: hasConflict ? 'rgba(239,68,68,0.35)' : 'rgba(8,145,178,0.18)',
              }}
            >
              {/* Location header */}
              <div style={lc.header}>
                <div style={lc.locIcon}>◉</div>
                <div style={lc.locName}>{loc}</div>
                {hasConflict && <div style={lc.conflictTag}>⚠ Conflict</div>}
              </div>

              {/* Character presence */}
              {locChars.length > 0 && (
                <div style={lc.charRow}>
                  {locChars.map((char, ci) => (
                    <div key={char.id} style={lc.charChip}>
                      <div style={{
                        ...lc.charDot,
                        background: char.color || CHAR_COLORS[ci % CHAR_COLORS.length],
                      }} />
                      <span style={{ ...lc.charName, color: char.color || CHAR_COLORS[ci % CHAR_COLORS.length] }}>
                        {char.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Beat list */}
              <div style={lc.beats}>
                {locBeats.map((beat, i) => (
                  <button
                    key={beat.id}
                    style={{
                      ...lc.beatRow,
                      borderLeft: conflictBeatIds.has(beat.id)
                        ? '2px solid #DC2626'
                        : '2px solid rgba(8,145,178,0.3)',
                    }}
                    onClick={() => onSelectBeat(beat)}
                    type='button'
                  >
                    <span style={lc.beatName}>{beat.name}</span>
                    {beat.time_tag && (
                      <span style={lc.beatTime}>{beat.time_tag}</span>
                    )}
                    {conflictBeatIds.has(beat.id) && (
                      <span style={lc.conflictDot}>⚠</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict Panel
// ─────────────────────────────────────────────────────────────────────────────

function ConflictPanel({ conflicts, characters }) {
  return (
    <div style={cp.panel}>
      <div style={cp.title}>⚠ CONTINUITY CONFLICTS</div>
      {conflicts.map((c, i) => {
        const char = characters.find(ch => ch.id === c.character_id);
        return (
          <div key={i} style={cp.conflict}>
            <div style={{ ...cp.charName, color: char?.color || '#DC2626' }}>
              {c.character_name || char?.name || 'Unknown'}
            </div>
            <div style={cp.timeTag}>{c.time_tag}</div>
            <div style={cp.locations}>
              {(c.locations || []).map((loc, li) => (
                <span key={li} style={cp.locTag}>{loc}</span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Beat Detail panel
// ─────────────────────────────────────────────────────────────────────────────

function BeatDetail({ beat, characters, conflicts, onClose, onEdit, onDelete }) {
  const beatChars = beat.characters || beat.continuity_characters || [];

  return (
    <div style={bd.panel}>
      <div style={bd.header}>
        <div style={bd.beatName}>{beat.name}</div>
        <button style={bd.closeBtn} onClick={onClose} type='button'>×</button>
      </div>

      {conflicts.length > 0 && (
        <div style={bd.conflictAlert}>
          ⚠ {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} at this beat
        </div>
      )}

      <div style={bd.fields}>
        {beat.location && (
          <DetailField label='Location' value={beat.location} />
        )}
        {beat.time_tag && (
          <DetailField label='Time' value={beat.time_tag} />
        )}
        {beat.note && (
          <DetailField label='Note' value={beat.note} />
        )}
      </div>

      {beatChars.length > 0 && (
        <div style={bd.charSection}>
          <div style={bd.charLabel}>CHARACTERS PRESENT</div>
          <div style={bd.charList}>
            {beatChars.map((bc, ci) => {
              const full  = characters.find(c => c.id === bc.id || c.id === bc.character_id);
              const color = full?.color || bc.color || CHAR_COLORS[ci % CHAR_COLORS.length];
              return (
                <div key={bc.id || ci} style={bd.charChip}>
                  <div style={{ ...bd.charDot, background: color }} />
                  <span style={{ ...bd.charName, color }}>{full?.name || bc.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={bd.actions}>
        <button style={bd.editBtn}   onClick={onEdit}   type='button'>Edit</button>
        <button style={bd.deleteBtn} onClick={onDelete} type='button'>Delete</button>
      </div>
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '0.18em', color: 'rgba(100,116,139,0.55)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 15, color: '#475569', lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────────────────────────────────────

function NewTimelineModal({ onSubmit, onClose }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  return (
    <Modal title='New Timeline' onClose={onClose}>
      <ModalField label='Name' value={name} onChange={setName} placeholder='Book 1 - Before Lala' />
      <ModalField label='Description' value={desc} onChange={setDesc} placeholder='Optional' />
      <ModalActions
        onSubmit={() => name.trim() && onSubmit({ name: name.trim(), description: desc.trim() })}
        onClose={onClose}
        submitLabel='Create Timeline'
        disabled={!name.trim()}
      />
    </Modal>
  );
}

function AddCharModal({ existingCount, onSubmit, onClose }) {
  const [name,  setName]  = useState('');
  const [role,  setRole]  = useState('');
  const [color, setColor] = useState(CHAR_COLORS[existingCount % CHAR_COLORS.length]);

  return (
    <Modal title='Add Character' onClose={onClose}>
      <ModalField label='Name'  value={name}  onChange={setName}  placeholder='JustAWoman' />
      <ModalField label='Role'  value={role}  onChange={setRole}  placeholder='Protagonist' />
      <div style={mf.field}>
        <div style={mf.label}>Color</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CHAR_COLORS.map(c => (
            <button
              key={c}
              type='button'
              onClick={() => setColor(c)}
              style={{
                width: 24, height: 24, borderRadius: '50%',
                background: c, border: 'none', cursor: 'pointer',
                outline: color === c ? `2px solid ${c}` : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      </div>
      <ModalActions
        onSubmit={() => name.trim() && onSubmit({ name: name.trim(), role: role.trim(), color })}
        onClose={onClose}
        submitLabel='Add Character'
        disabled={!name.trim()}
      />
    </Modal>
  );
}

function AddBeatModal({ beat, characters, beats, onSubmit, onClose }) {
  const [name,     setName]     = useState(beat?.name     || '');
  const [location, setLocation] = useState(beat?.location || '');
  const [timeTag,  setTimeTag]  = useState(beat?.time_tag || '');
  const [note,     setNote]     = useState(beat?.note     || '');
  const [order,    setOrder]    = useState(beat?.sort_order ?? beats.length);
  const [charIds,  setCharIds]  = useState(
    new Set((beat?.characters || beat?.continuity_characters || []).map(c => c.id || c.character_id))
  );

  const editing = !!beat;

  function toggleChar(id) {
    setCharIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function submit() {
    if (!name.trim()) return;
    onSubmit({
      name:         name.trim(),
      location:     location.trim(),
      time_tag:     timeTag.trim(),
      note:         note.trim(),
      sort_order:   Number(order),
      character_ids: [...charIds],
    });
  }

  return (
    <Modal title={editing ? 'Edit Beat' : 'Log Scene Beat'} onClose={onClose}>
      <ModalField label='Beat name'  value={name}     onChange={setName}     placeholder='The Comparison' />
      <ModalField label='Location'   value={location} onChange={setLocation} placeholder='Coffee shop' />
      <ModalField label='Time tag'   value={timeTag}  onChange={setTimeTag}  placeholder='Morning - Act I' />
      <ModalField label='Note'       value={note}     onChange={setNote}     placeholder="JustAWoman sees Chloe's post..." textarea />
      <ModalField label='Order'      value={String(order)} onChange={v => setOrder(Number(v))} type='number' />

      {characters.length > 0 && (
        <div style={mf.field}>
          <div style={mf.label}>Characters present</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {characters.map((char, ci) => {
              const color   = char.color || CHAR_COLORS[ci % CHAR_COLORS.length];
              const checked = charIds.has(char.id);
              return (
                <label key={char.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type='checkbox'
                    checked={checked}
                    onChange={() => toggleChar(char.id)}
                    style={{ accentColor: color }}
                  />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 15, color: checked ? color : '#64748B' }}>
                    {char.name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <ModalActions
        onSubmit={submit}
        onClose={onClose}
        submitLabel={editing ? 'Save changes' : 'Log beat'}
        disabled={!name.trim()}
      />
    </Modal>
  );
}

// ── Modal primitives ──────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div style={mo.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={mo.modal}>
        <div style={mo.header}>
          <div style={mo.title}>{title}</div>
          <button style={mo.closeBtn} onClick={onClose} type='button'>×</button>
        </div>
        <div style={mo.body}>{children}</div>
      </div>
    </div>
  );
}

function ModalField({ label, value, onChange, placeholder, textarea, type }) {
  return (
    <div style={mf.field}>
      <div style={mf.label}>{label}</div>
      {textarea ? (
        <textarea
          style={{ ...mf.input, minHeight: 72, resize: 'vertical' }}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          style={mf.input}
          type={type || 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function ModalActions({ onSubmit, onClose, submitLabel, disabled }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
      <button style={mf.cancelBtn} onClick={onClose} type='button'>Cancel</button>
      <button
        style={{ ...mf.submitBtn, opacity: disabled ? 0.5 : 1 }}
        onClick={onSubmit}
        disabled={disabled}
        type='button'
      >
        {submitLabel}
      </button>
    </div>
  );
}

function CenterMessage({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(100,116,139,0.5)', fontFamily: 'DM Mono, monospace', fontSize: 15 }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = '#0891B2';
const BG     = '#F8FAFC';
const PANEL  = '#FFFFFF';
const EDGE   = 'rgba(148,163,184,0.2)';

const s = {
  page: {
    display:       'flex',
    flexDirection: 'column',
    height:        '100vh',
    background:    BG,
    color:         '#334155',
    fontFamily:    'DM Mono, monospace',
    overflow:      'hidden',
  },
  topbar: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '0 20px',
    height:         52,
    borderBottom:   `1px solid ${EDGE}`,
    flexShrink:     0,
    background:     'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(8px)',
  },
  topbarLeft: {
    display: 'flex', alignItems: 'baseline', gap: 12,
  },
  pageTitle: {
    fontSize: 13, letterSpacing: '0.24em', color: ACCENT, fontWeight: 600,
  },
  timelineName: {
    fontSize: 15, color: 'rgba(100,116,139,0.6)', letterSpacing: '0.06em',
  },
  topbarCenter: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  conflictBadge: {
    fontFamily: 'DM Mono, monospace', fontSize: 13, letterSpacing: '0.1em',
    padding: '4px 12px', borderRadius: 2, border: '1px solid', fontWeight: 600,
  },
  topbarRight: {
    display: 'flex', gap: 4,
  },
  viewBtn: {
    background: 'none', border: '1px solid',
    borderRadius: 3, fontFamily: 'DM Mono, monospace',
    fontSize: 12, letterSpacing: '0.12em', padding: '5px 10px',
    cursor: 'pointer', transition: 'all 0.12s',
  },
  body: {
    display: 'flex', flex: 1, overflow: 'hidden',
  },
  sidebar: {
    width: 220, flexShrink: 0,
    borderRight: `1px solid ${EDGE}`,
    overflowY: 'auto', padding: '12px 0',
    display: 'flex', flexDirection: 'column', gap: 0,
  },
  sideSection: {
    padding: '8px 0 16px',
    borderBottom: `1px solid ${EDGE}`,
  },
  sideSectionLabel: {
    fontSize: 11, letterSpacing: '0.2em', color: 'rgba(100,116,139,0.5)',
    padding: '0 14px 8px',
  },
  timelineBtn: {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '7px 14px', background: 'none', border: 'none',
    fontFamily: 'DM Mono, monospace', fontSize: 14,
    letterSpacing: '0.04em', cursor: 'pointer',
    transition: 'background 0.1s',
  },
  addBtn: {
    display: 'block', width: 'calc(100% - 28px)', margin: '8px 14px 0',
    background: 'none', border: '1px solid rgba(8,145,178,0.25)',
    borderRadius: 3, fontFamily: 'DM Mono, monospace', fontSize: 12,
    letterSpacing: '0.1em', color: '#0891B2',
    padding: '6px 10px', cursor: 'pointer', textAlign: 'left',
  },
  seedBtn: {
    display: 'block', width: 'calc(100% - 28px)', margin: '4px 14px 0',
    background: 'none', border: '1px dashed rgba(148,163,184,0.35)',
    borderRadius: 3, fontFamily: 'DM Mono, monospace', fontSize: 12,
    letterSpacing: '0.08em', color: 'rgba(100,116,139,0.5)',
    padding: '6px 10px', cursor: 'pointer', textAlign: 'left',
  },
  beatList: {
    display: 'flex', flexDirection: 'column', gap: 0,
  },
  beatListItem: {
    display: 'block', width: '100%', background: 'none', border: 'none',
    fontFamily: 'DM Mono, monospace', padding: '6px 14px',
    cursor: 'pointer', textAlign: 'left',
  },
  beatListName: {
    fontSize: 14, color: '#475569', letterSpacing: '0.02em',
    display: 'flex', alignItems: 'center', gap: 5,
  },
  beatListMeta: {
    fontSize: 12, color: 'rgba(100,116,139,0.6)', letterSpacing: '0.04em',
    marginTop: 2, display: 'flex', gap: 6,
  },
  beatTimeDot: {
    color: ACCENT, opacity: 0.7,
  },
  conflictFlag: {
    color: '#DC2626', fontSize: 13,
  },
  charRow: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 14px',
  },
  charDot: {
    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
  },
  charName: {
    fontSize: 14, letterSpacing: '0.04em', flex: 1,
    color: '#475569',
  },
  charRole: {
    fontSize: 12, color: 'rgba(100,116,139,0.6)', letterSpacing: '0.04em',
  },
  charDelete: {
    background: 'none', border: 'none', color: 'rgba(148,163,184,0.5)',
    fontSize: 17, cursor: 'pointer', padding: '0 2px', lineHeight: 1,
    flexShrink: 0,
  },
  main: {
    flex: 1, overflowY: 'auto', overflowX: 'hidden',
    display: 'flex', flexDirection: 'column', gap: 0,
  },
  toast: {
    position: 'fixed', bottom: 24, right: 24,
    fontFamily: 'DM Mono, monospace', fontSize: 14,
    letterSpacing: '0.08em', padding: '9px 16px',
    borderRadius: 3, border: '1px solid', zIndex: 9999,
    pointerEvents: 'none',
  },
};

// View styles
const v = {
  stripWrap: {
    padding: '20px 20px 0',
    display: 'flex', flexDirection: 'column', gap: 12,
    flex: 1,
  },
  stripLabel: {
    fontSize: 11, letterSpacing: '0.22em', color: 'rgba(100,116,139,0.5)',
    marginBottom: 4,
  },
  strip: {
    display: 'flex', gap: 12, overflowX: 'auto',
    padding: '4px 0 16px',
  },
  stripEmpty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 10, height: 240,
  },
  emptyGlyph: { fontSize: 38, color: 'rgba(8,145,178,0.25)' },
  emptyText:  { fontSize: 16, color: 'rgba(100,116,139,0.45)', fontFamily: 'DM Mono, monospace' },
  emptySub:   { fontSize: 13,  color: 'rgba(100,116,139,0.35)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.06em' },
  beatCard: {
    flexShrink: 0, width: 160, border: '1px solid',
    borderRadius: 6, padding: '12px 12px 10px',
    cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6,
    transition: 'border-color 0.12s, background 0.12s',
  },
  beatNum: {
    fontFamily: 'DM Mono, monospace', fontSize: 12,
    letterSpacing: '0.16em', color: ACCENT, marginBottom: 2,
  },
  beatName: {
    fontFamily: 'DM Mono, monospace', fontSize: 15,
    color: '#1E293B', letterSpacing: '0.02em',
    lineHeight: 1.3,
  },
  beatLocation: {
    fontFamily: 'DM Mono, monospace', fontSize: 13,
    color: '#64748B', letterSpacing: '0.04em',
    display: 'flex', alignItems: 'center', gap: 4,
  },
  locationDot: {
    color: ACCENT, fontSize: 11, opacity: 0.7,
  },
  beatTimeTag: {
    fontFamily: 'DM Mono, monospace', fontSize: 12,
    color: 'rgba(8,145,178,0.7)', letterSpacing: '0.06em',
  },
  beatCharDots: {
    display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2,
  },
  charDot: {
    width: 8, height: 8, borderRadius: '50%',
  },
  beatNote: {
    fontFamily: 'DM Mono, monospace', fontSize: 12,
    color: 'rgba(100,116,139,0.6)', lineHeight: 1.4, letterSpacing: '0.02em',
  },
  conflictFlag: {
    color: '#DC2626',
  },
};

// Movement map styles
const mm = {
  wrap: {
    padding: '20px', overflowX: 'auto',
  },
  headerRow: {
    display: 'flex', alignItems: 'center', marginBottom: 4,
  },
  charLabelCol: {
    width: 140, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
  },
  beatHeader: {
    width: 80, flexShrink: 0, textAlign: 'center',
    fontFamily: 'DM Mono, monospace', padding: '0 4px',
  },
  beatHeaderNum: {
    fontSize: 12, letterSpacing: '0.14em', marginBottom: 2,
  },
  beatHeaderName: {
    fontSize: 12, color: 'rgba(100,116,139,0.5)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  charRow: {
    display: 'flex', alignItems: 'center', height: 40,
    borderBottom: '1px solid rgba(148,163,184,0.12)',
  },
  charDot: {
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
  },
  charLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 14,
    letterSpacing: '0.04em', flex: 1,
  },
  beatCell: {
    width: 80, flexShrink: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  presenceDot: {
    width: 12, height: 12, borderRadius: '50%',
  },
  absentLine: {
    width: 20, height: 1, background: 'rgba(148,163,184,0.2)',
  },
};

// Location card styles
const lc = {
  wrap: { padding: '20px' },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 16, marginTop: 12,
  },
  card: {
    background: '#FFFFFF', border: '1px solid',
    borderRadius: 8, padding: '14px 16px', display: 'flex',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    flexDirection: 'column', gap: 10,
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  locIcon: {
    fontSize: 14, color: ACCENT, opacity: 0.7,
  },
  locName: {
    fontFamily: 'DM Mono, monospace', fontSize: 16,
    color: '#1E293B', flex: 1, letterSpacing: '0.04em',
  },
  conflictTag: {
    fontFamily: 'DM Mono, monospace', fontSize: 11,
    color: '#DC2626', letterSpacing: '0.1em',
  },
  charRow: {
    display: 'flex', flexWrap: 'wrap', gap: 6,
  },
  charChip: {
    display: 'flex', alignItems: 'center', gap: 5,
    background: 'rgba(148,163,184,0.08)', borderRadius: 2,
    padding: '3px 7px',
  },
  charDot: {
    width: 6, height: 6, borderRadius: '50%',
  },
  charName: {
    fontFamily: 'DM Mono, monospace', fontSize: 12, letterSpacing: '0.06em',
  },
  beats: {
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  beatRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'none', border: 'none', borderLeft: '2px solid',
    padding: '5px 8px', cursor: 'pointer', width: '100%', textAlign: 'left',
    borderRadius: '0 3px 3px 0',
  },
  beatName: {
    fontFamily: 'DM Mono, monospace', fontSize: 14,
    color: '#475569', flex: 1, letterSpacing: '0.02em',
  },
  beatTime: {
    fontFamily: 'DM Mono, monospace', fontSize: 12,
    color: 'rgba(8,145,178,0.6)',
  },
  conflictDot: {
    color: '#DC2626', fontSize: 13,
  },
};

// Conflict panel styles
const cp = {
  panel: {
    margin: '16px 20px',
    background: '#FEF2F2',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 6, padding: '14px 16px',
  },
  title: {
    fontFamily: 'DM Mono, monospace', fontSize: 12,
    letterSpacing: '0.18em', color: '#DC2626',
    marginBottom: 10, fontWeight: 600,
  },
  conflict: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '6px 0',
    borderTop: '1px solid rgba(239,68,68,0.15)',
  },
  charName: {
    fontFamily: 'DM Mono, monospace', fontSize: 14,
    letterSpacing: '0.04em', fontWeight: 600, minWidth: 100,
  },
  timeTag: {
    fontFamily: 'DM Mono, monospace', fontSize: 13,
    color: '#64748B', minWidth: 120,
  },
  locations: {
    display: 'flex', gap: 6, flexWrap: 'wrap',
  },
  locTag: {
    fontFamily: 'DM Mono, monospace', fontSize: 12,
    color: '#DC2626', background: 'rgba(239,68,68,0.06)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 2, padding: '2px 8px',
  },
};

// Beat detail panel styles
const bd = {
  panel: {
    width: 240, flexShrink: 0,
    borderLeft: `1px solid ${EDGE}`,
    display: 'flex', flexDirection: 'column',
    background: PANEL, padding: 16, gap: 0,
  },
  header: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 12,
  },
  beatName: {
    fontFamily: 'DM Mono, monospace', fontSize: 16,
    color: '#1E293B', lineHeight: 1.3, flex: 1,
  },
  closeBtn: {
    background: 'none', border: 'none',
    color: 'rgba(100,116,139,0.5)', fontSize: 22,
    cursor: 'pointer', padding: 0, lineHeight: 1, marginLeft: 8,
  },
  conflictAlert: {
    fontFamily: 'DM Mono, monospace', fontSize: 13,
    color: '#DC2626', background: '#FEF2F2',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 3, padding: '6px 10px', marginBottom: 12,
  },
  fields: { marginBottom: 12 },
  charSection: { marginBottom: 12 },
  charLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 11,
    letterSpacing: '0.18em', color: 'rgba(100,116,139,0.5)', marginBottom: 8,
  },
  charList: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  charChip: {
    display: 'flex', alignItems: 'center', gap: 5,
    background: 'rgba(148,163,184,0.08)', borderRadius: 2, padding: '3px 8px',
  },
  charDot: { width: 7, height: 7, borderRadius: '50%' },
  charName: { fontFamily: 'DM Mono, monospace', fontSize: 13 },
  actions: { display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 12 },
  editBtn: {
    flex: 1, background: 'none', border: '1px solid rgba(8,145,178,0.3)',
    borderRadius: 3, fontFamily: 'DM Mono, monospace', fontSize: 13,
    letterSpacing: '0.1em', color: ACCENT, padding: '7px 0', cursor: 'pointer',
  },
  deleteBtn: {
    background: 'none', border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 3, fontFamily: 'DM Mono, monospace', fontSize: 13,
    letterSpacing: '0.1em', color: '#DC2626', padding: '7px 12px', cursor: 'pointer',
  },
};

// Modal styles
const mo = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    background: '#FFFFFF', border: `1px solid ${EDGE}`,
    borderRadius: 8, width: 420, maxWidth: '90vw', maxHeight: '85vh',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 18px', borderBottom: `1px solid ${EDGE}`,
  },
  title: {
    fontFamily: 'DM Mono, monospace', fontSize: 14,
    letterSpacing: '0.16em', color: ACCENT,
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'rgba(100,116,139,0.5)',
    fontSize: 24, cursor: 'pointer', padding: 0, lineHeight: 1,
  },
  body: { padding: '18px', overflowY: 'auto' },
};

// Modal field styles
const mf = {
  field: { marginBottom: 14 },
  label: {
    fontFamily: 'DM Mono, monospace', fontSize: 11,
    letterSpacing: '0.18em', color: 'rgba(100,116,139,0.55)', marginBottom: 6,
  },
  input: {
    width: '100%', background: '#F8FAFC',
    border: '1px solid rgba(148,163,184,0.3)',
    borderRadius: 4, fontFamily: 'DM Mono, monospace', fontSize: 15,
    color: '#334155', padding: '8px 10px',
    boxSizing: 'border-box', outline: 'none',
  },
  cancelBtn: {
    background: 'none', border: '1px solid rgba(148,163,184,0.3)',
    borderRadius: 3, fontFamily: 'DM Mono, monospace', fontSize: 13,
    letterSpacing: '0.1em', color: '#64748B',
    padding: '8px 16px', cursor: 'pointer',
  },
  submitBtn: {
    background: 'rgba(8,145,178,0.08)', border: '1px solid rgba(8,145,178,0.35)',
    borderRadius: 3, fontFamily: 'DM Mono, monospace', fontSize: 13,
    letterSpacing: '0.1em', color: ACCENT, padding: '8px 18px', cursor: 'pointer',
  },
};

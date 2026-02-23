import React, { useState, useEffect, useCallback, useRef } from 'react';
import './ContinuityEnginePage.css';

const API = '/api/v1/continuity';

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function detectConflicts(beats, beatId, allCharacters) {
  const beat = beats.find(b => b.id === beatId);
  if (!beat) return [];
  const conflicts = [];
  const sameTime = beats.filter(
    b => b.id !== beatId && b.time_tag && beat.time_tag && b.time_tag === beat.time_tag
  );
  for (const other of sameTime) {
    const beatCharIds = (beat.characters || []).map(c => c.id);
    const overlap = (other.characters || []).filter(c => beatCharIds.includes(c.id));
    for (const char of overlap) {
      if (beat.location !== other.location) {
        conflicts.push({
          charId: char.id,
          charName: char.name,
          charColor: char.color,
          beat1: beat.name,
          beat2: other.name,
          location1: beat.location,
          location2: other.location,
          time: beat.time_tag,
        });
      }
    }
  }
  return conflicts;
}

function detectAllConflicts(beats) {
  const all = [];
  const seen = new Set();
  for (const beat of beats) {
    const cs = detectConflicts(beats, beat.id);
    for (const c of cs) {
      const key = [c.charId, c.beat1, c.beat2].sort().join('|');
      if (!seen.has(key)) { seen.add(key); all.push(c); }
    }
  }
  return all;
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function ContinuityEnginePage() {
  // ── State ──
  const [timelines, setTimelines] = useState([]);
  const [activeTimeline, setActiveTimeline] = useState(null);
  const [beats, setBeats] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [selectedBeatId, setSelectedBeatId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form: new beat
  const [newBeatName, setNewBeatName] = useState('');
  const [newBeatLocation, setNewBeatLocation] = useState('');
  const [newBeatTime, setNewBeatTime] = useState('');
  const [newBeatNote, setNewBeatNote] = useState('');
  const [newBeatCharIds, setNewBeatCharIds] = useState([]);

  // Form: new character
  const [newCharName, setNewCharName] = useState('');
  const [newCharRole, setNewCharRole] = useState('');
  const [newCharColor, setNewCharColor] = useState('#5b7fff');

  // Form: create timeline
  const [newTimelineTitle, setNewTimelineTitle] = useState('');

  // Toast
  const [toast, setToast] = useState({ msg: '', conflict: false, show: false });
  const toastTimer = useRef(null);

  // ── API helpers ──
  const api = useCallback(async (path, opts = {}) => {
    const res = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
    return res.json();
  }, []);

  const showToast = useCallback((msg, conflict = false) => {
    setToast({ msg, conflict, show: true });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 2800);
  }, []);

  // ── Load timelines ──
  const loadTimelines = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('/timelines');
      if (data.success) setTimelines(data.timelines || []);
    } catch (err) {
      console.error('[ContinuityEngine] Failed to load timelines:', err);
      setTimelines([]);
    }
    setLoading(false);
  }, [api]);

  // ── Load a single timeline ──
  const loadTimeline = useCallback(async (id) => {
    setLoading(true);
    const data = await api(`/timelines/${id}`);
    if (data.success && data.timeline) {
      setActiveTimeline(data.timeline);
      setCharacters(data.timeline.characters || []);
      const sortedBeats = (data.timeline.beats || []).sort((a, b) => a.sort_order - b.sort_order);
      setBeats(sortedBeats);
      if (sortedBeats.length > 0 && !selectedBeatId) {
        setSelectedBeatId(sortedBeats[0].id);
      }
    }
    setLoading(false);
  }, [api, selectedBeatId]);

  // Init
  useEffect(() => { loadTimelines(); }, [loadTimelines]);

  // ── Create timeline ──
  const createTimeline = async () => {
    if (!newTimelineTitle.trim()) return;
    const data = await api('/timelines', {
      method: 'POST',
      body: { title: newTimelineTitle.trim() },
    });
    if (data.success) {
      setNewTimelineTitle('');
      showToast('Timeline created');
      await loadTimelines();
      openTimeline(data.timeline.id);
    }
  };

  const openTimeline = (id) => {
    setSelectedBeatId(null);
    loadTimeline(id);
  };

  // ── Back to list ──
  const backToList = () => {
    setActiveTimeline(null);
    setBeats([]);
    setCharacters([]);
    setSelectedBeatId(null);
    loadTimelines();
  };

  // ── Add character ──
  const addCharacter = async () => {
    if (!newCharName.trim() || !activeTimeline) return;
    const data = await api(`/timelines/${activeTimeline.id}/characters`, {
      method: 'POST',
      body: { name: newCharName.trim(), role: newCharRole.trim() || null, color: newCharColor },
    });
    if (data.success) {
      setNewCharName('');
      setNewCharRole('');
      setNewCharColor('#5b7fff');
      showToast(`${data.character.name} added`);
      loadTimeline(activeTimeline.id);
    } else {
      showToast(data.error || 'Failed', true);
    }
  };

  // ── Add beat ──
  const addBeat = async () => {
    if (!newBeatName.trim() || !newBeatLocation.trim() || !newBeatTime.trim() || newBeatCharIds.length === 0) {
      showToast('Fill in name, location, time and at least one character.', true);
      return;
    }
    if (!activeTimeline) return;
    const data = await api(`/timelines/${activeTimeline.id}/beats`, {
      method: 'POST',
      body: {
        name: newBeatName.trim(),
        location: newBeatLocation.trim(),
        time_tag: newBeatTime.trim(),
        note: newBeatNote.trim() || null,
        character_ids: newBeatCharIds,
      },
    });
    if (data.success) {
      setNewBeatName('');
      setNewBeatLocation('');
      setNewBeatTime('');
      setNewBeatNote('');
      setNewBeatCharIds([]);
      await loadTimeline(activeTimeline.id);
      setSelectedBeatId(data.beat.id);
      // Check conflicts
      const updatedBeats = [...beats, data.beat];
      const conflicts = detectConflicts(updatedBeats, data.beat.id);
      if (conflicts.length > 0) {
        showToast(`Conflict detected — ${conflicts[0].charName} logged in two places.`, true);
      } else {
        showToast('Beat logged — no conflicts found.');
      }
    }
  };

  // ── Delete beat ──
  const deleteBeat = async (beatId) => {
    const data = await api(`/beats/${beatId}`, { method: 'DELETE' });
    if (data.success) {
      showToast('Beat deleted');
      if (selectedBeatId === beatId) setSelectedBeatId(null);
      loadTimeline(activeTimeline.id);
    }
  };

  // ── Seed demo ──
  const seedDemo = async () => {
    if (!activeTimeline) return;
    const data = await api(`/timelines/${activeTimeline.id}/seed-demo`, { method: 'POST' });
    if (data.success) {
      showToast('Demo data loaded');
      loadTimeline(activeTimeline.id);
    } else {
      showToast(data.error || 'Seed failed', true);
    }
  };

  // ── Toggle character for new beat ──
  const toggleNewBeatChar = (charId) => {
    setNewBeatCharIds(prev =>
      prev.includes(charId) ? prev.filter(c => c !== charId) : [...prev, charId]
    );
  };

  // ── Derived data ──
  const allConflicts = detectAllConflicts(beats);
  const selectedBeat = beats.find(b => b.id === selectedBeatId);
  const selectedConflicts = selectedBeatId ? detectConflicts(beats, selectedBeatId) : [];
  const selectedConflictCharIds = selectedConflicts.map(c => c.charId);

  /* ════════════════════════════════════════════════════════════════
     RENDER: Timeline list (landing)
     ════════════════════════════════════════════════════════════════ */
  if (!activeTimeline) {
    return (
      <div className="continuity-engine">
        <div className="ce-shell">
          <div className="ce-topbar">
            <div className="ce-topbar-brand">PNOS</div>
            <div className="ce-topbar-title">Continuity Engine</div>
          </div>

          <div className="ce-main-panel" style={{ maxHeight: 'none' }}>
            <div className="ce-scene-header">
              <div className="ce-scene-eyebrow">Timelines</div>
              <div className="ce-scene-title">Select or create a continuity timeline</div>
            </div>

            <div className="ce-create-row">
              <input
                className="ce-create-input"
                placeholder="New timeline title…"
                value={newTimelineTitle}
                onChange={e => setNewTimelineTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createTimeline()}
              />
              <button className="ce-create-btn" onClick={createTimeline}>Create →</button>
            </div>

            {loading ? (
              <div className="ce-loading">Loading timelines…</div>
            ) : timelines.length === 0 ? (
              <div className="ce-empty-state">No timelines yet — create one above.</div>
            ) : (
              <div className="ce-timeline-list">
                {timelines.map(tl => (
                  <div key={tl.id} className="ce-timeline-card" onClick={() => openTimeline(tl.id)}>
                    <div className="ce-timeline-card-title">{tl.title}</div>
                    <div className="ce-timeline-card-meta">
                      {(tl.characters || []).length} characters · {(tl.beats || []).length} beats
                      {tl.season_tag ? ` · ${tl.season_tag}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={`ce-toast ${toast.show ? 'show' : ''} ${toast.conflict ? 'conflict' : ''}`}>
          {toast.msg}
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════
     RENDER: Active timeline
     ════════════════════════════════════════════════════════════════ */
  return (
    <div className="continuity-engine">
      <div className="ce-shell">

        {/* ── Topbar ── */}
        <div className="ce-topbar">
          <button className="ce-back" onClick={backToList}>← Timelines</button>
          <div className="ce-topbar-brand">PNOS</div>
          <div className="ce-topbar-title">Continuity Engine</div>
          <div
            className={`ce-conflict-counter ${allConflicts.length === 0 ? 'none' : ''}`}
          >
            {allConflicts.length === 0
              ? '✓ No conflicts'
              : `⚠ ${allConflicts.length} conflict${allConflicts.length > 1 ? 's' : ''}`}
          </div>
          <div className="ce-topbar-scene">
            {selectedBeat ? selectedBeat.name : 'Select a beat to inspect'}
          </div>
        </div>

        <div className="ce-body">

          {/* ── Timeline sidebar ── */}
          <aside className="ce-timeline-panel">
            <div className="ce-panel-label">Scene Beats</div>
            {beats.map((b, i) => {
              const bConflicts = detectConflicts(beats, b.id);
              const hasConflict = bConflicts.length > 0;
              return (
                <div
                  key={b.id}
                  className={`ce-beat-item ${hasConflict ? 'has-conflict' : ''} ${selectedBeatId === b.id ? 'active' : ''}`}
                  onClick={() => setSelectedBeatId(b.id)}
                >
                  {hasConflict && <div className="ce-conflict-flag">CONFLICT</div>}
                  <div className="ce-beat-num">
                    BEAT {String(i + 1).padStart(2, '0')} · {b.time_tag || '—'}
                  </div>
                  <div className="ce-beat-name">{b.name}</div>
                  <div className="ce-beat-location">{b.location}</div>
                  <div className="ce-beat-chars">
                    {(b.characters || []).map(c => (
                      <div
                        key={c.id}
                        className="ce-char-pip"
                        style={{ background: c.color }}
                        title={c.name}
                      >
                        {c.name[0]}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {beats.length === 0 && (
              <div className="ce-empty-state" style={{ padding: '20px' }}>
                No beats yet
              </div>
            )}
          </aside>

          {/* ── Main panel ── */}
          <main className="ce-main-panel">

            {/* Add character */}
            <div className="ce-add-char-section">
              <div className="ce-add-char-title">+ Add Character</div>
              <div className="ce-add-char-row">
                <div className="ce-field-group">
                  <div className="ce-field-label">Name</div>
                  <input
                    className="ce-field-input"
                    placeholder="e.g. Frankie"
                    value={newCharName}
                    onChange={e => setNewCharName(e.target.value)}
                  />
                </div>
                <div className="ce-field-group">
                  <div className="ce-field-label">Role</div>
                  <input
                    className="ce-field-input"
                    placeholder="e.g. Protagonist"
                    value={newCharRole}
                    onChange={e => setNewCharRole(e.target.value)}
                  />
                </div>
                <div className="ce-field-group">
                  <div className="ce-field-label">Color</div>
                  <input
                    type="color"
                    className="ce-color-input"
                    value={newCharColor}
                    onChange={e => setNewCharColor(e.target.value)}
                  />
                </div>
                <button className="ce-create-btn" onClick={addCharacter}>Add</button>
                <button className="ce-seed-btn" onClick={seedDemo}>Seed Demo</button>
              </div>

              {characters.length > 0 && (
                <div className="ce-char-toggles" style={{ marginTop: 12 }}>
                  {characters.map(c => (
                    <span key={c.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 10, color: c.color, letterSpacing: '0.06em',
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', background: c.color, display: 'inline-block'
                      }} />
                      {c.name}
                      <span style={{ color: 'var(--text-muted)', marginRight: 10 }}>{c.role || ''}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Add beat */}
            <div className="ce-add-beat-section">
              <div className="ce-add-beat-title">+ Log New Scene Beat</div>
              <div className="ce-form-grid">
                <div className="ce-field-group">
                  <div className="ce-field-label">Beat Name</div>
                  <input
                    className="ce-field-input"
                    placeholder="e.g. Frankie arrives at Mond's"
                    value={newBeatName}
                    onChange={e => setNewBeatName(e.target.value)}
                  />
                </div>
                <div className="ce-field-group">
                  <div className="ce-field-label">Location</div>
                  <input
                    className="ce-field-input"
                    placeholder="e.g. Mond's Café"
                    value={newBeatLocation}
                    onChange={e => setNewBeatLocation(e.target.value)}
                  />
                </div>
                <div className="ce-field-group ce-form-full">
                  <div className="ce-field-label">Time / Episode Tag</div>
                  <input
                    className="ce-field-input"
                    placeholder="e.g. Ep 03 · Evening · 7:30pm"
                    value={newBeatTime}
                    onChange={e => setNewBeatTime(e.target.value)}
                  />
                </div>
                <div className="ce-field-group ce-form-full">
                  <div className="ce-field-label">Characters Present</div>
                  <div className="ce-char-toggles">
                    {characters.map(c => {
                      const sel = newBeatCharIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          className={`ce-char-toggle ${sel ? 'selected' : ''}`}
                          style={{
                            color: c.color,
                            borderColor: sel ? c.color : c.color + '22',
                            background: sel ? c.color + '22' : 'none',
                          }}
                          onClick={() => toggleNewBeatChar(c.id)}
                        >
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%', background: c.color, display: 'inline-block'
                          }} />
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="ce-field-group ce-form-full">
                  <div className="ce-field-label">Scene Note (optional)</div>
                  <input
                    className="ce-field-input"
                    placeholder="e.g. Will the Fan runs into them here"
                    value={newBeatNote}
                    onChange={e => setNewBeatNote(e.target.value)}
                  />
                </div>
              </div>
              <button className="ce-create-btn" onClick={addBeat}>Log Beat →</button>
            </div>

            {/* Conflict / OK alert */}
            {selectedBeat && selectedConflicts.length > 0 && (
              <div className="ce-conflict-alert">
                <div className="ce-conflict-alert-title">⚠ Continuity Conflicts Detected</div>
                <ul className="ce-conflict-list">
                  {selectedConflicts.map((c, i) => (
                    <li key={i}>
                      <strong>{c.charName}</strong> can't be at <strong>{c.location1}</strong> and{' '}
                      <strong>{c.location2}</strong> at the same time ({c.time}).
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedBeat && selectedConflicts.length === 0 && (
              <div className="ce-ok-alert">
                <span>✓</span>
                <span>All character locations check out for "{selectedBeat.name}."</span>
              </div>
            )}

            {/* Beat detail */}
            {selectedBeat ? (
              <>
                <div className="ce-scene-header">
                  <div className="ce-scene-eyebrow">
                    Beat {String(beats.indexOf(selectedBeat) + 1).padStart(2, '0')} · {selectedBeat.time_tag || '—'}
                  </div>
                  <div className="ce-scene-title">
                    {selectedBeat.name}
                    <button className="ce-delete-beat-btn" onClick={() => deleteBeat(selectedBeat.id)}>
                      Delete Beat
                    </button>
                  </div>
                  <div className="ce-scene-meta">
                    {selectedBeat.location}{selectedBeat.note ? ` · ${selectedBeat.note}` : ''}
                  </div>
                </div>

                {/* Timeline strip */}
                <div className="ce-strip-section">
                  <div className="ce-strip-label">Full Timeline Trace</div>
                  <div className="ce-timeline-strip">
                    {beats.map((b, i) => {
                      const hasC = detectConflicts(beats, b.id).length > 0;
                      return (
                        <div
                          key={b.id}
                          className={`ce-strip-beat ${b.id === selectedBeatId ? 'current' : ''} ${hasC ? 'conflict-beat' : ''}`}
                          onClick={() => setSelectedBeatId(b.id)}
                        >
                          <div className="ce-strip-beat-num">{String(i + 1).padStart(2, '0')}</div>
                          <div className="ce-strip-beat-name">{b.name}</div>
                          <div className="ce-strip-char-dots">
                            {(b.characters || []).map(c => (
                              <div
                                key={c.id}
                                style={{
                                  width: 6, height: 6, borderRadius: '50%', background: c.color,
                                }}
                                title={c.name}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Character movement map */}
                <div className="ce-trace-section">
                  <div className="ce-strip-label">Character Movement Map</div>
                  {characters.map(char => (
                    <div key={char.id} className="ce-trace-row">
                      <div className="ce-trace-char-label">
                        <div
                          className="ce-char-pip"
                          style={{ background: char.color, width: 22, height: 22, fontSize: 10 }}
                        >
                          {char.name[0]}
                        </div>
                        <div className="ce-trace-char-name">{char.name}</div>
                      </div>
                      <div className="ce-trace-path">
                        {beats.map(b => {
                          const present = (b.characters || []).some(c => c.id === char.id);
                          const isConflict =
                            b.id === selectedBeatId &&
                            selectedConflictCharIds.includes(char.id) &&
                            present;
                          if (present) {
                            return (
                              <div
                                key={b.id}
                                className={`ce-trace-cell ${isConflict ? 'conflict-cell' : ''}`}
                                style={
                                  isConflict
                                    ? {}
                                    : {
                                        background: char.color,
                                        opacity: b.id === selectedBeatId ? 1 : 0.45,
                                      }
                                }
                                title={b.name}
                                onClick={() => setSelectedBeatId(b.id)}
                              >
                                {b.location.split(' ')[0]}
                              </div>
                            );
                          }
                          return (
                            <div
                              key={b.id}
                              className="ce-trace-cell empty"
                              onClick={() => setSelectedBeatId(b.id)}
                            >
                              —
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Location cards */}
                <div>
                  <div className="ce-strip-label">Character Locations This Beat</div>
                  <div className="ce-location-grid">
                    {characters.map(char => {
                      const sameTimeBeats = beats.filter(
                        b => b.time_tag && selectedBeat.time_tag && b.time_tag === selectedBeat.time_tag
                      );
                      const presentBeat = sameTimeBeats.find(b =>
                        (b.characters || []).some(c => c.id === char.id)
                      );
                      const isConflict = selectedConflictCharIds.includes(char.id);
                      const isHere = (selectedBeat.characters || []).some(c => c.id === char.id);
                      return (
                        <div
                          key={char.id}
                          className={`ce-char-location-card ${isConflict ? 'conflict-char' : ''} ${isHere && !isConflict ? 'confirmed' : ''}`}
                        >
                          <div className="ce-clf-top">
                            <div className="ce-clf-avatar" style={{ background: char.color }}>
                              {char.name[0]}
                            </div>
                            <div>
                              <div className="ce-clf-name">{char.name}</div>
                              <div className="ce-clf-role">{char.role || '—'}</div>
                            </div>
                          </div>
                          <div className="ce-clf-location">
                            {presentBeat ? presentBeat.location : 'Location unknown'}
                          </div>
                          <div className="ce-clf-with">
                            {presentBeat
                              ? 'With: ' +
                                ((presentBeat.characters || [])
                                  .filter(c => c.id !== char.id)
                                  .map(c => c.name)
                                  .join(', ') || 'Alone')
                              : '—'}
                          </div>
                          {isConflict && (
                            <div className="ce-clf-conflict-note">
                              ⚠ Logged in{' '}
                              {sameTimeBeats.filter(b =>
                                (b.characters || []).some(c => c.id === char.id)
                              ).length}{' '}
                              locations simultaneously
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="ce-empty-state">
                {beats.length === 0
                  ? 'Log your first scene beat above — conflicts will be detected automatically.'
                  : 'Select a beat from the sidebar to inspect.'}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Toast */}
      <div className={`ce-toast ${toast.show ? 'show' : ''} ${toast.conflict ? 'conflict' : ''}`}>
        {toast.msg}
      </div>
    </div>
  );
}

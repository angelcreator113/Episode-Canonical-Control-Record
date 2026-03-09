/**
 * NarrativeControlCenter.jsx — Tier Features Hub
 *
 * Unified dashboard for all narrative intelligence features:
 *
 * Tabs:
 *   1. Pipeline       — 7-step story pipeline tracker
 *   2. Continuity     — Story continuity checker + franchise guard
 *   3. Character Arcs — Character arc visualization timeline
 *   4. Rel. Timeline  — Relationship event timeline
 *   5. World Timeline — World calendar / event timeline
 *   6. Locations      — Location database
 *   7. Snapshots      — World-state snapshots
 *   8. Threads        — Story thread tracker + dead thread detection
 *   9. Plot Holes     — Plot hole & revision history
 */
import { useState, useEffect, useCallback } from 'react';

const API = '/api/v1';

// ── Design Tokens ────────────────────────────────────────────────────────
const T = {
  parchment:  '#FAF7F0',
  gold:       '#C9A84C',
  goldDark:   '#b0922e',
  ink:        '#1C1814',
  inkLight:   '#4a4540',
  lavender:   '#8b6db5',
  blush:      '#d4607a',
  slate:      '#64748b',
  white:      '#ffffff',
  border:     '#e8e4dd',
  shadow:     '0 2px 12px rgba(0,0,0,.08)',
  radius:     '10px',
  radiusSm:   '6px',
  font:       "'DM Sans', 'Segoe UI', sans-serif",
  fontSerif:  "'Cormorant Garamond', 'Lora', Georgia, serif",
};

const STEPS = ['brief', 'generate', 'read', 'evaluate', 'memory', 'registry', 'write_back'];
const STEP_LABELS = { brief: 'Brief', generate: 'Generate', read: 'Read', evaluate: 'Evaluate', memory: 'Memory', registry: 'Registry', write_back: 'Write-Back' };
const STEP_COLORS = { brief: '#64748b', generate: '#3b82f6', read: '#8b5cf6', evaluate: '#f59e0b', memory: '#14b8a6', registry: '#ec4899', write_back: '#22c55e' };

const fetchJSON = async (url, opts = {}) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '', ...opts.headers } });
  return res.json();
};

// ═══════════════════════════════════════════════════════════════════════════
// TAB: Pipeline Dashboard
// ═══════════════════════════════════════════════════════════════════════════
function PipelineTab() {
  const [pipelines, setPipelines] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJSON(`${API}/tier/pipeline`).then(data => {
      setPipelines(data.pipelines || []);
      setStats(data.stats || null);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: T.slate }}>Loading pipeline...</div>;

  return (
    <div>
      {/* Stats bar */}
      {stats && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <StatCard label="Total Stories" value={stats.total} color="#3b82f6" />
          <StatCard label="In Progress" value={stats.in_progress} color="#f59e0b" />
          <StatCard label="Completed" value={stats.completed} color="#22c55e" />
          {STEPS.map(s => (
            <StatCard key={s} label={STEP_LABELS[s]} value={stats.by_step?.[s] || 0} color={STEP_COLORS[s]} small />
          ))}
        </div>
      )}

      {/* Pipeline cards */}
      {pipelines.length === 0 && <EmptyState text="No pipeline entries yet. Generate a story to start tracking." />}
      {pipelines.map(p => (
        <div key={p.id} style={{ ...cardStyle, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: T.ink }}>Story: {p.story_id?.substring(0, 8)}...</span>
            <span style={{ fontSize: 12, color: T.slate }}>{p.completed_at ? 'Completed' : 'In Progress'}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
            {STEPS.map((s, i) => {
              const isActive = s === p.current_step;
              const isPast = STEPS.indexOf(p.current_step) > i;
              const stepData = p[`step_${s}`] || {};
              const done = !!stepData.completed_at || isPast;
              return (
                <div key={s} style={{
                  flex: 1, padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: isActive ? 700 : 400,
                  background: done ? STEP_COLORS[s] + '22' : isActive ? STEP_COLORS[s] + '44' : '#f5f5f5',
                  color: done || isActive ? STEP_COLORS[s] : T.slate,
                  borderRadius: 6, border: isActive ? `2px solid ${STEP_COLORS[s]}` : '1px solid transparent',
                }}>
                  {done ? '\u2713' : isActive ? '\u25CF' : '\u25CB'} {STEP_LABELS[s]}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: Continuity Checker
// ═══════════════════════════════════════════════════════════════════════════
function ContinuityTab() {
  const [sceneText, setSceneText] = useState('');
  const [characters, setCharacters] = useState('');
  const [registryId, setRegistryId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [franchiseResult, setFranchiseResult] = useState(null);
  const [fLoading, setFLoading] = useState(false);

  // Auto-load default registry
  useEffect(() => {
    fetchJSON(`${API}/character-registry/registries/default`).then(data => {
      if (data.registry?.id) setRegistryId(data.registry.id);
    }).catch(() => {});
  }, []);

  const runCheck = async () => {
    if (!sceneText.trim()) return;
    setLoading(true);
    const data = await fetchJSON(`${API}/tier/continuity-check`, {
      method: 'POST',
      body: JSON.stringify({ scene_text: sceneText, characters_in_scene: characters.split(',').map(s => s.trim()).filter(Boolean), registry_id: registryId }),
    });
    setResult(data);
    setLoading(false);
  };

  const runFranchiseGuard = async () => {
    if (!sceneText.trim()) return;
    setFLoading(true);
    const data = await fetchJSON(`${API}/tier/franchise-guard-check`, {
      method: 'POST',
      body: JSON.stringify({ scene_text: sceneText }),
    });
    setFranchiseResult(data);
    setFLoading(false);
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Characters (comma-separated keys)</label>
        <input value={characters} onChange={e => setCharacters(e.target.value)} style={inputStyle} placeholder="lala, marcus, diane" />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Scene Text</label>
        <textarea value={sceneText} onChange={e => setSceneText(e.target.value)} style={{ ...inputStyle, minHeight: 200 }} placeholder="Paste scene text to check..." />
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button onClick={runCheck} disabled={loading} style={btnStyle}>{loading ? 'Checking...' : 'Run Continuity Check'}</button>
        <button onClick={runFranchiseGuard} disabled={fLoading} style={{ ...btnStyle, background: T.lavender }}>{fLoading ? 'Checking...' : 'Run Franchise Guard'}</button>
      </div>

      {result && (
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Continuity Score: <span style={{ color: result.continuity_score >= 80 ? '#22c55e' : result.continuity_score >= 50 ? '#f59e0b' : '#ef4444' }}>{result.continuity_score}/100</span></h3>
          <p style={{ fontSize: 14, color: T.inkLight, marginBottom: 16 }}>{result.summary}</p>
          {result.violations?.map((v, i) => (
            <div key={i} style={{ padding: 12, marginBottom: 8, background: v.severity === 'critical' ? '#fef2f2' : v.severity === 'warning' ? '#fffbeb' : '#f0fdf4', borderRadius: 8, border: `1px solid ${v.severity === 'critical' ? '#fecaca' : v.severity === 'warning' ? '#fde68a' : '#bbf7d0'}` }}>
              <div style={{ fontWeight: 600, fontSize: 13, textTransform: 'uppercase', color: v.severity === 'critical' ? '#dc2626' : v.severity === 'warning' ? '#d97706' : '#16a34a' }}>{v.severity} — {v.type}</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>{v.description}</div>
              {v.suggestion && <div style={{ fontSize: 13, color: T.slate, marginTop: 4 }}>Fix: {v.suggestion}</div>}
            </div>
          ))}
        </div>
      )}

      {franchiseResult && (
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Franchise Guard Score: <span style={{ color: franchiseResult.score >= 80 ? '#22c55e' : '#ef4444' }}>{franchiseResult.score}/100</span></h3>
          <p style={{ fontSize: 14, color: T.inkLight }}>{franchiseResult.summary}</p>
          {franchiseResult.violations?.map((v, i) => (
            <div key={i} style={{ padding: 12, marginBottom: 8, background: v.severity === 'critical' ? '#fef2f2' : '#fffbeb', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: v.severity === 'critical' ? '#dc2626' : '#d97706' }}>{v.severity}: {v.law_title}</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>{v.violation_description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: Character Arc Visualization
// ═══════════════════════════════════════════════════════════════════════════
function CharacterArcTab() {
  const [chars, setChars] = useState([]);
  const [selectedChar, setSelectedChar] = useState(null);
  const [arcData, setArcData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchJSON(`${API}/character-registry/registries/default`).then(data => {
      if (data.registry?.characters) setChars(data.registry.characters);
    }).catch(() => {});
  }, []);

  const loadArc = useCallback(async (charId) => {
    setSelectedChar(charId);
    setLoading(true);
    const data = await fetchJSON(`${API}/tier/character-arc/${charId}`);
    setArcData(data);
    setLoading(false);
  }, []);

  const nodeColors = { growth: '#3b82f6', transformation: '#a855f7', belief_shift: '#f59e0b', pain_point: '#ef4444', character_dynamic: '#14b8a6', relationship_event: '#ec4899' };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {chars.map(c => (
          <button key={c.id} onClick={() => loadArc(c.id)} style={{ ...btnStyle, background: selectedChar === c.id ? T.gold : '#f5f5f5', color: selectedChar === c.id ? T.white : T.ink, fontSize: 13, padding: '6px 14px' }}>
            {c.icon || ''} {c.display_name || c.character_key}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', color: T.slate, padding: 40 }}>Loading arc...</div>}

      {arcData && !loading && (
        <div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            <StatCard label="Growth Events" value={arcData.growth_count} color="#3b82f6" />
            <StatCard label="Transformations" value={arcData.transformation_count} color="#a855f7" />
            <StatCard label="Relationship Events" value={arcData.relationship_event_count} color="#ec4899" />
          </div>

          {arcData.arc_nodes?.length === 0 && <EmptyState text="No arc data yet. Generate stories and confirm memories to build the arc." />}

          {/* Timeline visualization */}
          <div style={{ position: 'relative', paddingLeft: 32 }}>
            {arcData.arc_nodes?.map((node, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 16, position: 'relative' }}>
                {/* Timeline line */}
                {i < arcData.arc_nodes.length - 1 && (
                  <div style={{ position: 'absolute', left: -20, top: 20, width: 2, height: 'calc(100% + 16px)', background: T.border }} />
                )}
                {/* Dot */}
                <div style={{ position: 'absolute', left: -26, top: 6, width: 14, height: 14, borderRadius: '50%', background: nodeColors[node.type] || T.slate, border: `2px solid ${T.white}`, boxShadow: T.shadow }} />
                {/* Content */}
                <div style={{ ...cardStyle, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: nodeColors[node.type] || T.slate }}>{node.type.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: 11, color: T.slate }}>{new Date(node.date).toLocaleDateString()}</span>
                  </div>
                  {node.statement && <div style={{ fontSize: 14, color: T.ink }}>{node.statement}</div>}
                  {node.field && <div style={{ fontSize: 14, color: T.ink }}><strong>{node.field}:</strong> {node.from} → {node.to}</div>}
                  {node.title && <div style={{ fontSize: 14, color: T.ink, fontWeight: 600 }}>{node.title}</div>}
                  {node.description && <div style={{ fontSize: 13, color: T.inkLight, marginTop: 4 }}>{node.description}</div>}
                  {node.tension_before != null && (
                    <div style={{ fontSize: 12, color: T.slate, marginTop: 4 }}>Tension: {node.tension_before} → {node.tension_after}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: Relationship Timeline
// ═══════════════════════════════════════════════════════════════════════════
function RelTimelineTab() {
  const [relationships, setRelationships] = useState([]);
  const [selectedRel, setSelectedRel] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ event_type: 'milestone', title: '', description: '', tension_before: 5, tension_after: 5, relationship_stage: '' });

  useEffect(() => {
    fetchJSON(`${API}/relationships`).then(data => {
      setRelationships(data.relationships || data || []);
      setLoading(false);
    });
  }, []);

  const loadEvents = async (relId) => {
    setSelectedRel(relId);
    const data = await fetchJSON(`${API}/tier/relationship-events/${relId}`);
    setEvents(data.events || []);
  };

  const addEvent = async () => {
    if (!form.title.trim() || !selectedRel) return;
    await fetchJSON(`${API}/tier/relationship-events`, {
      method: 'POST',
      body: JSON.stringify({ ...form, relationship_id: selectedRel }),
    });
    setShowForm(false);
    setForm({ event_type: 'milestone', title: '', description: '', tension_before: 5, tension_after: 5, relationship_stage: '' });
    loadEvents(selectedRel);
  };

  const stageColors = { strangers: '#94a3b8', acquaintances: '#64748b', friends: '#3b82f6', close_friends: '#2563eb', lovers: '#ec4899', partners: '#a855f7', exes: '#ef4444', enemies: '#dc2626' };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: T.slate }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', gap: 20 }}>
      {/* Relationship list */}
      <div style={{ width: 260, flexShrink: 0 }}>
        <h3 style={{ fontSize: 14, color: T.slate, marginBottom: 12 }}>Relationships</h3>
        {relationships.map(r => {
          const nameA = r.characterA?.display_name || r.char_a_name || '?';
          const nameB = r.characterB?.display_name || r.char_b_name || '?';
          return (
            <div key={r.id} onClick={() => loadEvents(r.id)} style={{ padding: '10px 14px', marginBottom: 6, background: selectedRel === r.id ? T.gold + '22' : T.white, border: `1px solid ${selectedRel === r.id ? T.gold : T.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{nameA} ↔ {nameB}</div>
              <div style={{ fontSize: 12, color: T.slate }}>{r.relationship_type} · {r.status}</div>
            </div>
          );
        })}
      </div>

      {/* Timeline */}
      <div style={{ flex: 1 }}>
        {selectedRel && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, margin: 0 }}>Timeline</h3>
            <button onClick={() => setShowForm(!showForm)} style={btnStyle}>+ Add Event</button>
          </div>
        )}

        {showForm && (
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Event Type</label>
                <select value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })} style={inputStyle}>
                  {['first_meeting', 'betrayal', 'reconciliation', 'confession', 'breakup', 'escalation', 'milestone'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Relationship Stage</label>
                <select value={form.relationship_stage} onChange={e => setForm({ ...form, relationship_stage: e.target.value })} style={inputStyle}>
                  <option value="">—</option>
                  {['strangers', 'acquaintances', 'friends', 'close_friends', 'lovers', 'partners', 'exes', 'enemies'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Title</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} placeholder="What happened?" />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, minHeight: 80 }} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <div>
                <label style={labelStyle}>Tension Before (0-10)</label>
                <input type="number" min={0} max={10} value={form.tension_before} onChange={e => setForm({ ...form, tension_before: +e.target.value })} style={{ ...inputStyle, width: 80 }} />
              </div>
              <div>
                <label style={labelStyle}>Tension After (0-10)</label>
                <input type="number" min={0} max={10} value={form.tension_after} onChange={e => setForm({ ...form, tension_after: +e.target.value })} style={{ ...inputStyle, width: 80 }} />
              </div>
            </div>
            <button onClick={addEvent} style={{ ...btnStyle, marginTop: 12 }}>Save Event</button>
          </div>
        )}

        {!selectedRel && <EmptyState text="Select a relationship to view its timeline." />}

        {selectedRel && events.length === 0 && <EmptyState text="No timeline events yet. Add one to start tracking turning points." />}

        {/* Timeline nodes */}
        <div style={{ position: 'relative', paddingLeft: 32 }}>
          {events.map((evt, i) => (
            <div key={evt.id} style={{ display: 'flex', gap: 12, marginBottom: 16, position: 'relative' }}>
              {i < events.length - 1 && <div style={{ position: 'absolute', left: -20, top: 20, width: 2, height: 'calc(100% + 16px)', background: T.border }} />}
              <div style={{ position: 'absolute', left: -26, top: 6, width: 14, height: 14, borderRadius: '50%', background: stageColors[evt.relationship_stage] || T.gold, border: `2px solid ${T.white}`, boxShadow: T.shadow }} />
              <div style={{ ...cardStyle, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: T.lavender }}>{evt.event_type.replace(/_/g, ' ')}</span>
                  {evt.relationship_stage && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: (stageColors[evt.relationship_stage] || T.slate) + '22', color: stageColors[evt.relationship_stage] || T.slate }}>{evt.relationship_stage.replace(/_/g, ' ')}</span>}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{evt.title}</div>
                {evt.description && <div style={{ fontSize: 13, color: T.inkLight, marginTop: 4 }}>{evt.description}</div>}
                {evt.tension_before != null && (
                  <div style={{ fontSize: 12, color: T.slate, marginTop: 6 }}>
                    Tension: {evt.tension_before} → {evt.tension_after} {evt.tension_after > evt.tension_before ? '\u2191' : evt.tension_after < evt.tension_before ? '\u2193' : '\u2194'}
                  </div>
                )}
                <div style={{ fontSize: 11, color: T.slate, marginTop: 4 }}>{new Date(evt.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: World Timeline
// ═══════════════════════════════════════════════════════════════════════════
function WorldTimelineTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ event_name: '', event_description: '', story_date: '', event_type: 'plot', impact_level: 'minor' });

  const load = useCallback(() => {
    fetchJSON(`${API}/tier/world-timeline`).then(data => {
      setEvents(data.events || []);
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const addEvent = async () => {
    if (!form.event_name.trim()) return;
    await fetchJSON(`${API}/tier/world-timeline`, { method: 'POST', body: JSON.stringify(form) });
    setShowForm(false);
    setForm({ event_name: '', event_description: '', story_date: '', event_type: 'plot', impact_level: 'minor' });
    load();
  };

  const deleteEvent = async (id) => {
    await fetchJSON(`${API}/tier/world-timeline/${id}`, { method: 'DELETE' });
    load();
  };

  const impactColors = { minor: '#64748b', moderate: '#f59e0b', major: '#ef4444', catastrophic: '#7c2d12' };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: T.slate }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>World Timeline ({events.length} events)</h3>
        <button onClick={() => setShowForm(!showForm)} style={btnStyle}>+ Add Event</button>
      </div>

      {showForm && (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Event Name</label><input value={form.event_name} onChange={e => setForm({ ...form, event_name: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Story Date</label><input value={form.story_date} onChange={e => setForm({ ...form, story_date: e.target.value })} style={inputStyle} placeholder="e.g. Season 1, Week 3" /></div>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })} style={inputStyle}>
                {['plot', 'backstory', 'world', 'character', 'relationship'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Impact</label>
              <select value={form.impact_level} onChange={e => setForm({ ...form, impact_level: e.target.value })} style={inputStyle}>
                {['minor', 'moderate', 'major', 'catastrophic'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}><label style={labelStyle}>Description</label><textarea value={form.event_description} onChange={e => setForm({ ...form, event_description: e.target.value })} style={{ ...inputStyle, minHeight: 80 }} /></div>
          <button onClick={addEvent} style={{ ...btnStyle, marginTop: 12 }}>Save Event</button>
        </div>
      )}

      {events.length === 0 && <EmptyState text="No world timeline events. Add key story events to track your world's chronology." />}

      <div style={{ position: 'relative', paddingLeft: 32 }}>
        {events.map((evt, i) => (
          <div key={evt.id} style={{ display: 'flex', gap: 12, marginBottom: 16, position: 'relative' }}>
            {i < events.length - 1 && <div style={{ position: 'absolute', left: -20, top: 20, width: 2, height: 'calc(100% + 16px)', background: T.border }} />}
            <div style={{ position: 'absolute', left: -26, top: 6, width: 14, height: 14, borderRadius: '50%', background: impactColors[evt.impact_level] || T.slate, border: `2px solid ${T.white}`, boxShadow: T.shadow }} />
            <div style={{ ...cardStyle, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: impactColors[evt.impact_level] || T.slate }}>{evt.event_type} · {evt.impact_level}</span>
                  {evt.story_date && <span style={{ fontSize: 12, color: T.slate, marginLeft: 8 }}>{evt.story_date}</span>}
                </div>
                <button onClick={() => deleteEvent(evt.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>\u00D7</button>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{evt.event_name}</div>
              {evt.event_description && <div style={{ fontSize: 13, color: T.inkLight, marginTop: 4 }}>{evt.event_description}</div>}
              {evt.consequences?.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 12, color: T.slate }}>Consequences: {evt.consequences.join(', ')}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: Locations
// ═══════════════════════════════════════════════════════════════════════════
function LocationsTab() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', location_type: 'interior', narrative_role: '', sensory_details: { sight: '', sound: '', smell: '', texture: '', atmosphere: '' } });

  const load = useCallback(() => {
    fetchJSON(`${API}/tier/world-locations`).then(data => {
      setLocations(data.locations || []);
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const addLocation = async () => {
    if (!form.name.trim()) return;
    await fetchJSON(`${API}/tier/world-locations`, { method: 'POST', body: JSON.stringify(form) });
    setShowForm(false);
    setForm({ name: '', description: '', location_type: 'interior', narrative_role: '', sensory_details: { sight: '', sound: '', smell: '', texture: '', atmosphere: '' } });
    load();
  };

  const deleteLocation = async (id) => {
    await fetchJSON(`${API}/tier/world-locations/${id}`, { method: 'DELETE' });
    load();
  };

  const typeIcons = { interior: '\uD83C\uDFE0', exterior: '\uD83C\uDF33', virtual: '\uD83D\uDCBB', transitional: '\uD83D\uDEB6' };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: T.slate }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Locations ({locations.length})</h3>
        <button onClick={() => setShowForm(!showForm)} style={btnStyle}>+ Add Location</button>
      </div>

      {showForm && (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={form.location_type} onChange={e => setForm({ ...form, location_type: e.target.value })} style={inputStyle}>
                {['interior', 'exterior', 'virtual', 'transitional'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Narrative Role</label><input value={form.narrative_role} onChange={e => setForm({ ...form, narrative_role: e.target.value })} style={inputStyle} placeholder="sanctuary, battleground, crossroads..." /></div>
          </div>
          <div style={{ marginTop: 12 }}><label style={labelStyle}>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, minHeight: 60 }} /></div>
          <h4 style={{ fontSize: 13, marginTop: 12, color: T.slate }}>Sensory Details</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {['sight', 'sound', 'smell', 'texture', 'atmosphere'].map(s => (
              <div key={s}><label style={labelStyle}>{s}</label><input value={form.sensory_details[s] || ''} onChange={e => setForm({ ...form, sensory_details: { ...form.sensory_details, [s]: e.target.value } })} style={inputStyle} /></div>
            ))}
          </div>
          <button onClick={addLocation} style={{ ...btnStyle, marginTop: 12 }}>Save Location</button>
        </div>
      )}

      {locations.length === 0 && <EmptyState text="No locations yet. Add the key places in your world." />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {locations.map(loc => (
          <div key={loc.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{typeIcons[loc.location_type] || ''} {loc.name}</div>
              <button onClick={() => deleteLocation(loc.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>\u00D7</button>
            </div>
            <div style={{ fontSize: 12, color: T.slate, marginTop: 4 }}>{loc.location_type}{loc.narrative_role ? ` · ${loc.narrative_role}` : ''}</div>
            {loc.description && <div style={{ fontSize: 13, color: T.inkLight, marginTop: 8 }}>{loc.description}</div>}
            {loc.sensory_details && Object.entries(loc.sensory_details).filter(([, v]) => v).length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: T.slate }}>
                {Object.entries(loc.sensory_details).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </div>
            )}
            {loc.childLocations?.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: T.lavender }}>Sub-locations: {loc.childLocations.map(c => c.name).join(', ')}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: World Snapshots
// ═══════════════════════════════════════════════════════════════════════════
function SnapshotsTab() {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(() => {
    fetchJSON(`${API}/tier/world-snapshots`).then(data => {
      setSnapshots(data.snapshots || []);
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: T.slate }}>Loading...</div>;

  return (
    <div>
      <h3 style={{ fontSize: 16, marginBottom: 16 }}>World State Snapshots ({snapshots.length})</h3>
      {snapshots.length === 0 && <EmptyState text="No snapshots yet. Generate one from the Story Evaluation Engine after completing a chapter." />}
      {snapshots.map(s => (
        <div key={s.id} style={{ ...cardStyle, marginBottom: 12, cursor: 'pointer' }} onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{s.snapshot_label}</span>
            <span style={{ fontSize: 12, color: T.slate }}>Position: {s.timeline_position}</span>
          </div>
          {expanded === s.id && (
            <div style={{ marginTop: 12 }}>
              {s.character_states && Object.keys(s.character_states).length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.slate, marginBottom: 4 }}>Character States:</div>
                  {Object.entries(s.character_states).map(([id, state]) => (
                    <div key={id} style={{ fontSize: 13, padding: '4px 0', borderBottom: `1px solid ${T.border}` }}>
                      <strong>{state.name}</strong> — {state.alive ? 'Alive' : 'Dead'} · Arc: {state.arc || 'none'} ({state.arc_stage || '?'})
                    </div>
                  ))}
                </div>
              )}
              {s.active_threads?.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.slate, marginBottom: 4 }}>Active Threads:</div>
                  {s.active_threads.map((t, i) => (
                    <div key={i} style={{ fontSize: 13 }}>{t.name} ({t.type}) — tension: {t.tension}/10</div>
                  ))}
                </div>
              )}
              {s.world_facts?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.slate, marginBottom: 4 }}>Known Facts:</div>
                  {s.world_facts.map((f, i) => <div key={i} style={{ fontSize: 13 }}>{f}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: Story Threads + Dead Thread Detection
// ═══════════════════════════════════════════════════════════════════════════
function ThreadsTab() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ thread_name: '', description: '', thread_type: 'subplot' });
  const [deadResult, setDeadResult] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [bookId, setBookId] = useState('');
  const [books, setBooks] = useState([]);

  useEffect(() => {
    fetchJSON(`${API}/storyteller/books`).then(data => {
      const b = data.books || data || [];
      setBooks(b);
      if (b.length > 0) setBookId(b[0].id);
    }).catch(() => {});
  }, []);

  const load = useCallback(() => {
    if (!bookId) return;
    fetchJSON(`${API}/tier/story-threads?book_id=${bookId}`).then(data => {
      setThreads(data.threads || []);
      setLoading(false);
    });
  }, [bookId]);
  useEffect(() => { load(); }, [load]);

  const addThread = async () => {
    if (!form.thread_name.trim()) return;
    await fetchJSON(`${API}/tier/story-threads`, { method: 'POST', body: JSON.stringify({ ...form, book_id: bookId }) });
    setShowForm(false);
    setForm({ thread_name: '', description: '', thread_type: 'subplot' });
    load();
  };

  const updateThread = async (id, updates) => {
    await fetchJSON(`${API}/tier/story-threads/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
    load();
  };

  const detectDead = async () => {
    if (!bookId) return;
    setDetecting(true);
    const data = await fetchJSON(`${API}/tier/dead-thread-detection`, { method: 'POST', body: JSON.stringify({ book_id: bookId }) });
    setDeadResult(data);
    setDetecting(false);
    load(); // reload to pick up auto-created threads
  };

  const statusColors = { active: '#22c55e', resolved: '#3b82f6', abandoned: '#ef4444', dormant: '#f59e0b' };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={bookId} onChange={e => setBookId(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
          {books.map(b => <option key={b.id} value={b.id}>{b.title || `Book ${b.id?.substring(0, 8)}`}</option>)}
        </select>
        <button onClick={() => setShowForm(!showForm)} style={btnStyle}>+ Add Thread</button>
        <button onClick={detectDead} disabled={detecting} style={{ ...btnStyle, background: T.blush }}>{detecting ? 'Detecting...' : 'Detect Dead Threads'}</button>
      </div>

      {showForm && (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Thread Name</label><input value={form.thread_name} onChange={e => setForm({ ...form, thread_name: e.target.value })} style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={form.thread_type} onChange={e => setForm({ ...form, thread_type: e.target.value })} style={inputStyle}>
                {['main_plot', 'subplot', 'mystery', 'relationship_arc', 'character_arc', 'theme'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}><label style={labelStyle}>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, minHeight: 60 }} /></div>
          <button onClick={addThread} style={{ ...btnStyle, marginTop: 12 }}>Save Thread</button>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', color: T.slate, padding: 40 }}>Loading...</div>}

      {!loading && threads.length === 0 && <EmptyState text="No story threads tracked yet. Add subplots, mysteries, and arcs to monitor." />}

      {threads.map(t => (
        <div key={t.id} style={{ ...cardStyle, marginBottom: 10, borderLeft: `4px solid ${statusColors[t.status] || T.slate}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{t.thread_name}</span>
              <span style={{ fontSize: 12, color: T.slate, marginLeft: 8 }}>{t.thread_type.replace(/_/g, ' ')}</span>
            </div>
            <select value={t.status} onChange={e => updateThread(t.id, { status: e.target.value })} style={{ ...inputStyle, width: 'auto', padding: '4px 8px', fontSize: 12 }}>
              {['active', 'resolved', 'abandoned', 'dormant'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {t.description && <div style={{ fontSize: 13, color: T.inkLight, marginTop: 4 }}>{t.description}</div>}
          {t.tension_level != null && <div style={{ fontSize: 12, color: T.slate, marginTop: 4 }}>Tension: {t.tension_level}/10 · Dormant: {t.chapters_since_last_reference} chapters</div>}
        </div>
      ))}

      {deadResult && (
        <div style={{ ...cardStyle, marginTop: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Dead Thread Analysis</h3>
          <p style={{ fontSize: 14, color: T.inkLight }}>{deadResult.summary}</p>
          {deadResult.dead_threads?.map((dt, i) => (
            <div key={i} style={{ padding: 12, marginBottom: 8, background: dt.severity === 'critical' ? '#fef2f2' : '#fffbeb', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: dt.severity === 'critical' ? '#dc2626' : '#d97706' }}>{dt.severity}: {dt.thread_name}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{dt.description}</div>
              <div style={{ fontSize: 12, color: T.slate, marginTop: 4 }}>Introduced: {dt.introduced_in} · Last seen: {dt.last_referenced_in} · Dormant: {dt.chapters_dormant} ch</div>
              {dt.suggestion && <div style={{ fontSize: 12, color: T.lavender, marginTop: 4 }}>Suggestion: {dt.suggestion}</div>}
            </div>
          ))}
          {deadResult.new_threads_detected?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 14, color: T.slate }}>New Threads Auto-Detected</h4>
              {deadResult.new_threads_detected.map((nt, i) => (
                <div key={i} style={{ fontSize: 13, padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>{nt.thread_name} ({nt.thread_type}) — {nt.description}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: Plot Holes + Revision History
// ═══════════════════════════════════════════════════════════════════════════
function PlotHolesTab() {
  const [books, setBooks] = useState([]);
  const [bookId, setBookId] = useState('');
  const [registryId, setRegistryId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [revStoryId, setRevStoryId] = useState('');

  useEffect(() => {
    fetchJSON(`${API}/storyteller/books`).then(data => {
      const b = data.books || data || [];
      setBooks(b);
      if (b.length > 0) setBookId(b[0].id);
    }).catch(() => {});
    fetchJSON(`${API}/character-registry/registries/default`).then(data => {
      if (data.registry?.id) setRegistryId(data.registry.id);
    }).catch(() => {});
  }, []);

  const detect = async () => {
    if (!bookId) return;
    setLoading(true);
    const data = await fetchJSON(`${API}/tier/plot-hole-detection`, {
      method: 'POST', body: JSON.stringify({ book_id: bookId, registry_id: registryId }),
    });
    setResult(data);
    setLoading(false);
  };

  const loadRevisions = async () => {
    if (!revStoryId.trim()) return;
    const data = await fetchJSON(`${API}/tier/story-revisions/${revStoryId}`);
    setRevisions(data.revisions || []);
  };

  return (
    <div>
      <h3 style={{ fontSize: 16, marginBottom: 16 }}>Plot Hole Detection</h3>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={bookId} onChange={e => setBookId(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
          {books.map(b => <option key={b.id} value={b.id}>{b.title || `Book ${b.id?.substring(0, 8)}`}</option>)}
        </select>
        <button onClick={detect} disabled={loading} style={btnStyle}>{loading ? 'Scanning...' : 'Scan for Plot Holes'}</button>
      </div>

      {result && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Score: <span style={{ color: result.score >= 80 ? '#22c55e' : result.score >= 50 ? '#f59e0b' : '#ef4444' }}>{result.score}/100</span></h3>
          <p style={{ fontSize: 14, color: T.inkLight }}>{result.summary}</p>
          {result.plot_holes?.map((ph, i) => (
            <div key={i} style={{ padding: 12, marginBottom: 8, background: ph.severity === 'critical' ? '#fef2f2' : ph.severity === 'major' ? '#fffbeb' : '#f0fdf4', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 13, textTransform: 'uppercase', color: ph.severity === 'critical' ? '#dc2626' : ph.severity === 'major' ? '#d97706' : '#16a34a' }}>{ph.severity} — {ph.type}</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>{ph.description}</div>
              {ph.chapters_involved && <div style={{ fontSize: 12, color: T.slate, marginTop: 4 }}>Chapters: {ph.chapters_involved.join(', ')}</div>}
              {ph.suggestion && <div style={{ fontSize: 12, color: T.lavender, marginTop: 4 }}>Fix: {ph.suggestion}</div>}
            </div>
          ))}
        </div>
      )}

      <hr style={{ border: 'none', borderTop: `1px solid ${T.border}`, margin: '24px 0' }} />

      <h3 style={{ fontSize: 16, marginBottom: 16 }}>Revision History</h3>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <input value={revStoryId} onChange={e => setRevStoryId(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Story ID" />
        <button onClick={loadRevisions} style={btnStyle}>Load Revisions</button>
      </div>
      {revisions.map(r => (
        <div key={r.id} style={{ ...cardStyle, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Revision #{r.revision_number} — {r.revision_type}</span>
            <span style={{ fontSize: 12, color: T.slate }}>{r.word_count} words · {new Date(r.created_at).toLocaleString()}</span>
          </div>
          {r.change_summary && <div style={{ fontSize: 13, color: T.inkLight, marginTop: 4 }}>{r.change_summary}</div>}
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 12, color: T.slate, cursor: 'pointer' }}>View text</summary>
            <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', marginTop: 8, padding: 12, background: '#f9fafb', borderRadius: 6, maxHeight: 300, overflow: 'auto' }}>{r.text}</pre>
          </details>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════
function StatCard({ label, value, color, small }) {
  return (
    <div style={{ padding: small ? '8px 14px' : '12px 20px', background: color + '11', borderRadius: 10, border: `1px solid ${color}33`, minWidth: small ? 80 : 100, textAlign: 'center' }}>
      <div style={{ fontSize: small ? 18 : 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: small ? 10 : 12, color: T.slate }}>{label}</div>
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={{ padding: 40, textAlign: 'center', color: T.slate, fontSize: 14, fontStyle: 'italic' }}>{text}</div>;
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const cardStyle = { padding: 16, background: '#fff', borderRadius: 10, border: `1px solid #e8e4dd`, boxShadow: '0 2px 8px rgba(0,0,0,.04)' };
const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #e8e4dd', borderRadius: 8, fontSize: 14, fontFamily: T.font, boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: T.slate, marginBottom: 4 };
const btnStyle = { padding: '8px 16px', background: T.gold, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: T.font };

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
const TABS = [
  { key: 'pipeline', label: 'Pipeline', icon: '\u25B6' },
  { key: 'continuity', label: 'Continuity', icon: '\uD83D\uDD0D' },
  { key: 'arcs', label: 'Char. Arcs', icon: '\uD83D\uDCC8' },
  { key: 'rel-timeline', label: 'Rel. Timeline', icon: '\u2764' },
  { key: 'world-timeline', label: 'World Timeline', icon: '\uD83C\uDF0D' },
  { key: 'locations', label: 'Locations', icon: '\uD83D\uDCCD' },
  { key: 'snapshots', label: 'Snapshots', icon: '\uD83D\uDCF7' },
  { key: 'threads', label: 'Threads', icon: '\uD83E\uDDF5' },
  { key: 'plot-holes', label: 'Plot Holes', icon: '\uD83D\uDD73' },
];

export default function NarrativeControlCenter() {
  const [activeTab, setActiveTab] = useState('pipeline');

  return (
    <div style={{ fontFamily: T.font, background: T.parchment, minHeight: '100vh', padding: '24px 20px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: T.fontSerif, fontSize: 28, fontWeight: 600, color: T.ink, margin: 0 }}>Narrative Control Center</h1>
          <p style={{ fontSize: 14, color: T.slate, margin: '4px 0 0' }}>Continuity, arcs, world state, pipeline tracking, plot analysis</p>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 24, padding: '4px', background: '#f5f3ee', borderRadius: 12 }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer',
                background: activeTab === tab.key ? T.white : 'transparent',
                color: activeTab === tab.key ? T.ink : T.slate,
                fontWeight: activeTab === tab.key ? 600 : 400,
                fontSize: 13, fontFamily: T.font,
                boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'pipeline' && <PipelineTab />}
        {activeTab === 'continuity' && <ContinuityTab />}
        {activeTab === 'arcs' && <CharacterArcTab />}
        {activeTab === 'rel-timeline' && <RelTimelineTab />}
        {activeTab === 'world-timeline' && <WorldTimelineTab />}
        {activeTab === 'locations' && <LocationsTab />}
        {activeTab === 'snapshots' && <SnapshotsTab />}
        {activeTab === 'threads' && <ThreadsTab />}
        {activeTab === 'plot-holes' && <PlotHolesTab />}
      </div>
    </div>
  );
}

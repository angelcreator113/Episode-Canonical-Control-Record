/**
 * StoryThreadTracker.jsx
 *
 * Manages story threads (subplots, arcs, mysteries, foreshadowing) across books.
 * Shows active/resolved/dangling threads with tension indicators.
 * Includes Memory Confirmation, Continuity Dashboard, and Voice Pattern panels.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
const API = '/api/v1/storyteller';

const C = {
  bg: '#f7f4ef', surface: '#fff', surfaceAlt: '#faf8f4', border: '#e8e0d0',
  text: '#2c2c2c', textDim: '#777', textFaint: '#aaa',
  accent: '#c9a96e', green: '#6ec9a0', red: '#c96e6e', blue: '#6e9ec9',
  purple: '#9e6ec9', orange: '#c9886e',
};

const STATUS_COLORS = { active: C.accent, resolved: C.green, dropped: C.red, dormant: C.textDim };
const THREAD_TYPES = ['subplot', 'mystery', 'relationship', 'foreshadow', 'character_arc', 'theme'];
const MEMORY_TYPES = ['goal', 'preference', 'relationship', 'belief', 'event', 'constraint', 'transformation', 'pain_point', 'dramatic_irony', 'open_mystery', 'foreshadow_seed'];

export default function StoryThreadTracker() {
  const navigate = useNavigate();
  const [threads, setThreads] = useState([]);
  const [dangling, setDangling] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('threads'); // threads | memories | continuity | voice
  const [filter, setFilter] = useState('all'); // all | active | resolved | dropped

  // Create thread form
  const [showCreate, setShowCreate] = useState(false);
  const [newThread, setNewThread] = useState({ thread_name: '', description: '', thread_type: 'subplot' });

  // Memory confirmation
  const [pendingMemories, setPendingMemories] = useState([]);
  const [memLoading, setMemLoading] = useState(false);

  // Continuity
  const [issues, setIssues] = useState([]);
  const [contLoading, setContLoading] = useState(false);

  // Voice
  const [signals, setSignals] = useState([]);
  const [rules, setRules] = useState([]);
  const [voiceLoading, setVoiceLoading] = useState(false);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, dRes] = await Promise.all([
        fetch(`${API}/threads`),
        fetch(`${API}/threads/dangling`),
      ]);
      if (tRes.ok) { const d = await tRes.json(); setThreads(d.threads || []); }
      if (dRes.ok) { const d = await dRes.json(); setDangling(d.threads || []); }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchMemories = useCallback(async () => {
    setMemLoading(true);
    try {
      const res = await fetch(`${API}/memories/pending`);
      if (res.ok) { const d = await res.json(); setPendingMemories(d.memories || []); }
    } catch { /* ignore */ }
    setMemLoading(false);
  }, []);

  const fetchContinuity = useCallback(async () => {
    setContLoading(true);
    try {
      const res = await fetch(`${API}/continuity/issues`);
      if (res.ok) { const d = await res.json(); setIssues(d.issues || []); }
    } catch { /* ignore */ }
    setContLoading(false);
  }, []);

  const fetchVoice = useCallback(async () => {
    setVoiceLoading(true);
    try {
      const [sRes, rRes] = await Promise.all([
        fetch(`${API}/voice-signals`),
        fetch(`${API}/voice-rules`),
      ]);
      if (sRes.ok) { const d = await sRes.json(); setSignals(d.signals || []); }
      if (rRes.ok) { const d = await rRes.json(); setRules(d.rules || []); }
    } catch { /* ignore */ }
    setVoiceLoading(false);
  }, []);

  useEffect(() => {
    fetchThreads();
    fetchMemories();
    fetchContinuity();
    fetchVoice();
  }, [fetchThreads, fetchMemories, fetchContinuity, fetchVoice]);

  const handleCreateThread = async () => {
    if (!newThread.thread_name.trim()) return;
    try {
      const res = await fetch(`${API}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newThread),
      });
      if (res.ok) {
        setNewThread({ thread_name: '', description: '', thread_type: 'subplot' });
        setShowCreate(false);
        fetchThreads();
      }
    } catch { /* ignore */ }
  };

  const handleUpdateThread = async (id, updates) => {
    try {
      await fetch(`${API}/threads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      fetchThreads();
    } catch { /* ignore */ }
  };

  const handleDeleteThread = async (id) => {
    try {
      await fetch(`${API}/threads/${id}`, { method: 'DELETE' });
      fetchThreads();
    } catch { /* ignore */ }
  };

  const handleConfirmMemory = async (id) => {
    try {
      await fetch(`${API}/memories/${id}/confirm`, { method: 'PATCH' });
      setPendingMemories(prev => prev.filter(m => m.id !== id));
    } catch { /* ignore */ }
  };

  const handleRejectMemory = async (id) => {
    try {
      await fetch(`${API}/memories/${id}/reject`, { method: 'PATCH' });
      setPendingMemories(prev => prev.filter(m => m.id !== id));
    } catch { /* ignore */ }
  };

  const filteredThreads = filter === 'all' ? threads : threads.filter(t => t.status === filter);
  const danglingIds = new Set(dangling.map(d => d.id));

  const inputStyle = {
    width: '100%', padding: '10px 12px', background: C.surfaceAlt,
    border: `1px solid ${C.border}`, borderRadius: 6, color: C.text,
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: C.text }}>Story Thread Tracker</h1>
            <p style={{ fontSize: 12, color: C.textDim, margin: '4px 0 0' }}>
              Track subplots, mysteries, arcs · Review memories · Monitor continuity · Voice patterns
            </p>
          </div>
          <button onClick={() => navigate('/')} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', color: C.textDim }}>
            ← Home
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
          {[
            { key: 'threads', label: '⧖ Threads', count: threads.length },
            { key: 'memories', label: '◎ Memories', count: pendingMemories.length },
            { key: 'continuity', label: '⚠ Continuity', count: issues.length },
            { key: 'voice', label: '♪ Voice', count: signals.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 18px', fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
                cursor: 'pointer', border: 'none', borderBottom: `2px solid ${tab === t.key ? C.accent : 'transparent'}`,
                background: 'transparent', color: tab === t.key ? C.accent : C.textDim,
                transition: 'all 0.2s',
              }}
            >
              {t.label} {t.count > 0 && <span style={{ fontSize: 10, background: `${C.accent}20`, color: C.accent, padding: '1px 6px', borderRadius: 8, marginLeft: 4 }}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* ═══ THREADS TAB ═══ */}
        {tab === 'threads' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {['all', 'active', 'resolved', 'dropped'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: '5px 12px', fontSize: 11, fontWeight: filter === f ? 600 : 400,
                      cursor: 'pointer', borderRadius: 12,
                      border: `1px solid ${filter === f ? C.accent : C.border}`,
                      background: filter === f ? `${C.accent}15` : 'transparent',
                      color: filter === f ? C.accent : C.textDim,
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowCreate(!showCreate)}
                style={{ padding: '8px 16px', background: C.accent, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                + New Thread
              </button>
            </div>

            {/* Create form */}
            {showCreate && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, marginBottom: 16 }}>
                <input
                  value={newThread.thread_name}
                  onChange={e => setNewThread(prev => ({ ...prev, thread_name: e.target.value }))}
                  placeholder="Thread name..."
                  style={{ ...inputStyle, marginBottom: 8, fontWeight: 600 }}
                />
                <textarea
                  value={newThread.description}
                  onChange={e => setNewThread(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Description (optional)..."
                  rows={2}
                  style={{ ...inputStyle, marginBottom: 8, resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={newThread.thread_type}
                    onChange={e => setNewThread(prev => ({ ...prev, thread_type: e.target.value }))}
                    style={{ ...inputStyle, width: 'auto' }}
                  >
                    {THREAD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button onClick={handleCreateThread} style={{ padding: '8px 18px', background: C.green, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Create
                  </button>
                  <button onClick={() => setShowCreate(false)} style={{ padding: '8px 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', color: C.textDim }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Dangling warning */}
            {dangling.length > 0 && (
              <div style={{ background: `${C.orange}12`, border: `1px solid ${C.orange}40`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: C.orange }}>
                ⚠ {dangling.length} thread{dangling.length > 1 ? 's' : ''} not referenced recently — may need attention
              </div>
            )}

            {/* Thread list */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.textDim }}>Loading threads...</div>
            ) : filteredThreads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.textDim }}>No threads found. Create one to start tracking story arcs.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredThreads.map(t => (
                  <div key={t.id} style={{
                    background: C.surface, border: `1px solid ${danglingIds.has(t.id) ? C.orange : C.border}`,
                    borderRadius: 10, padding: 16, transition: 'all 0.2s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{t.thread_name}</span>
                          <span style={{
                            fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                            padding: '2px 8px', borderRadius: 8, color: STATUS_COLORS[t.status] || C.textDim,
                            background: `${STATUS_COLORS[t.status] || C.textDim}15`,
                          }}>
                            {t.status}
                          </span>
                          <span style={{ fontSize: 9, color: C.textFaint, background: `${C.accent}10`, padding: '2px 6px', borderRadius: 4 }}>
                            {t.thread_type}
                          </span>
                        </div>
                        {t.description && <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>{t.description}</div>}
                        <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 10, color: C.textFaint }}>
                          {t.tension_level != null && (
                            <span>Tension: {'█'.repeat(Math.min(t.tension_level, 10))}{'░'.repeat(Math.max(10 - t.tension_level, 0))} {t.tension_level}/10</span>
                          )}
                          {t.chapters_since_last_reference > 0 && (
                            <span style={{ color: t.chapters_since_last_reference >= 3 ? C.orange : C.textFaint }}>
                              {t.chapters_since_last_reference} chapters since last ref
                            </span>
                          )}
                          {t.characters_involved?.length > 0 && (
                            <span>Characters: {t.characters_involved.join(', ')}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {t.status === 'active' && (
                          <button onClick={() => handleUpdateThread(t.id, { status: 'resolved' })}
                            style={{ padding: '4px 10px', fontSize: 10, background: `${C.green}15`, color: C.green, border: `1px solid ${C.green}40`, borderRadius: 4, cursor: 'pointer' }}>
                            ✓ Resolve
                          </button>
                        )}
                        {t.status === 'resolved' && (
                          <button onClick={() => handleUpdateThread(t.id, { status: 'active' })}
                            style={{ padding: '4px 10px', fontSize: 10, background: `${C.accent}15`, color: C.accent, border: `1px solid ${C.accent}40`, borderRadius: 4, cursor: 'pointer' }}>
                            ↺ Reopen
                          </button>
                        )}
                        <button onClick={() => handleDeleteThread(t.id)}
                          style={{ padding: '4px 10px', fontSize: 10, background: `${C.red}15`, color: C.red, border: `1px solid ${C.red}40`, borderRadius: 4, cursor: 'pointer' }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ MEMORIES TAB ═══ */}
        {tab === 'memories' && (
          <div>
            <div style={{ fontSize: 13, color: C.textDim, marginBottom: 16 }}>
              Review and confirm AI-proposed story memories. Confirmed memories are used to maintain narrative consistency.
            </div>
            {memLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.textDim }}>Loading pending memories...</div>
            ) : pendingMemories.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.textDim }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
                No pending memories to review. Check back after generating more scenes.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 4 }}>
                  {pendingMemories.length} unconfirmed memor{pendingMemories.length === 1 ? 'y' : 'ies'}
                </div>
                {pendingMemories.map(m => (
                  <div key={m.id} style={{
                    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
                          <span style={{
                            fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                            padding: '2px 8px', borderRadius: 8, color: C.purple,
                            background: `${C.purple}15`,
                          }}>
                            {m.type}
                          </span>
                          {m.confidence != null && (
                            <span style={{ fontSize: 9, color: C.textFaint }}>
                              {Math.round(m.confidence * 100)}% confidence
                            </span>
                          )}
                          {m.source_type && (
                            <span style={{ fontSize: 9, color: C.textFaint }}>via {m.source_type}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{m.statement}</div>
                        {m.tags?.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            {m.tags.map((tag, i) => (
                              <span key={i} style={{ fontSize: 9, padding: '1px 6px', background: `${C.accent}10`, borderRadius: 4, color: C.accent }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginLeft: 10 }}>
                        <button onClick={() => handleConfirmMemory(m.id)}
                          style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600, background: C.green, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                          ✓ Confirm
                        </button>
                        <button onClick={() => handleRejectMemory(m.id)}
                          style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600, background: 'transparent', color: C.red, border: `1px solid ${C.red}40`, borderRadius: 6, cursor: 'pointer' }}>
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ CONTINUITY TAB ═══ */}
        {tab === 'continuity' && (
          <div>
            <div style={{ fontSize: 13, color: C.textDim, marginBottom: 16 }}>
              Continuity issues detected across your story — dangling threads, stale memories, and narrative gaps.
            </div>
            {contLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.textDim }}>Analyzing continuity...</div>
            ) : issues.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.textDim }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
                No continuity issues detected. Your narrative is consistent.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {issues.map((issue, i) => {
                  const colors = { high: C.red, medium: C.orange, low: C.textDim };
                  return (
                    <div key={i} style={{
                      background: C.surface, border: `1px solid ${colors[issue.severity] || C.border}40`,
                      borderRadius: 10, padding: 14,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                          padding: '2px 8px', borderRadius: 8,
                          color: colors[issue.severity], background: `${colors[issue.severity]}15`,
                        }}>
                          {issue.severity}
                        </span>
                        <span style={{ fontSize: 9, color: C.textFaint }}>{issue.type.replace(/_/g, ' ')}</span>
                      </div>
                      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{issue.description}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ VOICE TAB ═══ */}
        {tab === 'voice' && (
          <div>
            <div style={{ fontSize: 13, color: C.textDim, marginBottom: 16 }}>
              Voice patterns detected from your edits, and rules proposed for consistent character voices.
            </div>

            {/* Voice Rules */}
            {rules.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px', color: C.text }}>Voice Rules ({rules.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rules.map(r => (
                    <div key={r.id} style={{
                      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
                            {r.character_name && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: C.accent }}>{r.character_name}</span>
                            )}
                            <span style={{
                              fontSize: 9, padding: '2px 6px', borderRadius: 4,
                              background: `${C.blue}15`, color: C.blue,
                            }}>
                              {r.rule_type?.replace(/_/g, ' ')}
                            </span>
                            <span style={{
                              fontSize: 9, padding: '2px 6px', borderRadius: 8,
                              color: r.status === 'active' ? C.green : C.textFaint,
                              background: r.status === 'active' ? `${C.green}15` : `${C.textFaint}15`,
                            }}>
                              {r.status}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{r.rule_text}</div>
                          <div style={{ fontSize: 10, color: C.textFaint, marginTop: 4 }}>
                            {r.signal_count} signal{r.signal_count !== 1 ? 's' : ''} · injected {r.injection_count || 0}×
                          </div>
                        </div>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: r.confirmed_by_author ? `${C.green}15` : `${C.textFaint}15`,
                          color: r.confirmed_by_author ? C.green : C.textFaint, fontSize: 14, fontWeight: 700,
                        }}>
                          {r.confirmed_by_author ? '✓' : '?'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Voice Signals */}
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px', color: C.text }}>Recent Signals ({signals.length})</h3>
            {voiceLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.textDim }}>Loading voice data...</div>
            ) : signals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.textDim }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>♪</div>
                No voice signals yet. Edit lines in the Storyteller to generate voice patterns.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {signals.map(s => (
                  <div key={s.id} style={{
                    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14,
                  }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
                      {s.pattern_tag && (
                        <span style={{ fontSize: 9, padding: '2px 6px', background: `${C.purple}15`, color: C.purple, borderRadius: 4, fontWeight: 600 }}>
                          {s.pattern_tag}
                        </span>
                      )}
                      <span style={{ fontSize: 9, color: C.textFaint }}>
                        {s.pattern_confidence ? `${Math.round(s.pattern_confidence * 100)}% confidence` : ''}
                      </span>
                      <span style={{
                        fontSize: 9, padding: '2px 6px', borderRadius: 8,
                        background: `${C.textFaint}10`, color: C.textFaint,
                      }}>
                        {s.status}
                      </span>
                    </div>
                    {s.diff_summary && (
                      <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{s.diff_summary}</div>
                    )}
                    <div style={{ fontSize: 10, color: C.textFaint, marginTop: 4 }}>
                      {s.scene_context && <span>Scene: {s.scene_context} · </span>}
                      {s.VoiceRule && <span>→ Rule: {s.VoiceRule.rule_text?.slice(0, 50)}…</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

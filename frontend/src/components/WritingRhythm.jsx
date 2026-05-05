// WritingRhythm.jsx
// Writing rhythm tracking + content pipeline view
// Tab in the Universe page, story-side cluster (writing-rhythm tab)

import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/api';

const API = import.meta.env.VITE_API_URL || '';

// ─── Track 6 CP9 module-scope helpers (Pattern F prophylactic — Api suffix) ───
// 5 helpers covering 5 fetch sites on /writing-rhythm/* and /multi-product/*.
// URL COMPOSITION NOTE: API='' default (no '/api/v1' prefix) preserved
// verbatim from pre-migration code per v2.15 §9.11 "bugs surface, don't
// fix" discipline. If the relative-path shape is a pre-existing bug, it
// is the original code's bug — surfaced for Step 3 audit, NOT corrected
// at this layer. The helper preserves exact pre-migration URL shape;
// build-time VITE_API_URL override (or Vite dev proxy) is the only
// mechanism that would have made the original work, and the helper
// inherits that same dependency.
// METHOD VERIFICATION: surface report flagged updateContentStatus as
// PUT-or-PATCH; actual backend contract is PATCH (verified at line 192
// of pre-migration code). Helper uses PATCH per source.
export const getWritingRhythmStatsApi = () =>
  apiClient.get(`${API}/writing-rhythm/stats`);
export const getMultiProductAllApi = () =>
  apiClient.get(`${API}/multi-product/all`);
export const logWritingRhythmApi = (payload) =>
  apiClient.post(`${API}/writing-rhythm/log`, payload);
export const setWritingRhythmGoalApi = (payload) =>
  apiClient.patch(`${API}/writing-rhythm/goal`, payload);
export const updateMultiProductStatusApi = (id, payload) =>
  apiClient.patch(`${API}/multi-product/${id}/status`, payload);

const C = {
  bg: '#f7f4ef',
  surface: '#ffffff',
  surfaceAlt: '#faf8f5',
  border: '#e0d9ce',
  borderDark: '#c8bfb0',
  text: '#1a1714',
  textDim: '#6b6259',
  textFaint: '#a89f94',
  accent: '#b8863e',
  gold: '#c9a96e',
  red: '#b84040',
  redSoft: '#b8404012',
  green: '#3a8a60',
  greenSoft: '#3a8a6012',
  blue: '#3a6a8a',
  blueSoft: '#3a6a8a12',
  purple: '#6a3a8a',
};

const FORMAT_LABELS = {
  instagram_caption: '📸 Instagram',
  tiktok_concept: '🎬 TikTok',
  howto_lesson: '📚 How-To',
  bestie_newsletter: '💌 Newsletter',
  behind_the_scenes: '🎭 BTS',
};

const STATUS_COLORS = {
  draft: C.textDim,
  approved: C.blue,
  posted: C.green,
  archived: C.textFaint,
};

const S = {
  card: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  statBox: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '14px 16px',
    textAlign: 'center',
    flex: 1,
  },
  btn: {
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    background: C.surface,
    color: C.text,
    cursor: 'pointer',
  },
  btnPrimary: {
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 6,
    border: 'none',
    background: C.accent,
    color: '#fff',
    cursor: 'pointer',
  },
  input: {
    padding: '6px 10px',
    fontSize: 13,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    background: C.surface,
    color: C.text,
    outline: 'none',
    boxSizing: 'border-box',
  },
  badge: (color) => ({
    display: 'inline-block',
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 6,
    background: color + '14',
    color: color,
    fontWeight: 600,
  }),
};

export default function WritingRhythm() {
  const [stats, setStats] = useState(null);
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [logForm, setLogForm] = useState({ scenes_proposed: 0, scenes_generated: 0, scenes_approved: 0, words_written: 0, session_note: '' });
  const [goalForm, setGoalForm] = useState({ goal_type: 'weekly', target_scenes: 10, target_words: 5000, cadence: 'weekdays' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [statsRes, contentRes] = await Promise.all([
        getWritingRhythmStatsApi().catch(() => null),
        getMultiProductAllApi().catch(() => null),
      ]);
      if (statsRes) {
        const data = statsRes.data;
        setStats(data);
        if (data.goal) {
          setGoalForm({
            goal_type: data.goal.goal_type || 'weekly',
            target_scenes: data.goal.target_scenes || 10,
            target_words: data.goal.target_words || 5000,
            cadence: data.goal.cadence || 'weekdays',
          });
        }
      }
      if (contentRes) {
        setContent(contentRes.data?.content || []);
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleLogSession(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await logWritingRhythmApi(logForm);
      showToast('Session logged');
      setShowLog(false);
      setLogForm({ scenes_proposed: 0, scenes_generated: 0, scenes_approved: 0, words_written: 0, session_note: '' });
      loadAll();
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to log session', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateGoal(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await setWritingRhythmGoalApi(goalForm);
      showToast('Goal updated');
      setShowGoal(false);
      loadAll();
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to update goal', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function updateContentStatus(id, status) {
    try {
      await updateMultiProductStatusApi(id, { status });
      showToast(`Marked ${status}`);
      loadAll();
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to update', 'error');
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.textFaint }}>Loading rhythm data...</div>;
  }

  const streakDays = stats?.streak || 0;
  const totalSessions = stats?.total_sessions || 0;
  const totalWords = stats?.total_words || 0;
  const totalScenes = stats?.total_scenes_approved || 0;
  const recentSessions = stats?.recent || [];
  const goal = stats?.goal;

  return (
    <div style={{ padding: '20px 24px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>
            ◇ Writing Rhythm
          </h2>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>
            Track your writing sessions, goals, and content pipeline
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btn} onClick={() => { setShowGoal(!showGoal); setShowLog(false); }}>
            🎯 Goal
          </button>
          <button style={S.btnPrimary} onClick={() => { setShowLog(!showLog); setShowGoal(false); }}>
            + Log Session
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={S.statBox}>
          <div style={{ fontSize: 24, fontWeight: 700, color: streakDays > 0 ? C.accent : C.textFaint }}>
            {streakDays}
          </div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Day Streak 🔥</div>
        </div>
        <div style={S.statBox}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{totalSessions}</div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Sessions</div>
        </div>
        <div style={S.statBox}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.blue }}>{totalWords.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Words</div>
        </div>
        <div style={S.statBox}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{totalScenes}</div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Scenes Approved</div>
        </div>
      </div>

      {/* Goal Display */}
      {goal && (
        <div style={{ ...S.card, borderLeft: `3px solid ${C.gold}`, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>🎯 Current Goal: </span>
              <span style={{ fontSize: 13, color: C.textDim }}>
                {goal.target_scenes && `${goal.target_scenes} scenes`}
                {goal.target_scenes && goal.target_words && ' / '}
                {goal.target_words && `${goal.target_words.toLocaleString()} words`}
                {' · '}{goal.cadence} · {goal.goal_type}
              </span>
            </div>
            <span style={{ fontSize: 11, color: goal.active ? C.green : C.textFaint }}>
              {goal.active ? '● Active' : '○ Inactive'}
            </span>
          </div>
        </div>
      )}

      {/* Log Session Form */}
      {showLog && (
        <form onSubmit={handleLogSession} style={{ ...S.card, borderColor: C.accent, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, marginBottom: 12 }}>Log Writing Session</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
            {[
              { key: 'scenes_proposed', label: 'Proposed' },
              { key: 'scenes_generated', label: 'Generated' },
              { key: 'scenes_approved', label: 'Approved' },
              { key: 'words_written', label: 'Words' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, color: C.textDim, display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input
                  type="number" min="0" style={{ ...S.input, width: '100%' }}
                  value={logForm[f.key]}
                  onChange={e => setLogForm(p => ({ ...p, [f.key]: parseInt(e.target.value) || 0 }))}
                />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: C.textDim, display: 'block', marginBottom: 4 }}>Session Note</label>
            <input
              style={{ ...S.input, width: '100%' }}
              value={logForm.session_note}
              onChange={e => setLogForm(p => ({ ...p, session_note: e.target.value }))}
              placeholder="What happened this session..."
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" style={S.btn} onClick={() => setShowLog(false)}>Cancel</button>
            <button type="submit" style={S.btnPrimary} disabled={saving}>{saving ? 'Saving...' : 'Log Session'}</button>
          </div>
        </form>
      )}

      {/* Update Goal Form */}
      {showGoal && (
        <form onSubmit={handleUpdateGoal} style={{ ...S.card, borderColor: C.gold, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.gold, marginBottom: 12 }}>Update Writing Goal</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: C.textDim, display: 'block', marginBottom: 4 }}>Type</label>
              <select style={{ ...S.input, width: '100%' }} value={goalForm.goal_type} onChange={e => setGoalForm(p => ({ ...p, goal_type: e.target.value }))}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="arc_stage">Arc Stage</option>
                <option value="book">Book</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.textDim, display: 'block', marginBottom: 4 }}>Target Scenes</label>
              <input type="number" min="0" style={{ ...S.input, width: '100%' }} value={goalForm.target_scenes} onChange={e => setGoalForm(p => ({ ...p, target_scenes: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.textDim, display: 'block', marginBottom: 4 }}>Target Words</label>
              <input type="number" min="0" style={{ ...S.input, width: '100%' }} value={goalForm.target_words} onChange={e => setGoalForm(p => ({ ...p, target_words: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.textDim, display: 'block', marginBottom: 4 }}>Cadence</label>
              <select style={{ ...S.input, width: '100%' }} value={goalForm.cadence} onChange={e => setGoalForm(p => ({ ...p, cadence: e.target.value }))}>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="3_per_week">3/week</option>
                <option value="burst">Burst</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" style={S.btn} onClick={() => setShowGoal(false)}>Cancel</button>
            <button type="submit" style={S.btnPrimary} disabled={saving}>{saving ? 'Saving...' : 'Update Goal'}</button>
          </div>
        </form>
      )}

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>Recent Sessions</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {recentSessions.map(s => (
              <div key={s.id} style={{ ...S.card, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: C.textDim }}>
                    {new Date(s.session_date).toLocaleDateString()} · {s.arc_stage || 'no stage'}
                  </div>
                  {s.session_note && <div style={{ fontSize: 12, color: C.textFaint, marginTop: 2 }}>{s.session_note}</div>}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.textDim }}>
                  <span>{s.scenes_approved || 0} scenes</span>
                  <span>{(s.words_written || 0).toLocaleString()} words</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Pipeline */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>
          Content Pipeline ({content.length})
        </h3>
        {content.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: C.textFaint, fontSize: 13 }}>
            No content generated yet. Generate multi-product content from approved scenes.
          </div>
        ) : (
          content.map(item => (
            <div key={item.id} style={{ ...S.card, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12 }}>{FORMAT_LABELS[item.format] || item.format}</span>
                  {item.headline && <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.headline}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={S.badge(STATUS_COLORS[item.status] || C.textDim)}>{item.status}</span>
                  {item.status === 'draft' && (
                    <button style={{ ...S.btn, fontSize: 11 }} onClick={() => updateContentStatus(item.id, 'approved')}>
                      ✓ Approve
                    </button>
                  )}
                  {item.status === 'approved' && (
                    <button style={{ ...S.btn, fontSize: 11, color: C.green }} onClick={() => updateContentStatus(item.id, 'posted')}>
                      📤 Posted
                    </button>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {item.content?.slice(0, 200)}{item.content?.length > 200 ? '…' : ''}
              </div>
              {item.emotional_core && (
                <div style={{ fontSize: 11, color: C.textFaint, marginTop: 4 }}>
                  Emotional core: {item.emotional_core}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '10px 20px',
          borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999,
          background: toast.type === 'error' ? C.red : C.green, color: '#fff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

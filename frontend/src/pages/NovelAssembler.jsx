/**
 * NovelAssembler.jsx — Novel Assembly Page
 *
 * Combines approved stories + social imports into a novel structure
 * with emotional curve visualization, chapter breaks, and export.
 *
 * Route: /assembler
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import './NovelAssembler.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

// ─── Track 6 CP8 module-scope helpers (Pattern F prophylactic — Api suffix) ───
// 6 helpers covering 6 fetch sites on /stories/*. File-local per Track 6
// convention. No cross-CP overlaps.
export const listCharacterStoriesApi = (charKey) =>
  apiClient.get(`${API_BASE}/stories/character/${charKey}`);
export const listCharacterAssembliesApi = (charKey) =>
  apiClient.get(`${API_BASE}/stories/assemblies/character/${charKey}`);
export const listCharacterSocialApi = (charKey) =>
  apiClient.get(`${API_BASE}/stories/social/character/${charKey}`);
export const createAssemblyApi = (payload) =>
  apiClient.post(`${API_BASE}/stories/assemblies`, payload);
export const compileAssemblyApi = (assemblyId) =>
  apiClient.post(`${API_BASE}/stories/assemblies/${assemblyId}/compile`);
export const deleteAssemblyApi = (assemblyId) =>
  apiClient.delete(`${API_BASE}/stories/assemblies/${assemblyId}`);

const CHARACTERS = {
  justawoman: { display_name: 'JustAWoman', icon: '♛', color: '#9a7d1e' },
  david:      { display_name: 'David',      icon: '◈', color: '#c0392b' },
  dana:       { display_name: 'Dana',       icon: '◉', color: '#0d9668' },
  chloe:      { display_name: 'Chloe',      icon: '◎', color: '#7c3aed' },
  jade:       { display_name: 'Jade',       icon: '◆', color: '#546678' },
  lala:       { display_name: 'Lala',        icon: '✦', color: '#d63384' },
};

const PHASE_COLORS = {
  establishment: '#9a7d1e',
  pressure:      '#c0392b',
  crisis:        '#b91c1c',
  integration:   '#0d9668',
};

// ── Emotional Curve Visualization ──────────────────────────────────────────
function EmotionalCurve({ data, charColor }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!data?.length || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const padding = 40;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#1c1814';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (h - 2 * padding) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(w - padding, y);
      ctx.stroke();
    }

    // Phase labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    const phases = ['Establishment', 'Pressure', 'Crisis', 'Integration'];
    phases.forEach((label, i) => {
      const x = padding + (w - 2 * padding) * ((i + 0.5) / 4);
      ctx.fillText(label, x, h - 8);
    });

    // Y-axis labels
    ctx.textAlign = 'right';
    ctx.fillText('High', padding - 8, padding + 10);
    ctx.fillText('Low', padding - 8, h - padding);

    // Plot the curve
    const plotW = w - 2 * padding;
    const plotH = h - 2 * padding;

    // Smooth curve with quadratic bezier
    ctx.beginPath();
    ctx.strokeStyle = charColor || '#9a7d1e';
    ctx.lineWidth = 2.5;

    data.forEach((point, i) => {
      const x = padding + (i / (data.length - 1 || 1)) * plotW;
      const y = padding + plotH - (point.intensity * plotH);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = padding + ((i - 1) / (data.length - 1 || 1)) * plotW;
        const prevY = padding + plotH - (data[i - 1].intensity * plotH);
        const cpX = (prevX + x) / 2;
        ctx.quadraticCurveTo(cpX, prevY, x, y);
      }
    });
    ctx.stroke();

    // Fill underneath
    const lastX = padding + plotW;
    const lastY = padding + plotH - (data[data.length - 1].intensity * plotH);
    ctx.lineTo(lastX, padding + plotH);
    ctx.lineTo(padding, padding + plotH);
    ctx.closePath();
    ctx.fillStyle = `${charColor}18`;
    ctx.fill();

    // Phase-colored dots
    data.forEach((point, i) => {
      const x = padding + (i / (data.length - 1 || 1)) * plotW;
      const y = padding + plotH - (point.intensity * plotH);

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = PHASE_COLORS[point.phase] || charColor;
      ctx.fill();
      ctx.strokeStyle = '#1c1814';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

  }, [data, charColor]);

  return (
    <div className="na-curve-container">
      <div className="na-curve-title">Emotional Arc</div>
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        className="na-curve-canvas"
      />
    </div>
  );
}

// ── Story Selection Checklist ──────────────────────────────────────────────
function StoryChecklist({ stories, selectedIds, onToggle, charColor }) {
  return (
    <div className="na-checklist">
      {stories.map(story => {
        const checked = selectedIds.includes(story.id);
        return (
          <div
            key={story.id}
            className={`na-check-item ${checked ? 'checked' : ''}`}
            onClick={() => onToggle(story.id)}
          >
            <div
              className="na-check-box"
              style={{ borderColor: charColor, background: checked ? charColor : 'transparent' }}
            >
              {checked && '✓'}
            </div>
            <div className="na-check-info">
              <div className="na-check-num">#{story.story_number}</div>
              <div className="na-check-title">{story.title}</div>
              <div className="na-check-meta">
                <span style={{ color: PHASE_COLORS[story.phase] }}>{story.phase}</span>
                <span>{story.word_count?.toLocaleString() || '?'} words</span>
                <span className={`na-check-status na-status-${story.status}`}>{story.status}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Assembly Card ──────────────────────────────────────────────────────────
function AssemblyCard({ assembly, charColor, onSelect, onDelete, onCompile }) {
  return (
    <div className="na-assembly-card" onClick={() => onSelect(assembly)}>
      <div className="na-assembly-header">
        <div className="na-assembly-title">{assembly.title}</div>
        <span className={`na-assembly-status na-status-${assembly.status}`}>
          {assembly.status}
        </span>
      </div>
      <div className="na-assembly-stats">
        <span>{(assembly.story_ids || []).length} stories</span>
        <span>{(assembly.social_import_ids || []).length} imports</span>
        <span>{(assembly.total_word_count || 0).toLocaleString()} words</span>
      </div>
      <div className="na-assembly-actions" onClick={e => e.stopPropagation()}>
        <button
          className="na-btn na-btn-compile"
          style={{ borderColor: charColor }}
          onClick={() => onCompile(assembly.id)}
        >
          Compile
        </button>
        <button
          className="na-btn na-btn-delete"
          onClick={() => onDelete(assembly.id)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function NovelAssembler() {
  const navigate = useNavigate();
  const [selectedChar, setSelectedChar] = useState('justawoman');
  const [stories, setStories] = useState([]);
  const [assemblies, setAssemblies] = useState([]);
  const [loading, setLoading] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedStoryIds, setSelectedStoryIds] = useState([]);
  const [creating, setCreating] = useState(false);

  // Selected assembly view
  const [activeAssembly, setActiveAssembly] = useState(null);
  const [compiling, setCompiling] = useState(false);

  // Social imports
  const [socialImports, setSocialImports] = useState([]);
  const [showImports, setShowImports] = useState(false);
  const [importsLoading, setImportsLoading] = useState(false);

  const char = CHARACTERS[selectedChar];

  // Load stories + assemblies
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [storiesRes, assembliesRes] = await Promise.all([
        listCharacterStoriesApi(selectedChar),
        listCharacterAssembliesApi(selectedChar),
      ]);
      setStories(storiesRes.data?.stories || []);
      setAssemblies(assembliesRes.data?.assemblies || []);
    } catch (err) {
      console.error('Load data error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedChar]);

  const loadSocialImports = useCallback(async () => {
    setImportsLoading(true);
    try {
      const res = await listCharacterSocialApi(selectedChar);
      setSocialImports(res.data?.imports || []);
    } catch { /* ignore */ }
    setImportsLoading(false);
  }, [selectedChar]);

  useEffect(() => {
    loadData();
    loadSocialImports();
    setActiveAssembly(null);
    setShowCreate(false);
    setShowImports(false);
  }, [loadData, loadSocialImports]);

  function toggleStoryId(id) {
    setSelectedStoryIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleCreate() {
    if (!newTitle.trim() || selectedStoryIds.length === 0) return;
    setCreating(true);
    try {
      await createAssemblyApi({
        title: newTitle,
        character_key: selectedChar,
        story_ids: selectedStoryIds,
      });
      setNewTitle('');
      setSelectedStoryIds([]);
      setShowCreate(false);
      loadData();
    } catch (err) {
      console.error('Create assembly error:', err);
    } finally {
      setCreating(false);
    }
  }

  async function handleCompile(assemblyId) {
    setCompiling(true);
    try {
      const res = await compileAssemblyApi(assemblyId);
      setActiveAssembly(res.data?.assembly);
      loadData();
    } catch (err) {
      console.error('Compile error:', err);
    } finally {
      setCompiling(false);
    }
  }

  async function handleDelete(assemblyId) {
    if (!window.confirm('Delete this assembly?')) return;
    try {
      await deleteAssemblyApi(assemblyId);
      if (activeAssembly?.id === assemblyId) setActiveAssembly(null);
      loadData();
    } catch (err) {
      console.error('Delete error:', err);
    }
  }

  const approvedStories = stories.filter(s => s.status === 'approved');
  const totalSelectedWords = selectedStoryIds.reduce((sum, id) => {
    const s = stories.find(st => st.id === id);
    return sum + (s?.word_count || 0);
  }, 0);

  return (
    <div className="na-page">
      {/* Top bar */}
      <div className="na-topbar">
        <button className="na-btn-back" onClick={() => navigate('/')}>← Home</button>
        <div className="na-topbar-title">Novel Assembler</div>
        <div className="na-topbar-stats">
          <span>{approvedStories.length} approved stories</span>
          <span>{assemblies.length} assemblies</span>
          {socialImports.length > 0 && (
            <button
              onClick={() => setShowImports(!showImports)}
              style={{ padding: '3px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 12, border: `1px solid ${showImports ? char?.color : '#e8e0d0'}`, background: showImports ? `${char?.color}15` : 'transparent', color: showImports ? char?.color : '#777' }}
            >
              📱 {socialImports.length} imports
            </button>
          )}
        </div>
      </div>

      {/* Character bar */}
      <div className="na-char-bar">
        {Object.entries(CHARACTERS).map(([key, c]) => (
          <button
            key={key}
            className={`na-char-pill ${selectedChar === key ? 'active' : ''}`}
            style={{ '--char-color': c.color }}
            onClick={() => setSelectedChar(key)}
          >
            <span>{c.icon}</span>
            <span>{c.display_name}</span>
          </button>
        ))}
      </div>

      <div className="na-workspace">
        {/* ── No assemblies: full-width onboarding ── */}
        {!loading && assemblies.length === 0 && !showCreate && !activeAssembly && (
          <div className="na-onboarding">
            <div className="na-onboarding-icon" style={{ color: char?.color }}>{char?.icon}</div>
            <div className="na-onboarding-title">
              Assemble {char?.display_name}'s novel
            </div>
            <div className="na-onboarding-text">
              Pick approved stories, arrange them into chapters, visualize the emotional
              arc, and compile into a single manuscript. Each assembly becomes a
              version of the novel you can refine.
            </div>
            <div className="na-onboarding-stats">
              <div className="na-onboarding-stat">
                <div className="na-onboarding-stat-value">{approvedStories.length}</div>
                <div className="na-onboarding-stat-label">Approved Stories</div>
              </div>
              <div className="na-onboarding-stat">
                <div className="na-onboarding-stat-value">
                  {approvedStories.reduce((s, st) => s + (st.word_count || 0), 0).toLocaleString()}
                </div>
                <div className="na-onboarding-stat-label">Total Words</div>
              </div>
            </div>
            {approvedStories.length > 0 ? (
              <button
                className="na-btn na-btn-new na-btn-onboarding"
                style={{ background: char?.color }}
                onClick={() => setShowCreate(true)}
              >
                Create First Assembly
              </button>
            ) : (
              <div className="na-onboarding-hint">
                Approve stories in the Story Engine first, then come back here to assemble.
              </div>
            )}
          </div>
        )}

        {/* ── Has assemblies or creating: show split layout ── */}
        {(assemblies.length > 0 || showCreate || loading) && (
          <>
            {/* Left: Assemblies list + Create */}
            <div className="na-list-column">
              <div className="na-list-header">
                <span>Assemblies</span>
                <button
                  className="na-btn na-btn-new"
                  style={{ background: char?.color }}
                  onClick={() => setShowCreate(!showCreate)}
                >
                  {showCreate ? 'Cancel' : '+ New Assembly'}
                </button>
              </div>

              {showCreate && (
                <div className="na-create-form">
                  <input
                    className="na-create-input"
                    placeholder="Assembly title…"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                  />
                  <div className="na-create-label">
                    Select stories to include ({selectedStoryIds.length} selected · {totalSelectedWords.toLocaleString()} words)
                  </div>
                  <StoryChecklist
                    stories={approvedStories}
                    selectedIds={selectedStoryIds}
                    onToggle={toggleStoryId}
                    charColor={char?.color}
                  />
                  <button
                    className="na-btn na-btn-create"
                    style={{ background: char?.color }}
                    onClick={handleCreate}
                    disabled={creating || !newTitle.trim() || selectedStoryIds.length === 0}
                  >
                    {creating ? 'Creating…' : 'Create Assembly'}
                  </button>
                </div>
              )}

              {loading ? (
                <div className="na-loading">Loading…</div>
              ) : (
                <div className="na-assembly-list">
                  {assemblies.map(a => (
                    <AssemblyCard
                      key={a.id}
                      assembly={a}
                      charColor={char?.color}
                      onSelect={setActiveAssembly}
                      onDelete={handleDelete}
                      onCompile={handleCompile}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right: Active assembly detail */}
            <div className="na-detail-column">
              {compiling ? (
                <div className="na-compiling">
                  <div className="na-compiling-spinner" style={{ borderTopColor: char?.color }} />
                  <div>Compiling {char?.display_name}'s novel…</div>
                </div>
              ) : activeAssembly ? (
                <div className="na-detail">
                  <div className="na-detail-header" style={{ borderColor: char?.color }}>
                    <div className="na-detail-title">{activeAssembly.title}</div>
                    <div className="na-detail-meta">
                      <span>{(activeAssembly.total_word_count || 0).toLocaleString()} words</span>
                      <span>{(activeAssembly.chapter_breaks || []).length} chapters</span>
                      <span className={`na-status-${activeAssembly.status}`}>{activeAssembly.status}</span>
                    </div>
                  </div>

                  {activeAssembly.emotional_curve?.length > 0 && (
                    <EmotionalCurve
                      data={activeAssembly.emotional_curve}
                      charColor={char?.color}
                    />
                  )}

                  {activeAssembly.chapter_breaks?.length > 0 && (
                    <div className="na-chapters">
                      <div className="na-chapters-title">Chapter Structure</div>
                      {activeAssembly.chapter_breaks.map((ch, i) => (
                        <div key={i} className="na-chapter-item">
                          <span className="na-chapter-num">Ch. {i + 1}</span>
                          <span className="na-chapter-title">{ch.title}</span>
                          <span className="na-chapter-pos">@ {ch.position.toLocaleString()} words</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeAssembly.compiled_text && (
                    <div className="na-preview">
                      <div className="na-preview-title">Preview (first 2000 chars)</div>
                      <div className="na-preview-text">
                        {activeAssembly.compiled_text.slice(0, 2000)}
                        {activeAssembly.compiled_text.length > 2000 && '…'}
                      </div>
                    </div>
                  )}

                  {/* Social Imports Panel */}
                  {showImports && socialImports.length > 0 && (
                    <div style={{ marginTop: 16, padding: 14, background: '#faf8f4', border: '1px solid #e8e0d0', borderRadius: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#2c2c2c', marginBottom: 10 }}>📱 Social Imports ({socialImports.length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                        {socialImports.map(imp => (
                          <div key={imp.id} style={{ padding: '10px 12px', background: '#fff', border: '1px solid #e8e0d0', borderRadius: 8, fontSize: 12 }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: char?.color }}>{imp.platform}</span>
                              {imp.lala_detected && <span style={{ fontSize: 9, padding: '1px 6px', background: '#d6338415', color: '#d63384', borderRadius: 8 }}>Lala detected</span>}
                              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: imp.canon_status === 'approved' ? '#6ec9a015' : '#c9a96e15', color: imp.canon_status === 'approved' ? '#6ec9a0' : '#c9a96e' }}>{imp.canon_status}</span>
                            </div>
                            <div style={{ color: '#2c2c2c', lineHeight: 1.5 }}>{imp.raw_content?.slice(0, 200)}{(imp.raw_content?.length || 0) > 200 ? '…' : ''}</div>
                            {imp.detected_voice && <div style={{ fontSize: 10, color: '#777', marginTop: 4 }}>Voice: {imp.detected_voice}</div>}
                            {imp.emotional_tags?.length > 0 && (
                              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                                {imp.emotional_tags.map((tag, i) => (
                                  <span key={i} style={{ fontSize: 9, padding: '1px 6px', background: '#9e6ec915', borderRadius: 4, color: '#9e6ec9' }}>{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="na-detail-empty">
                  <div className="na-detail-empty-icon" style={{ color: char?.color }}>{char?.icon}</div>
                  <div>Select an assembly to view details</div>
                  <div className="na-detail-empty-hint">Or create a new one from approved stories.</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

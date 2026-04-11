import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

/**
 * EpisodeTodoList
 *
 * Shows TWO to-do checklists for an episode:
 *   1. Wardrobe Shopping List (UI.OVERLAY.WARDROBE_LIST) — cute vibe-based names per outfit piece
 *   2. Career Checklist (UI.OVERLAY.CAREER_LIST) — event deliverables, content, networking
 *
 * Usage:
 *   <EpisodeTodoList
 *     episodeId={episode.id}
 *     showId={show.id}
 *     onAllRequiredComplete={() => { ... }}
 *   />
 */
export default function EpisodeTodoList({ episodeId, showId, onAllRequiredComplete }) {
  const [todoList, setTodoList] = useState(null);
  const [careerList, setCareerList] = useState(null);
  const [activeList, setActiveList] = useState('wardrobe');
  const [generating, setGenerating] = useState(false);
  const [generatingCareer, setGeneratingCareer] = useState(false);
  const [locking, setLocking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAsset, setShowAsset] = useState(false);

  const fetchTodoList = useCallback(async () => {
    try {
      const res = await api.get(`/api/v1/episodes/${episodeId}/todo`);
      setTodoList(res.data.data);
      if (res.data.data?.completion?.all_required_done && onAllRequiredComplete) {
        onAllRequiredComplete();
      }
    } catch (err) {
      console.error('[TodoList] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => { fetchTodoList(); }, [fetchTodoList]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await api.post(`/api/v1/episodes/${episodeId}/todo/generate`, { showId });
      await fetchTodoList();
    } catch (err) {
      setError(err.response?.data?.error || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateCareer = async () => {
    setGeneratingCareer(true);
    setError(null);
    try {
      const res = await api.post(`/api/v1/episodes/${episodeId}/todo/generate-career`, { showId });
      setCareerList(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Career list generation failed');
    } finally {
      setGeneratingCareer(false);
    }
  };

  const toggleIncluded = async (slot) => {
    if (!todoList || todoList.status === 'locked') return;
    const updated = todoList.tasks.map(t =>
      t.slot === slot ? { ...t, included: t.included === false ? true : false } : t
    );
    setTodoList(prev => ({ ...prev, tasks: updated }));
    try {
      await api.post(`/api/v1/episodes/${episodeId}/todo/save-selection`, { tasks: updated });
    } catch { /* best-effort save */ }
  };

  const handleLock = async () => {
    setLocking(true);
    setError(null);
    try {
      const res = await api.post(`/api/v1/episodes/${episodeId}/todo/lock`);
      setTodoList(prev => ({ ...prev, status: 'locked', asset_url: res.data.assetUrl }));
    } catch (err) {
      setError(err.response?.data?.error || 'Lock failed');
    } finally {
      setLocking(false);
    }
  };

  const handleUnlock = async () => {
    try {
      await api.post(`/api/v1/episodes/${episodeId}/todo/unlock`);
      setTodoList(prev => ({ ...prev, status: 'generated' }));
    } catch (err) {
      setError(err.response?.data?.error || 'Unlock failed');
    }
  };

  if (loading) return (
    <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 13 }}>
      Loading checklist...
    </div>
  );

  if (!todoList) return (
    <div style={{
      background: '#FAF7F0', border: '1px solid #D4AF37',
      borderRadius: 12, padding: 20, textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>👗</div>
      <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
        No to-do lists yet
      </p>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: '#888' }}>
        Generate your wardrobe shopping list first — cute, vibe-based names for each outfit piece.
      </p>
      {error && (
        <div style={{ background: '#FFEBEE', color: '#C62828', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}
      <button onClick={handleGenerate} disabled={generating} style={{
        background: generating ? '#EEE' : '#B8962E',
        color: generating ? '#999' : '#FFF',
        border: 'none', borderRadius: 8,
        padding: '10px 24px', fontSize: 13, fontWeight: 700,
        cursor: generating ? 'not-allowed' : 'pointer',
      }}>
        {generating ? 'Generating...' : 'Generate Wardrobe Shopping List'}
      </button>
    </div>
  );

  const { tasks, completion, asset_url, status } = todoList;
  const isLocked = status === 'locked';
  const includedTasks = tasks.filter(t => t.included !== false);
  const excludedCount = tasks.length - includedTasks.length;
  const pct = completion.total > 0 ? Math.round((completion.completed / completion.total) * 100) : 0;

  const isWardrobe = activeList === 'wardrobe';
  const currentTasks = isWardrobe ? tasks : (careerList?.tasks || []);
  const currentAsset = isWardrobe ? asset_url : careerList?.assetUrl;

  return (
    <div style={{ background: isWardrobe ? '#FAF7F0' : '#EEF2FF', border: `1px solid ${isWardrobe ? '#D4AF37' : '#6366f1'}`, borderRadius: 12, overflow: 'hidden' }}>

      {showAsset && currentAsset && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
        }} onClick={() => setShowAsset(false)}>
          <div style={{ background: '#FFF', borderRadius: 16, padding: 24, maxWidth: 400, width: '90%' }}
            onClick={e => e.stopPropagation()}>
            <img src={currentAsset} alt={isWardrobe ? 'Wardrobe list' : 'Career list'} style={{ width: '100%', borderRadius: 8 }} />
            <p style={{ textAlign: 'center', fontSize: 10, color: '#888', margin: '8px 0 0' }}>
              {isWardrobe ? 'UI.OVERLAY.WARDROBE_LIST' : 'UI.OVERLAY.CAREER_LIST'}
            </p>
            <button onClick={() => setShowAsset(false)} style={{
              marginTop: 12, width: '100%', background: isWardrobe ? '#B8962E' : '#6366f1', color: '#FFF',
              border: 'none', borderRadius: 8, padding: '10px 0',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Done</button>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <button
          onClick={() => setActiveList('wardrobe')}
          style={{
            flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
            background: isWardrobe ? '#FAF7F0' : 'transparent',
            borderBottom: isWardrobe ? '2px solid #B8962E' : '2px solid transparent',
            fontSize: 12, fontWeight: isWardrobe ? 700 : 500,
            color: isWardrobe ? '#B8962E' : '#888',
          }}
        >
          👗 Wardrobe Shopping List
        </button>
        <button
          onClick={() => setActiveList('career')}
          style={{
            flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
            background: !isWardrobe ? '#EEF2FF' : 'transparent',
            borderBottom: !isWardrobe ? '2px solid #6366f1' : '2px solid transparent',
            fontSize: 12, fontWeight: !isWardrobe ? 700 : 500,
            color: !isWardrobe ? '#6366f1' : '#888',
          }}
        >
          💼 Career Checklist
        </button>
      </div>

      {/* Career list — generate prompt if not yet created */}
      {!isWardrobe && !careerList && (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>💼</div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#444' }}>
            Generate your career checklist — content goals, networking tasks, brand deliverables.
          </p>
          <button onClick={handleGenerateCareer} disabled={generatingCareer} style={{
            background: generatingCareer ? '#EEE' : '#6366f1',
            color: generatingCareer ? '#999' : '#FFF',
            border: 'none', borderRadius: 8,
            padding: '10px 24px', fontSize: 13, fontWeight: 700,
            cursor: generatingCareer ? 'not-allowed' : 'pointer',
          }}>
            {generatingCareer ? 'Generating...' : 'Generate Career Checklist'}
          </button>
        </div>
      )}

      {/* Header — only show for wardrobe or when career exists */}
      {(isWardrobe || careerList) && (
      <div style={{
        padding: '14px 18px', borderBottom: `1px solid ${isWardrobe ? 'rgba(184,150,46,0.2)' : 'rgba(99,102,241,0.2)'}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: completion.all_required_done && isWardrobe ? '#F0FDF4' : isWardrobe ? '#FAF7F0' : '#EEF2FF',
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
            {isWardrobe ? 'Wardrobe Shopping List' : 'Career Checklist'}
            {isLocked && isWardrobe && <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', background: '#E8F5E9', color: '#1A7A40', borderRadius: 4, fontWeight: 700 }}>LOCKED</span>}
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: '#888' }}>
            {isWardrobe ? (
              <>
                {includedTasks.length} task{includedTasks.length !== 1 ? 's' : ''} selected
                {excludedCount > 0 && <span> ({excludedCount} excluded)</span>}
                {completion.all_required_done && (
                  <span style={{ marginLeft: 8, color: '#1A7A40', fontWeight: 700 }}>Ready to go!</span>
                )}
              </>
            ) : (
              <>{careerList?.tasks?.length || 0} career tasks</>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {currentAsset && (
            <button onClick={() => setShowAsset(true)} style={{
              background: 'none', border: `1px solid ${isWardrobe ? '#D4AF37' : '#6366f1'}`,
              borderRadius: 6, padding: '4px 10px',
              fontSize: 11, color: isWardrobe ? '#B8962E' : '#6366f1', cursor: 'pointer',
            }}>Preview Overlay</button>
          )}
          {isWardrobe && !isLocked ? (
            <>
              <button onClick={handleLock} disabled={locking || includedTasks.length === 0} style={{
                background: '#B8962E', color: '#FFF', border: 'none',
                borderRadius: 6, padding: '4px 12px',
                fontSize: 11, fontWeight: 700, cursor: locking ? 'not-allowed' : 'pointer',
                opacity: (locking || includedTasks.length === 0) ? 0.6 : 1,
              }}>
                {locking ? 'Locking...' : 'Lock'}
              </button>
              <button onClick={handleGenerate} disabled={generating} style={{
                background: 'none', border: '1px solid #D4AF37',
                borderRadius: 6, padding: '4px 10px',
                fontSize: 11, color: '#B8962E', cursor: generating ? 'not-allowed' : 'pointer',
                opacity: generating ? 0.6 : 1,
              }}>
                {generating ? '...' : 'Regenerate'}
              </button>
            </>
          ) : isWardrobe ? (
            <button onClick={handleUnlock} style={{
              background: 'none', border: '1px solid #D4AF37',
              borderRadius: 6, padding: '4px 10px',
              fontSize: 11, color: '#B8962E', cursor: 'pointer',
            }}>Unlock</button>
          ) : (
            <button onClick={handleGenerateCareer} disabled={generatingCareer} style={{
              background: 'none', border: '1px solid #6366f1',
              borderRadius: 6, padding: '4px 10px',
              fontSize: 11, color: '#6366f1', cursor: generatingCareer ? 'not-allowed' : 'pointer',
            }}>
              {generatingCareer ? '...' : 'Regenerate'}
            </button>
          )}
        </div>
      </div>
      )}

      {/* Progress bar */}
      {isWardrobe && (
      <div style={{ height: 3, background: '#EEE' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: completion.all_required_done ? '#1A7A40' : '#B8962E',
          transition: 'width 0.4s ease',
        }} />
      </div>
      )}

      {/* Tasks */}
      {(isWardrobe || careerList) && (
      <div style={{ padding: '8px 0' }}>
        {currentTasks.map((task, i) => {
          const excluded = task.included === false;
          return (
            <div key={task.slot} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 18px',
              borderBottom: i < tasks.length - 1 ? '1px solid rgba(184,150,46,0.1)' : 'none',
              background: excluded ? 'rgba(0,0,0,0.02)' : task.completed ? 'rgba(26,122,64,0.04)' : 'transparent',
              opacity: excluded ? 0.5 : 1,
            }}>
              {/* Include/exclude toggle */}
              {!isLocked && isWardrobe && (
                <button
                  onClick={() => toggleIncluded(task.slot)}
                  title={excluded ? 'Include in checklist' : 'Exclude from checklist'}
                  style={{
                    width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                    border: `1.5px solid ${excluded ? '#CCC' : isWardrobe ? '#B8962E' : '#6366f1'}`,
                    background: excluded ? 'transparent' : isWardrobe ? '#B8962E' : '#6366f1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0,
                  }}
                >
                  {!excluded && <span style={{ color: '#FFF', fontSize: 11, fontWeight: 700 }}>✓</span>}
                </button>
              )}

              {/* Completion checkbox (locked wardrobe or career list) */}
              {((isLocked && isWardrobe) || !isWardrobe) && !excluded && (
                <div style={{
                  width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                  border: task.completed ? 'none' : `1.5px solid ${task.required ? (isWardrobe ? '#B8962E' : '#6366f1') : '#CCC'}`,
                  background: task.completed ? '#1A7A40' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {task.completed && <span style={{ color: '#FFF', fontSize: 12, fontWeight: 700 }}>✓</span>}
                </div>
              )}

              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: excluded ? '#AAA' : task.completed ? '#888' : '#1A1A1A',
                  textDecoration: excluded ? 'line-through' : task.completed ? 'line-through' : 'none',
                }}>
                  {task.label}
                </div>
                {task.description && (
                  <div style={{ fontSize: 11, color: excluded ? '#CCC' : task.completed ? '#AAA' : '#666', marginTop: 2 }}>
                    {task.description}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                {!task.required && !excluded && (
                  <span style={{ fontSize: 10, color: isWardrobe ? '#B8962E' : '#6366f1', fontWeight: 500 }}>optional</span>
                )}
                {excluded && (
                  <span style={{ fontSize: 10, color: '#999', fontWeight: 500 }}>excluded</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {error && (
        <div style={{ padding: '8px 18px', background: '#FFEBEE', color: '#C62828', fontSize: 12 }}>
          {error}
        </div>
      )}
    </div>
  );
}

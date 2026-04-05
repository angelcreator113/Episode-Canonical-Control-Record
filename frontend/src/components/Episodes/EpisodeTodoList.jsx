import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

/**
 * EpisodeTodoList
 *
 * Shows the to-do checklist for an episode.
 * Syncs completion state from wardrobe slots automatically.
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
  const [generating, setGenerating] = useState(false);
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
      <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
      <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
        No to-do list yet
      </p>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: '#888' }}>
        Generate a checklist from your linked event. Each task maps to a wardrobe slot.
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
        {generating ? 'Generating...' : 'Generate To-Do List'}
      </button>
    </div>
  );

  const { tasks, completion, asset_url, status } = todoList;
  const isLocked = status === 'locked';
  const includedTasks = tasks.filter(t => t.included !== false);
  const excludedCount = tasks.length - includedTasks.length;
  const pct = completion.total > 0 ? Math.round((completion.completed / completion.total) * 100) : 0;

  return (
    <div style={{ background: '#FAF7F0', border: '1px solid #D4AF37', borderRadius: 12, overflow: 'hidden' }}>

      {showAsset && asset_url && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
        }} onClick={() => setShowAsset(false)}>
          <div style={{ background: '#FFF', borderRadius: 16, padding: 24, maxWidth: 400, width: '90%' }}
            onClick={e => e.stopPropagation()}>
            <img src={asset_url} alt="To-do list" style={{ width: '100%', borderRadius: 8 }} />
            <button onClick={() => setShowAsset(false)} style={{
              marginTop: 12, width: '100%', background: '#B8962E', color: '#FFF',
              border: 'none', borderRadius: 8, padding: '10px 0',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Done</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid rgba(184,150,46,0.2)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: completion.all_required_done ? '#F0FDF4' : '#FAF7F0',
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
            Getting Ready Checklist
            {isLocked && <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', background: '#E8F5E9', color: '#1A7A40', borderRadius: 4, fontWeight: 700 }}>LOCKED</span>}
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: '#888' }}>
            {includedTasks.length} task{includedTasks.length !== 1 ? 's' : ''} selected
            {excludedCount > 0 && <span> ({excludedCount} excluded)</span>}
            {completion.all_required_done && (
              <span style={{ marginLeft: 8, color: '#1A7A40', fontWeight: 700 }}>Ready to go!</span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {asset_url && (
            <button onClick={() => setShowAsset(true)} style={{
              background: 'none', border: '1px solid #D4AF37',
              borderRadius: 6, padding: '4px 10px',
              fontSize: 11, color: '#B8962E', cursor: 'pointer',
            }}>Preview</button>
          )}
          {!isLocked ? (
            <>
              <button onClick={handleLock} disabled={locking || includedTasks.length === 0} style={{
                background: '#B8962E', color: '#FFF', border: 'none',
                borderRadius: 6, padding: '4px 12px',
                fontSize: 11, fontWeight: 700, cursor: locking ? 'not-allowed' : 'pointer',
                opacity: (locking || includedTasks.length === 0) ? 0.6 : 1,
              }}>
                {locking ? 'Locking...' : 'Lock Checklist'}
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
          ) : (
            <button onClick={handleUnlock} style={{
              background: 'none', border: '1px solid #D4AF37',
              borderRadius: 6, padding: '4px 10px',
              fontSize: 11, color: '#B8962E', cursor: 'pointer',
            }}>Unlock</button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: '#EEE' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: completion.all_required_done ? '#1A7A40' : '#B8962E',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Tasks */}
      <div style={{ padding: '8px 0' }}>
        {tasks.map((task, i) => {
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
              {!isLocked && (
                <button
                  onClick={() => toggleIncluded(task.slot)}
                  title={excluded ? 'Include in checklist' : 'Exclude from checklist'}
                  style={{
                    width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                    border: `1.5px solid ${excluded ? '#CCC' : '#B8962E'}`,
                    background: excluded ? 'transparent' : '#B8962E',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0,
                  }}
                >
                  {!excluded && <span style={{ color: '#FFF', fontSize: 11, fontWeight: 700 }}>✓</span>}
                </button>
              )}

              {/* Completion checkbox (locked mode) */}
              {isLocked && !excluded && (
                <div style={{
                  width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                  border: task.completed ? 'none' : `1.5px solid ${task.required ? '#B8962E' : '#CCC'}`,
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
                  <span style={{ fontSize: 10, color: '#B8962E', fontWeight: 500 }}>optional</span>
                )}
                {excluded && (
                  <span style={{ fontSize: 10, color: '#999', fontWeight: 500 }}>excluded</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{ padding: '8px 18px', background: '#FFEBEE', color: '#C62828', fontSize: 12 }}>
          {error}
        </div>
      )}
    </div>
  );
}

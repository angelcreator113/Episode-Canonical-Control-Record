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

  const { tasks, completion, asset_url } = todoList;
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
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: '#888' }}>
            {completion.completed}/{completion.total} complete
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
          <button onClick={handleGenerate} disabled={generating} style={{
            background: 'none', border: '1px solid #D4AF37',
            borderRadius: 6, padding: '4px 10px',
            fontSize: 11, color: '#B8962E', cursor: generating ? 'not-allowed' : 'pointer',
            opacity: generating ? 0.6 : 1,
          }}>
            {generating ? '...' : 'Regenerate'}
          </button>
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
        {tasks.map((task, i) => (
          <div key={task.slot} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 18px',
            borderBottom: i < tasks.length - 1 ? '1px solid rgba(184,150,46,0.1)' : 'none',
            background: task.completed ? 'rgba(26,122,64,0.04)' : 'transparent',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: 4, flexShrink: 0,
              border: task.completed ? 'none' : `1.5px solid ${task.required ? '#B8962E' : '#CCC'}`,
              background: task.completed ? '#1A7A40' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {task.completed && <span style={{ color: '#FFF', fontSize: 12, fontWeight: 700 }}>✓</span>}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: task.completed ? '#888' : '#1A1A1A',
                textDecoration: task.completed ? 'line-through' : 'none',
              }}>
                {task.label}
              </div>
              {task.description && (
                <div style={{ fontSize: 11, color: task.completed ? '#AAA' : '#666', marginTop: 2 }}>
                  {task.description}
                </div>
              )}
            </div>

            {!task.required && (
              <span style={{ fontSize: 10, color: '#B8962E', fontWeight: 500, flexShrink: 0 }}>
                optional
              </span>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ padding: '8px 18px', background: '#FFEBEE', color: '#C62828', fontSize: 12 }}>
          {error}
        </div>
      )}
    </div>
  );
}

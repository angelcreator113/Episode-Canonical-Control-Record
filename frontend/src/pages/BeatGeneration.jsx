import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

const API = '/api/v1';
const getToken = () => localStorage.getItem('authToken') || localStorage.getItem('token') || sessionStorage.getItem('token');
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
});

export default function BeatGeneration() {
  const { episodeId } = useParams();
  const [episode, setEpisode] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [flash, setFlash] = useState(null);

  const load = useCallback(async () => {
    try {
      const [epRes, scRes] = await Promise.all([
        fetch(`${API}/episodes/${episodeId}`, { headers: authHeaders() }),
        fetch(`${API}/scenes?episode_id=${episodeId}`, { headers: authHeaders() }),
      ]);
      if (epRes.ok) setEpisode(await epRes.json());
      if (scRes.ok) {
        const d = await scRes.json();
        setScenes(Array.isArray(d) ? d : d.data || []);
      }
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => { load(); }, [load]);

  const generateBeats = async (sceneId) => {
    setGenerating(sceneId);
    setFlash(null);
    try {
      const sceneRes = await fetch(`${API}/scenes/${sceneId}`, { headers: authHeaders() });
      if (!sceneRes.ok) throw new Error('Failed to load scene');
      const scene = await sceneRes.json();

      const scriptLines = (scene.script_lines || scene.scriptLines || []);
      if (scriptLines.length === 0) {
        setFlash({ type: 'warn', msg: 'No script lines found for this scene. Add script content first.' });
        setGenerating(null);
        return;
      }

      const res = await fetch(`${API}/scenes/${sceneId}/beats/generate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ scriptLines }),
      });
      const d = await res.json();
      if (res.ok) {
        setFlash({ type: 'ok', msg: `Generated ${d.data?.count || 0} beats for scene.` });
      } else {
        setFlash({ type: 'err', msg: d.error || 'Beat generation failed' });
      }
    } catch (e) {
      setFlash({ type: 'err', msg: e.message });
    } finally {
      setGenerating(null);
    }
  };

  const viewComposition = async (sceneId) => {
    try {
      const res = await fetch(`${API}/scenes/${sceneId}/composition`, { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        setFlash({ type: 'ok', msg: `Scene has ${d.data?.total_beats || 0} beats (${d.data?.dialogue_beats || 0} dialogue, ${d.data?.ui_beats || 0} UI)` });
      }
    } catch (e) {
      setFlash({ type: 'err', msg: e.message });
    }
  };

  if (loading) return <div className="page-wrapper" style={{ padding: 32 }}>Loading...</div>;

  return (
    <div className="page-wrapper" style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link to={`/episodes/${episodeId}/timeline`} style={{ color: '#aaa', textDecoration: 'none' }}>&larr; Timeline</Link>
        <h1 style={{ margin: 0 }}>Beat Generation</h1>
      </div>

      {episode && (
        <p style={{ color: '#999', marginBottom: 24 }}>
          Episode: <strong>{episode.title || episode.name || `#${episode.episode_number}`}</strong>
        </p>
      )}

      {flash && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: flash.type === 'ok' ? '#1a3a1a' : flash.type === 'warn' ? '#3a3a1a' : '#3a1a1a',
          color: flash.type === 'ok' ? '#4ade80' : flash.type === 'warn' ? '#fbbf24' : '#f87171',
        }}>
          {flash.msg}
        </div>
      )}

      {scenes.length === 0 ? (
        <p style={{ color: '#888' }}>No scenes found for this episode. Create scenes first.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {scenes.map(sc => (
            <div key={sc.id} style={{
              background: '#1e1e2e', border: '1px solid #333', borderRadius: 10, padding: 16,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <strong style={{ color: '#e2e8f0' }}>{sc.title || sc.scene_label || `Scene ${sc.scene_number || sc.id}`}</strong>
                {sc.location && <span style={{ color: '#888', marginLeft: 8 }}>@ {sc.location}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => viewComposition(sc.id)}
                  style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #555', background: '#2a2a3e', color: '#ccc', cursor: 'pointer' }}
                >
                  View Beats
                </button>
                <button
                  onClick={() => generateBeats(sc.id)}
                  disabled={generating === sc.id}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none',
                    background: generating === sc.id ? '#555' : '#6366f1', color: '#fff', cursor: 'pointer',
                  }}
                >
                  {generating === sc.id ? 'Generating...' : 'Generate Beats'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

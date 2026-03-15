import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

const API = '/api/v1';
const getToken = () => localStorage.getItem('authToken') || localStorage.getItem('token') || sessionStorage.getItem('token');
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
});

export default function EpisodeReview() {
  const { episodeId } = useParams();
  const [episode, setEpisode] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState(null);

  const load = useCallback(async () => {
    try {
      const [epRes, revRes] = await Promise.all([
        fetch(`${API}/episodes/${episodeId}`, { headers: authHeaders() }),
        fetch(`${API}/reviews/unacknowledged`, { headers: authHeaders() }),
      ]);
      if (epRes.ok) setEpisode(await epRes.json());
      if (revRes.ok) {
        const d = await revRes.json();
        setReviews(Array.isArray(d) ? d : d.data || d.reviews || []);
      }
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => { load(); }, [load]);

  const acknowledge = async (reviewId) => {
    try {
      const res = await fetch(`${API}/reviews/${reviewId}/acknowledge`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (res.ok) {
        setReviews(prev => prev.filter(r => r.id !== reviewId));
        setFlash({ type: 'ok', msg: 'Review acknowledged.' });
      } else {
        setFlash({ type: 'err', msg: 'Failed to acknowledge review.' });
      }
    } catch (e) {
      setFlash({ type: 'err', msg: e.message });
    }
  };

  const runPostGenReview = async (sceneId) => {
    setFlash(null);
    try {
      const res = await fetch(`${API}/reviews/post-generation`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ scene_id: sceneId }),
      });
      const d = await res.json();
      if (res.ok) {
        setFlash({ type: 'ok', msg: 'Post-generation review complete.' });
        load();
      } else {
        setFlash({ type: 'err', msg: d.error || 'Review failed' });
      }
    } catch (e) {
      setFlash({ type: 'err', msg: e.message });
    }
  };

  if (loading) return <div className="page-wrapper" style={{ padding: 32 }}>Loading...</div>;

  return (
    <div className="page-wrapper" style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link to={`/episodes/${episodeId}/export`} style={{ color: '#aaa', textDecoration: 'none' }}>&larr; Export</Link>
        <h1 style={{ margin: 0 }}>Review &amp; Approve</h1>
      </div>

      {episode && (
        <p style={{ color: '#999', marginBottom: 24 }}>
          Episode: <strong>{episode.title || episode.name || `#${episode.episode_number}`}</strong>
        </p>
      )}

      {flash && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: flash.type === 'ok' ? '#1a3a1a' : '#3a1a1a',
          color: flash.type === 'ok' ? '#4ade80' : '#f87171',
        }}>
          {flash.msg}
        </div>
      )}

      <h2 style={{ color: '#e2e8f0', fontSize: 18, marginBottom: 16 }}>Unacknowledged Reviews</h2>

      {reviews.length === 0 ? (
        <p style={{ color: '#888' }}>No pending reviews. All clear!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reviews.map(rev => (
            <div key={rev.id} style={{
              background: '#1e1e2e', border: '1px solid #333', borderRadius: 10, padding: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong style={{ color: '#e2e8f0' }}>{rev.review_type || 'Review'}</strong>
                  {rev.scene_id && <span style={{ color: '#888', marginLeft: 8 }}>Scene: {rev.scene_id}</span>}
                  {rev.created_at && <span style={{ color: '#666', marginLeft: 8, fontSize: 12 }}>{new Date(rev.created_at).toLocaleDateString()}</span>}
                </div>
                <button
                  onClick={() => acknowledge(rev.id)}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none',
                    background: '#22c55e', color: '#fff', cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  Acknowledge
                </button>
              </div>
              {rev.summary && <p style={{ color: '#aaa', marginTop: 8, fontSize: 14 }}>{rev.summary}</p>}
              {rev.issues && Array.isArray(rev.issues) && rev.issues.length > 0 && (
                <ul style={{ color: '#f59e0b', marginTop: 8, fontSize: 13, paddingLeft: 20 }}>
                  {rev.issues.map((issue, i) => <li key={i}>{typeof issue === 'string' ? issue : issue.description || JSON.stringify(issue)}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

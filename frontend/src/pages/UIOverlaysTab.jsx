import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Loader, CheckCircle2, Image, Layout, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../services/api';

export default function UIOverlaysTab() {
  const [overlays, setOverlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);
  const [showId, setShowId] = useState(null);
  const [shows, setShows] = useState([]);
  const [filter, setFilter] = useState('all'); // all | frame | icon
  const [genProgress, setGenProgress] = useState(null); // { status, completed, failed, total, errors }
  const pollRef = useRef(null);

  // Load shows
  useEffect(() => {
    api.get('/api/v1/shows').then(r => {
      const list = r.data?.data || [];
      setShows(list);
      if (list.length > 0) setShowId(list[0].id);
    }).catch(() => {});
  }, []);

  // Load overlays
  const loadOverlays = useCallback(() => {
    if (!showId) return;
    setLoading(true);
    api.get(`/api/v1/ui-overlays/${showId}`)
      .then(r => {
        setOverlays(r.data?.data || []);
        // Check if generation status is present
        if (r.data?.generation_status) {
          setGenProgress(r.data.generation_status);
        }
      })
      .catch(() => setOverlays([]))
      .finally(() => setLoading(false));
  }, [showId]);

  useEffect(() => { loadOverlays(); }, [loadOverlays]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleGenerateAll = async () => {
    if (!showId) return;
    setGenerating(true);
    setGenProgress(null);
    try {
      const postRes = await api.post(`/api/v1/ui-overlays/${showId}/generate-all`);
      if (postRes.data?.error) {
        setGenProgress({ status: 'failed', errors: [postRes.data.error] });
        setGenerating(false);
        return;
      }
      // Poll for progress every 5 seconds
      pollRef.current = setInterval(() => {
        api.get(`/api/v1/ui-overlays/${showId}`)
          .then(r => {
            const data = r.data?.data || [];
            setOverlays(data);
            const genStatus = r.data?.generation_status;
            if (genStatus) setGenProgress(genStatus);

            const done = data.filter(o => o.generated).length;
            // Stop polling if all generated OR if generation is done/failed
            if (done >= data.length || genStatus?.status === 'done' || genStatus?.status === 'failed') {
              clearInterval(pollRef.current);
              pollRef.current = null;
              setGenerating(false);
            }
          })
          .catch(() => {});
      }, 5000);
      // Stop polling after 5 minutes max
      setTimeout(() => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setGenerating(false);
      }, 300000);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message;
      setGenProgress({ status: 'failed', errors: [errMsg] });
      setGenerating(false);
    }
  };

  const handleGenerateOne = async (overlayId) => {
    if (!showId) return;
    setGeneratingId(overlayId);
    try {
      await api.post(`/api/v1/ui-overlays/${showId}/generate/${overlayId}`);
      loadOverlays();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.error || err.message));
    }
    setGeneratingId(null);
  };

  const filtered = filter === 'all' ? overlays : overlays.filter(o => o.category === filter);
  const generatedCount = overlays.filter(o => o.generated).length;

  return (
    <div style={{ padding: '20px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#2C2C2C' }}>UI Overlays</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888', fontFamily: "'DM Mono', monospace" }}>
            {generatedCount}/{overlays.length} generated — show-level assets for episode production
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {shows.length > 1 && (
            <select value={showId || ''} onChange={e => setShowId(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 12 }}>
              {shows.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button
            onClick={handleGenerateAll}
            disabled={generating || !showId}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', border: 'none', borderRadius: 8,
              background: '#B8962E', color: '#fff', fontSize: 12,
              fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer',
              opacity: generating ? 0.6 : 1,
            }}
          >
            {generating ? <><Loader size={14} className="spin" /> Generating all...</> : <><Sparkles size={14} /> Generate All ({overlays.length - generatedCount} missing)</>}
          </button>
        </div>
      </div>

      {/* Generation Progress / Error Banner */}
      {genProgress && (genProgress.status === 'generating' || genProgress.status === 'failed' || genProgress.status === 'done') && (
        <div style={{
          marginBottom: 12, padding: '10px 14px', borderRadius: 8,
          background: genProgress.status === 'failed' ? '#fef2f2' : genProgress.status === 'done' ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${genProgress.status === 'failed' ? '#fecaca' : genProgress.status === 'done' ? '#bbf7d0' : '#fde68a'}`,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          {genProgress.status === 'failed' ? (
            <AlertTriangle size={16} style={{ color: '#dc2626', marginTop: 1, flexShrink: 0 }} />
          ) : genProgress.status === 'done' ? (
            <CheckCircle2 size={16} style={{ color: '#16a34a', marginTop: 1, flexShrink: 0 }} />
          ) : (
            <Loader size={16} className="spin" style={{ color: '#d97706', marginTop: 1, flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, fontSize: 12 }}>
            {genProgress.status === 'generating' && (
              <span style={{ color: '#92400e' }}>
                Generating: {genProgress.completed || 0} completed, {genProgress.failed || 0} failed of {genProgress.total || '...'} total
              </span>
            )}
            {genProgress.status === 'done' && (
              <span style={{ color: '#166534' }}>
                Generation complete: {genProgress.completed || 0} generated{genProgress.failed > 0 ? `, ${genProgress.failed} failed` : ''}
              </span>
            )}
            {genProgress.status === 'failed' && (
              <span style={{ color: '#991b1b' }}>
                Generation failed{genProgress.completed > 0 ? ` (${genProgress.completed} succeeded)` : ''}
              </span>
            )}
            {genProgress.errors?.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 11, color: '#666', fontFamily: "'DM Mono', monospace" }}>
                {genProgress.errors.slice(-3).map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </div>
          {(genProgress.status === 'done' || genProgress.status === 'failed') && (
            <button onClick={() => { setGenProgress(null); loadOverlays(); }} style={{
              border: 'none', background: 'none', cursor: 'pointer', padding: 4,
              color: '#666', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
            }}>
              <RefreshCw size={12} /> Refresh
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[
          { key: 'all', label: 'All', icon: null },
          { key: 'frame', label: 'Frames', icon: Layout },
          { key: 'icon', label: 'Icons', icon: Image },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '5px 14px', border: '1px solid #e0d9cc', borderRadius: 20,
            background: filter === f.key ? '#2C2C2C' : '#fff',
            color: filter === f.key ? '#fff' : '#666',
            fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {f.icon && <f.icon size={12} />} {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {filtered.map(overlay => (
            <div key={overlay.id} style={{
              background: '#fff', border: '1px solid #e8e0d0', borderRadius: 12,
              overflow: 'hidden', transition: 'box-shadow 0.2s',
            }}>
              {/* Image */}
              <div style={{
                aspectRatio: '1', background: overlay.generated ? '#faf9f6' : '#f5f3ee',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', position: 'relative',
              }}>
                {overlay.generated && overlay.url ? (
                  <img src={overlay.url} alt={overlay.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
                ) : (
                  <div style={{ textAlign: 'center', color: '#ccc' }}>
                    <Sparkles size={24} />
                    <div style={{ fontSize: 9, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>Not generated</div>
                  </div>
                )}
                {overlay.generated && (
                  <div style={{ position: 'absolute', top: 6, right: 6 }}>
                    <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
                  </div>
                )}
                <div style={{
                  position: 'absolute', top: 6, left: 6,
                  padding: '2px 6px', borderRadius: 4, fontSize: 8,
                  fontFamily: "'DM Mono', monospace", textTransform: 'uppercase',
                  background: overlay.category === 'frame' ? '#dbeafe' : '#fef3c7',
                  color: overlay.category === 'frame' ? '#1e40af' : '#92400e',
                }}>
                  {overlay.category}
                </div>
              </div>

              {/* Info */}
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#2C2C2C', marginBottom: 2 }}>{overlay.name}</div>
                <div style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>{overlay.beat}</div>
                <div style={{ fontSize: 10, color: '#888', lineHeight: 1.3 }}>{overlay.description}</div>

                {!overlay.generated && (
                  <button
                    onClick={() => handleGenerateOne(overlay.id)}
                    disabled={generatingId === overlay.id}
                    style={{
                      width: '100%', marginTop: 8, padding: '6px 0',
                      border: 'none', borderRadius: 6,
                      background: '#B8962E', color: '#fff',
                      fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      opacity: generatingId === overlay.id ? 0.5 : 1,
                    }}
                  >
                    {generatingId === overlay.id ? 'Generating...' : 'Generate'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>
          <Sparkles size={32} />
          <p style={{ fontSize: 13, marginTop: 8 }}>No overlays yet. Select a show and generate.</p>
        </div>
      )}
    </div>
  );
}

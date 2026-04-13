/**
 * StoriesPage — Franchise Story Library + Editor
 *
 * Browse, generate, edit, and publish stories across formats.
 * Episode-based stories auto-generate. Original stories created here.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

const FORMAT_CONFIG = {
  short_story: { icon: '📖', label: 'Short Story', color: '#6366f1' },
  social_fiction: { icon: '📱', label: 'Social Fiction', color: '#ec4899' },
  snippet: { icon: '✂️', label: 'Snippet', color: '#f59e0b' },
  recap: { icon: '🔄', label: 'Recap', color: '#16a34a' },
  novella_chapter: { icon: '📚', label: 'Novella Chapter', color: '#B8962E' },
};

const STATUS_CONFIG = {
  draft: { color: '#94a3b8', label: 'Draft' },
  writing: { color: '#f59e0b', label: 'Writing' },
  review: { color: '#6366f1', label: 'Review' },
  published: { color: '#16a34a', label: 'Published' },
  archived: { color: '#64748b', label: 'Archived' },
};

export default function StoriesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showId, setShowId] = useState(null);
  const [filter, setFilter] = useState('all'); // all | episode | original
  const [formatFilter, setFormatFilter] = useState('all');
  const [selectedStory, setSelectedStory] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    // Get show ID
    api.get('/api/v1/shows').then(r => {
      const shows = r.data?.data || r.data || [];
      const first = Array.isArray(shows) ? shows[0] : null;
      if (first) { setShowId(first.id); loadStories(first.id); }
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadStories = async (sid) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/v1/world/${sid}/stories?limit=100`);
      setStories(res.data?.data || []);
    } catch { setStories([]); }
    finally { setLoading(false); }
  };

  const loadFullStory = async (storyId) => {
    try {
      const res = await api.get(`/api/v1/world/${showId}/stories/${storyId}`);
      setSelectedStory(res.data?.data || null);
      setEditContent(res.data?.data?.content || '');
    } catch { showToast('Failed to load story', 'error'); }
  };

  const handleSave = async () => {
    if (!selectedStory) return;
    setSaving(true);
    try {
      await api.put(`/api/v1/world/${showId}/stories/${selectedStory.id}`, { content: editContent });
      showToast('Story saved');
      setSelectedStory({ ...selectedStory, content: editContent, word_count: editContent.split(/\s+/).filter(Boolean).length });
      setEditing(false);
      loadStories(showId);
    } catch { showToast('Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const handlePublish = async (storyId) => {
    try {
      await api.put(`/api/v1/world/${showId}/stories/${storyId}`, { status: 'published' });
      showToast('Published');
      loadStories(showId);
      if (selectedStory?.id === storyId) setSelectedStory({ ...selectedStory, status: 'published' });
    } catch { showToast('Publish failed', 'error'); }
  };

  const handleGenerateAll = async (episodeId) => {
    setGenerating(true);
    try {
      const formats = ['short_story', 'social_fiction', 'snippet', 'recap'];
      let count = 0;
      for (const format of formats) {
        try {
          await api.post(`/api/v1/world/${showId}/episodes/${episodeId}/generate-story`, { format });
          count++;
        } catch { /* continue with other formats */ }
      }
      showToast(`${count} stories generated`);
      loadStories(showId);
    } catch { showToast('Generation failed', 'error'); }
    finally { setGenerating(false); }
  };

  // Filter stories
  const filtered = stories.filter(s => {
    if (filter === 'episode' && !s.episode_id) return false;
    if (filter === 'original' && s.episode_id) return false;
    if (formatFilter !== 'all' && s.format !== formatFilter) return false;
    return true;
  });

  // Group by episode
  const episodeGroups = {};
  const originalStories = [];
  filtered.forEach(s => {
    if (s.episode_id) {
      if (!episodeGroups[s.episode_id]) episodeGroups[s.episode_id] = { title: s.title, stories: [] };
      episodeGroups[s.episode_id].stories.push(s);
    } else {
      originalStories.push(s);
    }
  });

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading stories...</div>;

  // Story detail/editor view
  if (selectedStory) {
    const fmt = FORMAT_CONFIG[selectedStory.format] || FORMAT_CONFIG.short_story;
    const st = STATUS_CONFIG[selectedStory.status] || STATUS_CONFIG.draft;
    const wc = editing ? editContent.split(/\s+/).filter(Boolean).length : (selectedStory.word_count || 0);

    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 24px' }}>
        {toast && <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: toast.type === 'error' ? '#FFEBEE' : '#E8F5E9', color: toast.type === 'error' ? '#C62828' : '#16a34a', borderRadius: 10, padding: '10px 16px', fontSize: 13 }}>{toast.msg}</div>}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <button onClick={() => { setSelectedStory(null); setEditing(false); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 12, marginBottom: 4, padding: 0 }}>← Back to Library</button>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>{selectedStory.title}</h1>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <span style={{ padding: '2px 8px', background: fmt.color + '15', borderRadius: 4, fontSize: 10, fontWeight: 600, color: fmt.color }}>{fmt.icon} {fmt.label}</span>
              <span style={{ padding: '2px 8px', background: '#f1f5f9', borderRadius: 4, fontSize: 10, fontWeight: 600, color: st.color }}>{st.label}</span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{wc.toLocaleString()} words</span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>~{Math.max(1, Math.ceil(wc / 250))} min read</span>
              {selectedStory.pov_character && <span style={{ fontSize: 10, color: '#94a3b8' }}>POV: {selectedStory.pov_character}</span>}
              {selectedStory.created_at && <span style={{ fontSize: 10, color: '#94a3b8' }}>Created {new Date(selectedStory.created_at).toLocaleDateString()}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#B8962E', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{saving ? '⏳' : '💾 Save'}</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>✏️ Edit</button>
                <button onClick={() => {
                  const blob = new Blob([selectedStory.content || ''], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url;
                  a.download = `${(selectedStory.title || 'story').replace(/[^a-z0-9]/gi, '-')}.txt`;
                  a.click(); URL.revokeObjectURL(url);
                }} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>
                  📥 Export
                </button>
                <button onClick={() => { navigator.clipboard.writeText(selectedStory.content || ''); showToast('Copied to clipboard'); }} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>
                  📋 Copy
                </button>
                {selectedStory.status !== 'published' && (
                  <button onClick={() => handlePublish(selectedStory.id)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Publish</button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Content */}
        {editing ? (
          <div>
            <textarea value={editContent} onChange={e => setEditContent(e.target.value)} style={{
              width: '100%', minHeight: 500, padding: 20, border: '1px solid #e2e8f0', borderRadius: '10px 10px 0 0',
              fontSize: 15, lineHeight: 1.8, fontFamily: "'Lora', Georgia, serif", resize: 'vertical',
              outline: 'none', boxSizing: 'border-box', color: '#1a1a2e',
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 10px 10px', fontSize: 10, color: '#94a3b8' }}>
              <span>{wc.toLocaleString()} words · {editContent.length.toLocaleString()} characters · ~{Math.max(1, Math.ceil(wc / 250))} min read</span>
              <span>{saving ? 'Saving...' : 'Editing'}</span>
            </div>
          </div>
        ) : (
          <div style={{
            background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '28px 32px',
            fontSize: 15, lineHeight: 1.9, fontFamily: "'Lora', Georgia, serif", color: '#2C2C2C',
            whiteSpace: 'pre-wrap',
          }}>
            {selectedStory.content || 'No content yet. Click Edit to write.'}
          </div>
        )}
      </div>
    );
  }

  // Library view
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 24px' }}>
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: toast.type === 'error' ? '#FFEBEE' : '#E8F5E9', color: toast.type === 'error' ? '#C62828' : '#16a34a', borderRadius: 10, padding: '10px 16px', fontSize: 13 }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>Stories</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
            {stories.length} stor{stories.length !== 1 ? 'ies' : 'y'} · {Object.keys(episodeGroups).length} from episodes · {originalStories.length} original
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
          {[{ key: 'all', label: 'All' }, { key: 'episode', label: 'From Episodes' }, { key: 'original', label: 'Original' }].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: '5px 14px', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: filter === f.key ? '#1a1a2e' : '#fff', color: filter === f.key ? '#fff' : '#64748b',
            }}>{f.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {Object.entries(FORMAT_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => setFormatFilter(formatFilter === key ? 'all' : key)} style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
              background: formatFilter === key ? cfg.color + '15' : '#f8f8f8',
              color: formatFilter === key ? cfg.color : '#94a3b8',
              border: `1px solid ${formatFilter === key ? cfg.color + '40' : 'transparent'}`,
            }}>{cfg.icon} {cfg.label}</button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✍️</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#1a1a2e' }}>No stories yet</h3>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
            Complete an episode to auto-generate stories, or create an original story.
          </p>
          {showId && (
            <button onClick={() => navigate(`/shows/${showId}/world?tab=events`)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#B8962E', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              🎭 Go to Producer Mode
            </button>
          )}
        </div>
      )}

      {/* Episode-based stories */}
      {Object.entries(episodeGroups).map(([epId, group]) => (
        <div key={epId} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{group.title}</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>{group.stories.length} format{group.stories.length !== 1 ? 's' : ''} · from episode</div>
            </div>
            <button onClick={() => handleGenerateAll(epId)} disabled={generating} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #B8962E40', background: '#FAF7F0', color: '#B8962E', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
              {generating ? '⏳' : '✦ Generate All Formats'}
            </button>
          </div>
          <div style={{ padding: '8px 16px 12px' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {group.stories.map(s => {
                const fmt = FORMAT_CONFIG[s.format] || FORMAT_CONFIG.short_story;
                const st = STATUS_CONFIG[s.status] || STATUS_CONFIG.draft;
                return (
                  <div key={s.id} onClick={() => loadFullStory(s.id)} style={{
                    padding: '8px 14px', borderRadius: 8, border: `1px solid ${fmt.color}30`,
                    background: '#fafafa', cursor: 'pointer', transition: 'all 0.15s', flex: '1 1 180px', minWidth: 180,
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = fmt.color}
                    onMouseLeave={e => e.currentTarget.style.borderColor = fmt.color + '30'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: fmt.color }}>{fmt.icon} {fmt.label}</span>
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: '#f1f5f9', color: st.color, fontWeight: 600 }}>{st.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{(s.word_count || 0).toLocaleString()} words</div>
                  </div>
                );
              })}
              {/* Show missing formats */}
              {Object.entries(FORMAT_CONFIG).filter(([k]) => !group.stories.some(s => s.format === k)).map(([key, cfg]) => (
                <div key={key} onClick={async () => {
                  setGenerating(true);
                  try {
                    await api.post(`/api/v1/world/${showId}/episodes/${epId}/generate-story`, { format: key });
                    showToast(`${cfg.label} generated`);
                    loadStories(showId);
                  } catch { showToast('Failed', 'error'); }
                  finally { setGenerating(false); }
                }} style={{
                  padding: '8px 14px', borderRadius: 8, border: '1px dashed #d1d5db', background: '#fff',
                  cursor: 'pointer', flex: '1 1 180px', minWidth: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{cfg.icon} Generate {cfg.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Original stories */}
      {originalStories.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', margin: '16px 0 8px' }}>✍️ Original Stories</h3>
          {originalStories.map(s => {
            const fmt = FORMAT_CONFIG[s.format] || FORMAT_CONFIG.short_story;
            const st = STATUS_CONFIG[s.status] || STATUS_CONFIG.draft;
            return (
              <div key={s.id} onClick={() => loadFullStory(s.id)} style={{
                background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '12px 16px', marginBottom: 6,
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{s.title}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <span style={{ padding: '2px 6px', background: fmt.color + '15', borderRadius: 4, fontSize: 9, color: fmt.color, fontWeight: 600 }}>{fmt.icon} {fmt.label}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{(s.word_count || 0).toLocaleString()} words</span>
                  </div>
                </div>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: '#f1f5f9', color: st.color, fontWeight: 600 }}>{st.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

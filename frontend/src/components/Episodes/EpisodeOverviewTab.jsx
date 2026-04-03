// frontend/src/components/Episodes/EpisodeOverviewTab.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import EpisodeStatusBadge from './EpisodeStatusBadge';
import EpisodeProductionChecklist from './EpisodeProductionChecklist';
import { calculateProgress } from '../../utils/workflowRouter';
import api from '../../services/api';
import './EpisodeOverviewTab.css';

/**
 * EpisodeOverviewTab - Episode cover page with production context
 */

function EpisodeOverviewTab({ episode, show, onUpdate }) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: episode.title || '',
    logline: episode.logline || episode.description || '',
    publish_date: episode.air_date || '',
    guest: episode.guest || '',
    episode_intent: episode.episode_intent || '',
    creative_notes: episode.creative_notes || ''
  });

  // Production context state
  const [linkedEvent, setLinkedEvent] = useState(null);
  const [sceneSets, setSceneSets] = useState([]);
  const [brief, setBrief] = useState(null);
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [scriptInfo, setScriptInfo] = useState(null);
  const [totalEpisodes, setTotalEpisodes] = useState(0);

  useEffect(() => {
    if (!episode?.id) return;
    loadProductionContext();
  }, [episode?.id]);

  const loadProductionContext = async () => {
    const showId = show?.id;

    // Load linked event
    if (showId) {
      api.get(`/api/v1/world/${showId}/events`).then(({ data }) => {
        const ev = (data?.events || []).find(e => e.used_in_episode_id === episode.id);
        setLinkedEvent(ev || null);
      }).catch(() => {});
    }

    // Load scene sets
    api.get(`/api/v1/episodes/${episode.id}/scene-sets`).then(({ data }) => {
      setSceneSets(data?.data || data?.sceneSets || []);
    }).catch(() => {});

    // Load brief
    api.get(`/api/v1/episode-brief/${episode.id}`).then(({ data }) => {
      setBrief(data?.data || null);
    }).catch(() => {});

    // Load wardrobe
    if (showId) {
      api.get(`/api/v1/wardrobe?show_id=${showId}&limit=10`).then(({ data }) => {
        setWardrobeItems(data?.data || []);
      }).catch(() => {});
    }

    // Check script
    api.get(`/api/v1/episodes/${episode.id}/scripts?includeAllVersions=false`).then(({ data }) => {
      const scripts = data?.data || data?.scripts || [];
      if (scripts.length > 0) {
        const s = scripts[0];
        setScriptInfo({ exists: true, wordCount: s.content?.split(/\s+/).length || 0, updatedAt: s.updated_at });
      }
    }).catch(() => {});

    // Total episodes for arc position
    if (showId) {
      api.get(`/api/v1/episodes?show_id=${showId}&limit=100`).then(({ data }) => {
        const list = data?.episodes || data?.data || [];
        setTotalEpisodes(Array.isArray(list) ? list.length : 0);
      }).catch(() => {});
    }
  };
  
  const progress = calculateProgress(episode);
  
  const handleSave = async () => {
    try {
      await onUpdate(formData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating episode:', error);
      alert('Failed to update episode');
    }
  };
  
  const handleStatusChange = async (newStatus) => {
    try {
      await onUpdate({ status: newStatus });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };
  
  if (isEditing) {
    return (
      <div className="episode-overview-tab editing">
        <div className="overview-header">
          <h2>Edit Episode Overview</h2>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSave}>
              Save Changes
            </button>
          </div>
        </div>
        
        <div className="overview-form">
          <div className="form-group">
            <label>Episode Title *</label>
            <input
              type="text"
              className="form-input"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter episode title..."
            />
          </div>
          
          <div className="form-group">
            <label>Logline</label>
            <textarea
              className="form-textarea"
              rows="3"
              value={formData.logline}
              onChange={(e) => setFormData({ ...formData, logline: e.target.value })}
              placeholder="Short description of this episode (1-2 sentences)..."
            />
            <small className="form-hint">Keep it concise - this is the elevator pitch</small>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Publish Target Date</label>
              <input
                type="date"
                className="form-input"
                value={formData.publish_date}
                onChange={(e) => setFormData({ ...formData, publish_date: e.target.value })}
              />
            </div>
            
            <div className="form-group">
              <label>Guest (if any)</label>
              <input
                type="text"
                className="form-input"
                value={formData.guest}
                onChange={(e) => setFormData({ ...formData, guest: e.target.value })}
                placeholder="Guest name..."
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Episode Intent</label>
            <input
              type="text"
              className="form-input"
              value={formData.episode_intent}
              onChange={(e) => setFormData({ ...formData, episode_intent: e.target.value })}
              placeholder="1-line internal goal (e.g., 'Strengthen LaLa's networking arc')"
            />
            <small className="form-hint">What's the purpose of this episode? (helps AI later)</small>
          </div>
          
          <div className="form-group">
            <label>Creative Notes</label>
            <textarea
              className="form-textarea"
              rows="6"
              value={formData.creative_notes}
              onChange={(e) => setFormData({ ...formData, creative_notes: e.target.value })}
              placeholder="Intent, emotional goal, tone direction, canon reminders, things to remember in edit..."
            />
            <small className="form-hint">Lightweight notes - not a lore system (yet)</small>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="episode-overview-tab">
      {/* Header */}
      <div className="overview-header">
        <h2>Episode Overview</h2>
        <button className="btn-edit" onClick={() => setIsEditing(true)}>
          ✏️ Edit
        </button>
      </div>
      
      {/* Cover Page */}
      <div className="overview-cover">
        {/* Title Section */}
        <div className="cover-section title-section">
          <h1 className="episode-title">{episode.title}</h1>
          {formData.logline && (
            <p className="episode-logline">{formData.logline}</p>
          )}
        </div>
        
        {/* Meta Grid */}
        <div className="cover-meta-grid">
          <div className="meta-card">
            <span className="meta-label">Status</span>
            <div className="meta-value">
              <EpisodeStatusBadge
                episode={episode}
                onStatusChange={handleStatusChange}
                size="medium"
              />
            </div>
          </div>
          
          {formData.publish_date && (
            <div className="meta-card">
              <span className="meta-label">Publish Date</span>
              <div className="meta-value date">
                📅 {new Date(formData.publish_date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
            </div>
          )}
          
          {formData.guest && (
            <div className="meta-card">
              <span className="meta-label">Guest</span>
              <div className="meta-value guest">
                👤 {formData.guest}
              </div>
            </div>
          )}
          
          {show && (
            <div className="meta-card">
              <span className="meta-label">Show</span>
              <div className="meta-value show">
                <button
                  className="show-link"
                  onClick={() => navigate(`/shows/${show.id}`)}
                >
                  🎬 {show.name}
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Arc Position */}
        {(brief?.arc_number || episode.episode_number) && (
          <div className="cover-section" style={{ padding: '12px 16px', background: '#fafaf7', borderRadius: 10, border: '1px solid #f0ede6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Season Position</span>
              {brief?.episode_archetype && (
                <span style={{ padding: '2px 10px', background: '#eef2ff', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#6366f1' }}>{brief.episode_archetype}</span>
              )}
              {brief?.designed_intent && (
                <span style={{ padding: '2px 10px', background: brief.designed_intent === 'slay' ? '#f0fdf4' : brief.designed_intent === 'fail' ? '#fef2f2' : '#fef3c7', borderRadius: 6, fontSize: 11, fontWeight: 600, color: brief.designed_intent === 'slay' ? '#16a34a' : brief.designed_intent === 'fail' ? '#dc2626' : '#b45309' }}>
                  {brief.designed_intent.toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              {Array.from({ length: totalEpisodes || 12 }, (_, i) => (
                <div key={i} style={{
                  flex: 1, height: 6, borderRadius: 3,
                  background: (i + 1) === (episode.episode_number || 1) ? '#B8962E' : (i + 1) < (episode.episode_number || 1) ? '#d1fae5' : '#f1f5f9',
                  transition: 'background 0.2s',
                }} title={`Episode ${i + 1}`} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 9, color: '#cbd5e1' }}>Ep 1</span>
              <span style={{ fontSize: 10, color: '#B8962E', fontWeight: 600 }}>Ep {episode.episode_number || '?'}{brief?.arc_number ? ` · Arc ${brief.arc_number}` : ''}</span>
              <span style={{ fontSize: 9, color: '#cbd5e1' }}>Ep {totalEpisodes || 12}</span>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="cover-section" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => navigate(`/episodes/${episode.id}/plan`)} style={{ padding: '8px 16px', background: '#FAF7F0', border: '1px solid rgba(184,150,46,0.2)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#B8962E', cursor: 'pointer' }}>
            🎬 Scene Planner
          </button>
          {show?.id && (
            <button onClick={() => navigate(`/shows/${show.id}/world?tab=events`)} style={{ padding: '8px 16px', background: '#FAF7F0', border: '1px solid rgba(184,150,46,0.2)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#B8962E', cursor: 'pointer' }}>
              📅 Producer Mode
            </button>
          )}
          <button onClick={() => setIsEditing(true)} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontWeight: 500, color: '#64748b', cursor: 'pointer' }}>
            ✏️ Edit Details
          </button>
        </div>

        {/* Linked Event */}
        {linkedEvent && (
          <div className="cover-section" style={{ padding: '14px 16px', background: '#fff', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>💌 Event</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>{linkedEvent.name}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ padding: '2px 8px', background: 'rgba(184,150,46,0.08)', borderRadius: 4, fontSize: 10, color: '#B8962E' }}>⭐ {linkedEvent.prestige}</span>
                  <span style={{ padding: '2px 8px', background: 'rgba(184,150,46,0.08)', borderRadius: 4, fontSize: 10, color: '#B8962E' }}>🪙 {linkedEvent.cost_coins}</span>
                  {linkedEvent.dress_code && <span style={{ padding: '2px 8px', background: 'rgba(184,150,46,0.08)', borderRadius: 4, fontSize: 10, color: '#B8962E' }}>👗 {linkedEvent.dress_code}</span>}
                  {linkedEvent.host && <span style={{ padding: '2px 8px', background: '#f1f5f9', borderRadius: 4, fontSize: 10, color: '#64748b' }}>🏛️ {linkedEvent.host}</span>}
                </div>
                {linkedEvent.narrative_stakes && (
                  <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 6, lineHeight: 1.4 }}>{linkedEvent.narrative_stakes}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scene Sets Preview */}
        {sceneSets.length > 0 && (
          <div className="cover-section" style={{ padding: '14px 16px', background: '#fff', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>📍 Locations ({sceneSets.length})</h3>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
              {sceneSets.map(ss => (
                <div key={ss.id} style={{ flexShrink: 0, width: 120 }}>
                  {ss.base_still_url ? (
                    <img src={ss.base_still_url} alt={ss.name} style={{ width: 120, height: 70, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)' }} />
                  ) : (
                    <div style={{ width: 120, height: 70, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>📍</div>
                  )}
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ss.name}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>{ss.scene_type?.replace(/_/g, ' ')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Script Status */}
        <div className="cover-section" style={{ padding: '14px 16px', background: '#fff', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>📝 Script</h3>
          {scriptInfo?.exists ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ padding: '3px 10px', background: '#f0fdf4', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#16a34a' }}>✓ Script exists</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>{scriptInfo.wordCount?.toLocaleString()} words</span>
              {scriptInfo.updatedAt && <span style={{ fontSize: 10, color: '#94a3b8' }}>Updated {new Date(scriptInfo.updatedAt).toLocaleDateString()}</span>}
            </div>
          ) : (
            <span style={{ fontSize: 12, color: '#94a3b8' }}>No script generated yet — complete the checklist below</span>
          )}
          {episode.script_content && !scriptInfo?.exists && (
            <div style={{ marginTop: 4 }}>
              <span style={{ padding: '3px 10px', background: '#fef3c7', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#b45309' }}>Draft in episode</span>
              <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>{episode.script_content.split(/\s+/).length.toLocaleString()} words</span>
            </div>
          )}
        </div>

        {/* Wardrobe Preview */}
        {wardrobeItems.length > 0 && (
          <div className="cover-section" style={{ padding: '14px 16px', background: '#fff', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>👗 Wardrobe ({wardrobeItems.length})</h3>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {wardrobeItems.slice(0, 8).map(w => (
                <span key={w.id} style={{ padding: '3px 10px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 6, fontSize: 10, color: '#7c3aed', fontWeight: 500 }}>
                  {w.name || w.category || 'Item'}
                </span>
              ))}
              {wardrobeItems.length > 8 && <span style={{ fontSize: 10, color: '#94a3b8', padding: '3px 6px' }}>+{wardrobeItems.length - 8} more</span>}
            </div>
          </div>
        )}

        {/* Episode Intent */}
        {formData.episode_intent && (
          <div className="cover-section intent-section">
            <h3 className="section-title">
              <span className="section-icon">🎯</span>
              Episode Intent
            </h3>
            <p className="intent-text">{formData.episode_intent}</p>
          </div>
        )}

        {/* Production Checklist */}
        <div className="cover-section progress-section">
          <EpisodeProductionChecklist
            episode={episode}
            showId={show?.id}
            onScriptGenerate={(data) => {
              if (data?.script) {
                setScriptInfo({ exists: true, wordCount: data.script.split(/\s+/).length, updatedAt: new Date().toISOString() });
              }
            }}
          />
        </div>

        {/* Creative Notes */}
        {formData.creative_notes && (
          <div className="cover-section notes-section">
            <h3 className="section-title">
              <span className="section-icon">💭</span>
              Creative Notes
            </h3>
            <div className="notes-content">
              {formData.creative_notes.split('\n').map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
          </div>
        )}

        {/* Empty States */}
        {!formData.logline && !formData.episode_intent && !formData.creative_notes && (
          <div className="empty-prompt">
            <p>📝 Add more details to make this cover page complete</p>
            <button className="btn-primary" onClick={() => setIsEditing(true)}>
              Complete Overview
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default EpisodeOverviewTab;

import React, { useState, useEffect } from 'react';
import { FiUser, FiMic, FiVideo, FiSettings, FiSave, FiPlus, FiTrash2 } from 'react-icons/fi';
import axios from 'axios';

const CharacterProfileEditor = ({ showId, characterId = null, onSaved, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [character, setCharacter] = useState({
    character_name: '',
    editing_style: {
      pacing: 'medium',
      preferred_framing: 'medium',
      reaction_frequency: 0.5,
      overlay_behavior: 'minimal',
      cut_on_emphasis: true,
      cut_on_breath: false
    },
    voice_embedding: null,
    face_embeddings: null
  });

  const [enrollmentClips, setEnrollmentClips] = useState([]);
  const [voiceQuality, setVoiceQuality] = useState(null);

  useEffect(() => {
    if (characterId) {
      loadCharacter();
    }
  }, [characterId]);

  const loadCharacter = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/v1/characters/${characterId}`);
      setCharacter(response.data.data);
    } catch (error) {
      console.error('Failed to load character:', error);
      alert('Failed to load character profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!character.character_name.trim()) {
      alert('Character name is required');
      return;
    }

    try {
      setSaving(true);
      
      if (characterId) {
        await axios.put(`/api/v1/characters/${characterId}`, character);
      } else {
        await axios.post(`/api/v1/shows/${showId}/characters`, character);
      }
      
      onSaved && onSaved();
    } catch (error) {
      console.error('Failed to save character:', error);
      alert('Failed to save character profile');
    } finally {
      setSaving(false);
    }
  };

  const handleEnrollVoice = async () => {
    if (enrollmentClips.length === 0) {
      alert('Please select at least one clip for voice enrollment');
      return;
    }

    try {
      const response = await axios.post(`/api/v1/characters/${characterId}/enroll-voice`, {
        clips: enrollmentClips
      });
      
      setCharacter({
        ...character,
        voice_embedding: response.data.data.voice_embedding
      });
      
      setVoiceQuality(response.data.data.quality_score);
      alert(`✅ Voice profile created! Confidence: ${Math.round(response.data.data.quality_score * 100)}%`);
    } catch (error) {
      console.error('Voice enrollment failed:', error);
      alert('Failed to create voice profile');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div className="ed-spinner"></div>
        <p>Loading character...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <FiUser size={24} />
        {characterId ? 'Edit Character Profile' : 'New Character Profile'}
      </h2>

      {/* Basic Info */}
      <div className="ed-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
          Basic Information
        </h3>
        
        <div>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
            Character Name *
          </label>
          <input
            type="text"
            value={character.character_name}
            onChange={(e) => setCharacter({ ...character, character_name: e.target.value })}
            placeholder="e.g., Lala, JustAWoman, Guest Host"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      {/* Editing Style */}
      <div className="ed-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiSettings size={18} />
          Editing Style Preferences
        </h3>

        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Pacing */}
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
              Pacing
            </label>
            <select
              value={character.editing_style.pacing}
              onChange={(e) => setCharacter({
                ...character,
                editing_style: { ...character.editing_style, pacing: e.target.value }
              })}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            >
              <option value="fast">Fast (quick cuts, energetic)</option>
              <option value="medium">Medium (balanced)</option>
              <option value="slow">Slow (longer holds, contemplative)</option>
            </select>
          </div>

          {/* Preferred Framing */}
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
              Preferred Framing
            </label>
            <select
              value={character.editing_style.preferred_framing}
              onChange={(e) => setCharacter({
                ...character,
                editing_style: { ...character.editing_style, preferred_framing: e.target.value }
              })}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            >
              <option value="close">Close-up (intimate, emotional)</option>
              <option value="medium">Medium (conversational)</option>
              <option value="wide">Wide (contextual, environmental)</option>
            </select>
          </div>

          {/* Reaction Frequency */}
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
              Reaction Shot Frequency: {Math.round(character.editing_style.reaction_frequency * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={character.editing_style.reaction_frequency}
              onChange={(e) => setCharacter({
                ...character,
                editing_style: { ...character.editing_style, reaction_frequency: parseFloat(e.target.value) }
              })}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              <span>Minimal</span>
              <span>Heavy</span>
            </div>
          </div>

          {/* Overlay Behavior */}
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
              Overlay/Graphics Style
            </label>
            <select
              value={character.editing_style.overlay_behavior}
              onChange={(e) => setCharacter({
                ...character,
                editing_style: { ...character.editing_style, overlay_behavior: e.target.value }
              })}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            >
              <option value="minimal">Minimal (clean, professional)</option>
              <option value="moderate">Moderate (balanced)</option>
              <option value="heavy">Heavy (dynamic, energetic)</option>
            </select>
          </div>

          {/* Cut on Emphasis */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="checkbox"
              id="cut-emphasis"
              checked={character.editing_style.cut_on_emphasis}
              onChange={(e) => setCharacter({
                ...character,
                editing_style: { ...character.editing_style, cut_on_emphasis: e.target.checked }
              })}
              style={{ width: '20px', height: '20px' }}
            />
            <label htmlFor="cut-emphasis" style={{ fontSize: '14px', fontWeight: '500' }}>
              Cut on emphasis words/gestures
            </label>
          </div>

          {/* Cut on Breath */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="checkbox"
              id="cut-breath"
              checked={character.editing_style.cut_on_breath}
              onChange={(e) => setCharacter({
                ...character,
                editing_style: { ...character.editing_style, cut_on_breath: e.target.checked }
              })}
              style={{ width: '20px', height: '20px' }}
            />
            <label htmlFor="cut-breath" style={{ fontSize: '14px', fontWeight: '500' }}>
              Cut on breath pauses
            </label>
          </div>
        </div>
      </div>

      {/* Voice Profile */}
      {characterId && (
        <div className="ed-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiMic size={18} />
            Voice Profile
          </h3>

          {character.voice_embedding ? (
            <div style={{
              padding: '16px',
              backgroundColor: '#f0fdf4',
              borderRadius: '8px',
              borderLeft: '4px solid #10b981'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <span style={{ fontSize: '24px' }}>✅</span>
                <div>
                  <div style={{ fontWeight: '600', color: '#065f46' }}>Voice Profile Active</div>
                  {voiceQuality && (
                    <div style={{ fontSize: '14px', color: '#047857', marginTop: '4px' }}>
                      Confidence: {Math.round(voiceQuality * 100)}%
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '14px', color: '#065f46', marginTop: '12px' }}>
                This character's voice will be automatically detected in new footage.
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
                Create a voice profile to automatically detect this character in raw footage.
              </p>
              <button
                onClick={() => alert('Voice enrollment UI coming soon!')}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FiMic size={16} />
                Create Voice Profile
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: '12px 24px',
            backgroundColor: '#f3f4f6',
            color: '#111827',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '12px 24px',
            background: saving ? '#9ca3af' : '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FiSave size={16} />
          {saving ? 'Saving...' : (characterId ? 'Update Character' : 'Create Character')}
        </button>
      </div>
    </div>
  );
};

export default CharacterProfileEditor;

import React, { useState, useEffect } from 'react';
import { FiMonitor, FiLayout, FiZap, FiCamera, FiMessageSquare } from 'react-icons/fi';
import axios from 'axios';

const GameShowComposer = ({ episodeId, showId }) => {
  const [showFormat, setShowFormat] = useState(null);
  const [phases, setPhases] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [interactiveElements, setInteractiveElements] = useState([]);
  const [activePhase, setActivePhase] = useState('gameplay');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShowFormat();
    loadPhases();
  }, [showId, episodeId]);

  const loadShowFormat = async () => {
    try {
      const response = await axios.get(`/api/v1/shows/${showId}`);
      setShowFormat(response.data.data.format_config);
      
      // Load layout templates for this show
      const layoutsResponse = await axios.get(`/api/v1/shows/${showId}/layouts`);
      setLayouts(layoutsResponse.data.data);
    } catch (error) {
      console.error('Failed to load show format:', error);
    }
  };

  const loadPhases = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/v1/episodes/${episodeId}/phases`);
      setPhases(response.data.data || []);
    } catch (error) {
      console.error('Failed to load phases:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultPhases = async () => {
    // Auto-create default phase structure for game show
    const defaultPhases = [
      {
        phase_name: 'intro',
        layout_template_id: layouts.find(l => l.layout_type === 'cinematic')?.id,
        active_characters: {
          player: { visible: true, camera: 'main_feed', control: 'user' }
        }
      },
      {
        phase_name: 'gameplay',
        layout_template_id: layouts.find(l => l.layout_type === 'twitch')?.id,
        active_characters: {
          player: { visible: true, camera: 'main_feed', control: 'user' },
          ai: { visible: true, camera: 'overlay', control: 'system', mode: 'advisor' }
        }
      },
      {
        phase_name: 'photoshoot',
        layout_template_id: layouts.find(l => l.layout_type === 'cinematic')?.id,
        active_characters: {
          player: { visible: true, camera: 'full_screen', control: 'user' }
        }
      },
      {
        phase_name: 'outro',
        layout_template_id: layouts.find(l => l.layout_type === 'cinematic')?.id,
        active_characters: {
          player: { visible: true, camera: 'main_feed' },
          ai: { visible: true, camera: 'overlay' }
        }
      }
    ];

    try {
      await axios.post(`/api/v1/episodes/${episodeId}/phases/bulk`, {
        phases: defaultPhases
      });
      loadPhases();
    } catch (error) {
      console.error('Failed to create phases:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div className="ed-spinner"></div>
        <p>Loading game show composer...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FiMonitor size={24} />
          Game Show Composer
        </h2>

        {phases.length === 0 && (
          <button
            onClick={createDefaultPhases}
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
            <FiZap size={16} />
            Generate Default Structure
          </button>
        )}
      </div>

      {/* Show Format Info */}
      {showFormat && (
        <div className="ed-card" style={{ marginBottom: '24px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <FiLayout size={20} />
            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Show Format</h3>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Layout Style</div>
              <div style={{ fontWeight: '600', color: '#7c3aed' }}>{showFormat.layout_style || 'Not set'}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Player Character</div>
              <div style={{ fontWeight: '600' }}>{showFormat.player_character}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>AI Character</div>
              <div style={{ fontWeight: '600' }}>{showFormat.ai_character}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Interactive</div>
              <div style={{ fontWeight: '600', color: showFormat.interactive_elements ? '#10b981' : '#6b7280' }}>
                {showFormat.interactive_elements ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase Timeline */}
      {phases.length > 0 ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          {phases.map((phase, idx) => (
            <PhaseCard
              key={phase.id}
              phase={phase}
              index={idx}
              isActive={activePhase === phase.phase_name}
              onClick={() => setActivePhase(phase.phase_name)}
            />
          ))}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '48px',
          backgroundColor: '#f9fafb',
          borderRadius: '12px'
        }}>
          <FiMonitor size={48} style={{ color: '#9ca3af', marginBottom: '16px' }} />
          <h3 style={{ color: '#111827', marginBottom: '8px' }}>No Phases Configured</h3>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>
            Click "Generate Default Structure" to create a standard game show layout
          </p>
        </div>
      )}
    </div>
  );
};

// Phase Card Component
const PhaseCard = ({ phase, index, isActive, onClick }) => {
  const getPhaseIcon = (name) => {
    const icons = {
      intro: '🎬',
      gameplay: '🎮',
      ai_interaction: '🤖',
      photoshoot: '📸',
      outro: '🎭'
    };
    return icons[name] || '📺';
  };

  const getPhaseColor = (name) => {
    const colors = {
      intro: '#3b82f6',
      gameplay: '#8b5cf6',
      ai_interaction: '#ec4899',
      photoshoot: '#f59e0b',
      outro: '#10b981'
    };
    return colors[name] || '#6b7280';
  };

  return (
    <div
      className="ed-card"
      onClick={onClick}
      style={{
        padding: '16px',
        cursor: 'pointer',
        borderLeft: `4px solid ${getPhaseColor(phase.phase_name)}`,
        backgroundColor: isActive ? '#f9fafb' : 'white',
        transition: 'all 0.2s'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          {/* Phase Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span style={{ fontSize: '32px' }}>{getPhaseIcon(phase.phase_name)}</span>
            <div>
              <div style={{ fontWeight: '700', fontSize: '16px', textTransform: 'uppercase' }}>
                {phase.phase_name}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>
                {formatTime(phase.start_time)} → {formatTime(phase.end_time)} 
                <span style={{ marginLeft: '8px' }}>
                  ({Math.round(phase.end_time - phase.start_time)}s)
                </span>
              </div>
            </div>
          </div>

          {/* Active Characters */}
          <div style={{
            backgroundColor: 'white',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '12px'
          }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>
              ACTIVE CHARACTERS
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {Object.entries(phase.active_characters || {}).map(([charKey, charConfig]) => (
                <div
                  key={charKey}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: charConfig.visible ? '#dbeafe' : '#f3f4f6',
                    color: charConfig.visible ? '#1e40af' : '#6b7280',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {charConfig.control === 'user' ? <FiCamera size={14} /> : <FiMessageSquare size={14} />}
                  {charKey}
                </div>
              ))}
            </div>
          </div>

          {/* Layout Info */}
          {phase.layout_template_id && (
            <div style={{
              backgroundColor: '#ede9fe',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#7c3aed'
            }}>
              <strong>📐 Layout:</strong> {phase.layout_template?.name || 'Custom layout'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default GameShowComposer;

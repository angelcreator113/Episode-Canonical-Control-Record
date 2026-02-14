import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AnalysisDashboard = ({ rawFootageId, editMap, onRefresh }) => {
  const [activeView, setActiveView] = useState('timeline');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!editMap) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎬</div>
        <p>No analysis available yet.</p>
        <p style={{ fontSize: '14px', marginTop: '8px' }}>
          Upload footage and click "Analyze" to generate edit map.
        </p>
      </div>
    );
  }

  if (editMap.processing_status === 'pending' || editMap.processing_status === 'processing') {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div className="ed-spinner" style={{ margin: '0 auto 24px' }}></div>
        <h3 style={{ color: '#111827', marginBottom: '8px' }}>AI Analysis in Progress...</h3>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          {editMap.processing_status === 'pending' ? 'Queued for processing' : 'Analyzing footage'}
        </p>
        <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '16px' }}>
          This usually takes 2-5 minutes
        </p>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            backgroundColor: '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          {isRefreshing ? 'Checking...' : '🔄 Check Status'}
        </button>
      </div>
    );
  }

  if (editMap.processing_status === 'failed') {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h3 style={{ color: '#ef4444', marginBottom: '8px' }}>Analysis Failed</h3>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          {editMap.error_message || 'Unknown error occurred'}
        </p>
      </div>
    );
  }

  // Analysis complete - show results
  return (
    <div style={{ padding: '24px' }}>
      {/* View Switcher */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '24px',
        borderBottom: '1px solid #e5e7eb',
        paddingBottom: '12px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setActiveView('timeline')}
          style={{
            padding: '8px 16px',
            backgroundColor: activeView === 'timeline' ? '#7c3aed' : 'transparent',
            color: activeView === 'timeline' ? 'white' : '#6b7280',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          🎬 Timeline
        </button>
        <button
          onClick={() => setActiveView('transcript')}
          style={{
            padding: '8px 16px',
            backgroundColor: activeView === 'transcript' ? '#7c3aed' : 'transparent',
            color: activeView === 'transcript' ? 'white' : '#6b7280',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          📝 Transcript
        </button>
        <button
          onClick={() => setActiveView('cuts')}
          style={{
            padding: '8px 16px',
            backgroundColor: activeView === 'cuts' ? '#7c3aed' : 'transparent',
            color: activeView === 'cuts' ? 'white' : '#6b7280',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          ✂️ Cuts
        </button>
        <button
          onClick={() => setActiveView('broll')}
          style={{
            padding: '8px 16px',
            backgroundColor: activeView === 'broll' ? '#7c3aed' : 'transparent',
            color: activeView === 'broll' ? 'white' : '#6b7280',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          🎥 B-Roll
        </button>
      </div>

      {/* Timeline View */}
      {activeView === 'timeline' && (
        <TimelineView editMap={editMap} />
      )}

      {/* Transcript View */}
      {activeView === 'transcript' && (
        <TranscriptView editMap={editMap} />
      )}

      {/* Cuts View */}
      {activeView === 'cuts' && (
        <CutsView editMap={editMap} />
      )}

      {/* B-Roll View */}
      {activeView === 'broll' && (
        <BRollView editMap={editMap} />
      )}
    </div>
  );
};

// Timeline visualization
const TimelineView = ({ editMap }) => {
  const timeline = editMap.active_speaker_timeline || [];

  if (!timeline || timeline.length === 0) {
    return (
      <div style={{
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        padding: '24px',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        No timeline data available
      </div>
    );
  }

  return (
    <div>
      <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
        Active Speaker Timeline
      </h4>
      
      <div style={{
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        padding: '16px',
        maxHeight: '600px',
        overflowY: 'auto'
      }}>
        {timeline.map((segment, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: '12px',
              padding: '12px',
              backgroundColor: 'white',
              borderRadius: '6px',
              borderLeft: `4px solid ${segment.character === 'off_camera' ? '#ef4444' : '#10b981'}`
            }}
          >
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              marginBottom: '8px',
              flexWrap: 'wrap'
            }}>
              <div style={{ fontWeight: '600', color: '#111827' }}>
                {segment.character === 'off_camera' ? '🔴 Off Camera' : `✅ ${segment.character}`}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>
                {formatTime(segment.start_time)} - {formatTime(segment.end_time)}
              </div>
            </div>
            <div style={{ fontSize: '14px', color: '#374151' }}>
              {segment.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Transcript view
const TranscriptView = ({ editMap }) => {
  const segments = editMap.speaker_segments || [];

  if (!segments || segments.length === 0) {
    return (
      <div style={{
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        padding: '24px',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        No transcript available
      </div>
    );
  }

  return (
    <div>
      <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
        Full Transcript with Speaker Labels
      </h4>
      
      <div style={{
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        padding: '16px',
        maxHeight: '600px',
        overflowY: 'auto'
      }}>
        {segments.map((segment, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: 'white',
              borderRadius: '6px'
            }}
          >
            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '8px',
              fontSize: '12px',
              color: '#6b7280',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontWeight: '600', color: '#7c3aed' }}>
                {segment.speaker || 'Unknown'}
              </span>
              <span style={{ fontFamily: 'monospace' }}>
                {formatTime(segment.start_time)}
              </span>
            </div>
            <div style={{ fontSize: '14px', color: '#111827', lineHeight: '1.5' }}>
              {Array.isArray(segment.words) ? segment.words.join(' ') : segment.words}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Suggested cuts view
const CutsView = ({ editMap }) => {
  const cuts = editMap.suggested_cuts || [];

  if (!cuts || cuts.length === 0) {
    return (
      <div style={{
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        padding: '24px',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        No suggested cuts found
      </div>
    );
  }

  return (
    <div>
      <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
        AI-Suggested Cut Points ({cuts.length} total)
      </h4>
      
      <div style={{
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        padding: '16px',
        maxHeight: '600px',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'grid', gap: '12px' }}>
          {cuts.map((cut, idx) => (
            <div
              key={idx}
              style={{
                padding: '12px',
                backgroundColor: 'white',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}
            >
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>
                  {cut.type === 'silence' ? '⏸️ Silence' : '📝 Sentence End'}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  Confidence: {Math.round((cut.confidence || 0) * 100)}%
                </div>
              </div>
              <div style={{
                fontFamily: 'monospace',
                fontSize: '14px',
                fontWeight: '600',
                color: '#7c3aed'
              }}>
                {formatTime(cut.time)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// B-Roll opportunities view
const BRollView = ({ editMap }) => {
  const opportunities = editMap.b_roll_opportunities || [];

  if (!opportunities || opportunities.length === 0) {
    return (
      <div style={{
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        padding: '24px',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        No B-roll opportunities detected
      </div>
    );
  }

  return (
    <div>
      <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
        B-Roll Opportunities ({opportunities.length} total)
      </h4>
      
      <div style={{
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        padding: '16px',
        maxHeight: '600px',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'grid', gap: '12px' }}>
          {opportunities.map((opp, idx) => (
            <div
              key={idx}
              style={{
                padding: '12px',
                backgroundColor: 'white',
                borderRadius: '6px',
                borderLeft: '4px solid #f59e0b'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                flexWrap: 'wrap'
              }}>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>
                  {opp.reason === 'speaker_off_camera' ? '🔴 Speaker Off Camera' : '👁️ Visual Cue'}
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: '#6b7280'
                }}>
                  {formatTime(opp.start_time)} - {formatTime(opp.end_time)}
                </div>
              </div>
              <div style={{
                fontSize: '13px',
                color: '#111827'
              }}>
                {opp.suggested_content ? opp.suggested_content.replace(/_/g, ' ') : 'Suggested content'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Helper function to format time
function formatTime(seconds) {
  if (!seconds && seconds !== 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default AnalysisDashboard;

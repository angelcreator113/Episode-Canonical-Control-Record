import { useState, useEffect } from 'react';
import { getDecisions } from '../services/decisionService';
import { FiClock, FiCheckCircle, FiXCircle, FiFilter, FiStar } from 'react-icons/fi';

/**
 * Decision History Component
 * Shows chronological list of user decisions for an episode
 */
export default function DecisionHistory({ episodeId }) {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    decision_type: '',
    decision_category: '',
    was_ai_suggestion: '',
  });
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    total: 0,
  });

  useEffect(() => {
    if (episodeId) {
      loadDecisions();
    }
  }, [episodeId, filter, pagination.offset]);

  const loadDecisions = async () => {
    setLoading(true);
    try {
      const filters = {
        episode_id: episodeId,
        limit: pagination.limit,
        offset: pagination.offset,
      };

      if (filter.decision_type) filters.decision_type = filter.decision_type;
      if (filter.decision_category) filters.decision_category = filter.decision_category;
      if (filter.was_ai_suggestion) filters.was_ai_suggestion = filter.was_ai_suggestion === 'true';

      const response = await getDecisions(filters);
      setDecisions(response.decisions || []);
      setPagination(prev => ({ ...prev, total: response.count || 0 }));
    } catch (error) {
      console.error('Failed to load decisions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getCategoryColor = (category) => {
    const colors = {
      timing: 'bg-blue-100 text-blue-800',
      style: 'bg-purple-100 text-purple-800',
      content: 'bg-green-100 text-green-800',
      asset_selection: 'bg-yellow-100 text-yellow-800',
      technical: 'bg-gray-100 text-gray-800',
      ai_feedback: 'bg-pink-100 text-pink-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const renderChosenOption = (option) => {
    if (typeof option === 'object') {
      return JSON.stringify(option, null, 2);
    }
    return String(option);
  };

  if (loading && decisions.length === 0) {
    return (
      <div className="ed-state">
        <div style={{ 
          width: '2.5rem', 
          height: '2.5rem', 
          border: '3px solid #e5e7eb', 
          borderTop: '3px solid #8b5cf6', 
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div className="ed-cardhead">
        <h3 className="ed-cardtitle">Decision History</h3>
        <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
          {pagination.total} decisions logged
        </div>
      </div>

      {/* Filters */}
      <div style={{ 
        background: '#f9fafb', 
        padding: '1.25rem', 
        borderRadius: '12px',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: '600', color: '#374151', marginBottom: '1rem' }}>
          <FiFilter style={{ width: '1rem', height: '1rem' }} />
          <span>Filters</span>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.4rem', fontWeight: '600' }}>Type</label>
            <select
              value={filter.decision_type}
              onChange={(e) => setFilter({ ...filter, decision_type: e.target.value })}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                fontSize: '0.85rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                backgroundColor: '#fff',
                cursor: 'pointer',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#8b5cf6'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            >
              <option value="">All Types</option>
              <option value="scene_duration">Scene Duration</option>
              <option value="asset_selection">Asset Selection</option>
              <option value="scene_linking">Scene Linking</option>
              <option value="transition_type">Transition</option>
              <option value="music_choice">Music</option>
              <option value="pacing_adjustment">Pacing</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.4rem', fontWeight: '600' }}>Category</label>
            <select
              value={filter.decision_category}
              onChange={(e) => setFilter({ ...filter, decision_category: e.target.value })}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                fontSize: '0.85rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                backgroundColor: '#fff',
                cursor: 'pointer',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#8b5cf6'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            >
              <option value="">All Categories</option>
              <option value="timing">Timing</option>
              <option value="style">Style</option>
              <option value="content">Content</option>
              <option value="asset_selection">Asset Selection</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.4rem', fontWeight: '600' }}>AI Suggestion</label>
            <select
              value={filter.was_ai_suggestion}
              onChange={(e) => setFilter({ ...filter, was_ai_suggestion: e.target.value })}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                fontSize: '0.85rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                backgroundColor: '#fff',
                cursor: 'pointer',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#8b5cf6'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            >
              <option value="">All Decisions</option>
              <option value="true">AI Suggestions Only</option>
              <option value="false">Manual Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Decision List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {decisions.length === 0 ? (
          <div className="ed-state">
            <FiClock style={{ width: '3rem', height: '3rem', opacity: 0.5, color: '#9ca3af' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#6b7280', margin: '0.5rem 0' }}>No decisions logged yet</h3>
            <p style={{ fontSize: '0.9rem', color: '#9ca3af', margin: 0 }}>Start editing and your decisions will appear here</p>
          </div>
        ) : (
          decisions.map((decision) => (
            <div
              key={decision.id}
              className="ed-card"
              style={{ padding: '1.25rem', transition: 'box-shadow 0.2s ease' }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 10px 26px rgba(0,0,0,0.10)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ 
                      padding: '0.25rem 0.75rem', 
                      borderRadius: '6px', 
                      fontSize: '0.75rem', 
                      fontWeight: '600',
                      ...(() => {
                        const colors = {
                          timing: { bg: '#dbeafe', color: '#1e40af' },
                          style: { bg: '#f3e8ff', color: '#6b21a8' },
                          content: { bg: '#d1fae5', color: '#065f46' },
                          asset_selection: { bg: '#fef3c7', color: '#92400e' },
                          technical: { bg: '#f3f4f6', color: '#374151' },
                          ai_feedback: { bg: '#fce7f3', color: '#9f1239' },
                        };
                        return { backgroundColor: colors[decision.decision_category]?.bg || '#f3f4f6', color: colors[decision.decision_category]?.color || '#374151' };
                      })()
                    }}>
                      {decision.decision_category}
                    </span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#111827' }}>
                      {decision.decision_type.replace(/_/g, ' ')}
                    </span>
                    {decision.was_ai_suggestion && (
                      <span style={{ 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '6px', 
                        fontSize: '0.75rem', 
                        fontWeight: '600',
                        backgroundColor: '#f3e8ff',
                        color: '#7c3aed'
                      }}>
                        🤖 AI
                      </span>
                    )}
                  </div>

                  {/* Chosen Option */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '600', marginBottom: '0.4rem' }}>Chosen:</div>
                    <pre style={{ 
                      fontSize: '0.75rem', 
                      backgroundColor: '#f9fafb', 
                      padding: '0.75rem', 
                      borderRadius: '8px', 
                      marginTop: '0.25rem', 
                      overflowX: 'auto',
                      border: '1px solid #e5e7eb',
                      fontFamily: 'ui-monospace, monospace'
                    }}>
                      {renderChosenOption(decision.chosen_option)}
                    </pre>
                  </div>

                  {/* Rejected Options */}
                  {decision.rejected_options && decision.rejected_options.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '600', marginBottom: '0.4rem' }}>Rejected:</div>
                      <pre style={{ 
                        fontSize: '0.75rem', 
                        backgroundColor: '#fef2f2', 
                        padding: '0.75rem', 
                        borderRadius: '8px', 
                        marginTop: '0.25rem', 
                        overflowX: 'auto',
                        border: '1px solid #fecaca',
                        fontFamily: 'ui-monospace, monospace'
                      }}>
                        {JSON.stringify(decision.rejected_options, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* User Rating */}
                  {decision.user_rating && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.75rem' }}>
                      {[...Array(5)].map((_, i) => (
                        <FiStar
                          key={i}
                          style={{
                            width: '1rem',
                            height: '1rem',
                            fill: i < decision.user_rating ? '#fbbf24' : 'none',
                            color: i < decision.user_rating ? '#fbbf24' : '#d1d5db'
                          }}
                        />
                      ))}
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                        ({decision.user_rating}/5)
                      </span>
                    </div>
                  )}

                  {/* User Notes */}
                  {decision.user_notes && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic' }}>
                      "{decision.user_notes}"
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginLeft: '1rem', whiteSpace: 'nowrap' }}>
                  <FiClock style={{ width: '0.75rem', height: '0.75rem', display: 'inline', marginRight: '0.25rem' }} />
                  {formatTimestamp(decision.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button
            onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
            disabled={pagination.offset === 0}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              backgroundColor: pagination.offset === 0 ? '#f3f4f6' : '#fff',
              color: pagination.offset === 0 ? '#9ca3af' : '#374151',
              cursor: pagination.offset === 0 ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { if (pagination.offset !== 0) e.target.style.backgroundColor = '#f9fafb'; }}
            onMouseLeave={(e) => { if (pagination.offset !== 0) e.target.style.backgroundColor = '#fff'; }}
          >
            Previous
          </button>
          <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '600' }}>
            {Math.floor(pagination.offset / pagination.limit) + 1} / {Math.ceil(pagination.total / pagination.limit)}
          </span>
          <button
            onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
            disabled={pagination.offset + pagination.limit >= pagination.total}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              backgroundColor: pagination.offset + pagination.limit >= pagination.total ? '#f3f4f6' : '#fff',
              color: pagination.offset + pagination.limit >= pagination.total ? '#9ca3af' : '#374151',
              cursor: pagination.offset + pagination.limit >= pagination.total ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { if (pagination.offset + pagination.limit < pagination.total) e.target.style.backgroundColor = '#f9fafb'; }}
            onMouseLeave={(e) => { if (pagination.offset + pagination.limit < pagination.total) e.target.style.backgroundColor = '#fff'; }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

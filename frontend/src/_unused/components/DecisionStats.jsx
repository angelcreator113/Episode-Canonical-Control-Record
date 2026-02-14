import { useState, useEffect } from 'react';
import { getEpisodeStats } from '../services/decisionService';
import { FiTrendingUp, FiCheckCircle, FiXCircle, FiPieChart } from 'react-icons/fi';

/**
 * Decision Statistics Component
 * Shows analytics and patterns from user decisions
 */
export default function DecisionStats({ episodeId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (episodeId) {
      loadStats();
    }
  }, [episodeId]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await getEpisodeStats(episodeId);
      setStats(response.stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="ed-state">
        <FiPieChart className="w-12 h-12 text-gray-400" style={{ width: '3rem', height: '3rem' }} />
        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#6b7280', margin: '0.5rem 0' }}>No statistics available yet</h2>
        <p style={{ fontSize: '0.95rem', color: '#9ca3af', margin: 0 }}>
          Make some editing decisions to see analytics
        </p>
      </div>
    );
  }

  const aiAcceptanceRate = stats.ai_suggestions?.total > 0
    ? ((stats.ai_suggestions.accepted / stats.ai_suggestions.total) * 100).toFixed(1)
    : 0;

  const aiRejectionRate = stats.ai_suggestions?.total > 0
    ? ((stats.ai_suggestions.rejected / stats.ai_suggestions.total) * 100).toFixed(1)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div className="ed-cardhead">
        <h3 className="ed-cardtitle">📊 Decision Analytics</h3>
        <p style={{ fontSize: '0.9rem', color: '#6b7280', margin: 0 }}>
          {stats.total} decisions tracked
        </p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {/* Total Decisions */}
        <div style={{ 
          background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
          borderRadius: '12px',
          padding: '1.25rem',
          border: '1px solid #e9d5ff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '0.85rem', fontWeight: '600', color: '#6b21a8', margin: '0 0 0.5rem 0' }}>Total Decisions</p>
              <p style={{ fontSize: '2rem', fontWeight: '800', color: '#7c3aed', margin: 0 }}>{stats.total}</p>
            </div>
            <FiTrendingUp style={{ width: '2rem', height: '2rem', color: '#8b5cf6' }} />
          </div>
        </div>

        {/* AI Suggestions */}
        <div style={{
          background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
          borderRadius: '12px',
          padding: '1.25rem',
          border: '1px solid #bfdbfe'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1e40af', margin: '0 0 0.5rem 0' }}>AI Suggestions</p>
              <p style={{ fontSize: '2rem', fontWeight: '800', color: '#2563eb', margin: 0 }}>
                {stats.ai_suggestions.total}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: '#1e40af', marginBottom: '0.25rem' }}>
                ✅ {stats.ai_suggestions.accepted} accepted
              </div>
              <div style={{ fontSize: '0.75rem', color: '#1e40af' }}>
                ❌ {stats.ai_suggestions.rejected} rejected
              </div>
            </div>
          </div>
        </div>

        {/* Avg Confidence */}
        <div style={{
          background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
          borderRadius: '12px',
          padding: '1.25rem',
          border: '1px solid #a7f3d0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '0.85rem', fontWeight: '600', color: '#065f46', margin: '0 0 0.5rem 0' }}>Avg AI Confidence</p>
              <p style={{ fontSize: '2rem', fontWeight: '800', color: '#059669', margin: 0 }}>
                {(stats.avg_confidence * 100).toFixed(0)}%
              </p>
            </div>
            <FiCheckCircle style={{ width: '2rem', height: '2rem', color: '#10b981' }} />
          </div>
        </div>
      </div>

      {/* AI Acceptance Rate */}
      {stats.ai_suggestions?.total > 0 && (
        <div className="ed-card" style={{ padding: '1.25rem' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#111827', marginBottom: '1rem' }}>
            AI Suggestion Performance
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Acceptance Rate Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                <span>Acceptance Rate</span>
                <span style={{ fontWeight: '600', color: '#059669' }}>{aiAcceptanceRate}%</span>
              </div>
              <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                <div
                  style={{ 
                    backgroundColor: '#10b981', 
                    height: '8px', 
                    borderRadius: '9999px', 
                    transition: 'width 0.3s ease',
                    width: `${aiAcceptanceRate}%`
                  }}
                />
              </div>
            </div>

            {/* Rejection Rate Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                <span>Rejection Rate</span>
                <span style={{ fontWeight: '600', color: '#dc2626' }}>{aiRejectionRate}%</span>
              </div>
              <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                <div
                  style={{ 
                    backgroundColor: '#ef4444', 
                    height: '8px', 
                    borderRadius: '9999px', 
                    transition: 'width 0.3s ease',
                    width: `${aiRejectionRate}%`
                  }}
                />
              </div>
            </div>

            {/* Neutral Rate Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                <span>Neutral (No Rating)</span>
                <span style={{ fontWeight: '600', color: '#6b7280' }}>
                  {(100 - parseFloat(aiAcceptanceRate) - parseFloat(aiRejectionRate)).toFixed(1)}%
                </span>
              </div>
              <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                <div
                  style={{ 
                    backgroundColor: '#9ca3af', 
                    height: '8px', 
                    borderRadius: '9999px', 
                    transition: 'width 0.3s ease',
                    width: `${100 - parseFloat(aiAcceptanceRate) - parseFloat(aiRejectionRate)}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decisions by Category */}
      <div className="ed-card" style={{ padding: '1.25rem' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#111827', marginBottom: '1rem' }}>
          Decisions by Category
        </h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {Object.entries(stats.by_category || {})
            .sort(([, a], [, b]) => b - a)
            .map(([category, count]) => {
              const percentage = ((count / stats.total) * 100).toFixed(1);
              const colors = {
                timing: 'bg-blue-500',
                style: 'bg-purple-500',
                content: 'bg-green-500',
                asset_selection: 'bg-yellow-500',
                technical: 'bg-gray-500',
                ai_feedback: 'bg-pink-500',
              };
              const bgColor = colors[category] || 'bg-gray-500';

              return (
                <div key={category}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: '600', color: '#374151', textTransform: 'capitalize' }}>
                      {category.replace(/_/g, ' ')}
                    </span>
                    <span style={{ color: '#6b7280' }}>
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                    <div
                      className={bgColor}
                      style={{ 
                        height: '8px', 
                        borderRadius: '9999px', 
                        transition: 'width 0.3s ease',
                        width: `${percentage}%`,
                        backgroundColor: bgColor === 'bg-blue-500' ? '#3b82f6' :
                                       bgColor === 'bg-purple-500' ? '#a855f7' :
                                       bgColor === 'bg-green-500' ? '#10b981' :
                                       bgColor === 'bg-yellow-500' ? '#f59e0b' :
                                       bgColor === 'bg-pink-500' ? '#ec4899' : '#6b7280'
                      }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Decisions by Type */}
      <div className="ed-card" style={{ padding: '1.25rem' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#111827', marginBottom: '1rem' }}>
          Most Common Decisions
        </h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {Object.entries(stats.by_type || {})
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5) // Top 5
            .map(([type, count]) => {
              const percentage = ((count / stats.total) * 100).toFixed(1);

              return (
                <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151', textTransform: 'capitalize', marginBottom: '0.4rem' }}>
                      {type.replace(/_/g, ' ')}
                    </div>
                    <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                      <div
                        style={{ 
                          backgroundColor: '#a855f7', 
                          height: '8px', 
                          borderRadius: '9999px', 
                          transition: 'width 0.3s ease',
                          width: `${percentage}%`
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ marginLeft: '1rem', fontSize: '0.9rem', fontWeight: '700', color: '#111827' }}>
                    {count}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Insights */}
      <div style={{
        background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
        border: '1px solid #e9d5ff',
        borderRadius: '12px',
        padding: '1.25rem'
      }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#6b21a8', marginBottom: '0.75rem' }}>
          💡 Insights
        </h4>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <style>{`
            .insight-list li { font-size: 0.85rem; color: #7c3aed; line-height: 1.6; }
          `}</style>
          <div className="insight-list">
          {stats.ai_suggestions.total > 0 && aiAcceptanceRate > 70 && (
            <li>✨ You're accepting most AI suggestions - the AI is learning your style!</li>
          )}
          {stats.ai_suggestions.total > 0 && aiRejectionRate > 50 && (
            <li>🔧 You're rejecting many AI suggestions - the AI will adjust to your preferences</li>
          )}
          {stats.total > 50 && (
            <li>🎯 You've made {stats.total} decisions - patterns are becoming clear!</li>
          )}
          {stats.total < 10 && (
            <li>🌱 Keep editing! More decisions will help AI learn your unique style</li>
          )}
          {stats.by_category?.timing > stats.total * 0.4 && (
            <li>⏱️ You focus a lot on timing decisions - precision editor!</li>
          )}
          {stats.by_category?.content > stats.total * 0.4 && (
            <li>🎨 You focus on content choices - creative storyteller!</li>
          )}
          </div>
        </ul>
      </div>
    </div>
  );
}

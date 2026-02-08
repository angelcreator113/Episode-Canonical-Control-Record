import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import '../styles/DecisionHistory.css';

export default function DecisionHistoryWithAnalytics({ episodeId }) {
  const [decisions, setDecisions] = useState([]);
  const [stats, setStats] = useState(null);
  const [byCategory, setByCategory] = useState([]);
  const [topChoices, setTopChoices] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (episodeId) {
      loadData();
    }
  }, [episodeId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load decisions and analytics in parallel
      const [decisionsRes, statsRes, categoryRes] = await Promise.all([
        axios.get(`/api/v1/decisions?episode_id=${episodeId}`),
        axios.get(`/api/decision-analytics/stats?episode_id=${episodeId}`),
        axios.get(`/api/decision-analytics/by-type?episode_id=${episodeId}`)
      ]);

      const decisionsData = decisionsRes.data.decisions || decisionsRes.data.data || [];
      const statsData = statsRes.data.data || statsRes.data || {};
      const categoryData = categoryRes.data.data || categoryRes.data || [];

      setDecisions(decisionsData);
      setStats(statsData);
      setByCategory(categoryData);

      // Load top choices for the most common decision type
      if (categoryData.length > 0) {
        const topType = categoryData[0].decision_type;
        const topRes = await axios.get(
          `/api/decision-analytics/top-choices/${topType}?episode_id=${episodeId}&limit=5`
        );
        setTopChoices(topRes.data.data || topRes.data || []);
      }

      // Generate insights
      generateInsights(statsData, categoryData);
    } catch (error) {
      console.error('Failed to load decision data:', error);
      // Set empty defaults on error
      setDecisions([]);
      setStats({});
      setByCategory([]);
      setTopChoices([]);
      generateInsights(null, []);
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = (stats, categories) => {
    const insights = [];

    // Safety check for stats
    if (!stats || typeof stats.total_decisions === 'undefined') {
      insights.push({
        icon: '🌱',
        text: 'Start making decisions to see AI insights about your editing style',
        type: 'encouragement'
      });
      setInsights(insights);
      return;
    }

    if (stats.total_decisions < 5) {
      insights.push({
        icon: '🌱',
        text: 'Keep editing! More decisions will help AI learn your unique style',
        type: 'encouragement'
      });
    }

    if (categories && categories.length > 0) {
      const topCategory = categories[0];
      const categoryName = topCategory.decision_type.replace(/_/g, ' ');
      insights.push({
        icon: '🎯',
        text: `You focus on ${categoryName} choices - creative storyteller!`,
        type: 'pattern'
      });
    }

    if (stats.total_decisions >= 10) {
      insights.push({
        icon: '🚀',
        text: 'Great progress! AI is learning from your editing patterns',
        type: 'achievement'
      });
    }

    setInsights(insights);
  };

  const handleUndo = async (decisionId) => {
    if (!confirm('Undo this decision?')) return;

    try {
      // TODO: Implement undo functionality
      // This would revert the decision and update the episode state
      console.log('Undo decision:', decisionId);
      alert('Undo functionality coming soon!');
    } catch (error) {
      console.error('Undo failed:', error);
      alert('Failed to undo decision');
    }
  };

  const handleExport = async (format) => {
    try {
      const response = await axios.get(
        `/api/decision-analytics/export?episode_id=${episodeId}&format=${format}`,
        { responseType: format === 'csv' ? 'blob' : 'json' }
      );

      if (format === 'csv') {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `episode-${episodeId}-decisions.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const link = document.createElement('a');
        link.href = dataUri;
        link.download = `episode-${episodeId}-decisions.json`;
        link.click();
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="decision-loading">
        <div className="decision-loading-content">
          <div className="decision-loading-spinner"></div>
          <p className="decision-loading-text">Loading decisions...</p>
        </div>
      </div>
    );
  }

  if (!stats || !stats.total_decisions || stats.total_decisions === 0) {
    return (
      <div className="decision-empty-state">
        <div className="decision-empty-icon">📊</div>
        <h3 className="decision-empty-title">
          No Decisions Yet
        </h3>
        <p className="decision-empty-subtitle">
          Decisions will be tracked automatically as you edit this episode.
        </p>
        <div className="decision-empty-info-box">
          <p className="decision-empty-info-title">Auto-tracked decisions:</p>
          <ul className="decision-empty-list">
            <li className="decision-empty-list-item">Scene duration adjustments</li>
            <li className="decision-empty-list-item">Transition type selections</li>
            <li className="decision-empty-list-item">Music volume changes</li>
            <li className="decision-empty-list-item">Color grading choices</li>
            <li className="decision-empty-list-item">Text overlay styles</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="decision-history-container">
      {/* Analytics Header */}
      <div className="decision-header">
        <h3 className="decision-header-title">
          <span className="text-2xl">📊</span>
          Decision Analytics
        </h3>
        <div className="decision-header-count">
          {stats.total_decisions} decision{stats.total_decisions !== 1 ? 's' : ''} tracked
        </div>
      </div>

      {/* Summary Stats */}
      <div className="decision-stats-grid">
        <div className="decision-stat-card purple">
          <div className="decision-stat-card-content">
            <span className="decision-stat-icon">📈</span>
            <span className="decision-stat-value">{stats.total_decisions}</span>
          </div>
          <div className="decision-stat-label">Total Decisions</div>
        </div>

        <div className="decision-stat-card blue">
          <div className="decision-stat-card-content">
            <span className="decision-stat-icon">🤖</span>
            <div className="decision-stat-ai-details">
              <div className="decision-stat-ai-accepted">✓ 0 accepted</div>
              <div className="decision-stat-ai-rejected">✗ 0 rejected</div>
            </div>
          </div>
          <div className="decision-stat-label">AI Suggestions</div>
        </div>

        <div className="decision-stat-card green">
          <div className="decision-stat-card-content">
            <span className="decision-stat-icon">✓</span>
            <span className="decision-stat-value">0%</span>
          </div>
          <div className="decision-stat-label">Avg AI Confidence</div>
        </div>
      </div>

      {/* Decisions by Category */}
      {byCategory.length > 0 && (
        <div className="decision-section-card">
          <h4 className="decision-section-title">Decisions by Category</h4>
          <div className="decision-category-list">
            {byCategory.map((category) => {
              const percentage = (category.count / stats.total_decisions) * 100;
              return (
                <div key={category.decision_type}>
                  <div className="decision-category-item-header">
                    <span className="decision-category-name">
                      {category.decision_type.replace(/_/g, ' ')}
                    </span>
                    <span className="decision-category-count">
                      {category.count} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="decision-progress-bar-bg">
                    <div
                      className="decision-progress-bar-fill"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Most Common Decisions */}
      {topChoices.length > 0 && (
        <div className="decision-section-card">
          <h4 className="decision-section-title">Most Common Decisions</h4>
          <div className="decision-category-list">
            {topChoices.map((choice, index) => {
              const percentage = (choice.frequency / stats.total_decisions) * 100;
              return (
                <div key={index}>
                  <div className="decision-category-item-header">
                    <span className="decision-category-name">{choice.chosen_value}</span>
                    <span className="decision-category-count">{choice.frequency}×</span>
                  </div>
                  <div className="decision-progress-bar-bg">
                    <div
                      className="decision-progress-bar-fill green"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="decision-insights-card">
          <h4 className="decision-insights-title">
            <span className="text-xl">💡</span>
            Insights
          </h4>
          <div className="decision-insights-list">
            {insights.map((insight, index) => (
              <div key={index} className="decision-insight-item">
                <span className="decision-insight-icon">{insight.icon}</span>
                <span className="decision-insight-text">{insight.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decision History */}
      <div className="decision-history-section">
        <div className="decision-history-header">
          <h4 className="decision-history-title">
            <span className="text-xl">📜</span>
            Decision History
          </h4>
          <span className="decision-history-count">
            {decisions.length} decision{decisions.length !== 1 ? 's' : ''} logged
          </span>
        </div>

        <div className="decision-history-list">
          {decisions.length === 0 ? (
            <p className="decision-history-empty">No decisions logged yet</p>
          ) : (
            decisions.map((decision) => (
              <div key={decision.id} className="decision-item">
                <div className="decision-item-content">
                  <div className="decision-item-main">
                    <div className="decision-item-header">
                      <span className="decision-item-icon">
                        {getCategoryIcon(decision.decision_type)}
                      </span>
                      {decision.decision_type.replace(/_/g, ' ')}
                    </div>
                    <div className="decision-item-choice">
                      <span className="decision-item-choice-label">Chose:</span>
                      <span className="decision-item-choice-value">
                        {typeof decision.chosen_option === 'object' 
                          ? JSON.stringify(decision.chosen_option)
                          : decision.chosen_option}
                      </span>
                    </div>
                    {decision.context_data && Object.keys(decision.context_data).length > 0 && (
                      <div className="decision-item-context">
                        Context: {JSON.stringify(decision.context_data)}
                      </div>
                    )}
                    <div className="decision-item-timestamp">
                      {new Date(decision.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUndo(decision.id)}
                    className="decision-item-undo-btn"
                  >
                    Undo
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Export Buttons */}
      <div className="decision-export-buttons">
        <button
          onClick={() => handleExport('json')}
          className="decision-export-btn purple"
        >
          <span>📥</span>
          <span className="decision-export-btn-text">Export JSON (AI Training)</span>
        </button>
        <button
          onClick={() => handleExport('csv')}
          className="decision-export-btn blue"
        >
          <span>📊</span>
          <span className="decision-export-btn-text">Export CSV</span>
        </button>
      </div>
    </div>
  );
}

function getCategoryIcon(type) {
  const icons = {
    scene_duration: '⏱️',
    transition_type: '🔄',
    music_volume: '🔊',
    text_overlay_style: '📝',
    color_grading: '🎨',
    scene_linking: '🔗'
  };
  return icons[type] || '📋';
}

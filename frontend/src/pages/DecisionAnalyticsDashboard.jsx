import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import '../styles/DecisionAnalyticsDashboard.css';

const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#6366f1'];

export default function DecisionAnalyticsDashboard() {
  const [stats, setStats] = useState(null);
  const [decisionsByType, setDecisionsByType] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(null);
  const [distribution, setDistribution] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  useEffect(() => {
    if (selectedType) {
      loadDistribution(selectedType);
    }
  }, [selectedType]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all analytics data
      const [statsRes, typeRes, timelineRes, patternsRes] = await Promise.all([
        axios.get('/api/decision-analytics/stats'),
        axios.get('/api/decision-analytics/by-type'),
        axios.get('/api/decision-analytics/timeline?interval=day'),
        axios.get('/api/decision-analytics/patterns')
      ]);

      console.log('Stats response:', statsRes.data);
      console.log('Types response:', typeRes.data);

      setStats(statsRes.data.data);
      setDecisionsByType(typeRes.data.data);
      setTimeline(timelineRes.data.data);
      setPatterns(patternsRes.data.data);

      // Auto-select first decision type
      if (typeRes.data.data.length > 0) {
        setSelectedType(typeRes.data.data[0].decision_type);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDistribution = async (type) => {
    try {
      const res = await axios.get(`/api/decision-analytics/distribution/${type}`);
      setDistribution(res.data.data);
    } catch (error) {
      console.error('Failed to load distribution:', error);
    }
  };

  const handleExport = async (format = 'json') => {
    try {
      const response = await axios.get(`/api/decision-analytics/export?format=${format}`, {
        responseType: format === 'csv' ? 'blob' : 'json'
      });

      if (format === 'csv') {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'decisions-export.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const link = document.createElement('a');
        link.href = dataUri;
        link.download = 'decisions-export.json';
        link.click();
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p style={{ color: '#6b7280' }}>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-box">
          <h2 className="error-title">Error Loading Analytics</h2>
          <p className="error-message">{error}</p>
          <button onClick={loadAnalytics} className="error-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      {/* Header */}
      <div className="analytics-header">
        <div>
          <h1 className="analytics-title">
            <span style={{ fontSize: '2.5rem' }}>📊</span>
            Decision Analytics Dashboard
          </h1>
          <p className="analytics-subtitle">
            Insights from your editing decisions to train the AI
          </p>
        </div>
      </div>
      
      <div className="analytics-content">

      {/* Overall Stats */}
      <div className="stats-grid">
        <StatCard
          title="Total Decisions"
          value={stats?.total_decisions || 0}
          icon="🎯"
          color="purple"
        />
        <StatCard
          title="Decision Types"
          value={stats?.decision_types_used || 0}
          icon="📋"
          color="blue"
        />
        <StatCard
          title="Episodes"
          value={stats?.episodes_with_decisions || 0}
          icon="🎬"
          color="pink"
        />
        <StatCard
          title="Active Users"
          value={stats?.unique_users || 0}
          icon="👥"
          color="green"
        />
      </div>

      {/* Export Buttons */}
      <div className="export-buttons">
        <button onClick={() => handleExport('json')} className="export-button purple">
          <span style={{ fontSize: '1.25rem' }}>📥</span>
          Export JSON (AI Training)
        </button>
        <button onClick={() => handleExport('csv')} className="export-button blue">
          <span style={{ fontSize: '1.25rem' }}>📊</span>
          Export CSV
        </button>
      </div>

      {/* No Data Message */}
      {(!stats || stats.total_decisions === 0) && (
        <div className="no-data-box">
          <h3 className="no-data-title">No Decision Data Yet</h3>
          <p className="no-data-text">
            Start making editing decisions to see analytics, or generate sample data for testing.
          </p>
          <div className="no-data-code-box">
            <p className="no-data-code-label">
              To generate test data, run:
            </p>
            <code className="no-data-code">
              node scripts/seed-decision-data.js
            </code>
          </div>
        </div>
      )}

      {/* Decisions by Type - Bar Chart */}
      {decisionsByType.length > 0 && (
        <div className="chart-container">
          <h2 className="chart-title">
            <span style={{ fontSize: '1.5rem' }}>📊</span>
            Decisions by Type
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={decisionsByType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="decision_type" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#8b5cf6" name="Total Decisions" />
              <Bar dataKey="episodes" fill="#ec4899" name="Episodes" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Decision Distribution - Pie Chart */}
      {selectedType && distribution.length > 0 && (
        <div className="chart-container">
          <div className="chart-header">
            <h2 className="chart-title">
              <span style={{ fontSize: '1.5rem' }}>🥧</span>
              Choice Distribution: {selectedType}
            </h2>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="chart-select"
            >
              {decisionsByType.map(type => (
                <option key={type.decision_type} value={type.decision_type}>
                  {type.decision_type}
                </option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={distribution}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={120}
                label={(entry) => `${entry.label}: ${entry.percentage}%`}
              >
                {distribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Patterns Detected */}
      {patterns.length > 0 && (
        <div className="patterns-section">
          <h2 className="chart-title">
            <span style={{ fontSize: '1.5rem' }}>🔍</span>
            Patterns Detected
          </h2>
          <div style={{ marginTop: '1.5rem' }}>
            {patterns.map((pattern, index) => (
              <div key={index} className="pattern-item">
                <h3 className="pattern-title">
                  {pattern.description}
                </h3>
                <div>
                  {pattern.data.slice(0, 5).map((item, i) => (
                    <div key={i} className="pattern-data-item">
                      {renderPatternItem(pattern.type, item)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-card-inner">
        <span className="stat-icon">{icon}</span>
        <span className="stat-value">{value}</span>
      </div>
      <div className="stat-title">{title}</div>
    </div>
  );
}

function renderPatternItem(type, item) {
  if (type === 'frequently_paired') {
    return (
      <span>
        <strong>{item.type1}:</strong> {item.value1} 
        {' + '}
        <strong>{item.type2}:</strong> {item.value2}
        {' '}({item.frequency}×)
      </span>
    );
  } else if (type === 'user_preferences') {
    return (
      <span>
        <strong>{item.decision_type}:</strong> {item.chosen_value} 
        {' '}({item.percentage}% of the time)
      </span>
    );
  } else if (type === 'time_based') {
    return (
      <span>
        <strong>{item.hour_of_day}:00 -</strong> {item.decision_type}: {item.chosen_value}
        {' '}({item.frequency}×)
      </span>
    );
  }
  return JSON.stringify(item);
}

import React, { useState } from 'react';
import { API_URL } from '../config/api';
import './DiagnosticPage.css';

const DiagnosticPage = () => {
  const [results, setResults] = useState({});
  const [testing, setTesting] = useState(false);
  const [episodeId, setEpisodeId] = useState('');

  const testEndpoint = async (name, url, method = 'GET', body = null) => {
    const startTime = Date.now();
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || 'none'}`,
        },
      };
      
      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const duration = Date.now() - startTime;
      const contentType = response.headers.get('content-type');
      
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        name,
        url,
        method,
        status: response.ok ? 'SUCCESS' : 'ERROR',
        statusCode: response.status,
        duration: `${duration}ms`,
        data: typeof data === 'string' ? data.substring(0, 500) : data,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error) {
      return {
        name,
        url,
        method,
        status: 'FAILED',
        error: error.message,
        duration: `${Date.now() - startTime}ms`,
      };
    }
  };

  const runAllTests = async () => {
    setTesting(true);
    setResults({});
    
    const tests = [
      // Basic connectivity
      { name: '🔌 Ping', url: `${API_URL}/ping`, method: 'GET' },
      { name: '🏥 Health Check', url: `${API_URL}/api/v1/health`, method: 'GET' },
      
      // Episodes
      { name: '📺 List Episodes', url: `${API_URL}/api/v1/episodes?limit=5`, method: 'GET' },
      { name: '🧪 Test Create Episode', url: `${API_URL}/api/v1/episodes/test-create`, method: 'GET' },
      
      // Shows
      { name: '🎬 List Shows', url: `${API_URL}/api/v1/shows`, method: 'GET' },
      
      // Assets
      { name: '📸 List Assets', url: `${API_URL}/api/v1/assets?limit=5`, method: 'GET' },
      
      // Wardrobe
      { name: '👗 Wardrobe Library Stats', url: `${API_URL}/api/v1/wardrobe-library/stats`, method: 'GET' },
      { name: '👔 List Wardrobe Library', url: `${API_URL}/api/v1/wardrobe-library?limit=5`, method: 'GET' },
      
      // Scene Library
      { name: '🎬 Scene Library Stats', url: `${API_URL}/api/v1/scene-library/stats`, method: 'GET' },
      { name: '🎥 List Scene Library', url: `${API_URL}/api/v1/scene-library?limit=5`, method: 'GET' },
      
      // Templates
      { name: '🎨 List Templates', url: `${API_URL}/api/v1/templates?limit=5`, method: 'GET' },
    ];

    // If episodeId provided, test episode-specific endpoints
    if (episodeId) {
      tests.push(
        { name: `📺 Get Episode ${episodeId}`, url: `${API_URL}/api/v1/episodes/${episodeId}`, method: 'GET' },
        { name: `🎬 Episode Scenes`, url: `${API_URL}/api/v1/episodes/${episodeId}/library-scenes`, method: 'GET' },
        { name: `📸 Episode Assets`, url: `${API_URL}/api/v1/episodes/${episodeId}/assets`, method: 'GET' },
        { name: `👗 Episode Wardrobe`, url: `${API_URL}/api/v1/episodes/${episodeId}/wardrobe`, method: 'GET' },
      );
    }

    const testResults = {};
    for (const test of tests) {
      const result = await testEndpoint(test.name, test.url, test.method, test.body);
      testResults[test.name] = result;
      setResults({ ...testResults });
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between tests
    }

    setTesting(false);
  };

  const getStatusColor = (status) => {
    if (status === 'SUCCESS') return '#10b981';
    if (status === 'ERROR') return '#f59e0b';
    return '#ef4444';
  };

  const getStatusIcon = (status) => {
    if (status === 'SUCCESS') return '✅';
    if (status === 'ERROR') return '⚠️';
    return '❌';
  };

  return (
    <div className="diagnostic-page">
      <div className="diagnostic-header">
        <h1>🔧 API Diagnostics</h1>
        <p>Test all API endpoints to identify issues</p>
      </div>

      <div className="diagnostic-controls">
        <div className="control-group">
          <label>API Base URL:</label>
          <code>{API_URL}</code>
        </div>
        
        <div className="control-group">
          <label>Test Specific Episode (optional):</label>
          <input
            type="text"
            placeholder="Enter episode ID"
            value={episodeId}
            onChange={(e) => setEpisodeId(e.target.value)}
            className="episode-id-input"
          />
        </div>

        <div className="control-group">
          <label>Auth Token:</label>
          <code>{localStorage.getItem('authToken') ? '***' + localStorage.getItem('authToken').slice(-8) : 'Not set'}</code>
        </div>

        <button
          onClick={runAllTests}
          disabled={testing}
          className="run-tests-btn"
        >
          {testing ? '🔄 Testing...' : '▶️ Run All Tests'}
        </button>
      </div>

      <div className="diagnostic-results">
        {Object.keys(results).length === 0 && !testing && (
          <div className="empty-state">
            <p>Click "Run All Tests" to start diagnostics</p>
          </div>
        )}

        {Object.entries(results).map(([name, result]) => (
          <div key={name} className="test-result">
            <div className="result-header">
              <div className="result-title">
                <span className="result-icon">{getStatusIcon(result.status)}</span>
                <span className="result-name">{name}</span>
              </div>
              <div className="result-badges">
                <span
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(result.status) }}
                >
                  {result.status}
                </span>
                {result.statusCode && (
                  <span className="status-code">{result.statusCode}</span>
                )}
                <span className="duration">{result.duration}</span>
              </div>
            </div>

            <div className="result-details">
              <div className="detail-row">
                <strong>Method:</strong> <code>{result.method}</code>
              </div>
              <div className="detail-row">
                <strong>URL:</strong> <code className="url-code">{result.url}</code>
              </div>

              {result.error && (
                <div className="detail-row error-row">
                  <strong>Error:</strong> <code className="error-code">{result.error}</code>
                </div>
              )}

              {result.data && (
                <details className="data-details">
                  <summary>Response Data</summary>
                  <pre className="response-data">
                    {typeof result.data === 'object'
                      ? JSON.stringify(result.data, null, 2)
                      : result.data}
                  </pre>
                </details>
              )}

              {result.headers && (
                <details className="headers-details">
                  <summary>Response Headers</summary>
                  <pre className="response-headers">
                    {JSON.stringify(result.headers, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="diagnostic-footer">
        <h3>Environment Information</h3>
        <div className="env-info">
          <div className="env-item">
            <strong>Browser:</strong> {navigator.userAgent}
          </div>
          <div className="env-item">
            <strong>Location:</strong> {window.location.href}
          </div>
          <div className="env-item">
            <strong>Time:</strong> {new Date().toISOString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticPage;

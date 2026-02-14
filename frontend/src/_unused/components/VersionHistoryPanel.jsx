/**
 * VersionHistoryPanel.jsx
 * Component for viewing and managing composition version history
 * Features:
 * - View all versions with timestamps and changes
 * - Compare two versions side-by-side
 * - Revert to previous version
 * - View version statistics
 */

import React, { useState, useEffect } from 'react';
import './VersionHistoryPanel.css';

const VersionHistoryPanel = ({ compositionId, compositionName, onVersionReverted }) => {
  const [versions, setVersions] = useState([]);
  const [selectedVersions, setSelectedVersions] = useState({ a: null, b: null });
  const [comparison, setComparison] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showRevertConfirm, setShowRevertConfirm] = useState(null);
  const [revertReason, setRevertReason] = useState('');
  const [tab, setTab] = useState('timeline'); // 'timeline', 'compare', 'stats'

  // Load version history on mount
  useEffect(() => {
    if (compositionId) {
      loadVersionHistory();
      loadVersionStats();
    }
  }, [compositionId]);

  const loadVersionHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/v1/compositions/${compositionId}/versions`);
      const data = await response.json();

      if (response.ok) {
        setVersions(data.data.versions || []);
      } else {
        setError(data.error || 'Failed to load version history');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadVersionStats = async () => {
    try {
      const response = await fetch(`/api/v1/compositions/${compositionId}/version-stats`);
      const data = await response.json();

      if (response.ok) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Failed to load version stats:', err);
    }
  };

  const handleCompareVersions = async () => {
    if (!selectedVersions.a || !selectedVersions.b) {
      setError('Please select two versions to compare');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/v1/compositions/${compositionId}/versions/${selectedVersions.a}/compare/${selectedVersions.b}`
      );
      const data = await response.json();

      if (response.ok) {
        setComparison(data.data);
      } else {
        setError(data.error || 'Failed to compare versions');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevertVersion = async (versionNumber) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/v1/compositions/${compositionId}/revert/${versionNumber}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: revertReason })
        }
      );

      const data = await response.json();

      if (response.ok) {
        // Reload history after successful revert
        await loadVersionHistory();
        await loadVersionStats();
        setShowRevertConfirm(null);
        setRevertReason('');
        onVersionReverted && onVersionReverted(data.revert_details);
      } else {
        setError(data.error || 'Failed to revert version');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getFieldLabel = (field) => {
    const labels = {
      'name': 'Composition Name',
      'template_id': 'Template',
      'background_asset': 'Background Asset',
      'lala_asset': 'Lala Asset',
      'guest_asset': 'Guest Asset',
      'selected_formats': 'Output Formats',
      'status': 'Publication Status'
    };
    return labels[field] || field;
  };

  return (
    <div className="version-history-panel">
      <div className="version-header">
        <h3>📚 Version History</h3>
        <span className="version-count">
          {versions.length} version{versions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="version-tabs">
        <button
          className={`tab-button ${tab === 'timeline' ? 'active' : ''}`}
          onClick={() => setTab('timeline')}
        >
          Timeline
        </button>
        <button
          className={`tab-button ${tab === 'compare' ? 'active' : ''}`}
          onClick={() => setTab('compare')}
        >
          Compare
        </button>
        {stats && (
          <button
            className={`tab-button ${tab === 'stats' ? 'active' : ''}`}
            onClick={() => setTab('stats')}
          >
            Statistics
          </button>
        )}
      </div>

      {/* Timeline Tab */}
      {tab === 'timeline' && (
        <div className="version-timeline">
          {loading ? (
            <div className="loading">Loading version history...</div>
          ) : versions.length === 0 ? (
            <div className="empty-state">No versions yet</div>
          ) : (
            <div className="timeline-list">
              {versions.map((version) => (
                <div key={version.version_number} className="timeline-item">
                  <div className="timeline-marker">
                    <span className="version-number">v{version.version_number}</span>
                    {version.is_published && <span className="published-badge">Published</span>}
                  </div>

                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="change-summary">{version.change_summary}</span>
                      <span className="timestamp">{formatDate(version.created_at)}</span>
                    </div>

                    <div className="version-details">
                      <span className="created-by">by {version.created_by || 'system'}</span>

                      {version.changed_fields && Object.keys(version.changed_fields).length > 0 && (
                        <div className="changes-list">
                          <span className="changes-label">Changes:</span>
                          <ul>
                            {Object.entries(version.changed_fields).map(([field, change]) => (
                              <li key={field}>
                                <strong>{getFieldLabel(field)}:</strong>
                                {typeof change.old === 'string' ? ` "${change.old}" → "${change.new}"` : ' (complex change)'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {version.version_number > 1 && (
                      <div className="version-actions">
                        <button
                          className="revert-button"
                          onClick={() => setShowRevertConfirm(version.version_number)}
                          disabled={loading}
                        >
                          ↩️ Revert to this version
                        </button>

                        {selectedVersions.a === null && (
                          <button
                            className="compare-button"
                            onClick={() => setSelectedVersions({ ...selectedVersions, a: version.version_number })}
                          >
                            Compare (A)
                          </button>
                        )}

                        {selectedVersions.a !== null && selectedVersions.a !== version.version_number && selectedVersions.b === null && (
                          <button
                            className="compare-button"
                            onClick={() => {
                              setSelectedVersions({ ...selectedVersions, b: version.version_number });
                              // Auto-trigger comparison
                              setTimeout(() => handleCompareVersions(), 100);
                            }}
                          >
                            Compare (B)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compare Tab */}
      {tab === 'compare' && (
        <div className="version-compare">
          <div className="compare-controls">
            <div className="version-selector">
              <label>Version A:</label>
              <select
                value={selectedVersions.a || ''}
                onChange={(e) => setSelectedVersions({ ...selectedVersions, a: parseInt(e.target.value) || null })}
              >
                <option value="">Select version...</option>
                {versions.map((v) => (
                  <option key={v.version_number} value={v.version_number}>
                    v{v.version_number} - {v.change_summary}
                  </option>
                ))}
              </select>
            </div>

            <div className="version-selector">
              <label>Version B:</label>
              <select
                value={selectedVersions.b || ''}
                onChange={(e) => setSelectedVersions({ ...selectedVersions, b: parseInt(e.target.value) || null })}
              >
                <option value="">Select version...</option>
                {versions.map((v) => (
                  <option key={v.version_number} value={v.version_number}>
                    v{v.version_number} - {v.change_summary}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="compare-button"
              onClick={handleCompareVersions}
              disabled={!selectedVersions.a || !selectedVersions.b || loading}
            >
              Compare
            </button>

            <button
              className="clear-button"
              onClick={() => {
                setSelectedVersions({ a: null, b: null });
                setComparison(null);
              }}
            >
              Clear
            </button>
          </div>

          {comparison && (
            <div className="comparison-result">
              <div className="comparison-header">
                <span>Comparing v{comparison.version_a.number} vs v{comparison.version_b.number}</span>
                <span className="difference-count">
                  {comparison.difference_count} difference{comparison.difference_count !== 1 ? 's' : ''}
                </span>
              </div>

              {comparison.differences ? (
                <div className="differences-list">
                  {Object.entries(comparison.differences).map(([field, diff]) => (
                    <div key={field} className="difference-item">
                      <span className="field-name">{getFieldLabel(field)}</span>
                      <div className="diff-values">
                        <div className="old-value">
                          <span className="label">v{comparison.version_a.number}:</span>
                          <span className="value">{String(diff.version_a)}</span>
                        </div>
                        <div className="new-value">
                          <span className="label">v{comparison.version_b.number}:</span>
                          <span className="value">{String(diff.version_b)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-differences">No differences found between these versions</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Statistics Tab */}
      {tab === 'stats' && stats && (
        <div className="version-stats">
          <div className="stat-item">
            <span className="stat-label">Total Versions:</span>
            <span className="stat-value">{stats.total_versions}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">Published Versions:</span>
            <span className="stat-value">{stats.published_versions}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">Modified Versions:</span>
            <span className="stat-value">{stats.modified_versions}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">Unique Editors:</span>
            <span className="stat-value">{stats.unique_editors}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">Last Modified:</span>
            <span className="stat-value">{formatDate(stats.last_modified)}</span>
          </div>
        </div>
      )}

      {/* Revert Confirmation Modal */}
      {showRevertConfirm !== null && (
        <div className="revert-confirmation-modal">
          <div className="modal-content">
            <h4>⚠️ Revert to Version?</h4>
            <p>
              You're about to revert "{compositionName}" to version {showRevertConfirm}.
              This will create a new version with the previous composition state.
            </p>

            <div className="reason-input">
              <label>Reason for revert (optional):</label>
              <textarea
                value={revertReason}
                onChange={(e) => setRevertReason(e.target.value)}
                placeholder="Why are you reverting this composition?"
                rows="3"
              />
            </div>

            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => {
                  setShowRevertConfirm(null);
                  setRevertReason('');
                }}
              >
                Cancel
              </button>
              <button
                className="confirm-button"
                onClick={() => handleRevertVersion(showRevertConfirm)}
                disabled={loading}
              >
                {loading ? 'Reverting...' : 'Confirm Revert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VersionHistoryPanel;

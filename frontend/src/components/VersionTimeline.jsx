import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/VersionTimeline.css';

/**
 * Version Timeline Component
 * Displays the complete version history for a composition
 * with timeline visualization, version snapshots, and comparison features
 */
export default function VersionTimeline({ compositionId }) {
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareWith, setCompareWith] = useState(null);
  const [differences, setDifferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchVersionHistory();
  }, [compositionId]);

  const fetchVersionHistory = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3002'
        : '';
      const response = await axios.get(
        `${apiUrl}/api/v1/compositions/${compositionId}/versions`
      );
      const versionData = response.data.data.versions || [];
      setVersions(versionData);
      if (versionData.length > 0) {
        setSelectedVersion(versionData[0]);
      }
    } catch (err) {
      setError('Failed to load version history: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVersion = async (version) => {
    if (compareMode && compareWith) {
      await fetchComparison(version, compareWith);
    } else {
      setSelectedVersion(version);
      setCompareWith(null);
    }
  };

  const fetchComparison = async (v1, v2) => {
    try {
      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3002'
        : '';
      const response = await axios.get(
        `${apiUrl}/api/v1/compositions/${compositionId}/versions/${v1.version_number}/compare/${v2.version_number}`
      );
      setDifferences(response.data.data);
    } catch (err) {
      console.error('Comparison failed:', err);
    }
  };

  const handleRevert = async (versionNumber) => {
    if (!window.confirm(`Revert to version ${versionNumber}?`)) return;
    
    try {
        const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3002'
        : '';
        const response = await axios.post(
        `${apiUrl}/api/v1/compositions/${compositionId}/revert/${versionNumber}`
      );
      
      if (response.data.status === 'SUCCESS') {
        alert('Composition reverted successfully!');
        fetchVersionHistory();
      }
    } catch (err) {
      alert('Revert failed: ' + err.message);
    }
  };

  if (loading) return <div className="timeline-loading">Loading version history...</div>;
  if (error) return <div className="timeline-error">{error}</div>;

  return (
    <div className="version-timeline-container">
      <div className="timeline-header">
        <h2>Version History</h2>
        <button
          className={`btn ${compareMode ? 'btn-danger' : 'btn-secondary'}`}
          onClick={() => setCompareMode(!compareMode)}
        >
          {compareMode ? 'Cancel Comparison' : 'Compare Versions'}
        </button>
      </div>

      <div className="timeline-content">
        {/* Timeline visualization */}
        <div className="timeline-list">
          {versions.length === 0 ? (
            <p className="no-versions">No version history available</p>
          ) : (
            versions.map((version, index) => (
              <div
                key={version.version_number}
                className={`timeline-item ${
                  selectedVersion?.version_number === version.version_number ? 'active' : ''
                } ${compareWith?.version_number === version.version_number ? 'compare-selected' : ''}`}
                onClick={() => handleSelectVersion(version)}
              >
                <div className="timeline-marker">
                  <div className="marker-dot"></div>
                  {index < versions.length - 1 && <div className="marker-line"></div>}
                </div>
                
                <div className="timeline-item-content">
                  <div className="version-header">
                    <span className="version-number">v{version.version_number}</span>
                    <span className="version-date">
                      {new Date(version.created_at).toLocaleString()}
                    </span>
                  </div>
                  
                  <p className="version-summary">{version.change_summary}</p>
                  
                  {version.created_by && (
                    <p className="version-creator">By: {version.created_by}</p>
                  )}
                  
                  {compareMode && (
                    <div className="compare-checkbox">
                      <input
                        type="checkbox"
                        checked={compareWith?.version_number === version.version_number}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCompareWith(version);
                          } else {
                            setCompareWith(null);
                          }
                        }}
                      />
                      <span>Compare with selected</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Details panel */}
        <div className="timeline-details">
          {compareMode && selectedVersion && compareWith ? (
            <VersionComparison
              compositionId={compositionId}
              v1={selectedVersion}
              v2={compareWith}
              onRevert={handleRevert}
            />
          ) : selectedVersion ? (
            <VersionDetails
              version={selectedVersion}
              onRevert={handleRevert}
              compositionId={compositionId}
            />
          ) : (
            <div className="no-selection">Select a version to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Version Details Component
 * Displays full details and snapshot of a specific version
 */
function VersionDetails({ version, onRevert, compositionId }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);

  useEffect(() => {
    const fetchSnapshot = async () => {
      try {
        const apiUrl = process.env.NODE_ENV === 'development' 
          ? 'http://localhost:3002'
          : '';
        const response = await axios.get(
          `${apiUrl}/api/v1/compositions/${compositionId}/versions/${version.version_number}`
        );
        setSnapshot(response.data.data);
      } catch (err) {
        console.error('Failed to load snapshot:', err);
      } finally {
        setLoadingSnapshot(false);
      }
    };
    fetchSnapshot();
  }, [version, compositionId]);

  return (
    <div className="version-details">
      <div className="details-header">
        <h3>Version {version.version_number}</h3>
        {version.version_number > 1 && (
          <button
            className="btn btn-secondary"
            onClick={() => onRevert(version.version_number)}
          >
            Revert to This Version
          </button>
        )}
      </div>

      <div className="details-meta">
        <div className="meta-item">
          <span className="label">Date:</span>
          <span className="value">{new Date(version.created_at).toLocaleString()}</span>
        </div>
        <div className="meta-item">
          <span className="label">Created By:</span>
          <span className="value">{version.created_by || 'System'}</span>
        </div>
        <div className="meta-item">
          <span className="label">Change:</span>
          <span className="value">{version.change_summary}</span>
        </div>
      </div>

      {loadingSnapshot ? (
        <div className="loading">Loading snapshot...</div>
      ) : snapshot ? (
        <div className="snapshot-display">
          <h4>Composition Snapshot</h4>
          <pre className="snapshot-json">
            {JSON.stringify(snapshot.composition_snapshot || snapshot, null, 2)}
          </pre>
        </div>
      ) : null}

      {version.changed_fields && Object.keys(version.changed_fields).length > 0 && (
        <div className="changed-fields">
          <h4>Changed Fields</h4>
          <ul>
            {Object.entries(version.changed_fields).map(([field, change]) => (
              <li key={field}>
                <strong>{field}:</strong>
                {typeof change === 'object' ? (
                  <span>{JSON.stringify(change)}</span>
                ) : (
                  <span>{String(change)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Version Comparison Component
 * Shows side-by-side comparison of two versions
 */
function VersionComparison({ v1, v2, compositionId, onRevert }) {
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComparison = async () => {
      try {
        const apiUrl = process.env.NODE_ENV === 'development' 
          ? 'http://localhost:3002'
          : '';
        const response = await axios.get(
          `${apiUrl}/api/v1/compositions/${compositionId}/versions/${Math.min(v1.version_number, v2.version_number)}/compare/${Math.max(v1.version_number, v2.version_number)}`
        );
        setComparison(response.data.data);
      } catch (err) {
        console.error('Failed to load comparison:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchComparison();
  }, [v1, v2, compositionId]);

  if (loading) return <div className="comparison-loading">Loading comparison...</div>;
  if (!comparison) return <div className="comparison-error">Failed to load comparison</div>;

  return (
    <div className="version-comparison">
      <div className="comparison-header">
        <h3>Comparing Versions</h3>
        <p>v{comparison.version_a} ↔ v{comparison.version_b}</p>
      </div>

      <div className="comparison-stats">
        <div className="stat">
          <span className="label">Total Differences:</span>
          <span className="value">{comparison.difference_count || 0}</span>
        </div>
      </div>

      {comparison.differences && comparison.differences.length > 0 ? (
        <div className="differences-list">
          <h4>Changes</h4>
          {comparison.differences.map((diff, idx) => (
            <div key={idx} className="difference-item">
              <span className="field-name">{diff.field || 'Unknown'}</span>
              <div className="change-values">
                <span className="old-value">
                  {typeof diff.old_value === 'object'
                    ? JSON.stringify(diff.old_value)
                    : String(diff.old_value)}
                </span>
                <span className="arrow">→</span>
                <span className="new-value">
                  {typeof diff.new_value === 'object'
                    ? JSON.stringify(diff.new_value)
                    : String(diff.new_value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-differences">No differences between these versions</p>
      )}
    </div>
  );
}

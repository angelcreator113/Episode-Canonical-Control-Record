/**
 * Audit Log Viewer Page
 * View and filter all system audit logs (Admin only)
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/AuditLog.css';

const AuditLog = () => {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [logs, logs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    action: '',
    resource: '',
    userId: '',
    startDate: '',
    endDate: '',
  });
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    pages: 1,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = '/login';
      return;
    }

    if (user?.role !== 'ADMIN') {
      setError('Only administrators can view audit logs');
      return;
    }

    loadAuditLogs();
  }, [authLoading, isAuthenticated, user]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: pagination.limit,
        offset: pagination.offset,
      });

      if (filters.action) params.append('action', filters.action);
      if (filters.resource) params.append('resource', filters.resource);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`/api/v1/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) {
        throw new Error('Failed to load audit logs');
      }

      const data = await response.json();
      setLogs(data.data || []);
      setPagination(data.pagination || {});
    } catch (err) {
      console.error('Error loading audit logs:', err);
      setError(err.message);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPagination((prev) => ({ ...prev, offset: 0 })); // Reset to first page
  };

  const handleApplyFilters = () => {
    loadAuditLogs();
  };

  const handleClearFilters = () => {
    setFilters({
      action: '',
      resource: '',
      userId: '',
      startDate: '',
      endDate: '',
    });
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  const handlePrevPage = () => {
    setPagination((prev) => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }));
    loadAuditLogs();
  };

  const handleNextPage = () => {
    if (pagination.offset + pagination.limit < pagination.total) {
      setPagination((prev) => ({ ...prev, offset: prev.offset + prev.limit }));
      loadAuditLogs();
    }
  };

  if (authLoading || loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return (
    <div className="audit-log-page">
      <div className="container">
        <h1>📋 Audit Log Viewer</h1>

        {/* Filters */}
        <div className="filters-section">
          <div className="filter-row">
            <div className="filter-group">
              <label>Action Type</label>
              <select
                name="action"
                value={filters.action}
                onChange={handleFilterChange}
              >
                <option value="">All Actions</option>
                <option value="create">Create</option>
                <option value="edit">Edit</option>
                <option value="delete">Delete</option>
                <option value="view">View</option>
                <option value="upload">Upload</option>
                <option value="download">Download</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Resource Type</label>
              <select
                name="resource"
                value={filters.resource}
                onChange={handleFilterChange}
              >
                <option value="">All Resources</option>
                <option value="episode">Episode</option>
                <option value="asset">Asset</option>
                <option value="template">Template</option>
                <option value="metadata">Metadata</option>
                <option value="thumbnail">Thumbnail</option>
              </select>
            </div>

            <div className="filter-group">
              <label>User ID</label>
              <input
                type="text"
                name="userId"
                value={filters.userId}
                onChange={handleFilterChange}
                placeholder="Filter by user ID"
              />
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-group">
              <label>Start Date</label>
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
              />
            </div>

            <div className="filter-group">
              <label>End Date</label>
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
              />
            </div>

            <div className="filter-actions">
              <button className="btn btn-primary" onClick={handleApplyFilters}>
                Apply Filters
              </button>
              <button className="btn btn-secondary" onClick={handleClearFilters}>
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="results-section">
          <div className="results-header">
            <h2>Results ({pagination.total} total)</h2>
            <span className="page-info">
              Page {Math.floor(pagination.offset / pagination.limit) + 1} of{' '}
              {pagination.pages}
            </span>
          </div>

          {logs.length === 0 ? (
            <div className="empty-results">
              <p>📭 No audit logs found</p>
            </div>
          ) : (
            <div className="logs-table">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className={`log-row log-${log.actionType}`}>
                      <td className="timestamp">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="userId">{log.userId || 'system'}</td>
                      <td className="action">
                        <span className={`badge badge-${log.actionType}`}>
                          {log.actionType.toUpperCase()}
                        </span>
                      </td>
                      <td className="resource">{log.resourceType}</td>
                      <td className="details">
                        <span title={`ID: ${log.resourceId}`}>
                          {log.resourceId}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="pagination">
              <button
                className="btn"
                onClick={handlePrevPage}
                disabled={pagination.offset === 0}
              >
                ← Previous
              </button>
              <span className="page-indicator">
                {Math.floor(pagination.offset / pagination.limit) + 1} / {pagination.pages}
              </span>
              <button
                className="btn"
                onClick={handleNextPage}
                disabled={pagination.offset + pagination.limit >= pagination.total}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLog;

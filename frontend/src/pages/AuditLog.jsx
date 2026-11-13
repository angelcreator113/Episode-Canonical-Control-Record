/**
 * Audit Log Viewer Page (/admin/audit; linked from Admin › Security & Access)
 * View and filter the audit entries. Admin only: the route is wrapped in
 * AdminOnly (App.jsx) and the API refuses anyone else.
 *
 * 2026-11-13: every load names the filters and the page it asks for, so
 * Previous/Next and Clear load what they say (they used to load the page
 * before); a failed load keeps the filters on screen and offers Retry; the
 * filter options are the actions and resources that are actually written
 * (page views are never audited).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin } from '../utils/authGroups';
import apiClient from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/AuditLog.css';

const NO_FILTERS = { action: '', resource: '', userId: '', startDate: '', endDate: '' };
const PAGE_SIZE = 50;
// What the app writes (middleware/auditLog logAction callers).
const ACTIONS = ['create', 'edit', 'delete', 'download', 'retry', 'cancel', 'detach_secondary_event'];
const RESOURCES = ['episode', 'file', 'metadata', 'processing', 'job', 'world_event'];
const labelOf = (value) => value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');

const AuditLog = () => {
  const { loading: authLoading, user } = useAuth();
  const admin = isAdmin(user);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(NO_FILTERS);
  // The filters and page of the last request, so Retry and paging repeat them.
  const [asked, setAsked] = useState({ filters: NO_FILTERS, offset: 0 });
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0, pages: 1 });

  const loadAuditLogs = useCallback(async (useFilters, offset) => {
    setAsked({ filters: useFilters, offset });
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: PAGE_SIZE, offset });
      if (useFilters.action) params.append('action', useFilters.action);
      if (useFilters.resource) params.append('resource', useFilters.resource);
      if (useFilters.userId) params.append('userId', useFilters.userId);
      if (useFilters.startDate) params.append('startDate', useFilters.startDate);
      if (useFilters.endDate) params.append('endDate', useFilters.endDate);
      const response = await apiClient.get(`/api/v1/audit-logs?${params}`);
      const data = response.data;
      setLogs(data.data || []);
      setPagination({ total: 0, limit: PAGE_SIZE, offset, pages: 1, ...(data.pagination || {}) });
    } catch (err) {
      console.error('Error loading audit logs:', err);
      const status = err.response?.status;
      setError(`${err.response?.data?.error || 'The audit log could not be loaded'}${status ? ` (the server answered ${status})` : ''}.`);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!admin) { setLoading(false); return; }
    loadAuditLogs(NO_FILTERS, 0);
  }, [authLoading, admin, loadAuditLogs]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };
  // Applying or clearing starts again from the first page.
  const handleApplyFilters = () => loadAuditLogs(filters, 0);
  const handleClearFilters = () => { setFilters(NO_FILTERS); loadAuditLogs(NO_FILTERS, 0); };
  const handlePrevPage = () => loadAuditLogs(asked.filters, Math.max(0, asked.offset - PAGE_SIZE));
  const handleNextPage = () => {
    if (asked.offset + PAGE_SIZE < pagination.total) loadAuditLogs(asked.filters, asked.offset + PAGE_SIZE);
  };

  if (authLoading) {
    return <LoadingSpinner />;
  }
  if (!admin) {
    return <div className="audit-log-page"><div className="container"><p role="alert">Only administrators can view audit logs</p></div></div>;
  }

  return (
    <div className="audit-log-page">
      <div className="container">
        <p className="audit-back"><Link to="/admin?tab=security">← Security &amp; Access</Link></p>
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
                {ACTIONS.map((a) => <option key={a} value={a}>{labelOf(a)}</option>)}
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
                {RESOURCES.map((r) => <option key={r} value={r}>{labelOf(r)}</option>)}
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
          {loading && <LoadingSpinner />}
          {!loading && error && (
            <div className="audit-error" role="alert" data-testid="audit-error">
              <p>{error}</p>
              <button className="btn btn-primary" onClick={() => loadAuditLogs(asked.filters, asked.offset)}>Retry</button>
            </div>
          )}
          {!loading && !error && (<>
          <div className="results-header">
            <h2>Results ({pagination.total} total)</h2>
            <span className="page-info">
              Page {Math.floor(pagination.offset / pagination.limit) + 1} of{' '}
              {Math.max(1, pagination.pages || 1)}
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
          </>)}

          {/* Pagination */}
          {!loading && !error && pagination.pages > 1 && (
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

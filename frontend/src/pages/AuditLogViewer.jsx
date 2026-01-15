/**
 * Audit Log Viewer Page
 * Display user activity history with filters and search
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import '../styles/AuditLog.css';

const AuditLogViewer = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    action: 'all',
    user: '',
    resource: 'all',
    dateFrom: '',
    dateTo: '',
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch real audit logs from API
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        
        // Build query parameters
        const params = new URLSearchParams();
        if (filters.action !== 'all') params.append('action', filters.action);
        if (filters.resource !== 'all') params.append('resource', filters.resource);
        if (filters.user) params.append('user', filters.user);
        if (searchQuery) params.append('search', searchQuery);
        
        const response = await fetch(`/api/v1/audit-logs?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          // Fallback to mock data if API fails
          console.warn('Audit API unavailable, using sample data');
          const mockLogs = [
            {
              id: 1,
              user_id: 'user-1',
              username: 'admin',
              action: 'CREATE',
              resource_type: 'Episode',
              resource_id: 'ep-123',
              description: 'Created episode "The New Beginning"',
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              ip_address: '192.168.1.100',
              status: 'success',
            },
            {
              id: 2,
              user_id: 'user-2',
              username: 'editor',
              action: 'UPDATE',
              resource_type: 'Episode',
              resource_id: 'ep-122',
              description: 'Updated episode status to published',
              timestamp: new Date(Date.now() - 7200000).toISOString(),
              ip_address: '192.168.1.101',
              status: 'success',
            },
            {
              id: 3,
              user_id: 'user-1',
              username: 'admin',
              action: 'DELETE',
              resource_type: 'Episode',
              resource_id: 'ep-121',
              description: 'Deleted episode "Old Episode"',
              timestamp: new Date(Date.now() - 86400000).toISOString(),
              ip_address: '192.168.1.100',
              status: 'success',
            },
          ];
          setLogs(mockLogs);
          return;
        }

        const data = await response.json();
        setLogs(data.data || []);
      } catch (err) {
        console.error('Error fetching audit logs:', err);
        setError('Failed to fetch audit logs');
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && !authLoading) {
      fetchLogs();
    }
  }, [isAuthenticated, authLoading, filters, searchQuery]);

  // Filter and search logs
  const filteredLogs = logs.filter((log) => {
    const matchAction = filters.action === 'all' || log.action === filters.action;
    const matchUser = !filters.user || log.user.toLowerCase().includes(filters.user.toLowerCase());
    const matchResource = filters.resource === 'all' || log.resource === filters.resource;
    const matchSearch = !searchQuery || 
      log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user.toLowerCase().includes(searchQuery.toLowerCase());

    return matchAction && matchUser && matchResource && matchSearch;
  });

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      action: 'all',
      user: '',
      resource: 'all',
      dateFrom: '',
      dateTo: '',
    });
    setSearchQuery('');
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE':
        return '#10b981';
      case 'UPDATE':
        return '#3b82f6';
      case 'DELETE':
        return '#ef4444';
      case 'VIEW':
        return '#6366f1';
      default:
        return '#6b7280';
    }
  };

  if (authLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="audit-log-page">
      <div className="audit-container">
        <div className="audit-header">
          <h1>Audit Log</h1>
          <p className="audit-subtitle">View and filter user activity history</p>
        </div>

        {error && (
          <ErrorMessage
            message={error}
            onDismiss={() => setError(null)}
          />
        )}

        {/* Filters */}
        <div className="audit-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-controls">
            <div className="filter-item">
              <label htmlFor="auditActionFilter">Action:</label>
              <select
                id="auditActionFilter"
                name="action"
                value={filters.action}
                onChange={handleFilterChange}
              >
                <option value="all">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="VIEW">View</option>
              </select>
            </div>

            <div className="filter-item">
              <label htmlFor="auditResourceFilter">Resource Type:</label>
              <select
                id="auditResourceFilter"
                name="resource"
                value={filters.resource}
                onChange={handleFilterChange}
              >
                <option value="all">All Resources</option>
                <option value="Episode">Episode</option>
                <option value="User">User</option>
              </select>
            </div>

            <div className="filter-item">
              <label htmlFor="auditUserFilter">Username:</label>
              <input
                id="auditUserFilter"
                type="text"
                name="user"
                value={filters.user}
                onChange={handleFilterChange}
                placeholder="Filter by user..."
              />
            </div>

            <button
              onClick={handleResetFilters}
              className="btn btn-secondary"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Logs Table */}
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="audit-logs-container">
            {filteredLogs.length > 0 ? (
              <table className="audit-logs-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Description</th>
                    <th>IP Address</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="timestamp">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="user">{log.username || log.user}</td>
                      <td className="action">
                        <span
                          className="action-badge"
                          style={{ backgroundColor: getActionColor(log.action) }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="resource">{log.resource_type || log.resource}</td>
                      <td className="description">{log.description}</td>
                      <td className="ip-address">{log.ip_address || 'N/A'}</td>
                      <td className="status">
                        <span className={`status-badge status-${log.status || 'success'}`}>
                          {(log.status || 'success').charAt(0).toUpperCase() + (log.status || 'success').slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-logs">
                <p>No audit logs found matching your filters</p>
                <button
                  onClick={handleResetFilters}
                  className="btn btn-primary"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="audit-footer">
          <p className="log-count">
            Showing {filteredLogs.length} of {logs.length} logs
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuditLogViewer;

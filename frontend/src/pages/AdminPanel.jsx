/**
 * Admin Panel Page
 * User roles management interface
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import '../styles/AdminPanel.css';

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Check if user is admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      setError('Access denied. Admin privileges required.');
      setTimeout(() => navigate('/episodes'), 2000);
    }
  }, [user, navigate]);

  // Load current user into the user list from auth context
  useEffect(() => {
    if (user) {
      setUsers([{
        id: user.id || user.sub || 'current',
        username: user.name || user.email?.split('@')[0] || 'admin',
        email: user.email || '',
        role: user.role?.toLowerCase() || 'admin',
        created_at: new Date().toISOString(),
      }]);
    }
  }, [user]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      setError(null);
      // Update local state — persisted role changes require a User model + API
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      setEditingUserId(null);
    } catch (err) {
      setError(err.message || 'Failed to update user role');
    }
  };

  if (authLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="admin-panel-page">
      <div className="admin-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <button 
            onClick={() => navigate(-1)} 
            className="btn-back"
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
          >
            ← Back
          </button>
          <h1>Admin Panel</h1>
        </div>
        <p className="admin-subtitle">Manage user roles and permissions</p>

        {error && (
          <ErrorMessage
            message={error}
            onDismiss={() => setError(null)}
          />
        )}

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="username">{u.username}</td>
                    <td className="email">{u.email}</td>
                    <td className="role">
                      {editingUserId === u.id ? (
                        <select
                          value={selectedRole || u.role}
                          onChange={(e) => setSelectedRole(e.target.value)}
                          className="role-select"
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span className={`role-badge role-${u.role}`}>
                          {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                        </span>
                      )}
                    </td>
                    <td className="created">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="actions">
                      {editingUserId === u.id ? (
                        <>
                          <button
                            onClick={() =>
                              handleRoleChange(u.id, selectedRole || u.role)
                            }
                            className="btn btn-primary btn-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingUserId(null)}
                            className="btn btn-secondary btn-sm"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingUserId(u.id);
                            setSelectedRole(u.role);
                          }}
                          className="btn btn-secondary btn-sm"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-footer">
          <button
            onClick={() => navigate('/episodes')}
            className="btn btn-secondary"
          >
            ← Back to Episodes
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;

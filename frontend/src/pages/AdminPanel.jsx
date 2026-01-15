/**
 * Admin Panel Page
 * User roles management interface
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
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

  // Mock users data - in a real app, this would come from an API
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        // Mock data for demonstration
        const mockUsers = [
          {
            id: '50d117a5-3d96-43de-a2dc-2e5027c776a3',
            username: 'admin',
            email: 'admin@example.com',
            role: 'admin',
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            id: '60d227b5-3d96-43de-a2dc-2e5027c776a4',
            username: 'editor',
            email: 'editor@example.com',
            role: 'editor',
            created_at: '2024-01-02T00:00:00Z',
          },
          {
            id: '70d337c5-3d96-43de-a2dc-2e5027c776a5',
            username: 'viewer',
            email: 'viewer@example.com',
            role: 'viewer',
            created_at: '2024-01-03T00:00:00Z',
          },
        ];
        setUsers(mockUsers);
      } catch (err) {
        setError(err.message || 'Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      setError(null);
      // In a real app, this would call an API endpoint
      // await adminService.updateUserRole(userId, newRole);
      
      // Update local state for demo
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
        <h1>Admin Panel</h1>
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

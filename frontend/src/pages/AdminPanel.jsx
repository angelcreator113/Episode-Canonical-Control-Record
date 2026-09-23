/**
 * Admin Panel Page
 * User roles management interface, plus the admin tools index — the
 * doorway to the admin and diagnostic pages (docs/SIDEBAR_PROPOSAL.md §5).
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, BarChart3, Coins, Map as MapIcon, Palette, Stethoscope, Trash2, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin } from '../utils/authGroups';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import '../styles/AdminPanel.css';

// Admin tools index — each entry is a route in App.jsx.
const ADMIN_TOOLS = [
  { route: '/cfo', label: 'CFO Agent', Icon: Wallet,
    desc: 'Runs cost, dependency, resource and health audits across the system.' },
  { route: '/analytics/decisions', label: 'Decision Analytics', Icon: BarChart3,
    desc: 'Insights from your editing decisions, used to train the AI.' },
  { route: '/ai-costs', label: 'AI Costs', Icon: Coins,
    desc: 'AI spend broken down by day, model and feature.' },
  { route: '/site-organizer', label: 'Site Organizer', Icon: MapIcon,
    desc: 'Audits navigation: sidebar and route alignment, dead links, orphan pages.' },
  { route: '/design-agent', label: 'Design Agent', Icon: Palette,
    desc: 'Audits design: responsive breakpoints, tokens, consistency, accessibility.' },
  { route: '/diagnostics', label: 'Diagnostics', Icon: Stethoscope,
    desc: 'Tests the API endpoints to find what is failing.' },
  { route: '/recycle-bin', label: 'Recycle Bin', Icon: Trash2,
    desc: 'Restores soft-deleted items, grouped by type.' },
];

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

  // Check if user is admin (Cognito admin group; the user has no role field)
  useEffect(() => {
    if (user && !isAdmin(user)) {
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

        <section className="admin-tools" aria-labelledby="admin-tools-heading">
          <h2 id="admin-tools-heading" className="admin-tools-heading">Admin tools</h2>
          <ul className="admin-tools-list">
            {ADMIN_TOOLS.map(({ route, label, Icon, desc }) => (
              <li key={route}>
                <button
                  type="button"
                  className="admin-tool"
                  onClick={() => navigate(route)}
                >
                  <Icon className="admin-tool-icon" size={20} aria-hidden="true" />
                  <span className="admin-tool-text">
                    <span className="admin-tool-label">{label}</span>
                    <span className="admin-tool-desc">{desc}</span>
                  </span>
                  <ChevronRight className="admin-tool-chevron" size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>

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

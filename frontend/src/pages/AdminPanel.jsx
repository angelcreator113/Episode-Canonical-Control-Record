/**
 * Admin Panel Page
 * One page with tabs (The Pulse spec, docs/design/2026-10-the-pulse.md §1;
 * Task #2913): The Pulse (the Social Director's home), Website (the public
 * site's images and video, formerly its own sidebar row at /website), Show
 * settings (the active show's settings, formerly /shows/:id/settings; Task
 * #2914) and Tools (the admin tools index — the doorway to the admin and diagnostic
 * pages, docs/SIDEBAR_PROPOSAL.md §5 — and the user roles table; Evoni,
 * 2026-10-11). ?tab= selects one; the default is The Pulse. The header,
 * pill tabs and date follow Evoni's Admin mock (2026-10-17; AdminPulse.css).
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Wallet, BarChart3, Coins, Map as MapIcon, Palette, Trash2, ChevronRight, CalendarDays } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin } from '../utils/authGroups';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import WebsiteAdmin from './WebsiteAdmin';
import ShowSettings from './ShowSettings';
import AdminShowGate from '../components/Admin/AdminShowGate';
import PulseDirector from './AdminPulse';
import '../styles/AdminPanel.css';
import './AdminPulse.css';

// Admin's tabs, in order. The first is the default.
export const TABS = [
  { key: 'pulse', label: 'The Pulse' },
  { key: 'website', label: 'Website' },
  { key: 'show-settings', label: 'Show settings' },
  { key: 'tools', label: 'Tools' },
];
// The header's initials and today's date (Evoni's Admin mock, 2026-10-17).
export const initialsOf = (user) => {
  const name = (user?.name || user?.email?.split('@')[0] || 'A').trim();
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] || ''))).toUpperCase() || 'A';
};
const todayLabel = (now = new Date()) => now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const tabFrom = (value) => (TABS.some((t) => t.key === value) ? value : TABS[0].key);

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
  { route: '/recycle-bin', label: 'Recycle Bin', Icon: Trash2,
    desc: 'Restores soft-deleted items, grouped by type.' },
];

// Admin › Show settings: the active show's settings (AdminShowGate picks
// the show). The show's own Config/Advanced tab is ?sub= here.
function AdminShowSettings() {
  return (
    <AdminShowGate resetKeys={['sub']}>
      {(showId) => <ShowSettings key={showId} showId={showId} tabParam="sub" />}
    </AdminShowGate>
  );
}

const AdminPanel = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = tabFrom(params.get('tab'));
  // ?sub= belongs to the tab it was set on (Show settings' Config/Advanced,
  // The Pulse's sub-tabs), so changing tab drops it.
  const selectTab = (key) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('tab', key);
    next.delete('sub');
    return next;
  }, { replace: true });
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
    <div className="admin-panel-page adm">
      <div className="admin-container">
        <header className="adm-hero">
          <div className="adm-hero-text">
            <h1>Admin</h1>
            <p className="adm-kicker">Manage · Monitor · Guide · Grow</p>
          </div>
          {user && (
            <span className="adm-user" data-testid="adm-user">
              <span className="adm-avatar" aria-hidden="true">{initialsOf(user)}</span>
              <span className="adm-user-email">{user.email || user.name}</span>
            </span>
          )}
        </header>

        {error && (
          <ErrorMessage
            message={error}
            onDismiss={() => setError(null)}
          />
        )}

        <div className="adm-bar">
          <div className="adm-tabs" role="tablist" aria-label="Admin sections">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`admin-tab-${t.key}`}
                aria-selected={tab === t.key}
                aria-controls={`admin-panel-${t.key}`}
                className={tab === t.key ? 'adm-tab is-active' : 'adm-tab'}
                onClick={() => selectTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <span className="adm-date" data-testid="adm-date"><CalendarDays size={16} aria-hidden="true" />{todayLabel()}</span>
        </div>

        <div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`} className="admin-tabpanel">
        {tab === 'pulse' && <PulseDirector />}
        {tab === 'website' && <WebsiteAdmin />}
        {tab === 'show-settings' && <AdminShowSettings />}
        {tab === 'tools' && (<>
        <p className="admin-subtitle">Manage user roles and permissions</p>

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
        </>)}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;

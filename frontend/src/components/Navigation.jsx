/**
 * Navigation Component
 * Side navigation menu
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import '../styles/Navigation.css';

const Navigation = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const handleNavigation = (path) => {
    navigate(path);
    onClose();
  };

  let navItems = [
    { label: 'Home', path: '/', icon: '🏠' },
    { label: 'Episodes', path: '/episodes', icon: '📺' },
    { label: 'Create Episode', path: '/episodes/create', icon: '➕' },
    { label: 'Search', path: '/search', icon: '🔍' },
    { label: 'Thumbnail Composer', path: '/composer/default', icon: '🎨' },
    { label: 'Asset Manager', path: '/assets', icon: '📸' },
  ];

  // Add admin-only menu items
  if (user?.role === 'admin' || user?.groups?.includes('ADMIN')) {
    navItems.push({ label: 'Audit Log', path: '/audit-log', icon: '📋' });
    navItems.push({ label: 'Templates', path: '/admin/templates', icon: '📄' });
    navItems.push({ label: 'Admin Panel', path: '/admin', icon: '⚙️' });
  }

  return (
    <>
      <div className={`nav-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
      <nav className={`navigation ${isOpen ? 'open' : ''}`}>
        <div className="nav-header">
          <h2>📺 Episode Control</h2>
          <button className="nav-close" onClick={onClose} aria-label="Close menu">
            ✕
          </button>
        </div>
        
        <ul className="nav-items">
          {navItems.map((item) => (
            <li key={item.path}>
              <button
                onClick={() => handleNavigation(item.path)}
                className={location.pathname === item.path ? 'active' : ''}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>

        {/* ✅ NEW: User info section */}
        {user && (
          <div className="nav-footer">
            <div className="user-info">
              <div className="user-avatar">
                {user.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="user-details">
                <div className="user-name">{user.username}</div>
                <div className="user-role">{user.role || 'User'}</div>
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  );
};

export default Navigation;
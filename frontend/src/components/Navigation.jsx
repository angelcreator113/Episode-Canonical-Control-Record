/**
 * Navigation Component
 * Side navigation menu
 */

import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Navigation.css';

const Navigation = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Lock background scroll when nav is open (mobile especially)
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  const handleNavigation = (path) => {
    navigate(path);
    onClose?.();
  };

  const navItems = [
    { label: 'Home', path: '/', icon: '🏠' },
    { label: 'Shows', path: '/shows', icon: '🎬' },
    { label: 'Episodes', path: '/episodes', icon: '📺' },
    { label: 'Wardrobe', path: '/wardrobe', icon: '👗' },
  ];

  if (user?.role === 'admin' || user?.groups?.includes('ADMIN')) {
    navItems.push({ label: 'Audit Log', path: '/audit-log', icon: '📋' });
    navItems.push({ label: 'Templates', path: '/admin/templates', icon: '📄' });
    navItems.push({ label: 'Admin Panel', path: '/admin', icon: '⚙️' });
  }

  return (
    <>
      <div
        className={`nav-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <nav
        className={`navigation ${isOpen ? 'open' : ''}`}
        aria-label="Primary navigation"
        inert={!isOpen ? "" : undefined}
      >
        <div className="nav-header">
          <h2>Menu</h2>
          <button className="nav-close" onClick={onClose} aria-label="Close menu" type="button">
            ✕
          </button>
        </div>

        <ul className="nav-items">
          {navItems.map((item) => (
            <li key={item.path}>
              <button
                type="button"
                onClick={() => handleNavigation(item.path)}
                className={location.pathname === item.path ? 'active' : ''}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>

        {user && (
          <div className="nav-footer">
            <div className="user-info">
              <div className="user-avatar">{user.username?.charAt(0).toUpperCase() || 'U'}</div>
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

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
  const [expandedMenus, setExpandedMenus] = React.useState({});

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
  
  const toggleSubmenu = (label) => {
    setExpandedMenus(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };
  
  const isPathActive = (item) => {
    if (item.path) {
      return location.pathname === item.path;
    }
    if (item.subItems) {
      return item.subItems.some(sub => location.pathname === sub.path);
    }
    return false;
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
            <li key={item.label} className={item.subItems ? 'has-submenu' : ''}>
              {item.subItems ? (
                <>
                  <button
                    type="button"
                    onClick={() => toggleSubmenu(item.label)}
                    className={`nav-item-button ${isPathActive(item) ? 'active' : ''} ${expandedMenus[item.label] ? 'expanded' : ''}`}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                    <span className="submenu-arrow">{expandedMenus[item.label] ? '▼' : '▶'}</span>
                  </button>
                  {expandedMenus[item.label] && (
                    <ul className="submenu">
                      {item.subItems.map((subItem) => (
                        <li key={subItem.path}>
                          <button
                            type="button"
                            onClick={() => handleNavigation(subItem.path)}
                            className={location.pathname === subItem.path ? 'active' : ''}
                          >
                            <span className="nav-icon">{subItem.icon}</span>
                            <span>{subItem.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleNavigation(item.path)}
                  className={`nav-item-button ${location.pathname === item.path ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              )}
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

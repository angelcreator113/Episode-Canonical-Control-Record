/**
 * Header Component
 * Top navigation bar
 */

import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Breadcrumbs from './Breadcrumbs';
import '../styles/Header.css';

const Header = ({ navOpen, onNavToggle }) => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  // The header sticks to the top below 1280px (Header.css). Its height is
  // published as --app-header-h so a page's own sticky bar can sit under it
  // instead of behind it (the episode header, Evoni 2026-10-05).
  const headerRef = useRef(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--app-header-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty('--app-header-h'); };
  }, []);

  const handleLogout = async () => {
    try {
      console.log('[Header] Logging out...');
      await logout();
      console.log('[Header] Logout complete');
      navigate('/');
    } catch (err) {
      console.error('[Header] Logout error:', err);
      navigate('/');
    }
  };

  return (
    <header className="header" ref={headerRef}>
      <div className="header-content">
        <div className="header-left">
          {onNavToggle && (
            <button 
              className="nav-toggle-btn" 
              onClick={onNavToggle}
              aria-label="Toggle Navigation"
              data-location="header"
              data-state={navOpen ? 'open' : 'closed'}
            >
              {navOpen ? '✕' : '☰'}
            </button>
          )}
          <h1 className="header-title">Prime Studios</h1>
        </div>

        <div className="header-right">
          {isAuthenticated && user && (
            <>
              <span className="user-info">{user.email}</span>
              <button className="logout-button" onClick={handleLogout}>
                Logout
              </button>
            </>
          )}
        </div>
      </div>
      <Breadcrumbs />
    </header>
  );
};

export default Header;

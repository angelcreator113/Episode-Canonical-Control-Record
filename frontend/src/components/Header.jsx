/**
 * Header Component
 * Top navigation bar
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Breadcrumbs from './Breadcrumbs';
import '../styles/Header.css';

const Header = ({ navOpen, onNavToggle }) => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();

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
    <header className="header">
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

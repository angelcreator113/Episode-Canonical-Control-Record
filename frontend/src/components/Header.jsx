/**
 * Header Component
 * Top navigation bar
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Header.css';

const Header = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();

  const handleLogout = async () => {
    try {
      console.log('[Header] Logging out...');
      // Call logout which clears auth state and localStorage
      await logout();
      console.log('[Header] Logout complete');
      // Note: Navigation will happen automatically via App.jsx useEffect
      // when isAuthenticated changes to false
    } catch (err) {
      console.error('[Header] Logout error:', err);
      // Navigation will still happen via App.jsx
    }
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <button 
            className="menu-button" 
            onClick={onMenuClick}
            aria-label="Open menu"
          >
            ☰
          </button>
          <h1 className="header-title">Episode Control</h1>
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
      </header>
  );
};

export default Header;

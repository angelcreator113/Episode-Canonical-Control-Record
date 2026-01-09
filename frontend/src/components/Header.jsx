/**
 * Header Component
 * Top navigation bar
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Navigation from './Navigation';
import '../styles/Header.css';

const Header = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const [isNavOpen, setIsNavOpen] = useState(false);

  const handleLogout = async () => {
    try {
      // Call logout which clears auth state and localStorage
      await logout();
      // Redirect to login - using replace to prevent back button issues
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 100);
    } catch (err) {
      console.error('Logout error:', err);
      // Still redirect even if logout fails
      navigate('/login', { replace: true });
    }
  };

  return (
    <>
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <button 
              className="menu-button" 
              onClick={() => setIsNavOpen(true)}
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

      {/* Navigation Sidebar */}
      <Navigation 
        isOpen={isNavOpen} 
        onClose={() => setIsNavOpen(false)} 
      />
    </>
  );
};

export default Header;

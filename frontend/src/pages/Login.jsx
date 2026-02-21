import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService';
import '../styles/Login.css';

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('[Login] Attempting login with:', email);
      
      // ✅ FIX: Use the auth hook's login function
      const result = await login(email, password);
      console.log('[Login] Login successful:', result);
      setSuccess(`Welcome!`);
      
      // Note: Navigation will happen automatically via AppContent
      // when isAuthenticated changes to true
    } catch (err) {
      console.error('[Login] Login error:', err);
      console.error('[Login] Error response:', err.response);
      const errorMsg = err.response?.data?.message || err.message || 'Login failed. Please try again.';
      console.log('[Login] Error message:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Episode Canonical<br />Control Record</h1>
        <h2>Sign In</h2>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="password-eye"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '◉' : '○'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="help-text">
          Enter your credentials to access the canonical record
        </p>
      </div>
    </div>
  );
}


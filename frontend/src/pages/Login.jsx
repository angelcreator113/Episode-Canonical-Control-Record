import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
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
      const status = err.response?.status;
      const serverMsg = err.response?.data?.message;
      let errorMsg;
      if (serverMsg) {
        errorMsg = serverMsg;
      } else if (!err.response && (err.code === 'ERR_NETWORK' || err.message === 'Network Error')) {
        errorMsg = 'Unable to reach the server. Please check your connection and try again.';
      } else if (status === 401) {
        errorMsg = 'Invalid email or password. Please try again.';
      } else if (status === 429) {
        errorMsg = 'Too many attempts. Please wait a moment and try again.';
      } else if (status >= 500) {
        errorMsg = 'Server error. Please try again in a few moments.';
      } else {
        errorMsg = 'Login failed. Please check your credentials and try again.';
      }
      console.log('[Login] Error message:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-top">
        <Link className="login-brand" to="/">PRIME STUDIOS</Link>
        <Link className="login-back" to="/">
          <ArrowLeft size={14} />
          Back to the story
        </Link>
      </div>

      <div className="login-stage">
        <div className="login-blob login-blob--blush" />
        <div className="login-blob login-blob--lilac" />
        <div className="login-blob login-blob--sand" />

        <div className="login-card">
          <div className="login-eyebrow">THE STUDIO DOOR</div>
          <h1>Welcome <em>back.</em></h1>
          <p className="login-sub">The world kept every memory while you were gone.</p>

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
                placeholder="lala@primestudios.com"
                autoComplete="email"
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
                  placeholder="••••••••••"
                  autoComplete="current-password"
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
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-btn"
              disabled={loading}
            >
              {loading ? 'ENTERING…' : 'ENTER THE STUDIO'}
            </button>
          </form>
        </div>
      </div>

      <div className="login-foot">PRIME STUDIOS &middot; THE ATELIER OF THE LALAVERSE</div>
    </div>
  );
}


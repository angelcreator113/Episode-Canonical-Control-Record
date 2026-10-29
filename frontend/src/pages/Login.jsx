import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService';
import useCountdown, { formatWait } from '../hooks/useCountdown';
import useAllowPullToRefresh from '../hooks/useAllowPullToRefresh';
import '../styles/Login.css';

export default function Login() {
  const navigate = useNavigate();
  useAllowPullToRefresh();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // A rate limit's wait (POST /auth/login 429, rateLimits.refusedBy's
  // retry_after_seconds): Sign in stays off until it runs out, then the
  // message clears (Evoni, 2026-10-23: locked out twice, no idea for how long).
  const [retryAt, setRetryAt] = useState(null);
  const waitLeft = useCountdown(retryAt);
  const waiting = retryAt !== null && waitLeft > 0;

  useEffect(() => {
    if (retryAt !== null && waitLeft === 0) {
      setRetryAt(null);
      setError('');
    }
  }, [retryAt, waitLeft]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (waiting) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // ✅ FIX: Use the auth hook's login function
      await login(email, password);
      setSuccess(`Welcome!`);
      
      // Note: Navigation will happen automatically via AppContent
      // when isAuthenticated changes to true
    } catch (err) {
      // Message and status only: the error carries the login body (Task #1976).
      console.error('[Login] Login error:', err.message, err.response?.status);
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
        // The server names which limit refused (rateLimits.refusedBy); this is only the fallback.
        errorMsg = 'The server is limiting requests from this device. Please wait a few minutes and try again.';
      } else if (status >= 500) {
        errorMsg = 'Server error. Please try again in a few moments.';
      } else {
        errorMsg = 'Login failed. Please check your credentials and try again.';
      }
      setError(errorMsg);
      if (status === 429) {
        const data = err.response?.data || {};
        const seconds = Number(data.retry_after_seconds)
          || (Number(data.retry_after_minutes) ? Number(data.retry_after_minutes) * 60 : 0);
        if (seconds > 0) setRetryAt(Date.now() + seconds * 1000);
      }
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

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
              {waiting && (
                <span className="login-countdown" role="timer" aria-live="off" data-testid="login-countdown">
                  Try again in {formatWait(waitLeft)}
                </span>
              )}
            </div>
          )}
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
              disabled={loading || waiting}
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


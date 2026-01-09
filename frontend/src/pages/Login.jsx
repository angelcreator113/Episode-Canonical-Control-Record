import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import authService from '../services/authService';
import '../styles/Login.css';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
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
      
      // ✅ FIX: Use React Router navigate with replace
      console.log('[Login] Redirecting to home...');
      navigate('/', { replace: true });
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
        <h1>Episode Canonical Control Record</h1>
        <h2>Login</h2>

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
              placeholder="test@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="help-text">
          For testing, use any email and password (minimum 6 characters)
        </p>
      </div>
    </div>
  );
}


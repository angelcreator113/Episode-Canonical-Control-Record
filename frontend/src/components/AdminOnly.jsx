/**
 * AdminOnly — route wrapper for the admin tools (Admin › Tools: CFO Agent,
 * AI Costs, Site Organizer, Design Agent, Decision Analytics, Recycle Bin,
 * and the Amber Command Center). Their APIs answer 403 to anyone outside the
 * Cognito `admin` group (authorize(['ADMIN']) on the server; Evoni: "Enforce
 * permissions on the server, not only the frontend"), so a non-admin sees a
 * plain "Admins only" note here instead of a page of failed requests.
 * The server is the guard; this only explains it.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin } from '../utils/authGroups';

const boxStyle = {
  maxWidth: 480,
  margin: '3rem auto',
  padding: '1.5rem 16px',
  textAlign: 'center',
  color: 'var(--lala-ink, #2C2C2C)',
  fontFamily: "'DM Mono', monospace",
};

export default function AdminOnly({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (isAdmin(user)) return children;

  return (
    <div role="alert" data-testid="admin-only" style={boxStyle}>
      <h2 style={{ fontFamily: "'Lora', serif", fontWeight: 600, margin: '0 0 0.5rem' }}>Admins only</h2>
      <p style={{ margin: '0 0 1rem' }}>This tool is for admins. Your account is not in the admin group.</p>
      <Link to="/" style={{ color: 'var(--lala-gold, #B8962E)' }}>Back to the start page</Link>
    </div>
  );
}

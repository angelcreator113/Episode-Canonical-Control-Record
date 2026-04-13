/**
 * EpisodeCard — Enhanced with tier badge, score, financial P&L, production readiness
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { formatters } from '../utils/formatters';

const TIER_CONFIG = {
  slay: { emoji: '👑', label: 'SLAY', color: '#FFD700', bg: '#FFFBEB' },
  pass: { emoji: '✨', label: 'PASS', color: '#22c55e', bg: '#f0fdf4' },
  safe: { emoji: '😐', label: 'SAFE', color: '#eab308', bg: '#fefce8' },
  fail: { emoji: '💔', label: 'FAIL', color: '#dc2626', bg: '#fef2f2' },
};

const STATUS_CONFIG = {
  draft: { emoji: '✏️', label: 'Draft', color: '#94a3b8' },
  scripted: { emoji: '📜', label: 'Scripted', color: '#6366f1' },
  in_build: { emoji: '🎬', label: 'In Build', color: '#f59e0b' },
  in_review: { emoji: '👀', label: 'Review', color: '#8b5cf6' },
  published: { emoji: '✅', label: 'Published', color: '#22c55e' },
  archived: { emoji: '📦', label: 'Archived', color: '#64748b' },
};

function EpisodeCard({ episode, onEdit, onDelete, onView }) {
  const status = STATUS_CONFIG[episode.status] || STATUS_CONFIG.draft;

  // Parse evaluation
  let evalData = null;
  if (episode.evaluation_json) {
    evalData = typeof episode.evaluation_json === 'string' ? JSON.parse(episode.evaluation_json) : episode.evaluation_json;
  }
  const tier = evalData?.tier_final ? TIER_CONFIG[evalData.tier_final] : null;

  // Financial
  const income = parseFloat(episode.total_income) || 0;
  const expenses = parseFloat(episode.total_expenses) || 0;
  const net = income - expenses;

  // Categories
  let categories = episode.categories;
  if (typeof categories === 'string') try { categories = JSON.parse(categories); } catch { categories = []; }
  if (!Array.isArray(categories)) categories = [];

  return (
    <div
      onClick={() => onView && onView(episode.id)}
      style={{
        background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
        overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Header: tier banner or status bar */}
      {tier ? (
        <div style={{ padding: '8px 14px', background: tier.bg, borderBottom: `2px solid ${tier.color}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>{tier.emoji}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: tier.color }}>{tier.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>{evalData.score}/100</span>
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, color: status.color }}>{status.emoji} {status.label}</span>
        </div>
      ) : (
        <div style={{ padding: '6px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: status.color }}>{status.emoji} {status.label}</span>
          {episode.episode_number && <span style={{ fontSize: 10, color: '#94a3b8' }}>Ep {episode.episode_number}</span>}
        </div>
      )}

      {/* Body */}
      <div style={{ padding: '12px 14px', flex: 1 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.3 }}>
          {episode.title || 'Untitled Episode'}
        </h3>

        {episode.description && (
          <p style={{ margin: '0 0 8px', fontSize: 11, color: '#64748b', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {episode.description}
          </p>
        )}

        {/* Tags */}
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 8 }}>
            {categories.slice(0, 3).map((cat, i) => (
              <span key={i} style={{ padding: '1px 6px', background: '#f1f5f9', borderRadius: 4, fontSize: 9, color: '#64748b', fontWeight: 500 }}>{cat}</span>
            ))}
          </div>
        )}

        {/* Financial row */}
        {(income > 0 || expenses > 0) && (
          <div style={{ display: 'flex', gap: 8, fontSize: 10, marginTop: 4 }}>
            {income > 0 && <span style={{ color: '#16a34a', fontWeight: 600 }}>+{income.toLocaleString()}</span>}
            {expenses > 0 && <span style={{ color: '#dc2626', fontWeight: 600 }}>-{expenses.toLocaleString()}</span>}
            <span style={{ fontWeight: 700, color: net >= 0 ? '#16a34a' : '#dc2626' }}>
              Net: {net >= 0 ? '+' : ''}{net.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {onView && <button onClick={e => { e.stopPropagation(); onView(episode.id); }} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Open</button>}
          {onEdit && <button onClick={e => { e.stopPropagation(); onEdit(episode.id); }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Edit</button>}
        </div>
        {onDelete && (
          <button onClick={e => { e.stopPropagation(); onDelete(episode.id); }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', fontSize: 11, cursor: 'pointer' }} title="Delete">🗑</button>
        )}
      </div>
    </div>
  );
}

export default EpisodeCard;

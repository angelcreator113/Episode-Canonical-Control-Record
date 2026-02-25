// frontend/src/components/LoadingSkeleton.jsx
import React from 'react';
import './LoadingSkeleton.css';

/**
 * LoadingSkeleton - Reusable shimmer loading placeholder
 * Replaces plain "Loading..." text with elegant skeleton UI
 *
 * Variants:
 *   page   - Full page skeleton (header + cards)
 *   card   - Single card placeholder
 *   text   - Text line placeholder
 *   editor - Writing editor skeleton
 */
function LoadingSkeleton({ variant = 'page', lines = 3, count = 1 }) {
  if (variant === 'text') {
    return (
      <div className="skeleton-text-group">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className="skeleton-line shimmer"
            style={{ width: i === lines - 1 ? '60%' : '100%' }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="skeleton-cards">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-card-header shimmer" />
            <div className="skeleton-card-body">
              <div className="skeleton-line shimmer" style={{ width: '80%' }} />
              <div className="skeleton-line shimmer" style={{ width: '60%' }} />
              <div className="skeleton-line shimmer" style={{ width: '40%' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'editor') {
    return (
      <div className="skeleton-editor">
        <div className="skeleton-editor-toolbar shimmer" />
        <div className="skeleton-editor-body">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="skeleton-line shimmer"
              style={{ width: `${65 + Math.random() * 35}%`, marginBottom: i === 3 ? '1.2rem' : undefined }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Default: page skeleton
  return (
    <div className="skeleton-page">
      <div className="skeleton-page-header">
        <div className="skeleton-title shimmer" />
        <div className="skeleton-subtitle shimmer" />
      </div>
      <div className="skeleton-page-content">
        <div className="skeleton-cards">
          {Array.from({ length: count || 3 }, (_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-card-header shimmer" />
              <div className="skeleton-card-body">
                <div className="skeleton-line shimmer" style={{ width: '80%' }} />
                <div className="skeleton-line shimmer" style={{ width: '55%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default LoadingSkeleton;

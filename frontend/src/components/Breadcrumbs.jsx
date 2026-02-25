// frontend/src/components/Breadcrumbs.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Breadcrumbs.css';

/**
 * Breadcrumbs — Auto-generates navigation trail from current path
 * 
 * Usage:
 *   <Breadcrumbs />                       — auto-generate from URL
 *   <Breadcrumbs items={[{label, path}]} /> — manual override
 */

const ROUTE_LABELS = {
  '': 'Home',
  'start': 'Start Session',
  'universe': 'Universe',
  'storyteller': 'Write',
  'book': 'Book',
  'books': 'Books',
  'write': 'Write',
  'read': 'Read',
  'character-registry': 'Characters',
  'therapy': 'Therapy Room',
  'continuity': 'Timeline',
  'relationships': 'Relationships',
  'press': 'The Press',
  'shows': 'Shows',
  'wardrobe': 'Wardrobe',
  'wardrobe-library': 'Wardrobe Library',
  'scene-library': 'Scene Library',
  'template-studio': 'Template Studio',
  'assets': 'Asset Library',
  'settings': 'Settings',
  'search': 'Search',
  'analytics': 'Analytics',
  'decisions': 'Decisions',
  'admin': 'Admin',
  'diagnostics': 'Diagnostics',
  'episodes': 'Episodes',
  'export': 'Export',
  'edit': 'Edit',
  'create': 'Create',
  'review': 'Review',
  'world': 'World',
  'library': 'Library',
  'compositions': 'Compositions',
  'thumbnails': 'Thumbnails',
  'designer': 'Designer',
  'outfits': 'Outfits',
  'upload': 'Upload',
};

function Breadcrumbs({ items }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-generate breadcrumbs from URL path if no manual items
  const crumbs = items || (() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const result = [{ label: 'Home', path: '/' }];
    let currentPath = '';

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      currentPath += `/${seg}`;

      // Skip UUID/ID segments in display but include in path
      const isId = /^[0-9a-f]{8}-|^\d+$/.test(seg);
      if (isId) continue;

      const label = ROUTE_LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
      result.push({ label, path: currentPath });
    }

    return result;
  })();

  if (crumbs.length <= 1) return null;

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol className="breadcrumb-list">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={crumb.path} className={`breadcrumb-item ${isLast ? 'current' : ''}`}>
              {isLast ? (
                <span className="breadcrumb-current">{crumb.label}</span>
              ) : (
                <>
                  <button className="breadcrumb-link" onClick={() => navigate(crumb.path)}>
                    {crumb.label}
                  </button>
                  <span className="breadcrumb-sep">/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;

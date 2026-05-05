/**
 * CommandPalette.jsx — Global Cross-System Search (Ctrl+K)
 *
 * Searches across characters, stories, locations, threads, timeline events, and books.
 * Mounted in App.jsx as a global overlay.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';

// ─── Track 6 CP7 module-scope helper (Pattern F prophylactic — Api suffix) ───
export const searchStoryHealthApi = (query) =>
  apiClient.get(`/api/v1/story-health/search?q=${encodeURIComponent(query)}`);

const RESULT_ROUTES = {
  character: (r) => `/character-registry?search=${encodeURIComponent(r.display_name || r.character_key)}`,
  story:     (r) => `/story-engine`,
  location:  (r) => `/world-studio?tab=locations`,
  thread:    (r) => `/story-threads`,
  event:     (r) => `/story-calendar`,
  book:      (r) => `/storyteller?book=${r.id}`,
};

const RESULT_ICONS = {
  character: '◎',
  story:     '◈',
  location:  '🏛',
  thread:    '⧖',
  event:     '◉',
  book:      '◇',
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
        setQuery('');
        setResults([]);
        setHighlight(0);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Auto-focus input
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback((q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q || q.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchStoryHealthApi(q);
        setResults(res.data?.results || []);
        setHighlight(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    doSearch(val);
  };

  const selectResult = (r) => {
    const routeFn = RESULT_ROUTES[r.result_type];
    if (routeFn) {
      navigate(routeFn(r));
    }
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && results[highlight]) {
      selectResult(results[highlight]);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div style={{
        width: '100%', maxWidth: 560, background: '#fff',
        borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        border: '1px solid #e0dcd4', overflow: 'hidden',
      }}>
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #e8e5de' }}>
          <span style={{ fontSize: 16, marginRight: 10, color: '#999' }}>⌘</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Search characters, stories, locations, threads…"
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 15,
              fontFamily: "'DM Sans', sans-serif", color: '#1c1917',
              background: 'transparent',
            }}
          />
          <kbd style={{
            fontSize: 10, color: '#999', border: '1px solid #ddd',
            borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace',
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: 14, textAlign: 'center', color: '#999', fontSize: 12 }}>Searching…</div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div style={{ padding: 14, textAlign: 'center', color: '#999', fontSize: 12 }}>No results found</div>
          )}
          {results.map((r, i) => (
            <div
              key={`${r.result_type}-${r.id}`}
              onClick={() => selectResult(r)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', cursor: 'pointer',
                background: highlight === i ? '#f6f3ef' : 'transparent',
                borderBottom: '1px solid #f4f2ee',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              <span style={{ fontSize: 16, width: 24, textAlign: 'center', opacity: 0.7 }}>
                {RESULT_ICONS[r.result_type] || '•'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1c1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.display_name || r.title || r.name || r.character_key || 'Untitled'}
                </div>
                <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {r.result_type}{r.character_key ? ` · ${r.character_key}` : ''}{r.status ? ` · ${r.status}` : ''}
                </div>
              </div>
              <span style={{ fontSize: 10, color: '#ccc' }}>↵</span>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        {!query && (
          <div style={{ padding: '10px 16px', fontSize: 11, color: '#bbb', textAlign: 'center', borderTop: '1px solid #f4f2ee' }}>
            Search across all characters, stories, locations, threads, events, and books
          </div>
        )}
      </div>
    </div>
  );
}

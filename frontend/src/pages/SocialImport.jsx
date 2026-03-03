/**
 * SocialImport.jsx — Social Media Import Pipeline
 *
 * Page for importing social media content (Instagram, Twitter, TikTok, etc.)
 * and running AI analysis to detect voice, emotion, and Lala emergence.
 *
 * Route: /social-import
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './SocialImport.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const CHARACTERS = {
  justawoman: { display_name: 'JustAWoman', icon: '♛', color: '#9a7d1e' },
  david:      { display_name: 'David',      icon: '◈', color: '#c0392b' },
  dana:       { display_name: 'Dana',       icon: '◉', color: '#0d9668' },
  chloe:      { display_name: 'Chloe',      icon: '◎', color: '#7c3aed' },
  jade:       { display_name: 'Jade',       icon: '◆', color: '#546678' },
  lala:       { display_name: 'Lala',        icon: '✦', color: '#d63384' },
};

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'twitter',   label: 'Twitter/X', icon: '🐦' },
  { id: 'tiktok',    label: 'TikTok',    icon: '🎵' },
  { id: 'youtube',   label: 'YouTube',   icon: '▶️' },
  { id: 'reddit',    label: 'Reddit',    icon: '🔵' },
  { id: 'custom',    label: 'Custom',    icon: '📝' },
];

const STATUS_COLORS = {
  pending:  '#9a7d1e',
  canon:    '#0d9668',
  rejected: '#c0392b',
  archived: '#546678',
};

// ── Import Form ────────────────────────────────────────────────────────────
function ImportForm({ selectedChar, onImported }) {
  const [platform, setPlatform] = useState('instagram');
  const [sourceUrl, setSourceUrl] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  async function handleImport() {
    if (!rawContent.trim()) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/stories/social/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_key: selectedChar,
          platform,
          source_url: sourceUrl || undefined,
          raw_content: rawContent,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ type: 'success', data: data.import });
        setRawContent('');
        setSourceUrl('');
        onImported?.(data.import);
      } else {
        setResult({ type: 'error', message: data.error });
      }
    } catch (err) {
      setResult({ type: 'error', message: err.message });
    } finally {
      setImporting(false);
    }
  }

  const char = CHARACTERS[selectedChar];

  return (
    <div className="si-form">
      <div className="si-form-header" style={{ borderColor: char?.color }}>
        <span className="si-form-icon">{char?.icon}</span>
        <span>Import for {char?.display_name}</span>
      </div>

      {/* Platform picker */}
      <div className="si-platform-row">
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            className={`si-platform-btn ${platform === p.id ? 'active' : ''}`}
            onClick={() => setPlatform(p.id)}
          >
            <span>{p.icon}</span>
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      {/* Source URL (optional) */}
      <input
        className="si-url-input"
        type="text"
        placeholder="Source URL (optional)"
        value={sourceUrl}
        onChange={e => setSourceUrl(e.target.value)}
      />

      {/* Content textarea */}
      <textarea
        className="si-content-input"
        placeholder={`Paste ${PLATFORMS.find(p => p.id === platform)?.label} content here…\n\nCopy the full post, caption, thread, or comment. AI will analyze voice, emotion, and Lala emergence.`}
        value={rawContent}
        onChange={e => setRawContent(e.target.value)}
        rows={8}
      />

      <div className="si-form-footer">
        <span className="si-char-count">{rawContent.length} chars</span>
        <button
          className="si-import-btn"
          style={{ background: char?.color }}
          onClick={handleImport}
          disabled={importing || !rawContent.trim()}
        >
          {importing ? 'Analyzing…' : 'Import & Analyze'}
        </button>
      </div>

      {/* Result */}
      {result?.type === 'success' && (
        <div className="si-result si-result-success">
          <div className="si-result-title">✓ Imported & Analyzed</div>
          {result.data.detected_voice && (
            <div className="si-result-voice">Voice: <strong>{result.data.detected_voice}</strong></div>
          )}
          {result.data.lala_detected && (
            <div className="si-result-lala">✦ Lala Emergence Detected</div>
          )}
          {result.data.emotional_tags?.length > 0 && (
            <div className="si-result-tags">
              {result.data.emotional_tags.map((tag, i) => (
                <span key={i} className="si-tag">{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}
      {result?.type === 'error' && (
        <div className="si-result si-result-error">Error: {result.message}</div>
      )}
    </div>
  );
}

// ── Import Card ────────────────────────────────────────────────────────────
function ImportCard({ item, onStatusChange, onDetectLala, onDelete }) {
  const platformInfo = PLATFORMS.find(p => p.id === item.platform);
  const [detecting, setDetecting] = useState(false);

  async function handleDetectLala() {
    setDetecting(true);
    try {
      await onDetectLala(item.id);
    } finally {
      setDetecting(false);
    }
  }

  return (
    <div className={`si-card ${item.lala_detected ? 'si-card-lala' : ''}`}>
      <div className="si-card-header">
        <span className="si-card-platform">{platformInfo?.icon} {platformInfo?.label}</span>
        <span
          className="si-card-status"
          style={{ color: STATUS_COLORS[item.canon_status] }}
        >
          {item.canon_status}
        </span>
        <span className="si-card-date">
          {new Date(item.created_at).toLocaleDateString()}
        </span>
      </div>

      <div className="si-card-content">
        {item.raw_content.slice(0, 200)}
        {item.raw_content.length > 200 && '…'}
      </div>

      {item.detected_voice && (
        <div className="si-card-voice">
          <span className="si-card-voice-label">Voice:</span> {item.detected_voice}
        </div>
      )}

      {item.emotional_tags?.length > 0 && (
        <div className="si-card-tags">
          {item.emotional_tags.map((tag, i) => (
            <span key={i} className="si-tag">{tag}</span>
          ))}
        </div>
      )}

      {item.lala_detected && (
        <div className="si-card-lala-badge">
          ✦ Lala Detected
          {item.lala_markers?.length > 0 && (
            <span className="si-lala-count"> · {item.lala_markers.length} markers</span>
          )}
        </div>
      )}

      {item.lala_markers?.length > 0 && (
        <div className="si-lala-markers">
          {item.lala_markers.map((m, i) => (
            <div key={i} className="si-lala-marker">
              <span className="si-lala-marker-type">{m.type?.replace(/_/g, ' ')}</span>
              {m.excerpt && <span className="si-lala-marker-excerpt">"{m.excerpt}"</span>}
            </div>
          ))}
        </div>
      )}

      <div className="si-card-actions">
        <select
          className="si-card-status-select"
          value={item.canon_status}
          onChange={e => onStatusChange(item.id, e.target.value)}
        >
          <option value="pending">Pending</option>
          <option value="canon">Canon</option>
          <option value="rejected">Rejected</option>
          <option value="archived">Archived</option>
        </select>

        {!item.lala_detected && (
          <button
            className="si-card-btn si-card-btn-lala"
            onClick={handleDetectLala}
            disabled={detecting}
          >
            {detecting ? '…' : '✦ Detect Lala'}
          </button>
        )}

        <button
          className="si-card-btn si-card-btn-delete"
          onClick={() => onDelete(item.id)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function SocialImport({ embedded = false }) {
  const navigate = useNavigate();
  const [selectedChar, setSelectedChar] = useState('justawoman');
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all | canon | pending | lala

  const char = CHARACTERS[selectedChar];

  const loadImports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stories/social/character/${selectedChar}`);
      if (res.ok) {
        const data = await res.json();
        setImports(data.imports || []);
      }
    } catch (err) {
      console.error('Load imports error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedChar]);

  useEffect(() => {
    loadImports();
  }, [loadImports]);

  function handleImported() {
    loadImports();
  }

  async function handleStatusChange(id, newStatus) {
    try {
      await fetch(`${API_BASE}/stories/social/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canon_status: newStatus }),
      });
      setImports(prev => prev.map(imp =>
        imp.id === id ? { ...imp, canon_status: newStatus } : imp
      ));
    } catch (err) {
      console.error('Status change error:', err);
    }
  }

  async function handleDetectLala(id) {
    try {
      const res = await fetch(`${API_BASE}/stories/social/${id}/detect-lala`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.import) {
          setImports(prev => prev.map(imp =>
            imp.id === id ? data.import : imp
          ));
        }
      }
    } catch (err) {
      console.error('Lala detection error:', err);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this import?')) return;
    try {
      await fetch(`${API_BASE}/stories/social/${id}`, { method: 'DELETE' });
      setImports(prev => prev.filter(imp => imp.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
    }
  }

  // Filter imports
  let filtered = imports;
  if (filter === 'canon') filtered = imports.filter(i => i.canon_status === 'canon');
  else if (filter === 'pending') filtered = imports.filter(i => i.canon_status === 'pending');
  else if (filter === 'lala') filtered = imports.filter(i => i.lala_detected);

  const lalaCount = imports.filter(i => i.lala_detected).length;
  const canonCount = imports.filter(i => i.canon_status === 'canon').length;

  return (
    <div className="si-page">
      {/* Top bar — hidden when embedded in Universe page */}
      {!embedded && (
        <div className="si-topbar">
          <button className="si-btn-back" onClick={() => navigate('/')}>← Home</button>
          <div className="si-topbar-title">Social Import Pipeline</div>
          <div className="si-topbar-stats">
            <span>{imports.length} imports</span>
            <span>{canonCount} canon</span>
            {lalaCount > 0 && <span className="si-topbar-lala">✦ {lalaCount} Lala</span>}
          </div>
        </div>
      )}

      {/* Character bar */}
      <div className="si-char-bar">
        {Object.entries(CHARACTERS).map(([key, c]) => (
          <button
            key={key}
            className={`si-char-pill ${selectedChar === key ? 'active' : ''}`}
            style={{ '--char-color': c.color }}
            onClick={() => setSelectedChar(key)}
          >
            <span>{c.icon}</span>
            <span>{c.display_name}</span>
          </button>
        ))}
      </div>

      <div className="si-workspace">
        {/* Left: Import form */}
        <div className="si-form-column">
          <ImportForm selectedChar={selectedChar} onImported={handleImported} />
        </div>

        {/* Right: Import list */}
        <div className="si-list-column">
          {/* Filter bar */}
          <div className="si-filter-bar">
            {['all', 'pending', 'canon', 'lala'].map(f => (
              <button
                key={f}
                className={`si-filter-btn ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'lala' ? '✦ Lala' : f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'all' && ` (${imports.length})`}
                {f === 'lala' && ` (${lalaCount})`}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="si-loading">Loading imports…</div>
          ) : filtered.length === 0 ? (
            <div className="si-empty">
              <div className="si-empty-icon" style={{ color: char?.color }}>{char?.icon}</div>
              <div>No imports found{filter !== 'all' ? ` for "${filter}" filter` : ''}</div>
              <div className="si-empty-hint">Paste content in the form to start importing.</div>
            </div>
          ) : (
            <div className="si-card-list">
              {filtered.map(item => (
                <ImportCard
                  key={item.id}
                  item={item}
                  onStatusChange={handleStatusChange}
                  onDetectLala={handleDetectLala}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

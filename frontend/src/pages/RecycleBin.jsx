/**
 * RecycleBin.jsx
 * Manual restore page — shows all soft-deleted items grouped by type.
 * Route: /recycle-bin
 */

import { useState, useEffect, useCallback } from 'react';
import './RecycleBin.css';

const API = '/api/v1/memories';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function daysUntilPurge(dateStr) {
  if (!dateStr) return 30;
  const deleted = new Date(dateStr).getTime();
  const purgeAt = deleted + 30 * 86400000;
  const remaining = Math.ceil((purgeAt - Date.now()) / 86400000);
  return Math.max(0, remaining);
}

export default function RecycleBin() {
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState('all');
  const [confirming,  setConfirming]  = useState(null);
  const [working,     setWorking]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/recycle-bin`);
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const restore = async (type, id) => {
    setWorking(id);
    try {
      await fetch(`${API}/recycle-bin/restore`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type, id }),
      });
      await load();
    } finally {
      setWorking(null);
    }
  };

  const permanentDelete = async (type, id) => {
    setWorking(id);
    try {
      await fetch(`${API}/recycle-bin/${type}/${id}`, { method: 'DELETE' });
      setConfirming(null);
      await load();
    } finally {
      setWorking(null);
    }
  };

  const total = data
    ? (data.books?.length || 0) + (data.chapters?.length || 0) + (data.lines?.length || 0) +
      (data.characters?.length || 0) + (data.beats?.length || 0)
    : 0;

  const tabs = [
    { id: 'all',        label: 'All',        count: total },
    { id: 'books',      label: 'Books',      count: data?.books?.length      || 0 },
    { id: 'chapters',   label: 'Chapters',   count: data?.chapters?.length   || 0 },
    { id: 'lines',      label: 'Lines',      count: data?.lines?.length      || 0 },
    { id: 'characters', label: 'Characters', count: data?.characters?.length || 0 },
    { id: 'beats',      label: 'Beats',      count: data?.beats?.length      || 0 },
  ].filter(t => t.id === 'all' || t.count > 0);

  const getItems = () => {
    if (!data) return [];
    const all = [
      ...(data.books      || []).map(i => ({ ...i, itemType: 'book' })),
      ...(data.chapters   || []).map(i => ({ ...i, itemType: 'chapter' })),
      ...(data.lines      || []).map(i => ({ ...i, itemType: 'line' })),
      ...(data.characters || []).map(i => ({ ...i, itemType: 'character' })),
      ...(data.beats      || []).map(i => ({ ...i, itemType: 'beat' })),
    ].sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));

    if (activeTab === 'all') return all;
    return all.filter(i => i.itemType === activeTab.replace(/s$/, ''));
  };

  const items = getItems();

  return (
    <div className="rb-root">
      <div className="rb-header">
        <div className="rb-header-left">
          <h1 className="rb-title">Recycle Bin</h1>
          <p className="rb-subtitle">Deleted items are kept for 30 days, then purged automatically.</p>
        </div>
        {total > 0 && (
          <div className="rb-total">{total} item{total !== 1 ? 's' : ''}</div>
        )}
      </div>

      {/* Tabs */}
      {!loading && total > 0 && (
        <div className="rb-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`rb-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.count > 0 && <span className="rb-tab-count">{tab.count}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="rb-content">
        {loading && (
          <div className="rb-empty">
            <div className="rb-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </div>
            <p>Loading...</p>
          </div>
        )}

        {!loading && total === 0 && (
          <div className="rb-empty">
            <div className="rb-empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <p>Nothing in the bin.</p>
            <p className="rb-empty-sub">Deleted items appear here and can be restored anytime within 30 days.</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="rb-list">
            {items.map(item => {
              const purge    = daysUntilPurge(item.deleted_at);
              const isUrgent = purge <= 3;

              return (
                <div key={`${item.itemType}-${item.id}`} className={`rb-item rb-item--${item.itemType}`}>
                  <div className="rb-item-type-badge">{item.itemType}</div>

                  <div className="rb-item-main">
                    <div className="rb-item-name">
                      {item.title || item.name || (item.preview ? `"${item.preview}..."` : 'Untitled')}
                    </div>
                    <div className="rb-item-meta">
                      {item.book_title    && <span>{item.book_title}</span>}
                      {item.chapter_title && <span>· {item.chapter_title}</span>}
                      {item.char_type     && <span>· {item.char_type}</span>}
                      {item.location      && <span>· {item.location}</span>}
                    </div>
                  </div>

                  <div className="rb-item-right">
                    <div className={`rb-item-purge${isUrgent ? ' urgent' : ''}`}>
                      {isUrgent ? `Purges in ${purge}d` : `${timeAgo(item.deleted_at)}`}
                    </div>

                    <div className="rb-item-actions">
                      <button
                        className="rb-restore-btn"
                        onClick={() => restore(item.itemType, item.id)}
                        disabled={working === item.id}
                      >
                        {working === item.id ? '...' : 'Restore'}
                      </button>

                      {confirming === item.id ? (
                        <div className="rb-confirm-row">
                          <span className="rb-confirm-text">Delete forever?</span>
                          <button
                            className="rb-confirm-yes"
                            onClick={() => permanentDelete(item.itemType, item.id)}
                            disabled={working === item.id}
                          >
                            Yes
                          </button>
                          <button
                            className="rb-confirm-no"
                            onClick={() => setConfirming(null)}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          className="rb-delete-btn"
                          onClick={() => setConfirming(item.id)}
                          disabled={working === item.id}
                        >
                          Delete forever
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

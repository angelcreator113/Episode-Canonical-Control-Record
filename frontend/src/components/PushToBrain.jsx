import { useState } from 'react';

const API = import.meta.env.VITE_API_URL || '/api/v1';

/**
 * "Push to Brain" button — sends page data through the franchise brain ingest pipeline.
 * Props: pageName (string), data (object — the usePageData data map)
 */
export default function PushToBrain({ pageName, data }) {
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState(null);

  async function handlePush() {
    if (pushing) return;
    if (!confirm('Push this page\'s data to the Franchise Brain? Entries will be created as Pending Review.')) return;
    setPushing(true);
    setResult(null);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API}/franchise-brain/push-from-page`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ page_name: pageName, page_data: data }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Push failed');
      }
      const d = await res.json();
      setResult({ ok: true, msg: d.message || `Pushed ${d.entries_created} entries` });
    } catch (e) {
      setResult({ ok: false, msg: e.message });
    } finally {
      setPushing(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button
        onClick={handlePush}
        disabled={pushing}
        style={{
          padding: '5px 12px',
          fontSize: 12,
          fontWeight: 600,
          borderRadius: 6,
          border: '1px solid #c9a96e',
          background: pushing ? '#e8e0d4' : '#faf6f0',
          color: '#b8863e',
          cursor: pushing ? 'wait' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {pushing ? '⏳ Pushing...' : '🧠 Push to Brain'}
      </button>
      {result && (
        <span style={{ fontSize: 11, color: result.ok ? '#3a8a60' : '#b84040', fontWeight: 500 }}>
          {result.msg}
        </span>
      )}
    </span>
  );
}

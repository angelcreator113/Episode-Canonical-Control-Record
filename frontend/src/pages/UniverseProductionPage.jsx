/**
 * UniverseProductionPage.jsx
 * Standalone page wrapper for ProductionTab
 * Route: /universe/production
 */

import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/api';
import ProductionTab from './ProductionTab';
import './UniversePage.css';

const SHOWS_API = '/api/v1/shows';
const LALAVERSE_ID = 'a0cc3869-7d55-4d4c-8cf8-c2b66300bf6e';

// File-local cross-CP duplicate per v2.12 §9.11 — listShowsApi reaches
// 5-fold cross-CP existence after CP15 (6-fold including WorldSetupGuide).
// Path A (continue file-local convention) per CP15 Decision 2.
export const listShowsApi = () =>
  apiClient.get(SHOWS_API).then((r) => r.data);

function useWindowWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

export default function UniverseProductionPage() {
  const width = useWindowWidth();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const shData = await listShowsApi();
      const showsList = shData.data || shData.shows || shData;
      setShows(Array.isArray(showsList) ? showsList : []);
    } catch (_) {
      setShows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="up-loading">Loading production…</div>;

  return (
    <div className="up-shell">
      <div className="up-tab-content" style={isMobile ? { padding: '0 16px' } : isTablet ? { padding: '0 28px' } : undefined}>
        <ProductionTab
          shows={shows}
          universeId={LALAVERSE_ID}
          onChanged={() => { load(); showToast('Show updated'); }}
          showToast={showToast}
          isMobile={isMobile}
          isTablet={isTablet}
        />
      </div>
      {toast && (
        <div className={`up-toast ${toast.type === 'error' ? 'up-toast--error' : 'up-toast--success'}`}>{toast.msg}</div>
      )}
    </div>
  );
}

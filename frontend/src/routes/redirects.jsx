/**
 * Addresses that moved, kept working (Task #3157; pinned by
 * redirects.test.jsx, and App.jsx mounts them):
 *   /feed     → /pulse, with its query and hash. The Feed is The Pulse
 *               (Task #2912); its old ?layer= and other links still open
 *               the same view.
 *   /website  → /admin?tab=website. The Website page is Admin's Website tab
 *               (Task #2913).
 *   /book/:id → the book's first chapter in Write Mode, or /universe when
 *               the book has no chapter or does not load.
 */
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../services/api';

export function PulseRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={`/pulse${search}${hash}`} replace />;
}

export function WebsiteRedirect() {
  return <Navigate to="/admin?tab=website" replace />;
}

export function BookToWriteRedirect() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();
  useEffect(() => {
    apiClient.get(`/api/v1/storyteller/books/${id}`)
      .then(r => r.data)
      .then(data => {
        // GET /storyteller/books/:id answers { success, book } with the
        // chapters inside the book; reading data.chapters found none, so
        // every book went to /storyteller, which is the show's Stories.
        const book = data?.book || data || {};
        const chapters = Array.isArray(book.chapters) ? book.chapters : [];
        if (chapters.length > 0) {
          const sorted = [...chapters].sort((a, b) => (a.sort_order ?? a.order ?? a.chapter_number ?? 0) - (b.sort_order ?? b.order ?? b.chapter_number ?? 0));
          nav(`/chapter/${id}/${sorted[0].id}`, { replace: true });
        } else {
          // No chapter yet: back to the books, in the Universe.
          nav('/universe', { replace: true });
        }
      })
      .catch((err) => { console.error('[BookToWriteRedirect] book load failed:', err); nav('/universe', { replace: true }); })
      .finally(() => setLoading(false));
  }, [id, nav]);
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Lora,serif',color:'rgba(28,24,20,0.4)'}}>Opening book…</div>;
  return null;
}

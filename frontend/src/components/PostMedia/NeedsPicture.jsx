/**
 * Posts with no picture (Visual Memory phase 2; Evoni, 2026-10-19: "Picture
 * suggestions for old posts"): each text-only post, with the poster's
 * library pictures that fit its caption. Attaching one never changes the
 * caption. For one character (characterId) or a whole show (showId)
 * (GET /api/v1/post-media/needs-picture; services/postMedia).
 */
import { useState, useEffect, useCallback } from 'react';
import { ImageOff } from 'lucide-react';
import api from '../../services/api';
import PostPictures from './PostPictures';
import './NeedsPicture.css';

const errorText = (err, fallback) => err?.response?.data?.error || fallback;

export default function NeedsPicture({ showId = null, characterId = null }) {
  const [posts, setPosts] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (showId) q.set('show_id', showId);
      if (characterId) q.set('character_id', characterId);
      const { data } = await api.get(`/api/v1/post-media/needs-picture?${q.toString()}`);
      setPosts(data.posts || []);
    } catch (err) {
      console.error('[NeedsPicture] the posts could not be read:', err);
      setError(errorText(err, 'The posts could not be loaded.'));
      setPosts([]);
    }
  }, [showId, characterId]);
  useEffect(() => { load(); }, [load]);

  if (posts === null) return null;
  return (
    <details className="np" data-testid="needs-picture">
      <summary className="np-title"><ImageOff size={15} aria-hidden /> Posts that could use a picture ({posts.length})</summary>
      {error && <p className="np-error" role="alert">{error}</p>}
      {!posts.length && !error && <p className="np-muted">Every post has a picture.</p>}
      <ul className="np-list">
        {posts.map((p) => (
          <li key={p.id} className="np-item" data-testid="np-post">
            <p className="np-text">{p.content_text}</p>
            <p className="np-muted">{p.name}{p.status === 'draft' ? ' · draft' : ''}</p>
            {open === p.id
              ? <PostPictures postId={p.id} onSaved={load} />
              : <button type="button" className="np-btn" onClick={() => setOpen(p.id)}>Find a picture</button>}
          </li>
        ))}
      </ul>
    </details>
  );
}

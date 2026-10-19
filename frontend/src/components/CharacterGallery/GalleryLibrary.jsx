/**
 * Visual Memory, phase 1 (Evoni, 2026-10-18; services/mediaLibrary, /api/v1/media):
 * the shared picture library inside the character's gallery. Shown to an
 * ADMIN only (the gallery's `can_edit`):
 *
 *   AddPicture      upload a picture (or give its address), caption it, say
 *                   who may see it, and tag who and what else is in it; it is
 *                   tagged with this character and shows in each tagged
 *                   one's gallery. The same picture is never stored twice.
 *   PictureLibrary  in the larger view: the picture's tags (remove, add),
 *                   its status and who may see it; a picture not in the
 *                   library yet can be added to it.
 *   BringExisting   carries portraits, scene stills, invitations and post
 *                   pictures into the library, tagged with what they belong to.
 *
 * A picture is not a story fact: tagging never records that anything happened.
 */
import { useState, useEffect } from 'react';
import { ImagePlus, Tag, X, Search, Library } from 'lucide-react';
import api from '../../services/api';
import { MakeVariation, PictureFamily } from '../MediaVariations/MakeVariation';
import './GalleryLibrary.css';

const errorText = (err, fallback) => err?.response?.data?.error || fallback;
const TYPE_WORDS = { character: 'Character', scene_set: 'Place', event: 'Event', brand: 'Brand', post: 'Post', episode: 'Episode', deal: 'Deal', wardrobe: 'Wardrobe' };
export const VISIBILITY_WORDS = { private: 'Only me', internal: 'The studio', public: 'Public (can go on The Pulse)' };
const STATUS_WORDS = { draft: 'Draft', approved: 'Approved', archived: 'Archived' };
// Where a gallery picture came from, as the library's source.
const SOURCE_OF = { profile_photo: 'portrait', cover_photo: 'cover', portrait: 'portrait', scene_set: 'scene_set', venue: 'venue', invitation: 'invitation', event_set: 'event_set', post: 'post', draft_post: 'post' };

/** A search box over characters, places, events and brands (or only `only`, a kind); picking one calls onPick. */
export function TagSearch({ onPick, exclude = [], label = 'Tag who or what else is in it', only = null }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  // By value, so a new list with the same tags does not search again.
  const excludeKey = exclude.map((x) => `${x.entity_type}:${x.entity_id}`).sort().join(',');
  useEffect(() => {
    const skip = new Set(excludeKey ? excludeKey.split(',') : []);
    const term = q.trim();
    if (term.length < 2) { setFound([]); return undefined; }
    let live = true;
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/api/v1/media/taggables?q=${encodeURIComponent(term)}`);
        if (live) setFound((data.items || []).filter((i) => !skip.has(`${i.entity_type}:${i.entity_id}`) && (!only || i.entity_type === only)));
      } catch (err) {
        console.error('[GalleryLibrary] the tag search failed:', err);
        if (live) setFound([]);
      }
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, excludeKey, only]);
  return (
    <div className="gl-search">
      <label className="gl-label">
        <span><Search size={13} aria-hidden /> {label}</span>
        <input className="gl-input" type="search" value={q} placeholder="A name" onChange={(e) => setQ(e.target.value)} />
      </label>
      {found.length > 0 && (
        <ul className="gl-found" role="listbox" aria-label="Matches">
          {found.map((f) => (
            <li key={`${f.entity_type}:${f.entity_id}`}>
              <button type="button" className="gl-found-btn" onClick={() => { onPick(f); setQ(''); setFound([]); }}>
                {f.name} <span className="gl-muted">{TYPE_WORDS[f.entity_type] || f.entity_type}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chips({ tags, onRemove }) {
  return (
    <ul className="gl-chips">
      {tags.map((t) => (
        <li key={t.id || `${t.entity_type}:${t.entity_id}`} className="gl-chip">
          <Tag size={12} aria-hidden /> {t.name || TYPE_WORDS[t.entity_type]}
          {onRemove && (
            <button type="button" className="gl-chip-x" aria-label={`Untag ${t.name || t.entity_type}`} onClick={() => onRemove(t)}><X size={12} aria-hidden /></button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AddPicture({ character, onAdded }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState('internal');
  const [tags, setTags] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const name = character.selected_name || character.display_name;
  const self = { entity_type: 'character', entity_id: character.id, name };

  const reset = () => { setFile(null); setUrl(''); setCaption(''); setVisibility('internal'); setTags([]); setError(null); };
  const save = async (e) => {
    e.preventDefault();
    if (!file && !url.trim()) { setError('Choose a picture or give its address.'); return; }
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      if (file) form.append('image', file); else form.append('url', url.trim());
      if (caption.trim()) form.append('caption', caption.trim());
      form.append('visibility', visibility);
      form.append('links', JSON.stringify([self, ...tags].map(({ entity_type: t, entity_id: id }) => ({ entity_type: t, entity_id: id }))));
      const { data } = await api.post('/api/v1/media', form);
      reset(); setOpen(false);
      onAdded?.(data);
    } catch (err) {
      console.error('[GalleryLibrary] the picture could not be added:', err);
      setError(errorText(err, 'The picture could not be added. Try again.'));
    } finally { setBusy(false); }
  };

  if (!open) {
    return <button type="button" className="gl-btn" onClick={() => setOpen(true)}><ImagePlus size={15} aria-hidden /> Add a picture</button>;
  }
  return (
    <form className="gl-form" onSubmit={save} data-testid="gallery-add">
      <label className="gl-label"><span>A picture</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>
      {!file && (
        <label className="gl-label"><span>Or its address</span>
          <input className="gl-input" type="url" value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} />
        </label>
      )}
      <label className="gl-label"><span>Caption</span>
        <input className="gl-input" value={caption} maxLength={500} onChange={(e) => setCaption(e.target.value)} />
      </label>
      <label className="gl-label"><span>Who may see it</span>
        <select className="gl-input" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          {Object.entries(VISIBILITY_WORDS).map(([v, w]) => <option key={v} value={v}>{w}</option>)}
        </select>
      </label>
      <Chips tags={[self, ...tags]} onRemove={(t) => setTags((ts) => ts.filter((x) => !(x.entity_type === t.entity_type && x.entity_id === t.entity_id)))} />
      <TagSearch exclude={[self, ...tags]} onPick={(f) => setTags((ts) => [...ts, f])} />
      <p className="gl-muted">A picture is not a story fact: tagging someone doesn't record that they were there.</p>
      {error && <p className="gl-error" role="alert">{error}</p>}
      <div className="gl-actions">
        <button type="submit" className="gl-btn" disabled={busy}>{busy ? 'Adding…' : 'Add to the gallery'}</button>
        <button type="button" className="gl-btn is-quiet" disabled={busy} onClick={() => { reset(); setOpen(false); }}>Cancel</button>
      </div>
    </form>
  );
}

export function PictureLibrary({ item, character, onChanged }) {
  const [asset, setAsset] = useState(item.asset || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { setAsset(item.asset || null); }, [item]);

  const act = async (fn, fallback) => {
    setBusy(true); setError(null);
    try {
      const next = await fn();
      if (next) setAsset(next);
      onChanged?.();
    } catch (err) {
      console.error('[GalleryLibrary] the change did not save:', err);
      setError(errorText(err, fallback));
    } finally { setBusy(false); }
  };

  if (!asset) {
    const addToLibrary = () => act(async () => {
      const draft = item.source === 'draft_post';
      const { data } = await api.post('/api/v1/media', {
        url: item.url, caption: item.caption, source: SOURCE_OF[item.source] || 'upload',
        status: draft ? 'draft' : 'approved', visibility: draft ? 'private' : 'internal',
        links: JSON.stringify([{ entity_type: 'character', entity_id: character.id }]),
      });
      return data.asset;
    }, 'It could not be added to the library.');
    return (
      <div className="gl-panel" data-testid="gallery-picture-library">
        <p className="gl-muted">Not in the library yet: add it to tag who and what else is in it.</p>
        <button type="button" className="gl-btn" disabled={busy} onClick={addToLibrary}><Library size={14} aria-hidden /> Add to the library</button>
        {error && <p className="gl-error" role="alert">{error}</p>}
      </div>
    );
  }

  const base = `/api/v1/media/${asset.id}`;
  return (
    <div className="gl-panel" data-testid="gallery-picture-library">
      <Chips
        tags={asset.links || []}
        onRemove={busy ? null : (t) => act(async () => (await api.delete(`${base}/links/${t.id}`)).data.asset, 'The tag could not be removed.')}
      />
      <TagSearch
        exclude={asset.links || []}
        onPick={(f) => act(async () => (await api.post(`${base}/links`, { entity_type: f.entity_type, entity_id: f.entity_id })).data.asset, 'The tag could not be added.')}
      />
      <div className="gl-row">
        <label className="gl-label"><span>Status</span>
          <select className="gl-input" value={asset.status} disabled={busy}
            onChange={(e) => act(async () => (await api.put(base, { status: e.target.value })).data.asset, 'The status did not save.')}>
            {Object.entries(STATUS_WORDS).map(([v, w]) => <option key={v} value={v}>{w}</option>)}
          </select>
        </label>
        <label className="gl-label"><span>Who may see it</span>
          <select className="gl-input" value={asset.visibility} disabled={busy}
            onChange={(e) => act(async () => (await api.put(base, { visibility: e.target.value })).data.asset, 'Who may see it did not save.')}>
            {Object.entries(VISIBILITY_WORDS).map(([v, w]) => <option key={v} value={v}>{w}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="gl-error" role="alert">{error}</p>}
      {/* Visual Memory phase 3: a variation of this picture, and the family it belongs to. */}
      <MakeVariation asset={asset} onMade={onChanged} />
      <PictureFamily assetId={asset.id} />
    </div>
  );
}

export function BringExisting({ onDone }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const run = async () => {
    setBusy(true); setNote(null);
    try {
      const { data } = await api.post('/api/v1/media/bring-existing');
      setNote(data.pictures || data.tags ? `Added ${data.pictures} picture${data.pictures === 1 ? '' : 's'} and ${data.tags} tag${data.tags === 1 ? '' : 's'}.` : 'Everything was already in the library.');
      onDone?.();
    } catch (err) {
      console.error('[GalleryLibrary] bringing pictures in failed:', err);
      setNote(errorText(err, 'That did not work. Try again.'));
    } finally { setBusy(false); }
  };
  return (
    <span className="gl-bring">
      <button type="button" className="gl-link" disabled={busy} onClick={run}>{busy ? 'Bringing pictures in…' : 'Bring existing pictures into the library'}</button>
      {note && <span className="gl-muted" role="status"> {note}</span>}
    </span>
  );
}

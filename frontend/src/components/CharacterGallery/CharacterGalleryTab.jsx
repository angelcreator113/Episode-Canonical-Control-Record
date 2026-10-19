/**
 * Gallery (Evoni, 2026-10-18: "we need a separate tab for the gallery now
 * this tab will get over crowded"): every picture already linked to the
 * character, grouped: portraits, places, wardrobe, events and posts.
 * Reads only (GET /api/v1/cast/characters/:id/gallery,
 * services/characterGallery); portraits are made on the Appearance tab and
 * places linked on the Places & Gallery tab. A picture opens larger on click.
 * Evoni, 2026-10-18: "maybe the gallery and places tab should be one": it
 * sits under their places there, with `hide` leaving out the places group
 * the place editor above already shows.
 * Visual Memory, phase 1 (2026-10-18): a "Tagged" group holds the shared
 * library's pictures tagged with them; an ADMIN (the read's `can_edit`) can
 * add a picture, tag it with whoever else is in it, and in the larger view
 * edit its tags, status and who may see it (GalleryLibrary).
 */
import { useState, useEffect, useCallback } from 'react';
import { Images, UserRound, MapPin, Shirt, CalendarDays, FileText, X, ExternalLink, Tag } from 'lucide-react';
import api from '../../services/api';
import { AddPicture, PictureLibrary, BringExisting } from './GalleryLibrary';
import NeedsPicture from '../PostMedia/NeedsPicture';
import './CharacterGalleryTab.css';

const GROUP_ICONS = { portraits: UserRound, places: MapPin, wardrobe: Shirt, events: CalendarDays, posts: FileText, tagged: Tag };
// Where each kind of picture is added, for a group with none yet.
const EMPTY = {
  portraits: ['No portraits yet. Make one on the Appearance tab.', 'appearance'],
  places: ['No places with pictures yet. Link their home, closet or work on the Places & Gallery tab.', 'places'],
  wardrobe: ['No wardrobe pieces name them yet.', null],
  events: ['No event invitations or event sets yet.', 'story'],
  posts: ['No posts with photos yet.', 'voice'],
  tagged: ['No other pictures are tagged with them yet.', null],
};
const TAB_WORDS = { appearance: 'Appearance', places: 'Places & Gallery', story: 'Story & Events', voice: 'Voice & Feed' };

export default function CharacterGalleryTab({ character, openTab, hide = [] }) {
  const [state, setState] = useState({ loading: true, groups: [], linked: false, canEdit: false });
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const name = character.selected_name || character.display_name;

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/v1/cast/characters/${character.id}/gallery`);
      setState({ loading: false, groups: data.groups || [], linked: !!data.linked, canEdit: !!data.can_edit });
    } catch (err) {
      console.error('[CharacterGalleryTab] the gallery could not be read:', err);
      setState({ loading: false, groups: [], linked: false, canEdit: false });
      setError(err?.response?.data?.error || 'The gallery could not be loaded.');
    }
  }, [character.id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (state.loading) return <p className="gal-muted">Loading…</p>;
  const groups = state.groups.filter((g) => !hide.includes(g.key));
  const total = groups.reduce((n, g) => n + (g.items || []).length, 0);

  return (
    <div className="gal" data-testid="character-gallery">
      <header className="gal-head">
        <h3><Images size={18} aria-hidden /> Gallery</h3>
        <p className="gal-muted">
          {total ? `${total} picture${total === 1 ? '' : 's'} of ${name} and their world, from across the app.` : `No pictures of ${name} yet.`}
          {!state.linked && ' With no feed profile, their events and posts are not here yet.'}
        </p>
        {state.canEdit && (
          <div className="gal-tools">
            <AddPicture character={character} onAdded={load} />
            <BringExisting onDone={load} />
          </div>
        )}
      </header>
      {error && <p className="gal-error" role="alert">{error}</p>}
      {state.canEdit && state.linked && <NeedsPicture characterId={character.id} />}

      {groups.map((g) => {
        const Icon = GROUP_ICONS[g.key] || Images;
        const items = g.items || [];
        const [emptyText, tab] = EMPTY[g.key] || ['Nothing here yet.', null];
        return (
          <section key={g.key} className="gal-group" data-testid={`gallery-${g.key}`} aria-labelledby={`gal-h-${g.key}`}>
            <h4 id={`gal-h-${g.key}`} className="gal-group-title">
              <Icon size={15} aria-hidden /> {g.label} <span className="gal-count">{items.length}</span>
            </h4>
            {items.length ? (
              <ul className="gal-grid">
                {items.map((it) => (
                  <li key={it.id} className="gal-item">
                    <button type="button" className="gal-thumb" onClick={() => setOpen(it)} aria-label={`Open: ${it.caption}`}>
                      <img src={it.url} alt={it.caption} loading="lazy" />
                    </button>
                    <span className="gal-caption">{it.caption}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="gal-muted">
                {emptyText}
                {tab && openTab && (
                  <> <button type="button" className="gal-link" onClick={() => openTab(tab)}>Open {TAB_WORDS[tab]}</button></>
                )}
              </p>
            )}
          </section>
        );
      })}

      {open && (
        <div className="gal-viewer" role="dialog" aria-modal="true" aria-label={open.caption} onClick={() => setOpen(null)}>
          <figure className="gal-viewer-inner" onClick={(e) => e.stopPropagation()}>
            <img src={open.url} alt={open.caption} />
            <figcaption>
              <span>{open.caption}</span>
              <a href={open.url} target="_blank" rel="noreferrer" className="gal-link"><ExternalLink size={13} aria-hidden /> Open image</a>
              <button type="button" className="gal-close" onClick={() => setOpen(null)} aria-label="Close"><X size={16} aria-hidden /></button>
            </figcaption>
            {state.canEdit && <PictureLibrary item={open} character={character} onChanged={load} />}
          </figure>
        </div>
      )}
    </div>
  );
}

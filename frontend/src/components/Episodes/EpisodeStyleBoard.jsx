/**
 * EpisodeStyleBoard — the top of the episode Overview (Evoni's "Episode
 * Style" mock, 2026-10-16): the event, its dress code, the look's goals,
 * the mood board and inspiration, the wardrobe slots, the look and style
 * notes, as one pink-and-gold board. Since the shorter Overview (Evoni,
 * 2026-10-22 layout list) it is the Overview's Style column: the rewards
 * live in the Stakes band, coins after the episode in the tiles, and the
 * quick tools were the tabs over again.
 *
 * Every card reads data the episode already has: the source event and the
 * locked outfit (EpisodeOverviewTab loads them) and the
 * episode's Lookbook (the Style Page's data, GET /episodes/:id/lookbook;
 * the style sheet is not read here, it inlines every image). Nothing is
 * invented: a card with no data says so and opens the tab where it is made.
 *
 * Empty cards shrink (Evoni, 2026-10-22 Overview layout list): a card with
 * nothing in it is one line in "Still to add", with its link; the wardrobe
 * slots, while none is filled, are a row of small "+ Body" chips. Each card
 * is full size once something is in it.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarHeart, Shirt, Target, Images, Lightbulb, Gem, ShoppingBag, Sparkles,
  Wind, Hand, Footprints, NotebookPen, Plus, Check, Palette,
} from 'lucide-react';
import { lookbookApi } from '../../lib/lookbookApi';
import { atHandle } from '../../pages/feed/feedConstants';
import { resolveEventVenueAndDate } from '../../utils/eventReadiness';
import { gameSlotFor } from '../../lib/closetGrouping';
import './EpisodeStyleBoard.css';

const asList = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return v ? [v] : []; } }
  return [];
};
const asObject = (v) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return p && typeof p === 'object' ? p : {}; } catch { return {}; } }
  return {};
};
const pieceImage = (p) => p?.thumbnail_url || p?.s3_url_processed || p?.s3_url || p?.image_url || null;
const imgOf = (i) => i?.image_url || i?.url || null;

/**
 * The board's seven wardrobe slots. Body and Shoes are the game's required
 * slots (closetGrouping GAME_SLOT_DEFS); Nails come from the Lookbook.
 */
export const BOARD_SLOTS = [
  { key: 'body', label: 'Body', icon: Shirt, required: true, game: ['body', 'top', 'bottom', 'outerwear'] },
  { key: 'shoes', label: 'Shoes', icon: Footprints, required: true, game: ['shoes'] },
  { key: 'bag', label: 'Bag', icon: ShoppingBag, game: ['accessories'] },
  { key: 'jewelry', label: 'Jewelry', icon: Gem, game: ['jewelry'] },
  { key: 'hair', label: 'Hair', icon: Wind, game: ['hair'] },
  { key: 'perfume', label: 'Perfume', icon: Sparkles, game: ['perfume'] },
  { key: 'nails', label: 'Nails', icon: Hand, game: [] },
];

/** The locked outfit's pieces sorted into the board's slots (first piece wins). */
export function slotsFrom(outfit, lookbook) {
  const pieces = Array.isArray(outfit) ? outfit : [];
  return BOARD_SLOTS.map((slot) => {
    const piece = pieces.find((p) => slot.game.includes(gameSlotFor(p.clothing_category || p.category)));
    if (slot.key === 'nails') {
      const photo = (lookbook?.images?.nails || [])[0];
      const name = lookbook?.nails_name || null;
      return { ...slot, filled: !!(photo || name), name, image: imgOf(photo) };
    }
    return { ...slot, filled: !!piece, name: piece?.name || null, image: pieceImage(piece) };
  });
}

/** The look's goals: what the board can check from the Lookbook and the outfit. */
export function styleGoals(slots, lookbook) {
  const palette = asList(lookbook?.palette);
  const words = asList(lookbook?.mood_words);
  return [
    { key: 'body', label: 'Body piece chosen', done: !!slots.find((s) => s.key === 'body')?.filled },
    { key: 'shoes', label: 'Shoes chosen', done: !!slots.find((s) => s.key === 'shoes')?.filled },
    { key: 'hero', label: 'Hero photo on the Style Page', done: (lookbook?.images?.hero || []).length > 0 },
    { key: 'palette', label: 'Five-colour palette saved', done: palette.length >= 5 },
    { key: 'mood', label: 'Mood words set', done: words.length > 0 },
    { key: 'tagline', label: 'Tagline written', done: !!(lookbook?.tagline && String(lookbook.tagline).trim()) },
  ];
}

function Card({ icon: Icon, title, aside, className = '', children, testid }) {
  return (
    <section className={`esb-card ${className}`} data-testid={testid}>
      <header className="esb-card-head">
        <h3 className="esb-card-title"><Icon size={18} aria-hidden /> {title}</h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

export default function EpisodeStyleBoard({ episode, source, linkedEvents = [], outfit, onOpenTab }) {
  const [lookbook, setLookbook] = useState(undefined);

  useEffect(() => {
    if (!episode?.id) return undefined;
    let cancelled = false;
    lookbookApi.get(episode.id)
      .then((lb) => { if (!cancelled) setLookbook(lb || null); })
      .catch((err) => { console.error('[EpisodeStyleBoard] lookbook load failed:', err); if (!cancelled) setLookbook(null); });
    return () => { cancelled = true; };
  }, [episode?.id]);

  const ev = source?.event || linkedEvents[0] || null;
  const linked = ev ? linkedEvents.find((e) => e.id === ev.id) : null;
  const place = resolveEventVenueAndDate(ev);
  const when = [place.eventDate, place.eventTime].filter(Boolean).join(' · ');
  const guests = asList(ev?.canon_consequences?.automation?.guest_profiles);
  const keywords = asList(ev?.dress_code_keywords);
  const invitation = linked?.invitation_url || source?.invitationAsset?.s3_url_processed || source?.invitationAsset?.s3_url_raw || null;
  const venueStill = linked?.sceneSet?.base_still_url || null;

  const slots = useMemo(() => slotsFrom(outfit, lookbook), [outfit, lookbook]);
  const goals = useMemo(() => styleGoals(slots, lookbook), [slots, lookbook]);
  const required = slots.filter((s) => s.required);
  const palette = asList(lookbook?.palette).map((p) => (typeof p === 'string' ? p : p?.hex)).filter(Boolean).slice(0, 6);
  const moodWords = asList(lookbook?.mood_words);
  const moodImages = ['hero', 'front', 'side', 'back', 'venue']
    .flatMap((k) => lookbook?.images?.[k] || []).map(imgOf).filter(Boolean).slice(0, 5);
  const inspo = (lookbook?.images?.inspo || []).map(imgOf).filter(Boolean).slice(0, 9);
  const pieces = Array.isArray(outfit) ? outfit : [];
  const beauty = asObject(lookbook?.beauty_notes);
  const go = (tab) => onOpenTab?.(tab);

  const fields = [
    ['Event', ev?.name],
    ['Venue', place.venueName],
    ['Date & time', when],
    ['Host', ev?.host || ev?.host_brand],
    ['Attendees', guests.length ? `${guests.length} · ${guests.slice(0, 3).map((g) => g.display_name || (atHandle(g.handle) || null)).filter(Boolean).join(', ')}` : null],
    ['Dress code', ev?.dress_code],
  ].filter(([, v]) => v);
  const loaded = lookbook !== undefined;
  const notes = [['Hair', lookbook?.hair_name], ['Nails', lookbook?.nails_name], ['Eyes', beauty.eyes], ['Lips', beauty.lips], ['Skin', beauty.skin]].filter(([, v]) => v);
  const anySlot = slots.some((s) => s.filled);
  const eventImage = invitation || venueStill;

  // An empty card is one line in "Still to add": [testid, icon, title, text, link].
  const empties = [
    !ev && ['esb-event', CalendarHeart, 'The event', 'No event linked to this episode yet; link one under Events in the Story column.', null],
    !venueStill && !ev?.dress_code && !keywords.length && ['esb-dress', Shirt, 'Dress code', 'No dress code yet.', null],
    loaded && !moodImages.length && !palette.length && ['esb-mood', Images, 'Mood board', 'No look photos yet, and no palette.', { label: 'Add images', tab: 'lookbook' }],
    loaded && !inspo.length && ['esb-inspo', Lightbulb, 'Style inspiration', 'No inspiration photos yet.', { label: 'Add on the Style Page', tab: 'lookbook' }],
    !pieces.length && ['esb-look', Shirt, 'The look', 'No look locked yet. Choose it in the wardrobe game.', { label: 'Open Wardrobe', tab: 'wardrobe' }],
    loaded && !lookbook?.tagline && !moodWords.length && !notes.length && ['esb-notes', NotebookPen, 'Style notes', 'No tagline or beauty notes yet.', { label: 'Open the Style Page', tab: 'lookbook' }],
  ].filter(Boolean);
  const isEmpty = new Set(empties.map(([id]) => id));
  // A card whose partner on its row moved to Still to add takes the row.
  const alone = (partner) => (isEmpty.has(partner) ? ' is-wide' : '');

  return (
    <div className="esb" data-testid="episode-style-board">
      <div className="esb-row esb-row-top">
        {!isEmpty.has('esb-event') && (
          <Card icon={CalendarHeart} title="The event" className="esb-event is-wide" testid="esb-event">
            <div className={`esb-event-body${eventImage ? '' : ' is-text'}`}>
              {eventImage && (
                <div className="esb-frame esb-event-img">
                  <img src={eventImage} alt={ev?.name ? `${ev.name} invitation` : ''} />
                </div>
              )}
              <dl className="esb-fields">
                {fields.map(([k, v]) => (
                  <div key={k} className="esb-field">
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Card>
        )}

        {!isEmpty.has('esb-dress') && (
          <Card icon={Shirt} title="Dress code" testid="esb-dress">
            {venueStill && (
              <div className="esb-frame esb-dress-img">
                <img src={venueStill} alt={place.venueName ? `${place.venueName}` : 'The venue'} />
              </div>
            )}
            <p className="esb-dress-text">{ev?.dress_code || 'No dress code set'}</p>
            {keywords.length > 0 && <div className="esb-chips">{keywords.slice(0, 6).map((k) => <span key={k} className="esb-chip">{k}</span>)}</div>}
          </Card>
        )}

        <Card icon={Target} title="Style goals" className={alone('esb-dress').trim()} testid="esb-goals"
          aside={<span className="esb-count">{goals.filter((g) => g.done).length} / {goals.length}</span>}>
          <ul className="esb-goals">
            {goals.map((g) => (
              <li key={g.key} className={g.done ? 'is-done' : ''}>
                <span className="esb-check" aria-hidden="true">{g.done && <Check size={14} />}</span>
                <span>{g.label}</span>
                <span className="esb-visually-hidden">{g.done ? ' (done)' : ' (not yet)'}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="esb-link" onClick={() => go('lookbook')}>Full readiness on the Style Page</button>
        </Card>
      </div>

      <div className="esb-row esb-row-mid">
        {!isEmpty.has('esb-mood') && (
          <Card icon={Images} title="Mood board" className={alone('esb-inspo').trim()} testid="esb-mood">
            {!loaded ? <p className="esb-note">Loading…</p> : (<>
              {moodImages.length > 0 && (
                <div className="esb-mood-grid">
                  {moodImages.map((src, i) => (
                    <div key={src + i} className={`esb-frame${i === 0 ? ' is-big' : ''}`}><img src={src} alt="" /></div>
                  ))}
                </div>
              )}
              <div className="esb-mood-foot">
                <div className="esb-swatches" aria-label={palette.length ? `Palette: ${palette.join(', ')}` : 'No palette yet'}>
                  {palette.length ? palette.map((hex) => <span key={hex} className="esb-swatch" style={{ background: hex }} title={hex} />)
                    : <span className="esb-muted"><Palette size={14} aria-hidden /> No palette yet</span>}
                </div>
                <button type="button" className="esb-btn" onClick={() => go('lookbook')}><Plus size={15} aria-hidden /> Add images</button>
              </div>
            </>)}
          </Card>
        )}

        {!isEmpty.has('esb-inspo') && (
          <Card icon={Lightbulb} title="Style inspiration" className={alone('esb-mood').trim()} testid="esb-inspo">
            {!loaded ? <p className="esb-note">Loading…</p>
              : <div className="esb-inspo-grid">{inspo.map((src, i) => <div key={src + i} className="esb-frame"><img src={src} alt="" /></div>)}</div>}
          </Card>
        )}

        <Card icon={Shirt} title="Wardrobe slots" className={`esb-slots-card is-wide${anySlot ? '' : ' is-chips'}`} testid="esb-slots"
          aside={<span className="esb-count">{required.filter((s) => s.filled).length} / {required.length} required</span>}>
          <ul className={anySlot ? 'esb-slots' : 'esb-slot-chips'}>
            {slots.map((s) => (
              <li key={s.key}>
                {anySlot ? (
                  <button type="button" className={`esb-slot${s.filled ? ' is-filled' : ''}${s.required ? ' is-required' : ''}`}
                    onClick={() => go(s.key === 'nails' ? 'lookbook' : 'wardrobe')}
                    aria-label={`${s.label}: ${s.filled ? (s.name || 'chosen') : 'empty'}${s.required ? ', required' : ''}`}>
                    <span className="esb-slot-img">
                      {s.image ? <img src={s.image} alt="" /> : s.filled ? <s.icon size={22} aria-hidden /> : <Plus size={22} aria-hidden />}
                    </span>
                    <span className="esb-slot-label"><s.icon size={14} aria-hidden /> {s.label}</span>
                  </button>
                ) : (
                  // Nothing chosen yet: a small "+ Body" chip per slot.
                  <button type="button" className={`esb-slot-chip${s.required ? ' is-required' : ''}`}
                    onClick={() => go(s.key === 'nails' ? 'lookbook' : 'wardrobe')}
                    aria-label={`${s.label}: empty${s.required ? ', required' : ''}`}>
                    <Plus size={13} aria-hidden /> {s.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="esb-row esb-row-bottom">
        {!isEmpty.has('esb-look') && (
          <Card icon={Shirt} title="The look" className={alone('esb-notes').trim()} testid="esb-look"
            aside={<span className="esb-pill is-on">Locked</span>}>
            <ul className="esb-look">
              {pieces.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <span className="esb-look-img">{pieceImage(p) ? <img src={pieceImage(p)} alt="" /> : <Shirt size={16} aria-hidden />}</span>
                  <span>{p.name || 'Piece'}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {!isEmpty.has('esb-notes') && (
          <Card icon={NotebookPen} title="Style notes" className={alone('esb-look').trim()} testid="esb-notes">
            {!loaded ? <p className="esb-note">Loading…</p> : (
              <div className="esb-notes">
                {lookbook?.tagline ? <p className="esb-tagline">“{lookbook.tagline}”</p> : <p className="esb-note">No tagline yet.</p>}
                {moodWords.length > 0 && <div className="esb-chips">{moodWords.map((w) => <span key={w} className="esb-chip">{w}</span>)}</div>}
                <dl className="esb-fields is-compact">
                  {notes.map(([k, v]) => <div key={k} className="esb-field"><dt>{k}</dt><dd>{v}</dd></div>)}
                </dl>
              </div>
            )}
          </Card>
        )}
      </div>

      {empties.length > 0 && (
        <section className="esb-card esb-todo is-wide" aria-labelledby="esb-todo-title" data-testid="esb-todo">
          <header className="esb-card-head">
            <h3 className="esb-card-title" id="esb-todo-title"><Plus size={18} aria-hidden /> Still to add</h3>
          </header>
          <ul className="esb-todo-list">
            {empties.map(([id, Icon, title, text, link]) => (
              <li key={id} data-testid={id}>
                <Icon size={15} aria-hidden className="esb-todo-icon" />
                <span className="esb-todo-text"><strong>{title}</strong> {text}</span>
                {link && <button type="button" className="esb-link" onClick={() => go(link.tab)}>{link.label}</button>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

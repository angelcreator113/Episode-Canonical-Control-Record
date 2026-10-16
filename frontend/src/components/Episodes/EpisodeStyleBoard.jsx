/**
 * EpisodeStyleBoard — the top of the episode Overview (Evoni's "Episode
 * Style" mock, 2026-10-16): the event, its dress code, the look's goals and
 * rewards, the mood board and inspiration, the wardrobe slots, the look,
 * style notes and quick tools, as one pink-and-gold board.
 *
 * Every card reads data the episode already has: the source event and the
 * locked outfit (EpisodeOverviewTab loads them), the money plan, and the
 * episode's Lookbook (the Style Page's data, GET /episodes/:id/lookbook;
 * the style sheet is not read here, it inlines every image). Nothing is
 * invented: a card with no data says so and opens the tab where it is made.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarHeart, Shirt, Target, Trophy, Images, Lightbulb, Gem, ShoppingBag, Sparkles, Shuffle,
  Wind, Hand, Footprints, NotebookPen, WandSparkles, Plus, Check, Palette, Clapperboard, Coins,
} from 'lucide-react';
import { lookbookApi } from '../../lib/lookbookApi';
import { resolveEventVenueAndDate } from '../../utils/eventReadiness';
import { gameSlotFor } from '../../lib/closetGrouping';
import { coinsAfterPlan } from '../../lib/episodeOverview';
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

export default function EpisodeStyleBoard({ episode, source, linkedEvents = [], outfit, money, onOpenTab }) {
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
  const rewards = asObject(ev?.rewards);
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
  const coins = money ? coinsAfterPlan(money) : null;
  const beauty = asObject(lookbook?.beauty_notes);
  const go = (tab) => onOpenTab?.(tab);

  const fields = [
    ['Episode', episode?.title || '—'],
    ['Event', ev?.name],
    ['Venue', place.venueName],
    ['Date & time', when],
    ['Host', ev?.host || ev?.host_brand],
    ['Attendees', guests.length ? `${guests.length} · ${guests.slice(0, 3).map((g) => g.display_name || (g.handle ? `@${g.handle}` : null)).filter(Boolean).join(', ')}` : null],
    ['Dress code', ev?.dress_code],
  ];

  return (
    <div className="esb" data-testid="episode-style-board">
      <div className="esb-row esb-row-top">
        <Card icon={CalendarHeart} title="Episode & event" className="esb-event" testid="esb-event">
          <div className="esb-event-body">
            <div className="esb-frame esb-event-img">
              {invitation || venueStill ? <img src={invitation || venueStill} alt={ev?.name ? `${ev.name} invitation` : ''} /> : <span className="esb-empty">No invitation yet</span>}
            </div>
            <dl className="esb-fields">
              {fields.map(([k, v]) => (
                <div key={k} className="esb-field">
                  <dt>{k}</dt>
                  <dd>{v || <span className="esb-muted">—</span>}</dd>
                </div>
              ))}
            </dl>
          </div>
          {!ev && <p className="esb-note">No event linked to this episode yet; link one in the Identity band below.</p>}
        </Card>

        <Card icon={Shirt} title="Dress code" testid="esb-dress">
          <div className="esb-frame esb-dress-img">
            {venueStill ? <img src={venueStill} alt={place.venueName ? `${place.venueName}` : 'The venue'} /> : <span className="esb-empty">No venue still yet</span>}
          </div>
          <p className="esb-dress-text">{ev?.dress_code || 'No dress code set'}</p>
          {keywords.length > 0 && <div className="esb-chips">{keywords.slice(0, 6).map((k) => <span key={k} className="esb-chip">{k}</span>)}</div>}
        </Card>

        <Card icon={Target} title="Style goals" testid="esb-goals"
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

        <Card icon={Trophy} title="Rewards" testid="esb-rewards">
          <ul className="esb-rewards">
            {[['Reputation', rewards.reputation], ['Trust', rewards.brand_trust], ['Influence', rewards.influence]].map(([label, n]) => (
              <li key={label}><span>{label}</span><strong>{Number(n) > 0 ? `+${n}` : '—'}</strong></li>
            ))}
            <li><span><Coins size={15} aria-hidden /> Prime coins after</span><strong>{coins?.value ?? '—'}</strong></li>
          </ul>
          <p className="esb-note">Paid on a Slay or Pass.</p>
        </Card>
      </div>

      <div className="esb-row esb-row-mid">
        <Card icon={Images} title="Mood board" testid="esb-mood">
          {lookbook === undefined ? <p className="esb-note">Loading…</p> : (<>
            <div className="esb-mood-grid">
              {moodImages.length ? moodImages.map((src, i) => (
                <div key={src + i} className={`esb-frame${i === 0 ? ' is-big' : ''}`}><img src={src} alt="" /></div>
              )) : <div className="esb-frame is-big"><span className="esb-empty">No look photos yet</span></div>}
            </div>
            <div className="esb-mood-foot">
              <div className="esb-swatches" aria-label={palette.length ? `Palette: ${palette.join(', ')}` : 'No palette yet'}>
                {palette.length ? palette.map((hex) => <span key={hex} className="esb-swatch" style={{ background: hex }} title={hex} />)
                  : <span className="esb-muted"><Palette size={14} aria-hidden /> No palette yet</span>}
              </div>
              <button type="button" className="esb-btn" onClick={() => go('lookbook')}><Plus size={15} aria-hidden /> Add images</button>
            </div>
          </>)}
        </Card>

        <Card icon={Lightbulb} title="Style inspiration" testid="esb-inspo">
          {inspo.length ? (
            <div className="esb-inspo-grid">{inspo.map((src, i) => <div key={src + i} className="esb-frame"><img src={src} alt="" /></div>)}</div>
          ) : <p className="esb-note">No inspiration photos yet. Add them on the Style Page.</p>}
        </Card>

        <Card icon={Shirt} title="Wardrobe slots" className="esb-slots-card" testid="esb-slots"
          aside={<span className="esb-count">{required.filter((s) => s.filled).length} / {required.length} required</span>}>
          <ul className="esb-slots">
            {slots.map((s) => (
              <li key={s.key}>
                <button type="button" className={`esb-slot${s.filled ? ' is-filled' : ''}${s.required ? ' is-required' : ''}`}
                  onClick={() => go(s.key === 'nails' ? 'lookbook' : 'wardrobe')}
                  aria-label={`${s.label}: ${s.filled ? (s.name || 'chosen') : 'empty'}${s.required ? ', required' : ''}`}>
                  <span className="esb-slot-img">
                    {s.image ? <img src={s.image} alt="" /> : s.filled ? <s.icon size={22} aria-hidden /> : <Plus size={22} aria-hidden />}
                  </span>
                  <span className="esb-slot-label"><s.icon size={14} aria-hidden /> {s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="esb-row esb-row-bottom">
        <Card icon={Shirt} title="The look" testid="esb-look"
          aside={<span className={`esb-pill${pieces.length ? ' is-on' : ''}`}>{pieces.length ? 'Locked' : 'Not locked'}</span>}>
          {pieces.length ? (
            <ul className="esb-look">
              {pieces.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <span className="esb-look-img">{pieceImage(p) ? <img src={pieceImage(p)} alt="" /> : <Shirt size={16} aria-hidden />}</span>
                  <span>{p.name || 'Piece'}</span>
                </li>
              ))}
            </ul>
          ) : <p className="esb-note">No look locked yet. Choose it in the wardrobe game.</p>}
        </Card>

        <Card icon={NotebookPen} title="Style notes" testid="esb-notes">
          {lookbook === undefined ? <p className="esb-note">Loading…</p> : (
            <div className="esb-notes">
              {lookbook?.tagline ? <p className="esb-tagline">“{lookbook.tagline}”</p> : <p className="esb-note">No tagline yet.</p>}
              {moodWords.length > 0 && <div className="esb-chips">{moodWords.map((w) => <span key={w} className="esb-chip">{w}</span>)}</div>}
              <dl className="esb-fields is-compact">
                {[['Hair', lookbook?.hair_name], ['Nails', lookbook?.nails_name], ['Eyes', beauty.eyes], ['Lips', beauty.lips], ['Skin', beauty.skin]]
                  .filter(([, v]) => v).map(([k, v]) => <div key={k} className="esb-field"><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
            </div>
          )}
        </Card>

        <Card icon={WandSparkles} title="Quick tools" testid="esb-tools">
          <div className="esb-tools">
            <button type="button" className="esb-tool" onClick={() => go('lookbook')}><Palette size={20} aria-hidden /> Style Page</button>
            <button type="button" className="esb-tool" onClick={() => go('wardrobe')}><Shuffle size={20} aria-hidden /> Mix &amp; match</button>
            <button type="button" className="esb-tool" onClick={() => go('scenes')}><Clapperboard size={20} aria-hidden /> Scenes</button>
            <button type="button" className="esb-tool" onClick={() => go('money')}><Coins size={20} aria-hidden /> Coins</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

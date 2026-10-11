/**
 * The style sheet template, portrait 1024 x 1536
 * (docs/design/2026-10-landing-and-stylesheet.md Part 2, "Style sheet
 * template"; Task #2814). All text is real text laid over images. Every
 * value comes from the sheet GET /episodes/:id/style-sheet builds from
 * canon and the Lookbook; an empty value shows a quiet placeholder and an
 * empty required wardrobe slot shows "Needed". Nothing is invented.
 *
 * Rendered at full size; the panel scales it for the preview and draws it
 * to a PNG for the download.
 *
 * Edit mode (the Style Page, Task #2876): with an `edit` prop, every spot
 * is a button over its frame. An empty spot reads "+ Add <spot>"; the
 * selected one has a pink outline; the tagline and the hair and nails names
 * become inputs in place while their spot is selected. Without `edit` the
 * sheet renders exactly as before, so downloads and exports don't change.
 *
 *   edit = { selected, onSelect(spot), locked,
 *            text: { tagline, hair_name, nails_name },
 *            onText(field, value), onCommit(field),
 *            canSwapVenue, onSwapVenue() }
 */
import React, { forwardRef, useEffect, useRef } from 'react';
import './StyleSheetTemplate.css';

export const SHEET_WIDTH = 1024;
export const SHEET_HEIGHT = 1536;
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Great+Vibes&display=swap';

// The sheet's lettering (Cormorant Garamond serif, Great Vibes script),
// loaded once; a <link> keeps it out of the CSS bundle's @import order.
export function useSheetFonts() {
  useEffect(() => {
    if (typeof document === 'undefined' || document.querySelector('link[data-style-sheet-fonts]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    link.dataset.styleSheetFonts = 'true';
    document.head.appendChild(link);
  }, []);
}

// Photos are drawn as backgrounds (cover, or contain for pieces): html2canvas
// ignores object-fit, so an <img> would print stretched in the PNG.
function Photo({ src, label, alt = label, className = '' }) {
  return (
    <div className={`ss-photo ${className}`.trim()}>
      {src
        ? <div className="ss-photo-img" role="img" aria-label={alt} style={{ backgroundImage: `url("${src}")` }} />
        : <span className="ss-photo-empty">{label}</span>}
    </div>
  );
}

// In edit mode: a button over a spot's frame. Empty spots read "+ Add".
function SpotButton({ edit, spot, label, filled, needed = false }) {
  if (!edit) return null;
  const selected = edit.selected === spot;
  return (
    <button
      type="button"
      className={`ss-spot${filled ? ' is-filled' : ' is-empty'}${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      aria-label={filled ? `Edit ${label}` : `Add ${label}${needed ? ' (needed)' : ''}`}
      data-spot={spot}
      onClick={() => edit.onSelect(spot)}
    >
      {!filled && <span className="ss-spot-add">+ Add {label}{needed ? <em> · Needed</em> : null}</span>}
    </button>
  );
}

// In edit mode, a text field on the sheet while its spot is selected. It
// takes focus without scrolling the page, and saves when it is left.
function InPlaceText({ edit, field, placeholder, className, maxLength }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  return (
    <input
      ref={ref}
      type="text"
      className={`ss-inplace ${className}`}
      value={edit.text?.[field] ?? ''}
      placeholder={placeholder}
      maxLength={maxLength}
      aria-label={placeholder}
      onChange={(e) => edit.onText(field, e.target.value)}
      onBlur={() => edit.onCommit(field)}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

const Detail = ({ label, value }) => (
  <div className="ss-detail">
    <span className="ss-detail-label">{label}</span>
    <span className="ss-detail-value">{value || '—'}</span>
  </div>
);

const StyleSheetTemplate = forwardRef(function StyleSheetTemplate({ sheet, palette, edit = null }, ref) {
  useSheetFonts();
  const ev = sheet.event || {};
  const venue = sheet.venue || {};
  const swatches = (palette || sheet.palette || []).slice(0, 5);
  const mood = sheet.mood_words || [];
  const inspo = sheet.inspo || { photos: [], textures: [] };

  return (
    <div ref={ref} className={`ss-sheet${edit ? ' is-editing' : ''}`} style={{ width: SHEET_WIDTH, height: SHEET_HEIGHT }} data-testid="style-sheet">
      {/* Top row: logo and THE LOOK · Hero · episode, venue, details */}
      <div className="ss-top">
        <div className="ss-col ss-col-left">
          {sheet.logo ? (
            // The show's logo from Show Settings, drawn as a background so
            // the PNG keeps its proportions (html2canvas ignores object-fit).
            <div className="ss-logo ss-logo-image" role="img" aria-label="Styling Adventures with Lala"
              style={{ backgroundImage: `url("${sheet.logo}")` }} data-testid="ss-logo-image" />
          ) : (
            <div className="ss-logo" aria-label="Styling Adventures with Lala">
              <span className="ss-logo-styling">Styling</span>
              <span className="ss-logo-adventures">Adventures</span>
              <span className="ss-logo-with">with</span>
              <span className="ss-logo-lala">LALA</span>
            </div>
          )}
          <div className="ss-pill">THE LOOK</div>
          <div className="ss-look">
            {['front', 'side', 'back'].map((k) => (
              <figure key={k} className="ss-look-item">
                <div className="ss-spot-wrap">
                  <Photo src={sheet.look?.[k]} label={edit ? '' : k[0].toUpperCase() + k.slice(1)} className="ss-frame" />
                  <SpotButton edit={edit} spot={k} label={k[0].toUpperCase() + k.slice(1)} filled={Boolean(sheet.look?.[k])} />
                </div>
                <figcaption>{k.toUpperCase()}</figcaption>
              </figure>
            ))}
          </div>
        </div>

        <div className="ss-col ss-col-centre">
          <div className="ss-look-hero">
            <div className="ss-spot-wrap">
              <Photo src={sheet.look?.hero} label={edit ? '' : 'Hero'} />
              <SpotButton edit={edit} spot="hero" label="Hero" filled={Boolean(sheet.look?.hero)} />
            </div>
          </div>
        </div>

        <div className="ss-col ss-col-right">
          {sheet.episode?.label && <div className="ss-episode">{sheet.episode.label}</div>}
          <h1 className="ss-event-name">{ev.name || 'Event to come'}</h1>
          {venue.chip && <div className="ss-venue-chip">{venue.chip}</div>}
          <figure className="ss-venue">
            <div className="ss-spot-wrap">
              <Photo src={venue.image} label={edit ? '' : 'Venue'} className="ss-frame" />
              <SpotButton edit={edit} spot="venue" label="Venue" filled={Boolean(venue.image)} />
              {edit && venue.image && edit.canSwapVenue && !edit.locked && (
                <button type="button" className="ss-swap" onClick={edit.onSwapVenue} aria-label="Swap the venue image">Swap</button>
              )}
            </div>
            <figcaption>THE VENUE{venue.name ? ` · ${venue.name}` : ''}</figcaption>
          </figure>
          <div className="ss-pill">EVENT DETAILS</div>
          <div className="ss-details">
            <Detail label="HOST" value={ev.host} />
            <Detail label="TYPE" value={ev.type} />
            <Detail label="DRESS CODE" value={ev.dress_code} />
            <Detail label="WHEN" value={ev.when} />
            <Detail label="VIBE" value={ev.vibe} />
          </div>
        </div>
      </div>

      {/* WARDROBE BREAKDOWN */}
      <section className="ss-wardrobe">
        <div className="ss-pill ss-pill-centre">WARDROBE BREAKDOWN</div>
        <div className="ss-columns">
          {(sheet.wardrobe?.columns || []).map((c) => (
            <figure key={c.key} className={`ss-column${c.needed ? ' is-needed' : ''}`} data-testid={`ss-col-${c.key}`}>
              <div className="ss-column-label">{c.label}</div>
              <div className="ss-spot-wrap ss-column-photo-wrap">
                <Photo src={c.image} label={c.needed && !edit ? 'Needed' : ''} alt={c.name || c.label} className="ss-frame ss-column-photo" />
                {(() => {
                  // Hair and nails are Lookbook spots; the other columns are the saved look's pieces.
                  const spot = c.key === 'hair' || c.key === 'nails' ? c.key : 'wardrobe';
                  const label = c.label.charAt(0) + c.label.slice(1).toLowerCase();
                  return <SpotButton edit={edit} spot={spot} label={label} filled={Boolean(c.image) || (!c.needed && spot === 'wardrobe')} needed={c.needed} />;
                })()}
              </div>
              <figcaption className="ss-column-name">
                {(c.key === 'hair' || c.key === 'nails') && edit && edit.selected === c.key && !edit.locked
                  ? <InPlaceText edit={edit} field={`${c.key}_name`} placeholder={`${c.key === 'hair' ? 'Hair' : 'Nails'} name`} className="ss-inplace-name" maxLength={120} />
                  : (c.needed ? 'Needed' : ((edit && (c.key === 'hair' || c.key === 'nails') ? edit.text?.[`${c.key}_name`] : c.name) || ''))}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Bottom row: palette · beauty · inspo */}
      <div className="ss-bottom">
        <section className="ss-sheet-panel ss-spot-wrap">
          <SpotButton edit={edit} spot="palette" label="Palette" filled />
          <div className="ss-pill ss-pill-centre">COLOR PALETTE</div>
          <div className="ss-swatches">
            {Array.from({ length: 5 }, (_, i) => swatches[i] || null).map((s, i) => (
              <span key={i} className={`ss-swatch${s ? '' : ' is-empty'}`} style={s ? { background: s.hex } : undefined} data-testid="ss-swatch" />
            ))}
          </div>
          <div className="ss-mood-title">Mood</div>
          <p className="ss-mood-words">{mood.length ? mood.join(' · ') : ''}</p>
        </section>

        <section className="ss-sheet-panel">
          <div className="ss-pill ss-pill-centre">BEAUTY DETAILS</div>
          <div className="ss-beauty">
            {[['eyes', 'Eyes'], ['lips', 'Lips'], ['skin', 'Skin'], ['nails', 'Nails']].map(([k, label]) => (
              <figure key={k} className="ss-beauty-item">
                <div className="ss-spot-wrap">
                  <Photo src={sheet.beauty?.[k]} label={edit ? '' : label} className="ss-frame" />
                  <SpotButton edit={edit} spot={k} label={label} filled={Boolean(sheet.beauty?.[k])} />
                </div>
                <figcaption>{label.toUpperCase()}{k === 'nails' && sheet.nails_name ? ` · ${sheet.nails_name}` : ''}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="ss-sheet-panel">
          <div className="ss-pill ss-pill-centre">KEY INSPO</div>
          <div className="ss-inspo">
            {[0, 1].map((i) => (
              <div key={`p${i}`} className="ss-spot-wrap">
                <Photo src={inspo.photos?.[i]?.image} label={edit ? '' : 'Inspo'} className="ss-frame" />
                <SpotButton edit={edit} spot="inspo" label="Inspo" filled={Boolean(inspo.photos?.[i]?.image)} />
              </div>
            ))}
            {[0, 1].map((i) => (
              <div key={`t${i}`} className="ss-frame ss-texture">
                {inspo.textures?.[i]?.image
                  ? <div className="ss-texture-img" role="img" aria-label={`Texture from ${inspo.textures[i].label || 'a piece'}`} style={{ backgroundImage: `url("${inspo.textures[i].image}")` }} />
                  : <span className="ss-photo-empty">Texture</span>}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Footer strip */}
      <footer className="ss-footer">
        <div className="ss-skyline" aria-hidden="true" />
        {edit ? (
          <div className="ss-tagline-spot">
            {edit.selected === 'tagline' && !edit.locked
              ? <InPlaceText edit={edit} field="tagline" placeholder="Write a tagline" className="ss-tagline ss-inplace-tagline" maxLength={200} />
              : (
                <button type="button" className={`ss-tagline-btn${edit.selected === 'tagline' ? ' is-selected' : ''}`} aria-pressed={edit.selected === 'tagline'} onClick={() => edit.onSelect('tagline')}>
                  {edit.text?.tagline ? <span className="ss-tagline">{edit.text.tagline}</span> : <span className="ss-tagline ss-tagline-empty">Tap to write a tagline</span>}
                </button>
              )}
          </div>
        ) : (sheet.tagline && <p className="ss-tagline">{sheet.tagline}</p>)}
        <p className="ss-footer-line">LALAVERSE · FASHION · ATTENTION · MONEY</p>
      </footer>
    </div>
  );
});

export default StyleSheetTemplate;

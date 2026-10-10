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
 */
import React, { forwardRef, useEffect } from 'react';
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

const Detail = ({ label, value }) => (
  <div className="ss-detail">
    <span className="ss-detail-label">{label}</span>
    <span className="ss-detail-value">{value || '—'}</span>
  </div>
);

const StyleSheetTemplate = forwardRef(function StyleSheetTemplate({ sheet, palette }, ref) {
  useSheetFonts();
  const ev = sheet.event || {};
  const venue = sheet.venue || {};
  const swatches = (palette || sheet.palette || []).slice(0, 5);
  const mood = sheet.mood_words || [];
  const inspo = sheet.inspo || { photos: [], textures: [] };

  return (
    <div ref={ref} className="ss-sheet" style={{ width: SHEET_WIDTH, height: SHEET_HEIGHT }} data-testid="style-sheet">
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
                <Photo src={sheet.look?.[k]} label={k[0].toUpperCase() + k.slice(1)} className="ss-frame" />
                <figcaption>{k.toUpperCase()}</figcaption>
              </figure>
            ))}
          </div>
        </div>

        <div className="ss-col ss-col-centre">
          <div className="ss-hero">
            <Photo src={sheet.look?.hero} label="Hero" />
          </div>
        </div>

        <div className="ss-col ss-col-right">
          {sheet.episode?.label && <div className="ss-episode">{sheet.episode.label}</div>}
          <h1 className="ss-event-name">{ev.name || 'Event to come'}</h1>
          {venue.chip && <div className="ss-chip">{venue.chip}</div>}
          <figure className="ss-venue">
            <Photo src={venue.image} label="Venue" className="ss-frame" />
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
              <Photo src={c.image} label={c.needed ? 'Needed' : ''} alt={c.name || c.label} className="ss-frame ss-column-photo" />
              <figcaption className="ss-column-name">{c.needed ? 'Needed' : (c.name || '')}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Bottom row: palette · beauty · inspo */}
      <div className="ss-bottom">
        <section className="ss-panel">
          <div className="ss-pill ss-pill-centre">COLOR PALETTE</div>
          <div className="ss-swatches">
            {Array.from({ length: 5 }, (_, i) => swatches[i] || null).map((s, i) => (
              <span key={i} className={`ss-swatch${s ? '' : ' is-empty'}`} style={s ? { background: s.hex } : undefined} data-testid="ss-swatch" />
            ))}
          </div>
          <div className="ss-mood-title">Mood</div>
          <p className="ss-mood-words">{mood.length ? mood.join(' · ') : ''}</p>
        </section>

        <section className="ss-panel">
          <div className="ss-pill ss-pill-centre">BEAUTY DETAILS</div>
          <div className="ss-beauty">
            {[['eyes', 'Eyes'], ['lips', 'Lips'], ['skin', 'Skin'], ['nails', 'Nails']].map(([k, label]) => (
              <figure key={k} className="ss-beauty-item">
                <Photo src={sheet.beauty?.[k]} label={label} className="ss-frame" />
                <figcaption>{label.toUpperCase()}{k === 'nails' && sheet.nails_name ? ` · ${sheet.nails_name}` : ''}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="ss-panel">
          <div className="ss-pill ss-pill-centre">KEY INSPO</div>
          <div className="ss-inspo">
            {[0, 1].map((i) => <Photo key={`p${i}`} src={inspo.photos?.[i]?.image} label="Inspo" className="ss-frame" />)}
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
        {sheet.tagline && <p className="ss-tagline">{sheet.tagline}</p>}
        <p className="ss-footer-line">LALAVERSE · FASHION · ATTENTION · MONEY</p>
      </footer>
    </div>
  );
});

export default StyleSheetTemplate;

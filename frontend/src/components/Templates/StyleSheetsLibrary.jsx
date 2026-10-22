/**
 * Template Studio › Style sheets (Evoni, 2026-10-22: "Should we move the
 * templates in the templates studio instead?"; her choice, "Library +
 * on/off"). The Style Page's designs, as templates: each one previewed with
 * its empty frames, and switched on or off for a show. The Style Page, its
 * downloads and Send to Distribution use the ones that are on; Classic (the
 * style sheet itself) is always on. Filling an episode stays on its Style
 * Page.
 *
 * Data: GET/PUT /api/v1/shows/:id/style-designs (lib/styleDesignsApi).
 */
import React, { useEffect, useState } from 'react';
import { youtubeThumbnailsApi } from '../../lib/youtubeThumbnailsApi';
import { styleDesignsApi } from '../../lib/styleDesignsApi';
import StyleDesign, { DESIGN_HEIGHT, DESIGN_WIDTH } from '../Episodes/StyleDesign';
import './StyleSheetsLibrary.css';

const CARD_WIDTH = 220;
const EMPTY = { photos: {}, fields: {}, palette: [] };
const errorText = (err, fallback) => err?.response?.data?.error || err?.message || fallback;

export default function StyleSheetsLibrary({ say = () => {} }) {
  const [shows, setShows] = useState(null);
  const [showId, setShowId] = useState('');
  const [lib, setLib] = useState(null);
  const [failed, setFailed] = useState(null);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    let live = true;
    youtubeThumbnailsApi.shows()
      .then((rows) => {
        if (!live) return;
        setShows(rows);
        if (rows.length) setShowId((id) => id || rows[0].id);
      })
      .catch((err) => {
        console.error('[StyleSheets] shows load failed:', err);
        if (live) setFailed(errorText(err, 'Could not load the shows.'));
      });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!showId) return undefined;
    let live = true;
    setLib(null);
    setFailed(null);
    styleDesignsApi.get(showId)
      .then((data) => { if (live) setLib(data); })
      .catch((err) => {
        console.error('[StyleSheets] designs load failed:', err);
        if (live) setFailed(errorText(err, 'Could not load the style sheet designs.'));
      });
    return () => { live = false; };
  }, [showId]);

  const toggle = async (design) => {
    const wasOff = lib.off.includes(design.key);
    const off = wasOff ? lib.off.filter((k) => k !== design.key) : [...lib.off, design.key];
    const before = lib;
    setLib({ ...lib, off });
    setSaving(design.key);
    try {
      setLib(await styleDesignsApi.save(showId, off));
      say('ok', `${design.name} is ${wasOff ? 'on' : 'off'} for this show.`);
    } catch (err) {
      console.error('[StyleSheets] save failed:', err);
      setLib(before);
      say('error', errorText(err, 'The change could not be saved.'));
    } finally {
      setSaving(null);
    }
  };

  if (failed) return <div className="ts-state" role="alert"><p>{failed}</p></div>;
  if (!shows || (showId && !lib)) return <div className="ts-state"><div className="ts-spinner"></div><p>Loading style sheet designs...</p></div>;
  if (!shows.length) return <div className="ts-state"><p>Make a show first; its style sheet designs are chosen here.</p></div>;

  const scale = CARD_WIDTH / DESIGN_WIDTH;
  const onCount = lib.designs.length - lib.off.length;
  const show = shows.find((s) => s.id === showId);
  return (
    <div className="ssl" data-testid="ssl">
      <header className="ssl-head">
        <div>
          <h2 className="ssl-title">Style sheets</h2>
          <p className="ssl-sub">
            The Style Page's designs. Switch each one on or off for the show: the Style Page, its downloads and Send to Distribution use the ones that are on.
            Classic, the style sheet itself, is always on. Each episode's photos and words are filled on its Style Page.
          </p>
        </div>
        {shows.length > 1 && (
          <label className="ssl-show">
            <span>Show</span>
            <select value={showId} onChange={(e) => setShowId(e.target.value)} data-testid="ssl-show">
              {shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
      </header>
      <p className="ssl-count" data-testid="ssl-count">{onCount} of {lib.designs.length} on for {show?.name || 'this show'}</p>
      <ul className="ssl-grid">
        {lib.designs.map((d) => {
          const on = !lib.off.includes(d.key);
          return (
            <li key={d.key} className={`ssl-card${on ? '' : ' is-off'}`} data-testid={`ssl-design-${d.key}`}>
              <div className="ssl-pic" style={{ width: CARD_WIDTH, height: DESIGN_HEIGHT * scale }}>
                <div className="ssl-scale" style={{ transform: `scale(${scale})`, width: DESIGN_WIDTH }}>
                  <StyleDesign design={d} values={EMPTY} />
                </div>
              </div>
              <div className="ssl-card-foot">
                <p className="ssl-name"><span className="ssl-num">{d.number}</span> {d.name}</p>
                <button type="button" role="switch" aria-checked={on} className={`ssl-switch${on ? ' is-on' : ''}`} disabled={saving !== null}
                  aria-label={`${d.name}: ${on ? 'on' : 'off'} for ${show?.name || 'this show'}`} onClick={() => toggle(d)}>
                  <span className="ssl-knob" aria-hidden="true" /> {on ? 'On' : 'Off'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="ssl-note">Sizes: {lib.sizes.map((z) => `${z.label} ${z.width} × ${z.height}`).join(' · ')}</p>
    </div>
  );
}

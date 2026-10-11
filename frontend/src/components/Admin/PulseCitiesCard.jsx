/**
 * Admin › The Pulse › Uploads › Dream Cities (Task #2920): each city's
 * image (with alt text), story-bubble image and colours, saved on the city
 * (lib/pulseCities). Empty image spots are dashed "+ Add" buttons.
 * Styles: styles/AdminPanel.css.
 */
import React, { useEffect, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import PulseImageSpot from './PulseImageSpot';
import { HEX, hasSavedPalette, loadCities, paletteOf, saveCity, uploadCityImage } from '../../lib/pulseCities';

const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong.';

function CityCard({ city, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [alt, setAlt] = useState(city.image_alt || '');
  const [palette, setPalette] = useState(paletteOf(city));
  const [newHex, setNewHex] = useState('');

  const run = async (fn) => {
    setBusy(true);
    setNote(null);
    try {
      onSaved(await fn());
    } catch (err) {
      console.error(`[PulseCities] ${city.key} action failed:`, err);
      setNote(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const setImage = (field, kind) => (file) => run(async () => saveCity(city.key, { [field]: await uploadCityImage(city.key, kind, file) }));
  const clear = (fields) => () => run(() => saveCity(city.key, fields));

  const saved = paletteOf(city);
  const paletteDirty = !hasSavedPalette(city) || palette.join() !== saved.join();
  const paletteValid = palette.length > 0 && palette.every((c) => HEX.test(c));
  const addHex = () => {
    const hex = newHex.trim().startsWith('#') ? newHex.trim() : `#${newHex.trim()}`;
    if (!HEX.test(hex)) { setNote('A colour is # and six hex digits, like #D4789A.'); return; }
    setPalette([...palette, hex.toUpperCase()]);
    setNewHex('');
    setNote(null);
  };

  return (
    <article className="pulse-city" data-testid={`pulse-city-${city.key}`} style={{ borderTopColor: saved[0] || city.color }}>
      <header className="pulse-city-head">
        <h4>{city.name}</h4>
        {city.subtitle && <span className="pulse-hint">{city.subtitle}</span>}
      </header>
      <div className="pulse-city-spots">
        <PulseImageSpot label="Image" url={city.image_url} alt={city.image_alt} busy={busy}
          onFile={setImage('image_url', 'image')} onRemove={clear({ image_url: null, image_alt: '' })} testId={`city-${city.key}-image`} />
        <PulseImageSpot label="Story bubble" url={city.bubble_image_url} alt="" round busy={busy}
          onFile={setImage('bubble_image_url', 'bubble')} onRemove={clear({ bubble_image_url: null })} testId={`city-${city.key}-bubble`} />
      </div>
      {city.image_url && (
        <div className="pulse-field">
          <label htmlFor={`alt-${city.key}`}>Image alt text</label>
          <div className="pulse-inline">
            <input id={`alt-${city.key}`} type="text" maxLength={300} value={alt} onChange={(e) => setAlt(e.target.value)} />
            <button type="button" className="pulse-btn" disabled={busy || !alt.trim() || alt.trim() === (city.image_alt || '')}
              onClick={() => run(() => saveCity(city.key, { image_alt: alt.trim() }))}>Save</button>
          </div>
        </div>
      )}
      <div className="pulse-field">
        <span>Colours{!hasSavedPalette(city) && <span className="pulse-required"> (the spec's, not saved yet)</span>}</span>
        <ul className="pulse-swatches">
          {palette.map((hex, i) => (
            <li key={`${hex}-${i}`}>
              <span className="pulse-swatch" style={{ background: hex }} aria-hidden="true" />
              <input type="text" className="pulse-hex" value={hex} aria-label={`Colour ${i + 1}`}
                onChange={(e) => setPalette(palette.map((c, j) => (j === i ? e.target.value.trim() : c)))} />
              <button type="button" className="pulse-icon-btn" aria-label={`Remove colour ${i + 1}`} disabled={busy || palette.length === 1}
                onClick={() => setPalette(palette.filter((_, j) => j !== i))}><X size={16} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
        <div className="pulse-inline">
          <input type="text" className="pulse-hex" placeholder="#RRGGBB" value={newHex} aria-label="New colour" onChange={(e) => setNewHex(e.target.value)} />
          <button type="button" className="pulse-btn" disabled={busy || !newHex.trim()} onClick={addHex}><Plus size={16} aria-hidden="true" /> Add</button>
          <button type="button" className="pulse-btn primary" disabled={busy || !paletteDirty || !paletteValid}
            onClick={() => run(() => saveCity(city.key, { palette: palette.map((c) => c.toUpperCase()) }))}>Save colours</button>
        </div>
      </div>
      {busy && <p className="pulse-hint"><Loader2 size={14} className="pulse-spin" aria-hidden="true" /> Saving…</p>}
      {note && <p className="pulse-error" role="alert">{note}</p>}
    </article>
  );
}

export default function PulseCitiesCard() {
  const [cities, setCities] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    loadCities()
      .then((list) => { if (alive) setCities(list); })
      .catch((err) => {
        console.error('[PulseCities] the cities could not be read:', err);
        if (alive) setError('The Dream Cities could not be loaded.');
      });
    return () => { alive = false; };
  }, []);

  return (
    <section className="pulse-card" aria-labelledby="pulse-cities-heading" data-testid="pulse-cities">
      <h3 id="pulse-cities-heading">Dream Cities</h3>
      <p className="pulse-hint">Saved on each city, so World shows the same colours. A city without an image appears as its name in its colours.</p>
      {error && <p className="pulse-error" role="alert">{error}</p>}
      {!cities && !error && <p className="pulse-hint"><Loader2 size={14} className="pulse-spin" aria-hidden="true" /> Loading the cities…</p>}
      {cities && (
        <div className="pulse-cities">
          {cities.filter((c) => c?.key).map((city) => (
            <CityCard key={`${city.key}:${city.image_url || ''}:${city.bubble_image_url || ''}:${(city.palette || []).join()}`} city={city} onSaved={setCities} />
          ))}
        </div>
      )}
    </section>
  );
}

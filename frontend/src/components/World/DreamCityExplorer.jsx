/**
 * DreamCityExplorer — the World tab's front page in the LalaVerse hub, to
 * Evoni's mock (2026-10-06): the five DREAM cities as a map of bubbles;
 * pick one to see what it is known for, its venues (from the World
 * locations, with the events that use them) and its schools and
 * companies. Below it sit the illustrated map (its pin positions feed the
 * phone's map) and the Locations list; the old city, school and company
 * cards were dropped from the hub as duplicates of this (2026-10-07).
 *
 * Honest about the data (lib/dreamCityExplorer): a venue counts for a city
 * only when its city field names it; companies and legends carry no city
 * in the data, so the card lists them as not placed in a city yet.
 */
import React, { useState } from 'react';
import { cityPlaces, placeCounts, citySchools, cityCompanies } from '../../lib/dreamCityExplorer';
import './DreamCityExplorer.css';

// Where each city sits on the drawn map (percent of the map), and the
// roads between them, after the mock.
const SPOTS = {
  dazzle_district: { x: 28, y: 44 },
  radiance_row: { x: 57, y: 28 },
  echo_park: { x: 39, y: 72 },
  ascent_tower: { x: 70, y: 62 },
  maverick_harbor: { x: 86, y: 38 },
};
const ROADS = [['dazzle_district', 'radiance_row'], ['radiance_row', 'maverick_harbor'], ['dazzle_district', 'echo_park'], ['echo_park', 'ascent_tower']];
const VENUES_SHOWN = 6;

export default function DreamCityExplorer({ cities, universities, corporations, locations, loading, onAddVenue, onOpenLocations }) {
  const list = (cities || []).filter((c) => c?.key);
  const [selectedKey, setSelectedKey] = useState(() => list[0]?.key || null);
  const city = list.find((c) => c.key === selectedKey) || list[0] || null;
  const counts = placeCounts(locations, list);
  const places = city ? cityPlaces(locations, city) : [];
  const schools = city ? citySchools(universities, city) : [];
  const companies = city ? cityCompanies(corporations, city) : { here: [], unplaced: [] };
  const placed = (key) => Boolean(SPOTS[key]);

  return (
    <div className="dce" data-testid="dream-city-explorer">
      <section className="dce-map" aria-label="The DREAM cities">
        <svg className="dce-roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {ROADS.filter(([a, b]) => placed(a) && placed(b) && list.some((c) => c.key === a) && list.some((c) => c.key === b)).map(([a, b]) => (
            <line key={`${a}-${b}`} x1={SPOTS[a].x} y1={SPOTS[a].y} x2={SPOTS[b].x} y2={SPOTS[b].y} />
          ))}
        </svg>
        <div className="dce-water" aria-hidden="true" />
        <div className="dce-bubbles" role="group" aria-label="Pick a city">
          {list.map((c, i) => {
            const spot = SPOTS[c.key] || { x: 15 + i * 17, y: 50 };
            const active = city?.key === c.key;
            return (
              <button key={c.key} type="button" aria-pressed={active}
                className={`dce-bubble dce-city-${c.letter?.toLowerCase() || 'x'}${active ? ' is-active' : ''}`}
                style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                onClick={() => setSelectedKey(c.key)}>
                <span className="dce-letter" aria-hidden="true">{c.letter}</span>
                <span className="dce-name">{c.name}</span>
                <span className="dce-count">{loading ? '…' : `${counts[c.key] || 0} ${counts[c.key] === 1 ? 'place' : 'places'}`}</span>
              </button>
            );
          })}
        </div>
      </section>

      {city && (
        <div className="dce-side">
          <section className={`dce-card dce-city-card dce-city-${city.letter?.toLowerCase() || 'x'}`} aria-labelledby="dce-city-heading" data-testid="dce-city">
            <div className="dce-kicker">City{city.subtitle ? ` · ${city.subtitle}` : ''}</div>
            <h2 id="dce-city-heading" className="dce-city-name">{city.name}</h2>
            {city.famousFor && <p className="dce-known">Known for {city.famousFor.charAt(0).toLowerCase() + city.famousFor.slice(1)}.</p>}
            {city.energy && <p className="dce-energy">{city.energy}</p>}
          </section>

          <section className="dce-card" aria-labelledby="dce-venues-heading">
            <div className="dce-card-head">
              <h2 id="dce-venues-heading" className="dce-title">Venues</h2>
              <button type="button" className="dce-link" onClick={() => onAddVenue?.(city.name)}>+ Add</button>
            </div>
            {loading ? <p className="dce-note">Loading the places…</p> : places.length === 0 ? (
              <p className="dce-note" data-testid="dce-venues-empty">No places in {city.name} yet. A location whose city is {city.name} shows here.</p>
            ) : (
              <>
                <ul className="dce-venues" data-testid="dce-venues">
                  {places.slice(0, VENUES_SHOWN).map((p) => (
                    <li key={p.id} className="dce-venue">
                      <span className="dce-venue-mark" aria-hidden="true" />
                      <span className="dce-venue-text">
                        <strong>{p.name}</strong>
                        <span>{p.line}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                {places.length > VENUES_SHOWN && (
                  <button type="button" className="dce-link" onClick={() => onOpenLocations?.()}>See all {places.length} in Locations →</button>
                )}
              </>
            )}
          </section>

          <section className="dce-card dce-soft" aria-labelledby="dce-who-heading" data-testid="dce-companies">
            <h2 id="dce-who-heading" className="dce-title">Companies, schools &amp; legends</h2>
            {schools.length > 0 && (
              <ul className="dce-schools">
                {schools.map((u) => (
                  <li key={u.name}><strong>{u.name}</strong>{u.specialization && <span> · {u.specialization}</span>}</li>
                ))}
              </ul>
            )}
            {companies.here.length > 0 && (
              <ul className="dce-schools">
                {companies.here.map((c) => <li key={c.name}><strong>{c.name}</strong>{c.industry && <span> · {c.industry}</span>}</li>)}
              </ul>
            )}
            {schools.length === 0 && companies.here.length === 0 && <p className="dce-note">No school or company is placed in {city.name} yet.</p>}
            {companies.unplaced.length > 0 && (
              <div data-testid="dce-unplaced">
                <p className="dce-note">Not placed in a city yet:</p>
                <ul className="dce-schools">
                  {companies.unplaced.map((c) => <li key={c.name}><strong>{c.name}</strong>{c.industry && <span> · {c.industry}</span>}</li>)}
                </ul>
                <p className="dce-note">Legends are not tied to a city; they are on the Society tab.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

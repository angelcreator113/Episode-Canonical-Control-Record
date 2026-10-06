/**
 * EventsTab — DREAM city events + micro events
 * Shows cultural calendar events grouped by city or month.
 *
 * 2026-10-06: in the hub's design (pages/CultureEvents.css, tokens only).
 * A city's own color from data/dreamCities is only its accent; each
 * cultural category has a tone class.
 */
import React, { useState, useMemo } from 'react';
import { DREAM_CITIES } from '../../data/dreamCities';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Which city a cultural category belongs to when the event names no district.
const CITY_CATEGORIES = {
  dazzle_district: ['fashion'],
  radiance_row: ['beauty'],
  echo_park: ['entertainment', 'music'],
  ascent_tower: ['technology'],
  maverick_harbor: ['lifestyle', 'community'],
};
const CATEGORY_TONES = ['fashion', 'beauty', 'entertainment', 'lifestyle', 'community', 'technology'];

function getCityForEvent(ev) {
  if (ev.lalaverse_district) return DREAM_CITIES.find((c) => c.name === ev.lalaverse_district) || null;
  const cat = (ev.cultural_category || '').toLowerCase();
  return DREAM_CITIES.find((c) => (CITY_CATEGORIES[c.key] || []).includes(cat)) || null;
}
const toneOf = (ev) => (CATEGORY_TONES.includes(ev.cultural_category) ? ev.cultural_category : 'community');
const accent = (color) => (color ? { '--item': color } : undefined);

function EventCard({ ev, city, expanded, onToggle, onCreateEvent, onDelete }) {
  return (
    <div className={`ce-ev ce-cat-${toneOf(ev)}${expanded ? ' is-open' : ''}`} style={accent(city?.color)}>
      <button type="button" className="ce-ev-head" aria-expanded={expanded} onClick={onToggle}>
        <span className="ce-ev-title">{ev.title}</span>
        {city && <span className="ce-ev-letter">{city.letter}</span>}
      </button>
      {ev.start_datetime && !expanded && <div className="ce-ev-meta">{MONTHS[new Date(ev.start_datetime).getUTCMonth()]}</div>}
      {expanded && (
        <div className="ce-ev-body">
          {city && <div className="ce-ev-city">{city.icon} {city.name}</div>}
          {ev.what_world_knows && <p>{ev.what_world_knows}</p>}
          {ev.location_name && <div className="ce-ev-meta">📍 {ev.location_name}</div>}
          {ev.start_datetime && <div className="ce-ev-meta">📅 {new Date(ev.start_datetime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}</div>}
          <div className="ce-ev-actions">
            <button type="button" className="ce-btn" onClick={() => onCreateEvent(ev)}>Create World Event</button>
            <button type="button" className="ce-btn is-danger" onClick={() => { if (confirm(`Delete "${ev.title}"?`)) onDelete(ev.id); }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EventsTab({ events, loading, onCreateEvent, onDelete }) {
  const [calView, setCalView] = useState('city');
  const [expandedId, setExpandedId] = useState(null);

  const majorEvents = events.filter((e) => !e.is_micro_event);
  const microEvents = events.filter((e) => e.is_micro_event);

  const byMonth = useMemo(() => {
    const map = {}; MONTHS.forEach((_, i) => { map[i] = []; });
    majorEvents.forEach((ev) => { const m = new Date(ev.start_datetime).getUTCMonth(); if (map[m]) map[m].push(ev); });
    return map;
  }, [majorEvents]);

  if (loading) return <p className="ce-note">Loading events…</p>;

  const card = (ev, city) => (
    <EventCard key={ev.id} ev={ev} city={city} expanded={expandedId === ev.id} onToggle={() => setExpandedId(expandedId === ev.id ? null : ev.id)} onCreateEvent={onCreateEvent} onDelete={onDelete} />
  );

  return (
    <div className="ce-panel">
      {/* Counts by city + view toggle */}
      <div className="ce-toolbar">
        <div className="ce-city-counts">
          {DREAM_CITIES.map((c) => {
            const count = majorEvents.filter((ev) => getCityForEvent(ev)?.key === c.key).length;
            return (
              <div key={c.key} className="ce-city-count" style={accent(c.color)} title={c.name}>
                <span className="ce-city-letter">{c.letter}</span>
                <span className="ce-city-n">{count}</span>
              </div>
            );
          })}
          <div className="ce-city-count is-total"><span className="ce-city-letter">Total</span><span className="ce-city-n">{events.length}</span></div>
        </div>
        <div className="ce-seg" role="group" aria-label="View">
          {['city', 'month'].map((v) => (
            <button key={v} type="button" aria-pressed={calView === v} className={calView === v ? 'is-active' : ''} onClick={() => setCalView(v)}>
              By {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {calView === 'city' && (
        <div className="ce-columns">
          {DREAM_CITIES.map((city) => {
            const cityEvents = majorEvents.filter((ev) => getCityForEvent(ev)?.key === city.key);
            return (
              <div key={city.key} className="ce-column" style={accent(city.color)}>
                <div className="ce-column-head">
                  <span aria-hidden="true">{city.icon}</span>
                  <div><strong>{city.name}</strong><span>{cityEvents.length} events</span></div>
                </div>
                {cityEvents.length > 0 ? cityEvents.map((ev) => card(ev, city)) : <p className="ce-empty">No events yet</p>}
              </div>
            );
          })}
        </div>
      )}

      {calView === 'month' && (
        <div className="ce-months-grid">
          {MONTHS.map((m, i) => (
            <div key={m} className="ce-column">
              <div className="ce-column-head"><div><strong>{m}</strong><span>{(byMonth[i] || []).length} events</span></div></div>
              {(byMonth[i] || []).length > 0 ? byMonth[i].map((ev) => card(ev, getCityForEvent(ev))) : <p className="ce-empty">—</p>}
            </div>
          ))}
        </div>
      )}

      {microEvents.length > 0 && (
        <>
          <h3 className="ce-h3">Micro events ({microEvents.length})</h3>
          <div className="ce-grid">
            {microEvents.map((ev) => {
              const city = getCityForEvent(ev);
              return (
                <div key={ev.id} className={`ce-ev ce-cat-${toneOf(ev)}`} style={accent(city?.color)}>
                  <div className="ce-ev-head is-static"><span className="ce-ev-title">{ev.title}</span>{city && <span className="ce-ev-letter">{city.letter}</span>}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

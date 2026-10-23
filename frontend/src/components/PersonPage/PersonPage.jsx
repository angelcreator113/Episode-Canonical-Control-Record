/**
 * The character page's Person tab (Evoni, 2026-10-23: "one person page":
 * story details, Pulse account, relationships, family and episode history
 * in one place). One read, GET /api/v1/person/:id (routes/person.js), in
 * this order:
 *
 *   1 Who they are        name, also known as, role, a line about them
 *   2 Their Pulse account handle, followers, their tie to Lala
 *   3 Relationships       stage, love interest, who knows, different online
 *   4 Family              the Family section (components/CharacterFamily)
 *   5 Episode history     newest first, with what changed for them
 *   6 What the writers know  the script writer's own lines about them
 *
 * A row of chips at the top jumps to each section and stays in view.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../../services/api';
import { API_URL } from '../../config/api';
import FamilySection from '../CharacterFamily/FamilySection';
import PersonWho from './PersonWho';
import PersonPulse from './PersonPulse';
import PersonRelationships from './PersonRelationships';
import PersonEpisodes from './PersonEpisodes';
import PersonWriters from './PersonWriters';
import './PersonPage.css';

export const getPersonApi = (id) => apiClient.get(`${API_URL}/person/${id}`);

export const SECTIONS = [
  ['who', 'Who they are'],
  ['pulse', 'Pulse'],
  ['relationships', 'Relationships'],
  ['family', 'Family'],
  ['episodes', 'Episodes'],
  ['writers', 'What the writers know'],
];
export const sectionId = (key) => `person-${key}`;

export default function PersonPage({ character, openTab }) {
  const [person, setPerson] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState('who');
  const navRef = useRef(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getPersonApi(character.id);
      setPerson(res.data?.person || null);
    } catch (err) {
      console.error('[PersonPage] load failed:', err);
      setError(err.response?.data?.error || 'Could not load their page.');
    }
  }, [character.id]);
  useEffect(() => { load(); }, [load]);

  // The chip for the section in view lights up as the page scrolls.
  useEffect(() => {
    if (!person || typeof IntersectionObserver === 'undefined') return undefined;
    const seen = new Map();
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target.id, e.isIntersecting));
      const first = SECTIONS.find(([k]) => seen.get(sectionId(k)));
      if (first) setActive(first[0]);
    }, { rootMargin: '-80px 0px -55% 0px' });
    SECTIONS.forEach(([k]) => { const el = document.getElementById(sectionId(k)); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [person]);

  // Keep the lit chip in view in the chip row (it scrolls sideways on a phone).
  useEffect(() => {
    const bar = navRef.current;
    const el = bar?.querySelector('.pp-chip.is-on');
    if (bar && el) bar.scrollLeft = Math.max(0, el.offsetLeft - (bar.clientWidth - el.offsetWidth) / 2);
  }, [active]);

  const jump = (key) => {
    setActive(key);
    document.getElementById(sectionId(key))?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  if (error) {
    return (
      <div className="ch-card" role="alert">
        <p className="ch-note is-error">{error}</p>
        <button type="button" className="ch-pill-btn pp-retry" onClick={load}>Try again</button>
      </div>
    );
  }
  if (!person) return <div className="ch-card"><p className="ch-note" role="status">Loading their page…</p></div>;

  return (
    <div className="pp" data-testid="person-page">
      <nav className="pp-nav" aria-label="Person sections" ref={navRef}>
        {SECTIONS.map(([key, label]) => (
          <a key={key} href={`#${sectionId(key)}`} className={`pp-chip${active === key ? ' is-on' : ''}`}
            aria-current={active === key ? 'true' : undefined}
            onClick={(e) => { e.preventDefault(); jump(key); }}>{label}</a>
        ))}
      </nav>
      <div className="pp-grid">
        <div id={sectionId('who')} className="pp-sec"><PersonWho who={person.who} openTab={openTab} /></div>
        <div id={sectionId('pulse')} className="pp-sec">
          <PersonPulse pulse={person.pulse} lalaTie={person.lala_tie} isLala={person.who?.is_lala} />
        </div>
        <div id={sectionId('relationships')} className="pp-sec is-wide">
          <PersonRelationships characterId={person.id} relationships={person.relationships} />
        </div>
        <div id={sectionId('family')} className="pp-sec is-wide"><FamilySection character={character} /></div>
        <div id={sectionId('episodes')} className="pp-sec is-wide"><PersonEpisodes episodes={person.episodes} /></div>
        <div id={sectionId('writers')} className="pp-sec is-wide"><PersonWriters writers={person.writers} /></div>
      </div>
    </div>
  );
}

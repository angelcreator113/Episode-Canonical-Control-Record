/**
 * AwardsMediaTab — Awards, media outlets, algorithm, drama
 * The power structures that cover and amplify cultural events.
 *
 * 2026-10-06: in the hub's design (pages/CultureEvents.css, tokens only);
 * an item's own color from the data is only its accent.
 *
 * Its lists are the cultural_calendar page's; with the page's lists in
 * editing (components/PageEdit/ListEditor, wiring map fix-list item 21)
 * each item has Edit and Remove and each list its "+ Add".
 */
import React from 'react';
import { AWARD_SHOWS, GOSSIP_MEDIA, ALGORITHM_FORCES, DRAMA_MECHANICS } from '../../data/calendarData';
import { ItemActions, AddToList } from '../PageEdit/ListEditor';

const PAGE = 'cultural_calendar';
const accent = (color) => (color ? { '--item': color } : undefined);

export default function AwardsMediaTab({ data, lists }) {
  const editing = Boolean(lists?.editing);
  const listOf = (key, defaults) => data[key] || defaults;
  const actions = (key, i, item, name, what) => (editing ? (
    <ItemActions name={name || what} onEdit={() => lists.edit(PAGE, key, i, item, what)} onRemove={() => lists.remove(PAGE, key, i, name)} />
  ) : null);
  const adder = (key, defaults, what) => (editing ? (
    <AddToList what={what} onAdd={() => lists.add(PAGE, key, listOf(key, defaults), what)} />
  ) : null);

  return (
    <div className="ce-panel">
      <p className="ce-intro"><strong>How events become stories.</strong> Award shows create momentum. Media outlets control the narrative. The algorithm decides who sees what. Drama mechanics drive engagement. Together, they decide which events matter and which get forgotten.</p>

      <h3 className="ce-h3">Award shows</h3>
      <div className="ce-grid ce-grid-wide">
        {listOf('AWARD_SHOWS', AWARD_SHOWS).map((s, i) => (
          <div key={`${i}-${s.name}`} className="ce-card ce-accent-top" style={accent(s.color)}>
            <div className="ce-card-top"><strong className="ce-card-title"><span aria-hidden="true">{s.icon}</span> {s.name}</strong><span className="ce-pill">{s.month}</span></div>
            <p className="ce-card-text">{s.desc}</p>
            <div className="ce-chips">{(s.categories || []).map((c) => <span key={c} className="ce-chip-mini">{c}</span>)}</div>
            {actions('AWARD_SHOWS', i, s, s.name, 'award show')}
          </div>
        ))}
      </div>
      {adder('AWARD_SHOWS', AWARD_SHOWS, 'award show')}

      <h3 className="ce-h3">Media outlets · who controls the narrative</h3>
      <div className="ce-grid">
        {listOf('GOSSIP_MEDIA', GOSSIP_MEDIA).map((m, i) => (
          <div key={`${i}-${m.name}`} className="ce-card ce-accent-top" style={accent(m.color?.text)}>
            <strong className="ce-card-title">{m.name}</strong>
            <span className="ce-meta">{m.focus}</span>
            {m.style && <span className="ce-chip-mini">{m.style}</span>}
            <p className="ce-quote">{m.power}</p>
            {actions('GOSSIP_MEDIA', i, m, m.name, 'media outlet')}
          </div>
        ))}
      </div>
      {adder('GOSSIP_MEDIA', GOSSIP_MEDIA, 'media outlet')}

      <div className="ce-two">
        <div>
          <h3 className="ce-h3">Algorithm forces</h3>
          <p className="ce-note">What decides visibility on the Feed.</p>
          {listOf('ALGORITHM_FORCES', ALGORITHM_FORCES).map((f, i) => (
            <div key={`${i}-${f.name}`} className="ce-row ce-accent-left" style={accent(f.color)}>
              <strong><span aria-hidden="true">{f.icon}</span> {f.name}</strong>
              <span className="ce-meta">{f.measuredBy}</span>
              {f.effect && <span className="ce-card-text">{f.effect}</span>}
              {f.storyHook && <span className="ce-quote">{f.storyHook}</span>}
              {actions('ALGORITHM_FORCES', i, f, f.name, 'algorithm force')}
            </div>
          ))}
          {adder('ALGORITHM_FORCES', ALGORITHM_FORCES, 'algorithm force')}
        </div>
        <div>
          <h3 className="ce-h3">Drama mechanics</h3>
          <p className="ce-note">What drives viral engagement.</p>
          {listOf('DRAMA_MECHANICS', DRAMA_MECHANICS).map((d, i) => (
            <div key={`${i}-${d.type}`} className="ce-row ce-accent-left" style={accent(d.color)}>
              <strong><span aria-hidden="true">{d.icon}</span> {d.type}</strong>
              <span className="ce-meta">{d.trigger}</span>
              {d.feedEffect && <span className="ce-card-text">{d.feedEffect}</span>}
              {d.storyThread && <span className="ce-quote">{d.storyThread}</span>}
              {actions('DRAMA_MECHANICS', i, d, d.type, 'drama mechanic')}
            </div>
          ))}
          {adder('DRAMA_MECHANICS', DRAMA_MECHANICS, 'drama mechanic')}
        </div>
      </div>
    </div>
  );
}

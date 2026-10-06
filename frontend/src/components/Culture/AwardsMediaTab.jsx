/**
 * AwardsMediaTab — Awards, media outlets, algorithm, drama
 * The power structures that cover and amplify cultural events.
 *
 * 2026-10-06: in the hub's design (pages/CultureEvents.css, tokens only);
 * an item's own color from the data is only its accent.
 */
import React from 'react';
import { AWARD_SHOWS, GOSSIP_MEDIA, ALGORITHM_FORCES, DRAMA_MECHANICS } from '../../data/calendarData';

const accent = (color) => (color ? { '--item': color } : undefined);

export default function AwardsMediaTab({ data }) {
  return (
    <div className="ce-panel">
      <p className="ce-intro"><strong>How events become stories.</strong> Award shows create momentum. Media outlets control the narrative. The algorithm decides who sees what. Drama mechanics drive engagement. Together, they decide which events matter and which get forgotten.</p>

      <h3 className="ce-h3">Award shows</h3>
      <div className="ce-grid ce-grid-wide">
        {(data.AWARD_SHOWS || AWARD_SHOWS).map((s) => (
          <div key={s.name} className="ce-card ce-accent-top" style={accent(s.color)}>
            <div className="ce-card-top"><strong className="ce-card-title"><span aria-hidden="true">{s.icon}</span> {s.name}</strong><span className="ce-pill">{s.month}</span></div>
            <p className="ce-card-text">{s.desc}</p>
            <div className="ce-chips">{(s.categories || []).map((c) => <span key={c} className="ce-chip-mini">{c}</span>)}</div>
          </div>
        ))}
      </div>

      <h3 className="ce-h3">Media outlets · who controls the narrative</h3>
      <div className="ce-grid">
        {(data.GOSSIP_MEDIA || GOSSIP_MEDIA).map((m) => (
          <div key={m.name} className="ce-card ce-accent-top" style={accent(m.color?.text)}>
            <strong className="ce-card-title">{m.name}</strong>
            <span className="ce-meta">{m.focus}</span>
            {m.style && <span className="ce-chip-mini">{m.style}</span>}
            <p className="ce-quote">{m.power}</p>
          </div>
        ))}
      </div>

      <div className="ce-two">
        <div>
          <h3 className="ce-h3">Algorithm forces</h3>
          <p className="ce-note">What decides visibility on the Feed.</p>
          {(data.ALGORITHM_FORCES || ALGORITHM_FORCES).map((f) => (
            <div key={f.name} className="ce-row ce-accent-left" style={accent(f.color)}>
              <strong><span aria-hidden="true">{f.icon}</span> {f.name}</strong>
              <span className="ce-meta">{f.measuredBy}</span>
              {f.effect && <span className="ce-card-text">{f.effect}</span>}
              {f.storyHook && <span className="ce-quote">{f.storyHook}</span>}
            </div>
          ))}
        </div>
        <div>
          <h3 className="ce-h3">Drama mechanics</h3>
          <p className="ce-note">What drives viral engagement.</p>
          {(data.DRAMA_MECHANICS || DRAMA_MECHANICS).map((d) => (
            <div key={d.type} className="ce-row ce-accent-left" style={accent(d.color)}>
              <strong><span aria-hidden="true">{d.icon}</span> {d.type}</strong>
              <span className="ce-meta">{d.trigger}</span>
              {d.feedEffect && <span className="ce-card-text">{d.feedEffect}</span>}
              {d.storyThread && <span className="ce-quote">{d.storyThread}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

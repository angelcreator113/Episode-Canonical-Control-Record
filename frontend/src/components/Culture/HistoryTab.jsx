/**
 * HistoryTab — How the world remembers (merged Memory + Legacy)
 * Memory types, strength, archives, feuds, nostalgia, capsules, rankings.
 *
 * 2026-10-06: in the hub's design (pages/CultureEvents.css, tokens only);
 * an item's own color from the data is only its accent.
 */
import { useState } from 'react';
import { MEMORY_TYPES, STRENGTH_LEVELS, ARCHIVES, LEGEND_PATHS, FEUD_STAGES, NOSTALGIA_WAVES, CAPSULE_TYPES, RANKING_METRICS } from '../../data/memoryData';

const SECTIONS = [
  { key: 'how', label: 'How Memory Works' },
  { key: 'archives', label: 'Archives' },
  { key: 'legends', label: 'Legends & Feuds' },
  { key: 'nostalgia', label: 'Nostalgia & Capsules' },
];

const accent = (color) => (color ? { '--item': color } : undefined);

/** A pair of boxes: what is kept (green) and what is lost (red). */
function Pair({ keepLabel, keep, loseLabel, lose }) {
  return (
    <div className="ce-pair">
      <div className="ce-keep"><span className="ce-label">{keepLabel}</span><p>{keep}</p></div>
      <div className="ce-lose"><span className="ce-label">{loseLabel}</span><p>{lose}</p></div>
    </div>
  );
}

export default function HistoryTab({ data }) {
  const [section, setSection] = useState('how');

  return (
    <div className="ce-panel">
      <p className="ce-intro"><strong>Memory is power.</strong> Who controls the archive controls the history. What gets remembered shapes what happens next. This tab defines how the LalaVerse processes its past.</p>

      <div className="ce-seg" role="group" aria-label="History sections">
        {SECTIONS.map((s) => (
          <button key={s.key} type="button" aria-pressed={section === s.key} className={section === s.key ? 'is-active' : ''} onClick={() => setSection(s.key)}>{s.label}</button>
        ))}
      </div>

      {section === 'how' && (
        <>
          <h3 className="ce-h3">Memory types · what gets remembered</h3>
          <div className="ce-grid ce-grid-wide">
            {(data.MEMORY_TYPES || MEMORY_TYPES).map((m) => (
              <div key={m.type} className="ce-card">
                <strong className="ce-card-title"><span aria-hidden="true">{m.icon}</span> {m.type}</strong>
                <p className="ce-card-text">{m.created}</p>
                <div className="ce-callout"><span className="ce-label">How it's referenced</span><p className="ce-quote">{m.referenced}</p></div>
              </div>
            ))}
          </div>

          <h3 className="ce-h3">Strength levels · how long it lasts</h3>
          <div className="ce-grid">
            {(data.STRENGTH_LEVELS || STRENGTH_LEVELS).map((s) => (
              <div key={s.level} className="ce-card ce-accent-top is-centered" style={accent(s.color)}>
                <span className="ce-step">{s.level}</span>
                <strong className="ce-card-title">{s.name}</strong>
                <span className="ce-meta">{s.lifespan}</span>
                <p className="ce-card-text">{s.example}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {section === 'archives' && (
        <>
          <h3 className="ce-h3">Institutional archives · who controls the record</h3>
          <div className="ce-grid ce-grid-wide">
            {(data.ARCHIVES || ARCHIVES).map((a) => (
              <div key={a.name} className="ce-card ce-accent-left" style={accent(a.accent)}>
                <strong className="ce-card-title">{a.name}</strong>
                <span className="ce-meta">Maintained by: {a.maintained}</span>
                <Pair keepLabel="What it tracks" keep={a.tracks} loseLabel="What it leaves out" lose={a.leaves_out} />
                <div className="ce-callout"><span className="ce-label">Who controls the narrative</span><p className="ce-quote">{a.control}</p></div>
              </div>
            ))}
          </div>

          <h3 className="ce-h3">Influence rankings · how impact is measured</h3>
          <div className="ce-grid ce-grid-wide">
            {(data.RANKING_METRICS || RANKING_METRICS).map((r) => (
              <div key={r.metric} className="ce-card">
                <strong className="ce-card-title">{r.metric}</strong>
                <p className="ce-card-text">{r.measures}</p>
                <span className="ce-meta">Measured by: {r.measured_by}</span>
                <span className="ce-misses">Misses: {r.misses}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {section === 'legends' && (
        <>
          <h3 className="ce-h3">Paths to legendary status</h3>
          <div className="ce-grid ce-grid-wide">
            {(data.LEGEND_PATHS || LEGEND_PATHS).map((l) => (
              <div key={l.path} className="ce-card">
                <strong className="ce-card-title">{l.path}</strong>
                <Pair keepLabel="Requires" keep={l.requires} loseLabel="Costs" lose={l.costs} />
              </div>
            ))}
          </div>

          <h3 className="ce-h3">Historical feuds · how rivalries evolve</h3>
          <ol className="ce-stages">
            {(data.FEUD_STAGES || FEUD_STAGES).map((f) => (
              <li key={f.stage} className="ce-card ce-accent-top" style={accent(f.color)}>
                <strong className="ce-card-title">{f.stage}</strong>
                <p className="ce-card-text">{f.looks}</p>
                <span className="ce-meta">{f.attention}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      {section === 'nostalgia' && (
        <>
          <h3 className="ce-h3">Nostalgia waves · when the past returns</h3>
          <div className="ce-grid ce-grid-wide">
            {(data.NOSTALGIA_WAVES || NOSTALGIA_WAVES).map((n) => (
              <div key={n.type} className="ce-card">
                <strong className="ce-card-title">{n.type}</strong>
                <p className="ce-card-text">{n.returns}</p>
                <div className="ce-callout"><span className="ce-label">The gap</span><p className="ce-quote">{n.gap}</p></div>
              </div>
            ))}
          </div>

          <h3 className="ce-h3">Time capsules · retrospectives that rewrite history</h3>
          <div className="ce-list">
            {(data.CAPSULE_TYPES || CAPSULE_TYPES).map((c) => (
              <div key={c.type} className="ce-card">
                <div className="ce-card-top"><strong className="ce-card-title">{c.type}</strong><span className="ce-meta">{c.made_by}</span></div>
                <Pair keepLabel="Included" keep={c.included} loseLabel="Left out" lose={c.left_out} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

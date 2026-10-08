/**
 * HistoryTab — How the world remembers (merged Memory + Legacy)
 * Memory types, strength, archives, feuds, nostalgia, capsules, rankings.
 *
 * 2026-10-06: in the hub's design (pages/CultureEvents.css, tokens only);
 * an item's own color from the data is only its accent.
 *
 * Its lists are the cultural_memory page's; with the page's lists in
 * editing (components/PageEdit/ListEditor, wiring map fix-list item 21)
 * each item has Edit and Remove and each list its "+ Add".
 */
import { useState } from 'react';
import { MEMORY_TYPES, STRENGTH_LEVELS, ARCHIVES, LEGEND_PATHS, FEUD_STAGES, NOSTALGIA_WAVES, CAPSULE_TYPES, RANKING_METRICS } from '../../data/memoryData';
import { ItemActions, AddToList } from '../PageEdit/ListEditor';

const PAGE = 'cultural_memory';

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

export default function HistoryTab({ data, lists }) {
  const [section, setSection] = useState('how');
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
            {listOf('MEMORY_TYPES', MEMORY_TYPES).map((m, i) => (
              <div key={`${i}-${m.type}`} className="ce-card">
                <strong className="ce-card-title"><span aria-hidden="true">{m.icon}</span> {m.type}</strong>
                <p className="ce-card-text">{m.created}</p>
                <div className="ce-callout"><span className="ce-label">How it's referenced</span><p className="ce-quote">{m.referenced}</p></div>
                {actions('MEMORY_TYPES', i, m, m.type, 'memory type')}
              </div>
            ))}
          </div>
          {adder('MEMORY_TYPES', MEMORY_TYPES, 'memory type')}

          <h3 className="ce-h3">Strength levels · how long it lasts</h3>
          <div className="ce-grid">
            {listOf('STRENGTH_LEVELS', STRENGTH_LEVELS).map((s, i) => (
              <div key={`${i}-${s.level}`} className="ce-card ce-accent-top is-centered" style={accent(s.color)}>
                <span className="ce-step">{s.level}</span>
                <strong className="ce-card-title">{s.name}</strong>
                <span className="ce-meta">{s.lifespan}</span>
                <p className="ce-card-text">{s.example}</p>
                {actions('STRENGTH_LEVELS', i, s, s.name, 'strength level')}
              </div>
            ))}
          </div>
          {adder('STRENGTH_LEVELS', STRENGTH_LEVELS, 'strength level')}
        </>
      )}

      {section === 'archives' && (
        <>
          <h3 className="ce-h3">Institutional archives · who controls the record</h3>
          <div className="ce-grid ce-grid-wide">
            {listOf('ARCHIVES', ARCHIVES).map((a, i) => (
              <div key={`${i}-${a.name}`} className="ce-card ce-accent-left" style={accent(a.accent)}>
                <strong className="ce-card-title">{a.name}</strong>
                <span className="ce-meta">Maintained by: {a.maintained}</span>
                <Pair keepLabel="What it tracks" keep={a.tracks} loseLabel="What it leaves out" lose={a.leaves_out} />
                <div className="ce-callout"><span className="ce-label">Who controls the narrative</span><p className="ce-quote">{a.control}</p></div>
                {actions('ARCHIVES', i, a, a.name, 'archive')}
              </div>
            ))}
          </div>
          {adder('ARCHIVES', ARCHIVES, 'archive')}

          <h3 className="ce-h3">Influence rankings · how impact is measured</h3>
          <div className="ce-grid ce-grid-wide">
            {listOf('RANKING_METRICS', RANKING_METRICS).map((r, i) => (
              <div key={`${i}-${r.metric}`} className="ce-card">
                <strong className="ce-card-title">{r.metric}</strong>
                <p className="ce-card-text">{r.measures}</p>
                <span className="ce-meta">Measured by: {r.measured_by}</span>
                <span className="ce-misses">Misses: {r.misses}</span>
                {actions('RANKING_METRICS', i, r, r.metric, 'ranking metric')}
              </div>
            ))}
          </div>
          {adder('RANKING_METRICS', RANKING_METRICS, 'ranking metric')}
        </>
      )}

      {section === 'legends' && (
        <>
          <h3 className="ce-h3">Paths to legendary status</h3>
          <div className="ce-grid ce-grid-wide">
            {listOf('LEGEND_PATHS', LEGEND_PATHS).map((l, i) => (
              <div key={`${i}-${l.path}`} className="ce-card">
                <strong className="ce-card-title">{l.path}</strong>
                <Pair keepLabel="Requires" keep={l.requires} loseLabel="Costs" lose={l.costs} />
                {actions('LEGEND_PATHS', i, l, l.path, 'legend path')}
              </div>
            ))}
          </div>
          {adder('LEGEND_PATHS', LEGEND_PATHS, 'legend path')}

          <h3 className="ce-h3">Historical feuds · how rivalries evolve</h3>
          <ol className="ce-stages">
            {listOf('FEUD_STAGES', FEUD_STAGES).map((f, i) => (
              <li key={`${i}-${f.stage}`} className="ce-card ce-accent-top" style={accent(f.color)}>
                <strong className="ce-card-title">{f.stage}</strong>
                <p className="ce-card-text">{f.looks}</p>
                <span className="ce-meta">{f.attention}</span>
                {actions('FEUD_STAGES', i, f, f.stage, 'feud stage')}
              </li>
            ))}
          </ol>
          {adder('FEUD_STAGES', FEUD_STAGES, 'feud stage')}
        </>
      )}

      {section === 'nostalgia' && (
        <>
          <h3 className="ce-h3">Nostalgia waves · when the past returns</h3>
          <div className="ce-grid ce-grid-wide">
            {listOf('NOSTALGIA_WAVES', NOSTALGIA_WAVES).map((n, i) => (
              <div key={`${i}-${n.type}`} className="ce-card">
                <strong className="ce-card-title">{n.type}</strong>
                <p className="ce-card-text">{n.returns}</p>
                <div className="ce-callout"><span className="ce-label">The gap</span><p className="ce-quote">{n.gap}</p></div>
                {actions('NOSTALGIA_WAVES', i, n, n.type, 'nostalgia wave')}
              </div>
            ))}
          </div>
          {adder('NOSTALGIA_WAVES', NOSTALGIA_WAVES, 'nostalgia wave')}

          <h3 className="ce-h3">Time capsules · retrospectives that rewrite history</h3>
          <div className="ce-list">
            {listOf('CAPSULE_TYPES', CAPSULE_TYPES).map((c, i) => (
              <div key={`${i}-${c.type}`} className="ce-card">
                <div className="ce-card-top"><strong className="ce-card-title">{c.type}</strong><span className="ce-meta">{c.made_by}</span></div>
                <Pair keepLabel="Included" keep={c.included} loseLabel="Left out" lose={c.left_out} />
                {actions('CAPSULE_TYPES', i, c, c.type, 'time capsule')}
              </div>
            ))}
          </div>
          {adder('CAPSULE_TYPES', CAPSULE_TYPES, 'time capsule')}
        </>
      )}
    </div>
  );
}

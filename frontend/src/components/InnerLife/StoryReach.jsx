/**
 * Where it goes (Evoni, 2026-10-17, step 4): for each writer that turns
 * this character into content, the parts of their inner life it actually
 * reads (lib/storyReach), with this character's words, and what no writer
 * reads yet. Read-only; nothing here is generated.
 */
import { useState } from 'react';
import { reachOf, unreached } from '../../lib/storyReach';

const KINDS = [
  ['shows', 'What they show', 'Their public voice comes from this.'],
  ['private', 'Guides the writing, never said', 'Sent marked private: it shapes the writing and is never stated.'],
  ['unmarked', 'Sent with no private mark', 'Sent with no instruction to keep it private, so it can surface in what is written.'],
];

function Items({ items }) {
  return (
    <ul className="il-reach-items">
      {items.map((i) => (
        <li key={i.field} className={i.text ? '' : 'is-empty'}>
          <span className="il-reach-name">{i.label}</span>
          {i.text ? <span className="il-reach-text">{i.text}</span> : <span className="il-reach-none">empty</span>}
        </li>
      ))}
    </ul>
  );
}

export default function StoryReach({ character, isAuthor }) {
  const writers = reachOf(character, isAuthor);
  const notRead = unreached(character, isAuthor);
  const [open, setOpen] = useState(() => new Set(['posts']));
  const toggle = (key) => setOpen((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const written = notRead.filter((i) => i.text);

  return (
    <div className="il-reach">
      <ul className="il-reach-writers">
        {writers.map((w) => {
          const total = w.shows.length + w.private.length + w.unmarked.length;
          const got = [...w.shows, ...w.private, ...w.unmarked].filter((i) => i.text).length;
          const isOpen = open.has(w.key);
          return (
            <li key={w.key} className={`il-reach-writer${isOpen ? ' is-open' : ''}`} data-testid={`il-reach-${w.key}`}>
              <button type="button" className="il-reach-head" aria-expanded={isOpen} onClick={() => toggle(w.key)}>
                <span className="il-reach-title">{w.label}</span>
                <span className="il-count">{total ? `${got} of ${total} written` : 'reads none of it'}</span>
              </button>
              {isOpen && (
                <div className="il-reach-body">
                  <p className="il-note">{w.where}.</p>
                  {w.note && <p className="il-note">{w.note}</p>}
                  {KINDS.filter(([k]) => w[k].length).map(([k, title, about]) => (
                    <section key={k} className={`il-reach-kind is-${k}`}>
                      <h5 className="il-reach-kind-title" title={about}>{title}</h5>
                      <Items items={w[k]} />
                    </section>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <section className="il-reach-unread" aria-labelledby="il-reach-unread-h">
        <h4 id="il-reach-unread-h" className="il-subject-title">Reaches no writer yet</h4>
        <p className="il-note">
          {written.length
            ? `${written.length} written ${written.length === 1 ? 'part' : 'parts'} of their inner life ${written.length === 1 ? 'is' : 'are'} kept here but read by none of the writers above.`
            : 'Nothing written here is left unread.'}
        </p>
        <Items items={notRead} />
      </section>
    </div>
  );
}

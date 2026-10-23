/**
 * Who they are, in the character page's header (Evoni, 2026-10-23): what
 * the header did not already say. The header has their name, "Online as"
 * and their role; this adds the other names they go by (their Pulse
 * profile's aliases) and one line about them.
 */
import './PersonWho.css';

const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/**
 * One line about them: the first sentence of their prose, description or
 * core belief, at most 200 characters (as services/personPage summaryOf).
 */
export function summaryOf(character) {
  const text = clean(character?.prose_overview) || clean(character?.description) || clean(character?.core_belief);
  if (!text) return null;
  const first = (text.match(/^.+?[.!?](?=\s|$)/) || [text])[0];
  return first.length > 200 ? `${first.slice(0, 199).trimEnd()}…` : first;
}

export default function PersonWho({ aliases = [], summary = null, name = null }) {
  const akas = [...new Set(aliases.map(clean).filter((a) => a && a !== name))];
  if (!akas.length && !summary) return null;
  return (
    <div className="pw" data-testid="person-who">
      {akas.length > 0 && (
        <p className="pw-akas">
          <span className="pw-label">Also known as</span>
          {akas.map((a) => <span key={a} className="pw-aka">{a}</span>)}
        </p>
      )}
      {summary && <p className="pw-summary" data-testid="person-summary">{summary}</p>}
    </div>
  );
}

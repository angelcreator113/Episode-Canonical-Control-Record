/**
 * PulseStrip — "From the Pulse" on the Seeds tab (2026-10-24, one inbox):
 * the Pulse's suggested pairs (GET /feed-relationships/suggestions, the
 * Relationship Map's SuggestedPairs) whose two creators are both registry
 * characters in the cast (characters carry feed_profile_id), each with Add
 * to Seeds. A pair the cast already has, as a seed or a relationship, is
 * left out.
 * Prime Studios · LalaVerse
 */
import { Radio } from 'lucide-react';
import { cname } from './tokens';
import { Btn } from './primitives';

// A Pulse kind (services/pairSuggestions START_KINDS) as one of the app's
// types (tokens REL_PRESETS, the list the server checks).
export const PULSE_TYPE = {
  collab: 'collaborator', rival: 'rival', feud: 'rival', shade: 'rival', copycat: 'rival',
  mentor: 'mentor', bestie: 'best friend', orbit: 'friend',
};

const pairKey = (a, b) => [String(a), String(b)].sort().join('|');

/**
 * The suggestions this cast can take: each with its two characters, minus
 * pairs that already have a seed or a relationship (any type).
 */
export function pulseSeedsFor(pairs, chars, taken = []) {
  const byFeed = new Map();
  for (const c of chars || []) {
    if (c && c.feed_profile_id != null && c.feed_profile_id !== '') byFeed.set(String(c.feed_profile_id), c);
  }
  const have = new Set((taken || []).map(r => pairKey(r.character_id_a, r.character_id_b)));
  const out = [];
  for (const p of pairs || []) {
    const a = byFeed.get(String(p?.a ?? p?.profile_a?.id));
    const b = byFeed.get(String(p?.b ?? p?.profile_b?.id));
    if (!a || !b || a.id === b.id || have.has(pairKey(a.id, b.id))) continue;
    out.push({ ...p, charA: a, charB: b });
  }
  return out;
}

/** A Pulse suggestion as a POST /seeds seed. */
export function pulseSeed(p) {
  const why = typeof p.why === 'string' ? p.why.trim() : '';
  return {
    character_id_a: p.charA.id,
    character_id_b: p.charB.id,
    relationship_type: PULSE_TYPE[p.type] || 'friend',
    is_romantic: false,
    situation: why || null,
    seed_why: why ? why.slice(0, 140) : `Suggested on the Pulse as ${String(p.type || 'a pair').replace(/_/g, ' ')}.`,
    seed_basis: { facts: [`On the Pulse: ${String(p.type || 'pair').replace(/_/g, ' ')}`] },
  };
}

const at = h => (h ? `@${String(h).replace(/^@+/, '')}` : null);

export default function PulseStrip({ pairs, busyKey, onAdd }) {
  if (!pairs.length) return null;
  return (
    <section className="re-pulse-strip" aria-label="From the Pulse">
      <div className="re-pulse-head">
        <Radio size={16} aria-hidden />
        <span className="re-pulse-title">From the Pulse</span>
        <span className="re-pulse-sub">Creators who share or compete for an audience, both in the cast</span>
      </div>
      <ul className="re-pulse-list">
        {pairs.map(p => {
          const pair = `${cname(p.charA)} ↔ ${cname(p.charB)}`;
          const handles = [at(p.profile_a?.handle), at(p.profile_b?.handle)].filter(Boolean).join(' and ');
          return (
            <li key={p.key} className="re-pulse-row">
              <div className="re-pulse-text">
                <div className="re-pulse-pair">{pair} <span className="re-pulse-kind">· {String(p.type || 'pair').replace(/_/g, ' ')}</span></div>
                {handles && <div className="re-pulse-handles">{handles}</div>}
                {p.why && <div className="re-pulse-why">{p.why}</div>}
              </div>
              <Btn variant="outline" onClick={() => onAdd(p)} disabled={!!busyKey} aria-label={`Add ${pair} to Seeds`}>
                {busyKey === p.key ? 'Adding…' : 'Add to Seeds'}
              </Btn>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * SocialSystems — Archetypes + Legends/Society + Rules + Trends (the
 * LalaVerse hub's Society tab)
 * Merges: InfluencerSystems + Legends from Infrastructure + Society from Calendar
 *
 * 2026-10-04: each sub-tab says who reads its lists (READS, below) and
 * carries the Brain Update button for the data it shows: the Social
 * Systems button (influencer_systems) on Archetypes and Social Rules, the
 * Calendar button (cultural_calendar: celebrity tiers, famous characters,
 * gossip outlets, algorithm forces, drama mechanics) on Legends & Society,
 * both on Trends.
 *
 * 2026-10-08 (wiring map fix-list item 26; Evoni's ruling, "Feed also
 * uses your 15"): each new LalaVerse Feed profile also gets one of this
 * page's archetypes, the saved list or the defaults
 * (src/services/societyArchetypes.js), beside the Feed's own ten, and each
 * archetype card counts the profiles that have it (the Feed's composition,
 * lib/societySummary societyArchetypeCounts).
 *
 * 2026-10-06, to the LalaVerse mock: in the hub the tabs sit under the
 * Society front page (components/Society/SocietySummary: the Feed's
 * archetypes counted, what is trending, Lala on the career ladder, the
 * legends), and the whole page is in the hub's design (SocialSystems.css,
 * tokens only; a list item's own color from the data is only its accent).
 *
 * The lists edit (components/PageEdit/ListEditor; wiring map fix-list item
 * 21): "Edit lists" in the header gives every saved item Edit and Remove
 * and every list "+ Add", and a save writes the list to its own page:
 * influencer_systems for the archetypes, rules and trend stages,
 * cultural_calendar for the celebrity tiers, famous characters, gossip
 * outlets, algorithm forces and drama mechanics. Until now the page held an
 * EditItemModal nothing opened, whose save would have written every list,
 * the calendar's too, into influencer_systems. The fifty legendary roles
 * are fixed in code and are not edited here.
 */
import { useEffect, useState } from 'react';
import api from '../services/api';
import usePageData from '../hooks/usePageData';
import { societyArchetypeCounts } from '../lib/societySummary';
import useListEditor, { EditListsToggle, ItemActions, AddToList } from '../components/PageEdit/ListEditor';
import BrainUpdate from '../components/BrainUpdate';
import SocietySummary from '../components/Society/SocietySummary';
import { ARCHETYPES, RELATIONSHIP_TYPES, ECONOMY_STREAMS, FASHION_TREND_STAGES, BEAUTY_TREND_STAGES, MOMENTUM_WAVES, INFLUENCE_FORCES, LEGACY_SIGNALS, INFLUENCER_DEFAULTS } from '../data/influencerData';
import { CELEBRITY_HIERARCHY, ALGORITHM_FORCES, DRAMA_MECHANICS, GOSSIP_MEDIA, FAMOUS_CHARACTERS, CALENDAR_DEFAULTS } from '../data/calendarData';
import { tabFromSearch } from '../utils/worldRedirects';
import { LEGENDARY_GROUPS } from '../data/legendaryGroups';
import './SocialSystems.css';

const TABS = [
  { key: 'archetypes', label: 'Archetypes' },
  { key: 'legends', label: 'Legends & Society' },
  { key: 'rules', label: 'Social Rules' },
  { key: 'trends', label: 'Trends' },
];

// Who reads each sub-tab's lists, from the code (the wiring map,
// docs/reads/2026-10-06-lalaverse-wiring-map.md §1, §8): Brain Update
// writes these cards into the Show Bible, and the shared loader
// (src/services/brainRules.js) takes only rules marked for every prompt.
// A synced card starts unmarked; Evoni marks one in the Show Bible, card by
// card, and Brain Update keeps the mark (fix-list item 24, 2026-10-08). The
// page's saved edits are read by Amber's read_world_page tool, and the
// archetypes by the Feed (fix-list item 26, 2026-10-08).
const READS = {
  archetypes: 'Each new LalaVerse Feed profile gets one of these archetypes, your edits included, beside the Feed\'s own ten; each card counts the profiles that have it. Brain Update writes each archetype into the Show Bible as a Social Archetype card. A card reaches the generators only when you mark it “In every prompt” in the Show Bible; Brain Update keeps that mark when it updates the card.',
  legends: 'The fifty legendary roles are fixed placeholders in code; nothing in the app links a role to a character yet. The celebrity tiers, famous characters and gossip outlets below are Culture\'s calendar data, and the Calendar Brain Update here writes them into the Show Bible.',
  rules: 'Brain Update writes the relationship types, economy streams, influence forces and legacy signals into the Show Bible as cards. A card reaches the generators only when you mark it “In every prompt” in the Show Bible; Brain Update keeps that mark when it updates the card.',
  trends: 'The fashion and beauty stages and the momentum waves sync through the Social Systems button; the algorithm forces and drama mechanics are Culture\'s calendar data and sync through the Calendar button. No generator reads the page itself. A card reaches the generators only when you mark it “In every prompt” in the Show Bible; Brain Update keeps that mark when it updates the card.',
};

// A list item's own color (from the data files) as its accent only.
const accent = (color) => (color ? { '--item': color } : undefined);

const plural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** What the archetype cards' counts are, or why there are none. */
function feedNote(feed, counted) {
  if (feed === null) return 'Counting the LalaVerse Feed…';
  if (!counted) return 'The LalaVerse Feed could not be counted just now.';
  const parts = ['Each card counts the LalaVerse Feed profiles that have it.'];
  if (counted.unset) parts.push(`${plural(counted.unset, 'profile')} ${counted.unset === 1 ? 'has' : 'have'} none yet: made before the Feed used these. Regenerating a profile gives it one.`);
  if (counted.other) parts.push(`${plural(counted.other, 'profile')} ${counted.other === 1 ? 'carries' : 'carry'} an archetype no longer in this list.`);
  return parts.join(' ');
}

/** A row of stages joined by arrows (the trend engines); actions(s, i) is the item's edit controls. */
function Stages({ items, meta, actions = () => null }) {
  return (
    <ol className="ss-stages">
      {items.map((s, i) => (
        <li key={`${i}-${s.stage}`} className="ss-stage" style={accent(s.color)}>
          <span className="ss-stage-num">{s.stage}</span>
          <strong>{s.name}</strong>
          <span className="ss-meta">{meta(s)}</span>
          {s.story && <span className="ss-quote">{s.story}</span>}
          {actions(s, i)}
        </li>
      ))}
    </ol>
  );
}

const SYSTEMS = 'influencer_systems';
const CALENDAR = 'cultural_calendar';

export default function SocialSystems({ embedded = false }) {
  // ?tab= opens a tab (audit IA-04): the retired duplicate editors land here.
  const [tab, setTab] = useState(() => tabFromSearch(TABS, 'archetypes', undefined, 'sub'));
  const systemsPage = usePageData(SYSTEMS, INFLUENCER_DEFAULTS);
  const calendarPage = usePageData(CALENDAR, CALENDAR_DEFAULTS);
  const { data: isData, saving: isSaving, loaded: isLoaded } = systemsPage;
  const { data: ccData, saving: ccSaving, loaded: ccLoaded } = calendarPage;
  const lists = useListEditor({ [SYSTEMS]: systemsPage, [CALENDAR]: calendarPage });
  const [openLegend, setOpenLegend] = useState('Fashion Icons');
  const [expandedArch, setExpandedArch] = useState(null);
  // The LalaVerse Feed's composition, read once the Archetypes tab opens:
  // null while reading, false if the read failed.
  const [feed, setFeed] = useState(null);

  useEffect(() => {
    if (tab !== 'archetypes' || feed !== null) return undefined;
    let live = true;
    api.get('/api/v1/social-profiles/analytics/composition?feed_layer=lalaverse')
      .then((r) => { if (live) setFeed(r.data || {}); })
      .catch((err) => {
        console.error('[Society] the Feed profiles could not be counted:', err?.response?.status || err?.message);
        if (live) setFeed(false);
      });
    return () => { live = false; };
  }, [tab, feed]);

  const saving = isSaving || ccSaving;
  // The front page's legend chips open a group on the Legends tab.
  const openFromSummary = (key, group) => { setTab(key); if (group) setOpenLegend(group); };

  // A saved list: its items (the page's edits, else the defaults), each
  // item's Edit and Remove, and the list's "+ Add", while editing.
  const dataOf = (page) => (page === SYSTEMS ? isData : ccData);
  const listOf = (page, key, defaults) => dataOf(page)[key] || defaults;
  const actions = (page, key, i, item, name, what) => (lists.editing ? (
    <ItemActions name={name || what} onEdit={() => lists.edit(page, key, i, item, what)} onRemove={() => lists.remove(page, key, i, name)} />
  ) : null);
  const adder = (page, key, defaults, what) => (lists.editing ? (
    <AddToList what={what} onAdd={() => lists.add(page, key, listOf(page, key, defaults), what)} />
  ) : null);
  const archetypes = listOf(SYSTEMS, 'ARCHETYPES', ARCHETYPES);
  const counted = feed ? societyArchetypeCounts(feed, archetypes) : null;

  return (
    <div className={`ss${embedded ? ' is-embedded' : ''}`}>
      {embedded && <SocietySummary legendGroups={LEGENDARY_GROUPS} onOpen={openFromSummary} />}

      <section className="ss-shell" aria-label="Social systems">
        {/* Header; inside the LalaVerse hub the tab's banner is the heading */}
        <div className="ss-head">
          <div>
            {!embedded && <h1 className="ss-h1">Social Systems</h1>}
            <h2 className="ss-title">{embedded ? 'The rules of society' : 'Archetypes, legends, relationships, economy, trends'}</h2>
            <p className="ss-sub">The patterns the LalaVerse runs on. Brain Update copies them into the Show Bible.</p>
          </div>
          <div className="ss-head-actions">
            {saving && <span className="ss-saving">Saving…</span>}
            <EditListsToggle editing={lists.editing} onToggle={() => lists.setEditing(!lists.editing)} />
            {/* The Brain Update for the data the open sub-tab shows */}
            {(tab === 'archetypes' || tab === 'rules' || tab === 'trends') && <BrainUpdate source="social_systems" data={isData} ready={isLoaded} />}
            {(tab === 'legends' || tab === 'trends') && <BrainUpdate source="cultural_calendar" name="Calendar" data={ccData} ready={ccLoaded} />}
          </div>
        </div>

        <div className="ss-tabs" role="tablist" aria-label="Social systems">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`ss-tab${tab === t.key ? ' is-active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>
        <p data-testid={`society-reads-${tab}`} className="ss-reads"><strong>Who reads this </strong>{READS[tab]}</p>

        {/* ARCHETYPES */}
        {tab === 'archetypes' && (
          <div className="ss-panel">
            <p className="ss-note">Every major creator tends to fall into one of these patterns. The tension between two archetypes in the same person is often the story. Open one for its effect on the audience and what it does in the story.</p>
            <p className="ss-note" data-testid="ss-arch-feed">{feedNote(feed, counted)}</p>
            <ul className="ss-grid">
              {archetypes.map((a, i) => {
                const open = expandedArch === a.num;
                return (
                  <li key={`${i}-${a.num}`} className={`ss-card ss-accent-top${open ? ' is-open' : ''}`} style={accent(a.color)}>
                    <button type="button" className="ss-card-btn" aria-expanded={open} onClick={() => setExpandedArch(open ? null : a.num)}>
                      <span className="ss-card-top"><span className="ss-num">{a.num}</span><span aria-hidden="true">{a.icon}</span></span>
                      <strong className="ss-card-title">{a.name}</strong>
                      <span className="ss-card-text">{a.content}</span>
                      {counted && <span className="ss-chip-mini ss-arch-count" data-testid="ss-arch-count">{counted.count(a.name).toLocaleString()} in the Feed</span>}
                    </button>
                    {open && (
                      <div className="ss-card-more">
                        <span className="ss-label">Audience effect</span>
                        <p>{a.audience}</p>
                        <span className="ss-label">Narrative function</span>
                        <p className="ss-quote">{a.narrative}</p>
                      </div>
                    )}
                    {actions(SYSTEMS, 'ARCHETYPES', i, a, a.name, 'archetype')}
                  </li>
                );
              })}
            </ul>
            {adder(SYSTEMS, 'ARCHETYPES', ARCHETYPES, 'archetype')}
          </div>
        )}

        {/* LEGENDS & SOCIETY */}
        {tab === 'legends' && (
          <div className="ss-panel">
            <h3 className="ss-h3">The 50 legendary influencers</h3>
            <p className="ss-note">The most powerful cultural figures in the LalaVerse. All placeholders: no role is linked to a character yet.</p>
            <div className="ss-chips" role="group" aria-label="Legend groups">
              {LEGENDARY_GROUPS.map((g) => (
                <button key={g.group} type="button" aria-pressed={openLegend === g.group} className={`ss-chip${openLegend === g.group ? ' is-active' : ''}`} onClick={() => setOpenLegend(g.group)}>
                  <span aria-hidden="true">{g.icon}</span> {g.group}
                </button>
              ))}
            </div>
            {LEGENDARY_GROUPS.filter((g) => g.group === openLegend).map((g) => (
              <ul key={g.group} className="ss-list" data-testid="ss-legend-roles">
                {g.roles.map((r) => (
                  <li key={r.role} className="ss-row ss-accent-left" style={accent(g.color)}>
                    <strong>{r.role}</strong> <span className="ss-chip-mini">Placeholder</span>
                    <span className="ss-card-text">{r.fn}</span>
                    <span className="ss-quote">"{r.signature}"</span>
                  </li>
                ))}
              </ul>
            ))}

            <h3 className="ss-h3">Celebrity hierarchy</h3>
            <ul className="ss-grid ss-grid-sm">
              {listOf(CALENDAR, 'CELEBRITY_HIERARCHY', CELEBRITY_HIERARCHY).map((h, i) => (
                <li key={`${i}-${h.tier}`} className="ss-card ss-accent-top" style={accent(h.color)}>
                  <span className="ss-card-top"><span className="ss-num">Tier {h.tier}</span><span className="ss-meta">{h.followers}</span></span>
                  <strong className="ss-card-title">{h.name}</strong>
                  <span className="ss-card-text">{h.desc}</span>
                  {actions(CALENDAR, 'CELEBRITY_HIERARCHY', i, h, h.name, 'celebrity tier')}
                </li>
              ))}
            </ul>
            {adder(CALENDAR, 'CELEBRITY_HIERARCHY', CELEBRITY_HIERARCHY, 'celebrity tier')}

            <h3 className="ss-h3">The 25 most famous</h3>
            <ul className="ss-grid ss-grid-sm">
              {listOf(CALENDAR, 'FAMOUS_CHARACTERS', FAMOUS_CHARACTERS).map((c, i) => (
                <li key={`${i}-${c.rank}`} className="ss-card ss-accent-top" style={accent(c.color)}>
                  <span className="ss-card-top"><span className="ss-num">#{c.rank}</span><span aria-hidden="true">{c.icon}</span></span>
                  <strong className="ss-card-title">{c.title}</strong>
                  <span className="ss-card-text">{c.role}</span>
                  {actions(CALENDAR, 'FAMOUS_CHARACTERS', i, c, c.title, 'famous character')}
                </li>
              ))}
            </ul>
            {adder(CALENDAR, 'FAMOUS_CHARACTERS', FAMOUS_CHARACTERS, 'famous character')}

            <h3 className="ss-h3">Gossip media networks</h3>
            <ul className="ss-grid">
              {listOf(CALENDAR, 'GOSSIP_MEDIA', GOSSIP_MEDIA).map((m, i) => (
                <li key={`${i}-${m.name}`} className="ss-card ss-accent-top" style={accent(m.color?.text)}>
                  <strong className="ss-card-title">{m.name}</strong>
                  <span className="ss-meta">{[m.focus, m.style].filter(Boolean).join(' · ')}</span>
                  <span className="ss-card-text">{m.covers}</span>
                  <span className="ss-quote">{m.power}</span>
                  {actions(CALENDAR, 'GOSSIP_MEDIA', i, m, m.name, 'gossip outlet')}
                </li>
              ))}
            </ul>
            {adder(CALENDAR, 'GOSSIP_MEDIA', GOSSIP_MEDIA, 'gossip outlet')}
          </div>
        )}

        {/* SOCIAL RULES */}
        {tab === 'rules' && (
          <div className="ss-panel">
            <h3 className="ss-h3">Relationship types</h3>
            <ul className="ss-list">
              {listOf(SYSTEMS, 'RELATIONSHIP_TYPES', RELATIONSHIP_TYPES).map((r, i) => (
                <li key={`${i}-${r.type}`} className="ss-row ss-accent-left" style={accent(r.color)}>
                  <strong className="ss-card-title"><span aria-hidden="true">{r.icon}</span> {r.type}</strong>
                  <div className="ss-three">
                    <div><span className="ss-label">Looks like</span><p>{r.looksLike}</p></div>
                    <div><span className="ss-label">Creates</span><p>{r.creates}</p></div>
                    <div><span className="ss-label">Breaks</span><p>{r.breaks}</p></div>
                  </div>
                  {r.storyBreaks && <span className="ss-quote">{r.storyBreaks}</span>}
                  {actions(SYSTEMS, 'RELATIONSHIP_TYPES', i, r, r.type, 'relationship type')}
                </li>
              ))}
            </ul>
            {adder(SYSTEMS, 'RELATIONSHIP_TYPES', RELATIONSHIP_TYPES, 'relationship type')}

            <h3 className="ss-h3">Creator economy</h3>
            <ul className="ss-grid ss-grid-sm">
              {listOf(SYSTEMS, 'ECONOMY_STREAMS', ECONOMY_STREAMS).map((e, i) => (
                <li key={`${i}-${e.stream}`} className="ss-card ss-accent-top" style={accent(e.color)}>
                  <span aria-hidden="true" className="ss-icon">{e.icon}</span>
                  <strong className="ss-card-title">{e.stream}</strong>
                  <span className="ss-card-text">{e.what}</span>
                  <span className="ss-meta">{e.who}</span>
                  {e.narrative && <span className="ss-quote">{e.narrative}</span>}
                  {actions(SYSTEMS, 'ECONOMY_STREAMS', i, e, e.stream, 'economy stream')}
                </li>
              ))}
            </ul>
            {adder(SYSTEMS, 'ECONOMY_STREAMS', ECONOMY_STREAMS, 'economy stream')}

            <h3 className="ss-h3">Influence forces</h3>
            <ul className="ss-grid">
              {listOf(SYSTEMS, 'INFLUENCE_FORCES', INFLUENCE_FORCES).map((f, i) => (
                <li key={`${i}-${f.force}`} className="ss-card ss-accent-top" style={accent(f.color)}>
                  <span aria-hidden="true" className="ss-icon">{f.icon}</span>
                  <strong className="ss-card-title">{f.force}</strong>
                  <span className="ss-card-text">{f.definition}</span>
                  <span className="ss-built"><span className="ss-label">Built by</span> {f.built}</span>
                  <span className="ss-destroyed"><span className="ss-label">Destroyed by</span> {f.destroys}</span>
                  {actions(SYSTEMS, 'INFLUENCE_FORCES', i, f, f.force, 'influence force')}
                </li>
              ))}
            </ul>
            {adder(SYSTEMS, 'INFLUENCE_FORCES', INFLUENCE_FORCES, 'influence force')}

            <h3 className="ss-h3">Legacy signals</h3>
            <ul className="ss-list">
              {listOf(SYSTEMS, 'LEGACY_SIGNALS', LEGACY_SIGNALS).map((l, i) => (
                <li key={`${i}-${l.signal}`} className="ss-row ss-accent-left" style={accent(l.color)}>
                  <strong className="ss-card-title"><span aria-hidden="true">{l.icon}</span> {l.signal}</strong>
                  <span className="ss-card-text">{l.looksLike}</span>
                  {l.story && <span className="ss-quote">{l.story}</span>}
                  {actions(SYSTEMS, 'LEGACY_SIGNALS', i, l, l.signal, 'legacy signal')}
                </li>
              ))}
            </ul>
            {adder(SYSTEMS, 'LEGACY_SIGNALS', LEGACY_SIGNALS, 'legacy signal')}
          </div>
        )}

        {/* TRENDS */}
        {tab === 'trends' && (
          <div className="ss-panel">
            <h3 className="ss-h3">Fashion trend engine · 5 stages</h3>
            <Stages items={listOf(SYSTEMS, 'FASHION_TREND_STAGES', FASHION_TREND_STAGES)} meta={(s) => s.who}
              actions={(s, i) => actions(SYSTEMS, 'FASHION_TREND_STAGES', i, s, s.name, 'fashion stage')} />
            {adder(SYSTEMS, 'FASHION_TREND_STAGES', FASHION_TREND_STAGES, 'fashion stage')}
            <h3 className="ss-h3">Beauty trend engine · 4 stages</h3>
            <Stages items={listOf(SYSTEMS, 'BEAUTY_TREND_STAGES', BEAUTY_TREND_STAGES)} meta={(s) => s.where}
              actions={(s, i) => actions(SYSTEMS, 'BEAUTY_TREND_STAGES', i, s, s.name, 'beauty stage')} />
            {adder(SYSTEMS, 'BEAUTY_TREND_STAGES', BEAUTY_TREND_STAGES, 'beauty stage')}

            <h3 className="ss-h3">Momentum waves</h3>
            <ul className="ss-list">
              {listOf(SYSTEMS, 'MOMENTUM_WAVES', MOMENTUM_WAVES).map((m, i) => (
                <li key={`${i}-${m.event}`} className="ss-row ss-accent-left" style={accent(m.color)}>
                  <span className="ss-card-top"><strong><span aria-hidden="true">{m.icon}</span> {m.event}</strong><span className="ss-meta">{m.duration}</span></span>
                  <span className="ss-card-text">{m.feedEffect}</span>
                  {m.permanent && <span className="ss-quote">{m.permanent}</span>}
                  {actions(SYSTEMS, 'MOMENTUM_WAVES', i, m, m.event, 'momentum wave')}
                </li>
              ))}
            </ul>
            {adder(SYSTEMS, 'MOMENTUM_WAVES', MOMENTUM_WAVES, 'momentum wave')}

            <h3 className="ss-h3">Algorithm &amp; drama</h3>
            <div className="ss-two">
              <div>
                <span className="ss-label">Algorithm forces</span>
                <ul className="ss-list">
                  {listOf(CALENDAR, 'ALGORITHM_FORCES', ALGORITHM_FORCES).map((f, i) => (
                    <li key={`${i}-${f.name}`} className="ss-row ss-accent-left" style={accent(f.color)}>
                      <strong><span aria-hidden="true">{f.icon}</span> {f.name}</strong>
                      <span className="ss-meta">{f.measuredBy}</span>
                      {f.storyHook && <span className="ss-quote">{f.storyHook}</span>}
                      {actions(CALENDAR, 'ALGORITHM_FORCES', i, f, f.name, 'algorithm force')}
                    </li>
                  ))}
                </ul>
                {adder(CALENDAR, 'ALGORITHM_FORCES', ALGORITHM_FORCES, 'algorithm force')}
              </div>
              <div>
                <span className="ss-label">Drama mechanics</span>
                <ul className="ss-list">
                  {listOf(CALENDAR, 'DRAMA_MECHANICS', DRAMA_MECHANICS).map((d, i) => (
                    <li key={`${i}-${d.type}`} className="ss-row ss-accent-left" style={accent(d.color)}>
                      <strong><span aria-hidden="true">{d.icon}</span> {d.type}</strong>
                      <span className="ss-meta">{d.trigger}</span>
                      {d.storyThread && <span className="ss-quote">{d.storyThread}</span>}
                      {actions(CALENDAR, 'DRAMA_MECHANICS', i, d, d.type, 'drama mechanic')}
                    </li>
                  ))}
                </ul>
                {adder(CALENDAR, 'DRAMA_MECHANICS', DRAMA_MECHANICS, 'drama mechanic')}
              </div>
            </div>
          </div>
        )}
      </section>

      {lists.modal}
    </div>
  );
}

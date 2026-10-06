/**
 * What each LalaVerse hub tab is for, in three lines (2026-10-04): what it
 * holds, what reads it, and the thing to do here. Drafted from the code and
 * docs/BRAIN_OWNERSHIP.md: the AI reads the Show Bible (franchise_knowledge);
 * the World, Society and Culture page data (page_content) reaches the AI only
 * through each tab's Brain Update button, while locations, calendar events, snapshots and the
 * timeline are read directly by the generators named below.
 */
export const ORIENTATION = {
  overview: {
    title: 'The LalaVerse, at a glance',
    what: 'The world your show and novel live in: one hub, six tabs. This tab is the summary: the active show, its counts, and how far the world is set up.',
    reads: 'Nothing reads this tab; it reads everything else. The seven setup steps below check the other tabs and the Feed.',
    doHere: 'Follow the steps in order. Each one opens the tab that does the work; a green check means that part of the world exists.',
  },
  bible: {
    title: 'The Show Bible is what the AI believes',
    what: 'Laws, locked decisions, world facts and character truths as text entries. This is the canon the generators read: the script writer, the event generators, the Feed (posts, comments, redrafts and LalaVerse profiles), seasonal events, Amber, the memories engine, story evaluation and the franchise guard.',
    reads: 'Every AI call that writes for the show. Entries marked "always inject" go into each prompt; "critical" ones into the guard and Amber; the rest are stored and reviewed but not read by the generators.',
    doHere: 'Write a rule the AI must follow as a new entry and mark it always-inject. Review pending entries under Decisions. Paste a document under Documents to extract entries. Check a scene against the canon under Guard.',
  },
  world: {
    title: 'The map and the places scenes happen in',
    what: 'The DREAM map (cities, universities, corporations) and the locations: the venues, properties and scene-set homes that events and scenes are placed in.',
    reads: 'Locations are read directly: the event generator picks venues from them, the scene planner and the memories engine place scenes in them. The map text reaches the AI only when you press the Brain Update button here.',
    doHere: 'Add or fix a location under Locations: events need venues. Upload or describe the map under The Map, then press Brain Update so the AI knows the geography.',
  },
  society: {
    title: 'How influence works, as reference',
    what: 'The fifteen influencer archetypes, the legends and society, the social rules and the trends. A reference document for who exists in the social world and how reputation moves.',
    reads: 'The AI only through the Brain Update button: the eight seeded society laws in the Show Bible are what it sees today. Editing here changes the page, not the canon, until you update the Brain.',
    doHere: 'You rarely edit this. When you do, change the text and press Brain Update so the Show Bible carries the new rule.',
  },
  culture: {
    title: 'The year, who covers it, and what is remembered',
    what: 'The cultural calendar (the 42 events of story-year 8385), the award shows and gossip outlets, and the cultural memory: legends, feuds and archives.',
    reads: 'Calendar events are read directly: "Create in show" spawns a Producer Mode event with a host and guests from a calendar date, and the seasonal and automation services draw on them. Awards, media and history reach the AI only through the Brain Update button on their sub-tab.',
    doHere: 'Pick a calendar event and create it in the show when an episode needs one (with several shows, choose which first). Edit the awards, media or history text, then press the Brain Update button on that sub-tab.',
  },
  state: {
    title: 'Where the world is right now',
    what: 'State snapshots (facts and active threads at a point in time), timeline events (what happened, how big), and the tension scanner (which character pairs are about to blow).',
    reads: 'Snapshots and the timeline are read by the script writers, the memories engine and the world temperature; the tension scanner feeds story evaluation when you propose a scene from a pair.',
    doHere: 'Save a snapshot after a big story turn. Log a timeline event when something happened. Rescan tensions and propose a scene from a pair that is simmering.',
  },
};

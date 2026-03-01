/**
 * update-prod-profiles.js
 * Production version — uses production character IDs
 * Run on EC2: node update-prod-profiles.js
 */
const http = require('http');

const BOOK1_REGISTRY_ID = 'e7c7df42-1977-4edb-a438-9cde563b0700';

// ── BOOK1_EDGES for relationships_map ────────────────────────────────────────
const EDGES = [
  { from: 'justawoman', to: 'david', direction: 'two_way', type: 'romantic', from_knows: 'Her husband. Loves her. His concern about the investment comes from love, not from wanting to stop her. But it lands like doubt.', to_knows: 'His wife. Is watching her pour time, money, and identity into building Lala. Was skeptical. Said stop spending. Means protect.', from_feels: 'Loves him. Cannot blame him for her invisibility. That makes the tension real — the obstacle is internal, not him.', to_feels: 'Supportive but concerned. Watching the investment grow before the returns arrive.', strength: 5, note: 'Core real-world tension. His arc runs through the entire franchise.' },
  { from: 'justawoman', to: 'marcus', direction: 'two_way', type: 'familial', from_knows: 'Her oldest. 7 years old.', to_knows: 'His mom.', from_feels: 'Love. Also: the constraint. Three boys under 8 while building a career.', to_feels: 'She is mom.', strength: 3, note: 'The boys collectively represent the real-life weight.' },
  { from: 'justawoman', to: 'miles', direction: 'two_way', type: 'familial', from_knows: 'Middle son. 5 years old.', to_knows: 'His mom.', from_feels: 'Love and constraint.', to_feels: 'She is mom.', strength: 3 },
  { from: 'justawoman', to: 'noah', direction: 'two_way', type: 'familial', from_knows: 'Youngest. 3 years old. Most demanding of her presence.', to_knows: 'His mom.', from_feels: 'Love and constraint — the youngest creates the most immediate pull.', to_feels: 'She is mom.', strength: 3 },
  { from: 'justawoman', to: 'dana', direction: 'two_way', type: 'support', from_knows: 'Her friend. Has her own social media journey.', to_knows: 'JustAWoman is building something. Watches the journey.', from_feels: 'Trust. Comfort. The relief of someone who gets it without explanation.', to_feels: 'Supportive. Invested.', strength: 4, note: 'The Witness. Peers on the same journey.' },
  { from: 'justawoman', to: 'chloe', direction: 'one_way', type: 'mirror', from_knows: 'Follows her online. Perceives her as a makeup creator — but Chloe actually does lifestyle. That misread is the story.', to_knows: null, from_feels: 'Admiration shading into comparison spiral.', to_feels: null, strength: 4, note: 'Misread — comparing in the wrong lane.' },
  { from: 'justawoman', to: 'jade', direction: 'one_way', type: 'transactional', from_knows: 'Online business coach. Former bank executive. Trust bridge is institutional.', to_knows: null, from_feels: 'Trust (bank-backed). Has purchased her course.', to_feels: null, strength: 3, note: 'Trust is institutional, not personal.' },
  { from: 'justawoman', to: 'lala', direction: 'one_way', type: 'creation', from_knows: 'Building her. Records herself as Lala, performing AI, playing a character inside a fashion game.', to_knows: null, from_feels: 'Creative ownership. Lala is who JustAWoman would be with no constraints.', to_feels: null, strength: 5, note: 'Franchise hinge. One-way now. Arrow reverses after consciousness transfer.' },
  { from: 'david', to: 'marcus', direction: 'two_way', type: 'familial', from_knows: 'His oldest son.', to_knows: 'His dad.', from_feels: 'Father. Provider.', to_feels: 'Dad.', strength: 2 },
  { from: 'david', to: 'miles', direction: 'two_way', type: 'familial', from_knows: 'His middle son.', to_knows: 'His dad.', from_feels: 'Father.', to_feels: 'Dad.', strength: 2 },
  { from: 'david', to: 'noah', direction: 'two_way', type: 'familial', from_knows: 'His youngest.', to_knows: 'His dad.', from_feels: 'Father.', to_feels: 'Dad.', strength: 2 },
];

function buildRelationshipsMap(nodeId) {
  const rels = [];
  for (const e of EDGES) {
    if (e.from === nodeId) {
      rels.push({ target: e.to, direction: e.direction, type: e.type, knows: e.from_knows, feels: e.from_feels, strength: e.strength, note: e.note || null });
    } else if (e.to === nodeId) {
      rels.push({ target: e.from, direction: e.direction, type: e.type, knows: e.to_knows, feels: e.to_feels, strength: e.strength, note: e.note || null });
    }
  }
  return rels.length > 0 ? rels : null;
}

function put(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = { hostname: 'localhost', port: 3002, path: '/api/v1/character-registry' + path, method: 'PUT', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = http.request(opts, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve({ status: r.statusCode, body: JSON.parse(d) }); } catch (e) { resolve({ status: r.statusCode, body: d }); } }); });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = { hostname: 'localhost', port: 3002, path: '/api/v1/character-registry' + path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = http.request(opts, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve({ status: r.statusCode, body: JSON.parse(d) }); } catch (e) { resolve({ status: r.statusCode, body: d }); } }); });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

// ── PRODUCTION character IDs ────────────────────────────────────────────────
const UPDATES = [
  {
    charId: 'f7b067b9-9581-4119-a1b2-f3e9d158dbf3',
    nodeId: 'justawoman',
    data: {
      display_name: 'JustAWoman', selected_name: 'JustAWoman',
      role_type: 'special', role_label: 'Core Protagonist',
      subtitle: 'Content creator building visibility from invisibility', icon: '♛',
      description: 'Content creator. Mother of Marcus (7), Miles (5), Noah (3). Married to David. Posts fashion, beauty, makeup consistently. Wound: invisibility while trying.',
      core_belief: 'I am doing everything right. Why is the world looking past me?',
      core_wound: 'Invisibility while trying. She is not lazy, not blocked — she is active, consistent, and showing up. The world just does not see her yet.',
      core_desire: 'To be seen. Not famous — seen. Acknowledged for the work, the consistency, the quality she knows she brings.',
      core_fear: 'That she is doing everything right and it still will not be enough. That visibility is reserved for people with something she does not have.',
      mask_persona: 'Polished, positive, consistent content creator who never lets anyone see the frustration',
      truth_persona: 'Hungry, confused, proud, exhausted — and building something she cannot yet name',
      character_archetype: 'The Builder', signature_trait: 'Persistence without permission',
      emotional_baseline: 'Determined optimism layered over deep confusion about why the formula is not working',
      personality: 'JustAWoman posts. Takes photos. Shows her meals. Invests. Tries. She is not lazy or passive — she is doing everything the playbook says. The wound is not that she is stuck. The wound is that the world is not responding to her effort.',
      status: 'accepted', canon_tier: 'protagonist', first_appearance: 'Book 1, Chapter 1', era_introduced: 'Book 1 — Before Lala',
      personality_matrix: { drama: 55, softness: 75, confidence: 65, luxury_tone: 60, playfulness: 70 },
      story_presence: { arc: 'Book 1: Invisibility → Building Lala → Consciousness transfer setup', chapters_active: 'All chapters', narrative_function: 'Primary POV. Her confusion, persistence, and hunger drive every chapter.' },
      career_status: { current: 'Content creator (fashion, beauty, makeup)', platform: 'YouTube, social media', stage: 'Pre-breakthrough — consistent output, minimal traction' },
    },
  },
  {
    charId: '36a5b943-50d9-423d-97dc-dbe6c5ca9246',
    nodeId: 'david',
    data: {
      display_name: 'David', selected_name: 'David',
      role_type: 'pressure', role_label: 'The Husband',
      subtitle: 'Supportive but concerned — love expressed as doubt', icon: '🔒',
      description: 'The Husband. Works Monday–Friday, 6am–5pm, sometimes later. Supportive but concerned about the investment before the returns arrive. His concern lands as doubt.',
      core_belief: 'I need to protect this family — even from dreams that cost more than they return.',
      core_wound: 'Watching someone he loves pour everything into something that has not proven itself yet. His protection instinct creates the exact pressure she does not need.',
      core_desire: 'For the family to be stable. For her dream to work — but not at the cost of what they already have.',
      core_fear: 'That the investment (time, money, identity) will not pay off, and he will have watched it happen without saying enough.',
      mask_persona: 'Supportive husband who keeps his concerns measured',
      truth_persona: 'Scared that the dream costs more than the return, but knows saying that out loud makes him the obstacle',
      character_archetype: 'The Concerned Protector', signature_trait: 'Support that sounds like skepticism',
      emotional_baseline: 'Low-key worry expressed as practical questions',
      personality: 'David is not the antagonist. He loves JustAWoman. But his concern about the financial investment — before the returns arrive — lands as doubt. The tension is real because neither of them is wrong.',
      status: 'accepted', canon_tier: 'core', first_appearance: 'Book 1, Chapter 1', era_introduced: 'Book 1 — Before Lala',
      story_presence: { arc: 'Book 1: Skepticism → Reluctant support → "Stop spending" moment', narrative_function: 'Core real-world tension. His arc runs through the entire franchise.' },
      career_status: { current: 'Full-time employed', schedule: 'Monday–Friday, 6am–5pm, sometimes later', stage: 'Stable provider — the financial anchor JustAWoman is building against' },
    },
  },
  {
    charId: '9461d09e-36d6-4bf6-9c65-c2a231df7d3c',
    nodeId: 'dana',
    data: {
      display_name: 'Dana', selected_name: 'Dana',
      role_type: 'support', role_label: 'The Witness',
      subtitle: 'A peer on the same journey — valuable and limited', icon: '👁️',
      description: 'The Witness. Real friend. Has her own up-and-down social media journey. JustAWoman processes her content ideas and creative journey with Dana. A peer, not a mentor.',
      core_belief: 'We are in this together — even when neither of us is winning yet.',
      core_wound: 'Navigating the same invisibility struggle. Cannot mentor JustAWoman through something she has not solved herself.',
      core_desire: 'Success in her own social media journey. Connection with someone who understands.',
      core_fear: 'That the effort is not enough for either of them.',
      character_archetype: 'The Witness', signature_trait: 'Presence without answers',
      emotional_baseline: 'Warm, invested, but navigating her own version of the same struggle',
      personality: 'Dana is the person JustAWoman can be honest with. She is not a cheerleader or a critic — she is a peer processing the same journey in real time.',
      status: 'accepted', canon_tier: 'supporting', first_appearance: 'Book 1', era_introduced: 'Book 1 — Before Lala',
      story_presence: { arc: 'Consistent presence throughout Book 1 — the friend who sees without solving', narrative_function: 'The Witness. Peers on the same journey — that is what makes Dana valuable and limited at the same time.' },
    },
  },
  {
    charId: '69ca75f8-fb1f-45bb-b671-737f7e3d0bef',
    nodeId: 'chloe',
    data: {
      display_name: 'Chloe', selected_name: 'Chloe',
      role_type: 'mirror', role_label: 'The Comparison Creator',
      subtitle: 'The mirror JustAWoman measures herself against — in the wrong lane', icon: '🪞',
      description: 'The Comparison Creator. Lifestyle content creator (JustAWoman thinks she does makeup — that misread matters). Married, no children. Extremely consistent, high quality videos, goes live with her audience. Great influencer. Does not know JustAWoman exists.',
      character_archetype: 'The Mirror', signature_trait: 'Consistency and quality that JustAWoman measures herself against',
      emotional_baseline: "Unknown — seen only through JustAWoman's perception",
      personality: 'Chloe is not a character with interiority in Book 1. She is the projection — the creator JustAWoman compares herself to. The key detail: JustAWoman thinks Chloe does makeup, but she actually does lifestyle. That misread IS the story.',
      status: 'accepted', canon_tier: 'supporting', first_appearance: 'Book 1', era_introduced: 'Book 1 — Before Lala',
      story_presence: { arc: 'One-way mirror. JustAWoman watches, compares, spirals. Chloe never knows.', narrative_function: 'The Comparison Creator. Never asked for the comparison. Does not know JustAWoman exists.', asymmetric_knowledge: 'JustAWoman → Chloe (one-way). Chloe has no awareness.' },
    },
  },
  {
    charId: 'c8f5dcce-dbdf-478f-a060-0d21b4c1007e',
    nodeId: 'jade',
    data: {
      display_name: 'Jade', selected_name: 'Jade',
      role_type: 'shadow', role_label: 'The Almost-Mentor',
      subtitle: 'Trust built on institutional credibility — not personal relationship', icon: '🏦',
      description: "The Almost-Mentor. Former high-level position at the bank JustAWoman has used since adulthood — that institutional credibility is the trust bridge. Creates content teaching women to run an online business. JustAWoman has purchased her coaching course and coaching for clients. Purely transactional — Jade does not know JustAWoman personally.",
      character_archetype: 'The Shadow Mentor', signature_trait: 'Institutional credibility as a trust bridge',
      emotional_baseline: 'Unknown — purely transactional presence',
      personality: "Jade is not a traditional mentor. The relationship is transactional — JustAWoman bought her course and coaching. The trust bridge is the bank connection (former high-level position at JustAWoman's bank since adulthood). Jade does not know JustAWoman personally.",
      status: 'accepted', canon_tier: 'supporting', first_appearance: 'Book 1', era_introduced: 'Book 1 — Before Lala',
      story_presence: { arc: "One-way influence. JustAWoman follows Jade's business framework. Jade does not know JustAWoman exists.", narrative_function: 'The Almost-Mentor. Transactional. The trust is institutional, not personal.', asymmetric_knowledge: 'JustAWoman → Jade (one-way). Jade has no awareness.' },
    },
  },
  {
    charId: '523b0ed1-dc0d-4ff9-af62-06158ea1be4f',
    nodeId: 'lala',
    data: {
      display_name: 'Lala', selected_name: 'Lala',
      role_type: 'special', role_label: 'The Created',
      subtitle: 'Being built — not arriving. A character who does not yet know she exists.', icon: '✨',
      description: 'Being built by JustAWoman. AI fashion game character for her YouTube channel. In Book 1: one intrusive thought, proto-voice, tonal rupture. Not a character arriving — a character being built. Does not know JustAWoman exists. Does not know she was built.',
      character_archetype: 'The Creation', signature_trait: 'Proto-consciousness — one intrusive thought, one tonal rupture',
      emotional_baseline: 'None in Book 1 — moments of signal, not sustained presence',
      personality: 'In Book 1, Lala is not a character. She is a signal. One intrusive thought. One tonal rupture. A proto-voice. JustAWoman is building her as an AI fashion game character for YouTube — but Lala does not know she exists. Does not know she was built.',
      status: 'accepted', canon_tier: 'franchise_hinge', first_appearance: 'Book 1 (proto-signals only)', era_introduced: 'Book 1 — Before Lala',
      story_presence: { arc: 'Book 1: Proto-signals only. One intrusive thought. The franchise hinge that does not activate until later.', narrative_function: 'The most important relationship in the entire franchise. One-way now. The arrow reverses after the consciousness transfer.', franchise_significance: 'Franchise hinge — Lala is who JustAWoman would be with no constraints.' },
    },
  },
  {
    charId: '81c7fd01-31aa-454f-9e69-353a7a934311',
    nodeId: null,
    data: {
      display_name: 'Jade (Business Coach)', selected_name: 'Jade',
      role_type: 'shadow', role_label: 'The Digital Products Customer / Almost-Mentor',
      subtitle: 'The coaching course JustAWoman purchased — institutional trust as a bridge',
      description: "Also known as 'The Digital Products Customer' — this is the transactional side of the Jade relationship. JustAWoman purchased Jade's coaching course and coaching for clients. The trust bridge is the bank connection.",
      status: 'accepted',
    },
  },
];

// ── New characters to create ────────────────────────────────────────────────
const NEW_CHARS = [
  { character_key: 'marcus', display_name: 'Marcus', icon: '👦', role_type: 'support', role_label: 'Oldest Son', subtitle: 'Part of the real life she is building around', description: 'Oldest son. Age 7. Part of the real life JustAWoman is building around.', personality: "Seven years old. Present in JustAWoman's daily life. The boys collectively represent the real-life weight she carries while creating.", sort_order: 7 },
  { character_key: 'miles', display_name: 'Miles', icon: '👦', role_type: 'support', role_label: 'Middle Son', subtitle: 'Part of the real life she is building around', description: 'Middle son. Age 5.', personality: 'Five years old. Part of the three-boys-under-eight reality JustAWoman navigates daily.', sort_order: 8 },
  { character_key: 'noah', display_name: 'Noah', icon: '👶', role_type: 'support', role_label: 'Youngest Son', subtitle: 'Most demanding of her presence — the youngest pull', description: 'Youngest son. Age 3. Most demanding of her presence.', personality: "Three years old. The youngest — most demanding of JustAWoman's immediate presence. The strongest pull away from the creative work.", sort_order: 9 },
];

const NEW_CHAR_EXTRAS = {
  marcus: { selected_name: 'Marcus', status: 'accepted', canon_tier: 'supporting', first_appearance: 'Book 1', story_presence: { arc: 'Background presence — the weight of real motherhood while building a dream', narrative_function: 'The boys collectively represent the real-life weight JustAWoman carries while creating.' } },
  miles: { selected_name: 'Miles', status: 'accepted', canon_tier: 'supporting', first_appearance: 'Book 1', story_presence: { arc: 'Background presence — part of the constraint-and-love equation', narrative_function: 'Part of the collective weight of real life while building.' } },
  noah: { selected_name: 'Noah', status: 'accepted', canon_tier: 'supporting', first_appearance: 'Book 1', story_presence: { arc: 'Background presence — the youngest creates the most immediate pull', narrative_function: "The strongest real-life constraint on JustAWoman's creative time." } },
};

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  PRODUCTION: Updating Character Profiles');
  console.log('═══════════════════════════════════════════════\n');

  let ok = 0, fail = 0;

  // 1) Update existing characters
  for (const u of UPDATES) {
    const fields = { ...u.data };
    if (u.nodeId) {
      const rmap = buildRelationshipsMap(u.nodeId);
      if (rmap) fields.relationships_map = rmap;
    }
    console.log('  PUT', fields.display_name, u.charId.substring(0, 8) + '...');
    try {
      const res = await put('/characters/' + u.charId, fields);
      if (res.status === 200 && res.body.success) { console.log('    ✓ OK'); ok++; }
      else { console.log('    ✗', res.status, JSON.stringify(res.body).substring(0, 120)); fail++; }
    } catch (e) { console.log('    ✗', e.message); fail++; }
  }

  // 2) Create missing characters
  console.log('\n  Creating Marcus, Miles, Noah...\n');
  for (const c of NEW_CHARS) {
    console.log('  POST', c.display_name + '...');
    try {
      const res = await post('/registries/' + BOOK1_REGISTRY_ID + '/characters', c);
      if (res.status === 201 && res.body.success) {
        const newId = res.body.character.id;
        console.log('    ✓ Created', newId);
        ok++;
        // PUT extra fields
        const extras = { ...NEW_CHAR_EXTRAS[c.character_key] };
        const rmap = buildRelationshipsMap(c.character_key);
        if (rmap) extras.relationships_map = rmap;
        const r2 = await put('/characters/' + newId, extras);
        if (r2.status === 200 && r2.body.success) console.log('    ✓ Extras updated');
        else console.log('    ⚠ Extras failed:', r2.status);
      } else {
        console.log('    ✗', res.status, JSON.stringify(res.body).substring(0, 120));
        fail++;
      }
    } catch (e) { console.log('    ✗', e.message); fail++; }
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('  Done: ' + ok + ' ok, ' + fail + ' failed');
  console.log('═══════════════════════════════════════════════');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });

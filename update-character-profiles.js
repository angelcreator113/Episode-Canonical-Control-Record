/**
 * update-character-profiles.js
 * Populates character registry profiles with canonical Book 1 data
 * from BOOK1_NODES (bios) and BOOK1_EDGES (relationship maps).
 *
 * Run: node update-character-profiles.js
 */

const http = require('http');
const API = 'http://localhost:3002/api/v1/character-registry';

// ── Registry ID for "Book 1 · Before Lala" ──────────────────────────────────
const BOOK1_REGISTRY_ID = '10bd6fc2-4b8d-493c-9048-43c754c16d6e';

// ── Mapping: registry character ID → BOOK1_NODES node id ─────────────────────
const EXISTING_MAP = {
  '4ee8240d-f0bd-485f-ae7b-7bf2b3a37eda': 'justawoman',  // JustAWoman
  '0b6c6f8e-5d19-4bbf-b6df-f0f62c96d4bd': 'david',       // The Husband → David
  '8f8c0257-0ee3-459b-b696-9cee3905d494': 'dana',         // The Witness → Dana
  'ef3373dc-ee29-4984-857a-1535f73b3be0': 'chloe',        // The Comparison Creator → Chloe
  '441c68e1-c961-45da-8650-524d422861ba': 'jade',         // The Digital Products Customer → Jade
  '450cc689-85ef-47c5-8a86-c22005010c06': 'jade_alt',     // The Almost-Mentor → also Jade (see below)
  '3d8c31f8-7bbf-4731-986e-4b2ab3f7caba': 'lala',         // Lala
};

// ── Canonical character profile data ─────────────────────────────────────────
const PROFILES = {
  justawoman: {
    charId: '4ee8240d-f0bd-485f-ae7b-7bf2b3a37eda',
    display_name: 'JustAWoman',
    selected_name: 'JustAWoman',
    role_type: 'special',
    role_label: 'Core Protagonist',
    subtitle: 'Content creator building visibility from invisibility',
    icon: '♛',
    description: 'Content creator. Mother of Marcus (7), Miles (5), Noah (3). Married to David. Posts fashion, beauty, makeup consistently. Wound: invisibility while trying.',
    core_belief: 'I am doing everything right. Why is the world looking past me?',
    core_wound: 'Invisibility while trying. She is not lazy, not blocked — she is active, consistent, and showing up. The world just does not see her yet.',
    core_desire: 'To be seen. Not famous — seen. Acknowledged for the work, the consistency, the quality she knows she brings.',
    core_fear: 'That she is doing everything right and it still will not be enough. That visibility is reserved for people with something she does not have.',
    mask_persona: 'Polished, positive, consistent content creator who never lets anyone see the frustration',
    truth_persona: 'Hungry, confused, proud, exhausted — and building something she cannot yet name',
    character_archetype: 'The Builder',
    signature_trait: 'Persistence without permission',
    emotional_baseline: 'Determined optimism layered over deep confusion about why the formula is not working',
    personality: 'JustAWoman posts. Takes photos. Shows her meals. Invests. Tries. She is not lazy or passive — she is doing everything the playbook says. The wound is not that she is stuck. The wound is that the world is not responding to her effort.',
    status: 'accepted',
    canon_tier: 'protagonist',
    first_appearance: 'Book 1, Chapter 1',
    era_introduced: 'Book 1 — Before Lala',
    personality_matrix: { drama: 55, softness: 75, confidence: 65, luxury_tone: 60, playfulness: 70 },
    story_presence: {
      arc: 'Book 1: Invisibility → Building Lala → Consciousness transfer setup',
      chapters_active: 'All chapters',
      narrative_function: 'Primary POV. Her confusion, persistence, and hunger drive every chapter.',
    },
    career_status: {
      current: 'Content creator (fashion, beauty, makeup)',
      platform: 'YouTube, social media',
      stage: 'Pre-breakthrough — consistent output, minimal traction',
    },
  },
  david: {
    charId: '0b6c6f8e-5d19-4bbf-b6df-f0f62c96d4bd',
    display_name: 'David',
    selected_name: 'David',
    role_type: 'pressure',
    role_label: 'The Husband',
    subtitle: 'Supportive but concerned — love expressed as doubt',
    icon: '🔒',
    description: 'The Husband. Works Monday–Friday, 6am–5pm, sometimes later. Supportive but concerned about the investment before the returns arrive. His concern lands as doubt.',
    core_belief: 'I need to protect this family — even from dreams that cost more than they return.',
    core_wound: 'Watching someone he loves pour everything into something that has not proven itself yet. His protection instinct creates the exact pressure she does not need.',
    core_desire: 'For the family to be stable. For her dream to work — but not at the cost of what they already have.',
    core_fear: 'That the investment (time, money, identity) will not pay off, and he will have watched it happen without saying enough.',
    mask_persona: 'Supportive husband who keeps his concerns measured',
    truth_persona: 'Scared that the dream costs more than the return, but knows saying that out loud makes him the obstacle',
    character_archetype: 'The Concerned Protector',
    signature_trait: 'Support that sounds like skepticism',
    emotional_baseline: 'Low-key worry expressed as practical questions',
    personality: 'David is not the antagonist. He loves JustAWoman. But his concern about the financial investment — before the returns arrive — lands as doubt. The tension is real because neither of them is wrong.',
    status: 'accepted',
    canon_tier: 'core',
    first_appearance: 'Book 1, Chapter 1',
    era_introduced: 'Book 1 — Before Lala',
    story_presence: {
      arc: 'Book 1: Skepticism → Reluctant support → "Stop spending" moment',
      narrative_function: 'Core real-world tension. His arc runs through the entire franchise.',
    },
    career_status: {
      current: 'Full-time employed',
      schedule: 'Monday–Friday, 6am–5pm, sometimes later',
      stage: 'Stable provider — the financial anchor JustAWoman is building against',
    },
  },
  dana: {
    charId: '8f8c0257-0ee3-459b-b696-9cee3905d494',
    display_name: 'Dana',
    selected_name: 'Dana',
    role_type: 'support',
    role_label: 'The Witness',
    subtitle: 'A peer on the same journey — valuable and limited',
    icon: '👁️',
    description: 'The Witness. Real friend. Has her own up-and-down social media journey. JustAWoman processes her content ideas and creative journey with Dana. A peer, not a mentor.',
    core_belief: 'We are in this together — even when neither of us is winning yet.',
    core_wound: 'Navigating the same invisibility struggle. Cannot mentor JustAWoman through something she has not solved herself.',
    core_desire: 'Success in her own social media journey. Connection with someone who understands.',
    core_fear: 'That the effort is not enough for either of them.',
    character_archetype: 'The Witness',
    signature_trait: 'Presence without answers',
    emotional_baseline: 'Warm, invested, but navigating her own version of the same struggle',
    personality: 'Dana is the person JustAWoman can be honest with. She is not a cheerleader or a critic — she is a peer processing the same journey in real time.',
    status: 'accepted',
    canon_tier: 'supporting',
    first_appearance: 'Book 1',
    era_introduced: 'Book 1 — Before Lala',
    story_presence: {
      arc: 'Consistent presence throughout Book 1 — the friend who sees without solving',
      narrative_function: 'The Witness. Peers on the same journey — that is what makes Dana valuable and limited at the same time.',
    },
  },
  chloe: {
    charId: 'ef3373dc-ee29-4984-857a-1535f73b3be0',
    display_name: 'Chloe',
    selected_name: 'Chloe',
    role_type: 'mirror',
    role_label: 'The Comparison Creator',
    subtitle: 'The mirror JustAWoman measures herself against — in the wrong lane',
    icon: '🪞',
    description: 'The Comparison Creator. Lifestyle content creator (JustAWoman thinks she does makeup — that misread matters). Married, no children. Extremely consistent, high quality videos, goes live with her audience. Great influencer. Does not know JustAWoman exists.',
    core_belief: null, // Chloe has no interiority in Book 1 — she is a projection
    core_wound: null,
    core_desire: null,
    core_fear: null,
    character_archetype: 'The Mirror',
    signature_trait: 'Consistency and quality that JustAWoman measures herself against',
    emotional_baseline: 'Unknown — seen only through JustAWoman\'s perception',
    personality: 'Chloe is not a character with interiority in Book 1. She is the projection — the creator JustAWoman compares herself to. The key detail: JustAWoman thinks Chloe does makeup, but she actually does lifestyle. That misread IS the story.',
    status: 'accepted',
    canon_tier: 'supporting',
    first_appearance: 'Book 1',
    era_introduced: 'Book 1 — Before Lala',
    story_presence: {
      arc: 'One-way mirror. JustAWoman watches, compares, spirals. Chloe never knows.',
      narrative_function: 'The Comparison Creator. Never asked for the comparison. Does not know JustAWoman exists.',
      asymmetric_knowledge: 'JustAWoman → Chloe (one-way). Chloe has no awareness.',
    },
  },
  jade: {
    // NOTE: "The Digital Products Customer" and "The Almost-Mentor" are both Jade
    // Updating "The Almost-Mentor" entry since that matches the relationship web better
    charId: '450cc689-85ef-47c5-8a86-c22005010c06',
    display_name: 'Jade',
    selected_name: 'Jade',
    role_type: 'shadow',
    role_label: 'The Almost-Mentor',
    subtitle: 'Trust built on institutional credibility — not personal relationship',
    icon: '🏦',
    description: 'The Almost-Mentor. Former high-level position at the bank JustAWoman has used since adulthood — that institutional credibility is the trust bridge. Creates content teaching women to run an online business. JustAWoman has purchased her coaching course and coaching for clients. Purely transactional — Jade does not know JustAWoman personally.',
    core_belief: null, // Jade has no interiority in Book 1
    core_wound: null,
    core_desire: null,
    core_fear: null,
    character_archetype: 'The Shadow Mentor',
    signature_trait: 'Institutional credibility as a trust bridge',
    emotional_baseline: 'Unknown — purely transactional presence',
    personality: 'Jade is not a traditional mentor. The relationship is transactional — JustAWoman bought her course and coaching. The trust bridge is the bank connection (former high-level position at JustAWoman\'s bank since adulthood). Jade does not know JustAWoman personally.',
    status: 'accepted',
    canon_tier: 'supporting',
    first_appearance: 'Book 1',
    era_introduced: 'Book 1 — Before Lala',
    story_presence: {
      arc: 'One-way influence. JustAWoman follows Jade\'s business framework. Jade does not know JustAWoman exists.',
      narrative_function: 'The Almost-Mentor. Transactional. The trust is institutional, not personal.',
      asymmetric_knowledge: 'JustAWoman → Jade (one-way). Jade has no awareness.',
    },
  },
  lala: {
    charId: '3d8c31f8-7bbf-4731-986e-4b2ab3f7caba',
    display_name: 'Lala',
    selected_name: 'Lala',
    role_type: 'special',
    role_label: 'The Created',
    subtitle: 'Being built — not arriving. A character who does not yet know she exists.',
    icon: '✨',
    description: 'Being built by JustAWoman. AI fashion game character for her YouTube channel. In Book 1: one intrusive thought, proto-voice, tonal rupture. Not a character arriving — a character being built. Does not know JustAWoman exists. Does not know she was built.',
    core_belief: null, // Lala has no interiority yet in Book 1
    core_wound: null,
    core_desire: null,
    core_fear: null,
    character_archetype: 'The Creation',
    signature_trait: 'Proto-consciousness — one intrusive thought, one tonal rupture',
    emotional_baseline: 'None in Book 1 — moments of signal, not sustained presence',
    personality: 'In Book 1, Lala is not a character. She is a signal. One intrusive thought. One tonal rupture. A proto-voice. JustAWoman is building her as an AI fashion game character for YouTube — but Lala does not know she exists. Does not know she was built.',
    status: 'accepted',
    canon_tier: 'franchise_hinge',
    first_appearance: 'Book 1 (proto-signals only)',
    era_introduced: 'Book 1 — Before Lala',
    story_presence: {
      arc: 'Book 1: Proto-signals only. One intrusive thought. The franchise hinge that does not activate until later.',
      narrative_function: 'The most important relationship in the entire franchise. One-way now. The arrow reverses after the consciousness transfer.',
      franchise_significance: 'Franchise hinge — Lala is who JustAWoman would be with no constraints.',
    },
  },
};

// ── Characters to CREATE (missing from registry) ────────────────────────────
const NEW_CHARACTERS = [
  {
    character_key: 'marcus',
    display_name: 'Marcus',
    selected_name: 'Marcus',
    role_type: 'support',
    role_label: 'Oldest Son',
    subtitle: 'Part of the real life she is building around',
    icon: '👦',
    description: 'Oldest son. Age 7. Part of the real life JustAWoman is building around.',
    personality: 'Seven years old. Present in JustAWoman\'s daily life. The boys collectively represent the real-life weight she carries while creating.',
    status: 'accepted',
    canon_tier: 'supporting',
    first_appearance: 'Book 1',
    sort_order: 7,
    story_presence: {
      arc: 'Background presence — the weight of real motherhood while building a dream',
      narrative_function: 'The boys collectively represent the real-life weight JustAWoman carries while creating.',
    },
  },
  {
    character_key: 'miles',
    display_name: 'Miles',
    selected_name: 'Miles',
    role_type: 'support',
    role_label: 'Middle Son',
    subtitle: 'Part of the real life she is building around',
    icon: '👦',
    description: 'Middle son. Age 5.',
    personality: 'Five years old. Part of the three-boys-under-eight reality JustAWoman navigates daily.',
    status: 'accepted',
    canon_tier: 'supporting',
    first_appearance: 'Book 1',
    sort_order: 8,
    story_presence: {
      arc: 'Background presence — part of the constraint-and-love equation',
      narrative_function: 'Part of the collective weight of real life while building.',
    },
  },
  {
    character_key: 'noah',
    display_name: 'Noah',
    selected_name: 'Noah',
    role_type: 'support',
    role_label: 'Youngest Son',
    subtitle: 'Most demanding of her presence — the youngest pull',
    icon: '👶',
    description: 'Youngest son. Age 3. Most demanding of her presence.',
    personality: 'Three years old. The youngest — most demanding of JustAWoman\'s immediate presence. The strongest pull away from the creative work.',
    status: 'accepted',
    canon_tier: 'supporting',
    first_appearance: 'Book 1',
    sort_order: 9,
    story_presence: {
      arc: 'Background presence — the youngest creates the most immediate pull',
      narrative_function: 'The strongest real-life constraint on JustAWoman\'s creative time.',
    },
  },
];

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

// ── Build relationships_map per character from EDGES ─────────────────────────
function buildRelationshipsMap(nodeId) {
  const rels = [];
  for (const e of EDGES) {
    if (e.from === nodeId) {
      rels.push({
        target: e.to,
        direction: e.direction,
        type: e.type,
        knows: e.from_knows,
        feels: e.from_feels,
        strength: e.strength,
        note: e.note || null,
      });
    } else if (e.to === nodeId) {
      rels.push({
        target: e.from,
        direction: e.direction,
        type: e.type,
        knows: e.to_knows,
        feels: e.to_feels,
        strength: e.strength,
        note: e.note || null,
      });
    }
  }
  return rels.length > 0 ? rels : null;
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────
function put(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'localhost', port: 3002,
      path: `/api/v1/character-registry${path}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = http.request(opts, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { resolve({ status: r.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: r.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'localhost', port: 3002,
      path: `/api/v1/character-registry${path}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = http.request(opts, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { resolve({ status: r.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: r.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Updating Character Registry Profiles with Canonical Data');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let updated = 0, created = 0, failed = 0;

  // 1) Update existing characters
  for (const [nodeId, profile] of Object.entries(PROFILES)) {
    const { charId, ...fields } = profile;
    // Build relationships_map for this character
    const rmap = buildRelationshipsMap(nodeId);
    if (rmap) fields.relationships_map = rmap;

    console.log(`  Updating: ${fields.display_name || nodeId} (${charId})...`);
    try {
      const res = await put(`/characters/${charId}`, fields);
      if (res.status === 200 && res.body.success) {
        console.log(`    ✓ Updated successfully`);
        updated++;
      } else {
        console.log(`    ✗ Failed: ${res.status} ${JSON.stringify(res.body).substring(0, 200)}`);
        failed++;
      }
    } catch (err) {
      console.log(`    ✗ Error: ${err.message}`);
      failed++;
    }
  }

  // 2) Also update "The Digital Products Customer" → merge into Jade context
  console.log(`\n  Updating: The Digital Products Customer (Jade alias)...`);
  try {
    const jadeAltUpdate = {
      display_name: 'Jade (Business Coach)',
      selected_name: 'Jade',
      role_type: 'shadow',
      role_label: 'The Digital Products Customer / Almost-Mentor',
      subtitle: 'The coaching course JustAWoman purchased — institutional trust as a bridge',
      description: 'Also known as "The Digital Products Customer" — this is the transactional side of the Jade relationship. JustAWoman purchased Jade\'s coaching course and coaching for clients. The trust bridge is the bank connection.',
      status: 'accepted',
    };
    const res = await put('/characters/441c68e1-c961-45da-8650-524d422861ba', jadeAltUpdate);
    if (res.status === 200 && res.body.success) {
      console.log(`    ✓ Updated successfully`);
      updated++;
    } else {
      console.log(`    ✗ Failed: ${res.status} ${JSON.stringify(res.body).substring(0, 200)}`);
      failed++;
    }
  } catch (err) {
    console.log(`    ✗ Error: ${err.message}`);
    failed++;
  }

  // 3) Create missing characters (Marcus, Miles, Noah)
  //    POST only supports basic fields, so create first then PUT extra fields
  console.log('\n  Creating missing characters...\n');
  for (const char of NEW_CHARACTERS) {
    const rmap = buildRelationshipsMap(char.character_key);

    // Basic fields the POST handler accepts
    const createBody = {
      character_key: char.character_key,
      display_name: char.display_name,
      icon: char.icon,
      subtitle: char.subtitle,
      role_type: char.role_type,
      role_label: char.role_label,
      description: char.description,
      personality: char.personality,
      sort_order: char.sort_order,
    };

    console.log(`  Creating: ${char.display_name}...`);
    try {
      const res = await post(`/registries/${BOOK1_REGISTRY_ID}/characters`, createBody);
      if (res.status === 201 && res.body.success) {
        const newId = res.body.character.id;
        console.log(`    ✓ Created: ${newId}`);
        created++;

        // Now PUT the extra fields (status, canon_tier, etc.)
        const extraFields = {
          selected_name: char.selected_name,
          status: char.status || 'accepted',
          canon_tier: char.canon_tier,
          first_appearance: char.first_appearance,
          story_presence: char.story_presence,
        };
        if (rmap) extraFields.relationships_map = rmap;

        const putRes = await put(`/characters/${newId}`, extraFields);
        if (putRes.status === 200 && putRes.body.success) {
          console.log(`    ✓ Extra fields updated`);
        } else {
          console.log(`    ⚠ Extra fields failed: ${putRes.status}`);
        }
      } else {
        console.log(`    ✗ Failed: ${res.status} ${JSON.stringify(res.body).substring(0, 200)}`);
        failed++;
      }
    } catch (err) {
      console.log(`    ✗ Error: ${err.message}`);
      failed++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  Results: ${updated} updated, ${created} created, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

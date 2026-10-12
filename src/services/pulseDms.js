'use strict';

/**
 * DMs on The Pulse (Task #2984; The Pulse spec §3 "Lala's DMs are canon
 * conversations, drafted in voice and approved like posts; they can appear
 * on Lala's Phone"; docs/reads/2026-10-12-pulse-world-depth-read.md §3).
 * Evoni, 2026-10-12: both sides are drafted in voice, Lala's included, and
 * every message waits in Review.
 *
 *   openThread(db, { showId, a, b, at, topic })   one thread per pair
 *   enqueueMessage(db, { threadId, senderProfileId?, at? })
 *     queues a `dm` job (pulseQueue, under the daily draft cap); the sender
 *     defaults to whoever did not write the last message. Never calls AI.
 *   draftMessage(db, { threadId, senderProfileId, at })
 *     one Sonnet call in the sender's Voice Profile: the conversation so far,
 *     the topic, the story moment, the events the sender knows by then
 *     (pulseKnowledge, as the post drafter), the sender's Living State as
 *     private context. The gate runs on it (pulseGate, as a post at its story order)
 *     and the message is always left a draft.
 *   decide(message, action, { text, by })   approve | edit (approve with new
 *     text) | reject; deciding again is a 409
 *   threadsOf(db, showId, { at, profileId })
 *     with `at`: live messages at or before it only (The Pulse, the Phone);
 *     without: every message but rejected ones, with the gate (Review)
 *   registerHandlers()   the queue's `dm` handler
 */

const MODELS = ['claude-sonnet-4-6'];
const HISTORY = 20;   // the messages of the conversation the drafter sees

class DmError extends Error {
  constructor(status, message) { super(message); this.status = status; this.name = 'DmError'; }
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const pairOf = (a, b) => (Number(a) < Number(b) ? [Number(a), Number(b)] : [Number(b), Number(a)]);

/** The thread for a pair, opened at `at` with its topic if it is new. */
async function openThread(db, { showId, a, b, at = 0, topic = null }) {
  if (Number(a) === Number(b)) throw new DmError(400, 'A conversation needs two different profiles.');
  const [x, y] = pairOf(a, b);
  const [profiles] = await db.sequelize.query('SELECT id FROM social_profiles WHERE id IN (:ids) AND deleted_at IS NULL', { replacements: { ids: [x, y] } });
  if (profiles.length !== 2) throw new DmError(404, 'Both profiles must exist.');
  const existing = await db.PulseDmThread.findOne({ where: { show_id: showId, profile_a_id: x, profile_b_id: y } });
  if (existing) return existing;
  return db.PulseDmThread.create({
    show_id: showId, profile_a_id: x, profile_b_id: y,
    opened_story_order: Number.isInteger(at) ? at : 0,
    topic: topic ? String(topic).trim().slice(0, 1000) : null,
  });
}

/** The thread's messages in order (rejected ones left out). */
async function messagesOf(db, threadId, { liveOnly = false, at = null } = {}) {
  const { Op } = require('sequelize');
  const where = { thread_id: threadId, status: liveOnly ? 'live' : { [Op.ne]: 'rejected' } };
  if (at !== null) where.story_order = { [Op.lte]: at };
  return db.PulseDmMessage.findAll({ where, order: [['story_order', 'ASC'], ['created_at', 'ASC']] });
}

/** Queues the next message of a thread. Returns the job. */
async function enqueueMessage(db, { threadId, senderProfileId = null, at = null }) {
  const thread = await db.PulseDmThread.findByPk(threadId);
  if (!thread) throw new DmError(404, 'Conversation not found');
  const pair = [Number(thread.profile_a_id), Number(thread.profile_b_id)];
  let sender = senderProfileId == null ? null : Number(senderProfileId);
  if (sender !== null && !pair.includes(sender)) throw new DmError(400, 'The sender must be one of the two in the conversation.');
  if (sender === null) {
    const last = (await messagesOf(db, thread.id)).pop();
    if (!last) throw new DmError(400, 'Say who writes the first message.');
    sender = pair.find((id) => id !== Number(last.sender_profile_id));
  }
  return require('./pulseQueue').enqueue(db, {
    showId: thread.show_id, kind: 'dm',
    payload: { thread_id: thread.id, sender_profile_id: sender, ...(Number.isInteger(at) ? { at } : {}) },
  });
}

/** The sender's Voice Profile, character and Feed profile, or a DmError. */
async function senderOf(db, profileId) {
  const voice = await db.PulseVoice.findOne({ where: { social_profile_id: profileId } });
  if (!voice) throw new DmError(400, `Profile ${profileId} has no Voice Profile yet. Build it in Admin › The Pulse › Voices.`);
  const character = await db.RegistryCharacter.findByPk(voice.registry_character_id);
  if (!character) throw new DmError(404, 'The voice\'s character is gone.');
  const [[profile]] = await db.sequelize.query(
    'SELECT id, handle, display_name FROM social_profiles WHERE id = :id AND deleted_at IS NULL', { replacements: { id: profileId } });
  if (!profile) throw new DmError(404, `Profile ${profileId} is gone.`);
  return { voice, character, profile };
}

function buildPrompt({ sender, other, history, topic, label, known }) {
  const { BANNED_PHRASES } = require('./pulseVoices');
  const name = (p) => `${p.display_name || p.handle} (@${p.handle})`;
  const examples = (sender.voice.examples_json || []).slice(0, 6).map((e) => `- ${e.text}`).join('\n') || '(none yet)';
  const lines = history.map((m) => `${Number(m.sender_profile_id) === Number(sender.profile.id) ? 'You' : 'Them'}: ${m.text}`).join('\n')
    || '(nothing yet: you write first)';
  return `You write one direct message on The Pulse, LalaVerse's social network, as ${name(sender.profile)}, to ${name(other)}.

Write exactly in this voice:
${JSON.stringify(sender.voice.habits_json || {}, null, 2)}
Things they really wrote:
${examples}

When: ${label || 'now'}.
${require('./pulseDrafter').knowsLine(known)}
What the conversation is about: ${topic || 'whatever they would message about'}.
The conversation so far:
${lines}

PRIVATE (shapes the mood only; never state, quote or hint at it directly):
${JSON.stringify(sender.character.living_state || {})}

Rules: stay in the world (nothing about a show, episodes or a studio); nothing that happens after this moment; one message, the length they really text; never use: ${BANNED_PHRASES.join(', ')}.
Answer with JSON only: {"text": "the message"}`;
}

/** Drafts the next message in the sender's voice and gates it; it stays a draft. Returns { message, gate, review }. */
async function draftMessage(db, { threadId, senderProfileId, at = null }) {
  const thread = await db.PulseDmThread.findByPk(threadId);
  if (!thread) throw new DmError(404, 'Conversation not found');
  const pair = [Number(thread.profile_a_id), Number(thread.profile_b_id)];
  const senderId = Number(senderProfileId);
  if (!pair.includes(senderId)) throw new DmError(400, 'The sender must be one of the two in the conversation.');
  const sender = await senderOf(db, senderId);
  const otherId = pair.find((id) => id !== senderId);
  const [[other]] = await db.sequelize.query('SELECT id, handle, display_name FROM social_profiles WHERE id = :id', { replacements: { id: otherId } });
  const history = (await messagesOf(db, thread.id)).slice(-HISTORY);
  const last = history[history.length - 1];
  const order = Number.isInteger(at) ? at : (last ? Number(last.story_order) : Number(thread.opened_story_order));
  const clock = require('./storyClock');
  // What the sender knows by then (Task #2982): the gate flags a DM naming anything else.
  const known = await require('./pulseKnowledge').knowledgeLine(db, thread.show_id, senderId, order);
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({
        model, max_tokens: 300,
        messages: [{ role: 'user', content: buildPrompt({ sender, other: other || { handle: String(otherId) }, history, topic: thread.topic, label: clock.label(order), known }) }],
      });
      break;
    } catch (modelErr) {
      console.warn(`[PulseDms] drafting with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const raw = (message?.content?.[0]?.text || '').trim();
  let text;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    text = String(JSON.parse(match ? match[0] : raw).text || '').trim().slice(0, 2000);
  } catch (parseErr) {
    console.error('[PulseDms] could not read the message:', parseErr.message);
    throw new DmError(502, 'The message came back in a form that could not be read.');
  }
  if (!text) throw new DmError(502, 'The message came back empty.');

  const gateApi = require('./pulseGate');
  const lalaProfileId = await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  const asPost = {
    show_id: thread.show_id, social_profile_id: senderId, poster_handle: sender.profile.handle,
    content_text: text, trending_topic: null, story_order: order,
  };
  const gate = await gateApi.check(db, asPost, { voice: sender.voice, privateState: sender.character.living_state || null, lalaProfileId });
  // Every DM waits for Evoni (her ruling); the other reasons say what else to look at.
  const review = ['dm', ...gateApi.reviewReasons(asPost, gate, { lalaProfileId })];
  const row = await db.PulseDmMessage.create({
    thread_id: thread.id, show_id: thread.show_id, sender_profile_id: senderId, text, story_order: order,
    status: 'draft', gate_json: { ...gate, review, checked_at: new Date().toISOString() },
    ai_generated: true, generation_model: MODELS[0],
  });
  return { message: row, gate, review };
}

/** Evoni's decision on a draft message: approve, edit (approve with new text) or reject. */
async function decide(message, action, { text, by } = {}) {
  if (message.status !== 'draft') throw new DmError(409, 'This message was already decided.');
  const now = new Date();
  if (action === 'reject') return message.update({ status: 'rejected', decided_by: by, decided_at: now });
  if (action === 'edit') {
    const next = String(text || '').trim();
    if (!next) throw new DmError(400, 'An edit needs the new text.');
    return message.update({ text: next.slice(0, 2000), status: 'live', posted_at: now, decided_by: by, decided_at: now });
  }
  if (action === 'approve') return message.update({ status: 'live', posted_at: now, decided_by: by, decided_at: now });
  throw new DmError(400, `Unknown decision: ${action}`);
}

/** Threads with their messages and both profiles; `at` gives the live view, `profileId` one profile's threads. */
async function threadsOf(db, showId, { at = null, profileId = null } = {}) {
  const { Op } = require('sequelize');
  const where = { show_id: showId };
  if (profileId != null) where[Op.or] = [{ profile_a_id: Number(profileId) }, { profile_b_id: Number(profileId) }];
  if (at !== null) where.opened_story_order = { [Op.lte]: at };
  const threads = await db.PulseDmThread.findAll({ where, order: [['created_at', 'ASC']] });
  const ids = [...new Set(threads.flatMap((t) => [Number(t.profile_a_id), Number(t.profile_b_id)]))];
  const [profiles] = ids.length ? await db.sequelize.query(
    'SELECT id, handle, display_name FROM social_profiles WHERE id IN (:ids)', { replacements: { ids } }) : [[]];
  const profileOf = new Map(profiles.map((p) => [Number(p.id), { id: Number(p.id), handle: p.handle, display_name: p.display_name }]));
  const out = [];
  for (const t of threads) {
    const messages = await messagesOf(db, t.id, { liveOnly: at !== null, at });
    if (at !== null && messages.length === 0) continue;   // nothing said yet at this moment
    out.push({
      id: t.id,
      opened_story_order: Number(t.opened_story_order),
      topic: at !== null ? undefined : t.topic,
      profiles: [profileOf.get(Number(t.profile_a_id)) || { id: Number(t.profile_a_id) }, profileOf.get(Number(t.profile_b_id)) || { id: Number(t.profile_b_id) }],
      messages: messages.map((m) => ({
        id: m.id,
        sender_profile_id: Number(m.sender_profile_id),
        text: m.text,
        story_order: Number(m.story_order),
        posted_at: m.posted_at,
        ...(at !== null ? {} : { status: m.status, gate: m.gate_json || null, decided_by: m.decided_by, decided_at: m.decided_at }),
      })),
    });
  }
  return out;
}

/** The queue's `dm` handler. */
async function handleDm(db, job) {
  const p = job.payload_json || {};
  const { message } = await draftMessage(db, { threadId: p.thread_id, senderProfileId: p.sender_profile_id, at: Number.isInteger(p.at) ? p.at : null });
  return { draftIds: [message.id] };
}

function registerHandlers() {
  require('./pulseQueue').register('dm', handleDm);
}

module.exports = {
  MODELS, HISTORY, DmError, pairOf, openThread, messagesOf, enqueueMessage, buildPrompt, draftMessage, decide, threadsOf, handleDm, registerHandlers,
};

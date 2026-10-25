/**
 * World Events routes — shared helpers
 *
 * Used by more than one of the route modules in this folder.
 */

'use strict';

const { isBudgetError } = require('../../services/imageCostService');
const { loadScopedEvent } = require('../../utils/eventScope');

async function getModels() {
  try { return require('../../models'); } catch (e) { console.error('Failed to load models:', e.message); return null; }
}

const invitationError = (res, err, where) => {
  console.error(`[InviteGen] ${where} failed:`, err.message);
  const status = err.status || err.statusCode || (isBudgetError(err) ? 429 : 500);
  return res.status(status).json({ success: false, error: err.message });
};

const invitationService = () => require('../../services/invitationGeneratorService');

// One slow invitation action: a job when the body asks for one, else inline.
async function runInvitationWork(req, res, { kind, eventId = null, where }, work) {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    if (req.body?.async) {
      if (eventId) {
        // Refuse a missing event now, not inside the job.
        const event = await loadScopedEvent(models.sequelize, { showId: req.params.showId, eventId, columns: 'id' });
        if (!event) return res.status(404).json({ success: false, error: 'Event not found in this show.' });
      }
      const { startJob } = require('../../services/invitationJobs');
      const job = startJob({ showId: req.params.showId, eventId, kind }, (progress) => work(models, progress));
      return res.status(202).json({ success: true, jobId: job.id, job });
    }
    const data = await work(models, () => {});
    return res.json({ success: true, data });
  } catch (err) {
    return invitationError(res, err, where);
  }
}

// The money preview's data, or null when the event is not live in this show.
// `event`: the row, when the caller has already read it (the combined GET).
async function loadMoneyPreview(sequelize, { showId, eventId, event = null }) {
  const row = event || await loadScopedEvent(sequelize, { showId, eventId });
  if (!row) return null;
  const { eventMoneyPreview } = require('../../services/episodeMoneyService');
  return eventMoneyPreview(sequelize, { showId, event: row, episodeId: row.used_in_episode_id || null });
}

module.exports = { getModels, invitationError, invitationService, runInvitationWork, loadMoneyPreview };

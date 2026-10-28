'use strict';

/**
 * Voice Studio B1 (Evoni, 2026-10-27; design read
 * docs/reads/2026-10-27-voice-studio-timeline-design.md, Revision 5):
 * line-based dialogue takes. Mounted at /api/v1/voice-studio (/api/v1/voice is characterVoiceRoutes). Server only in B1:
 * no page calls these yet.
 *
 *   GET    /status                                     200 while switched on (the page's links show only then; B2)
 *   GET    /:episodeId/studio                          the page's view in one snapshot: lines by beat, takes, approvals (B2)
 *   GET    /:episodeId/summary                         approvals and their states, counts by beat
 *   GET    /:episodeId/playable                        current approvals only: the one list a player or export may use
 *   GET    /:episodeId/approvals/history               every approval, superseded, invalid and revoked included
 *   GET    /:episodeId/takes                           the takes, with their latest revision and line
 *   POST   /:episodeId/sources                         upload or recording (multipart `audio`, `kind`)
 *   POST   /:episodeId/candidates                      a take for a source { source_asset_id, label, in_ms, out_ms }
 *   POST   /:episodeId/candidates/:candidateId/revisions    trim, gain, fades { in_ms, out_ms, gain_db, fade_in_ms, fade_out_ms, normalise }
 *   POST   /:episodeId/candidates/:candidateId/associate    tie it to a line { script_revision, beat_number, line_index }
 *   POST   /:episodeId/candidates/:candidateId/approve      { candidate_revision_id, script_revision, expected_approval_id }
 *   POST   /:episodeId/approvals/:approvalId/resolve   a moved or ambiguous line confirmed { script_revision, line_index, expected_approval_id }
 *   POST   /:episodeId/approvals/:approvalId/revoke    withdraw an approval (kept as history)
 *   DELETE /:episodeId/candidates/:candidateId         remove a take (its source stays)
 *   POST   /:episodeId/reconfirm                       { script_revision, items: [{ approval_id, context_hash }] }
 *   POST   /:episodeId/legacy-import                   bring in the old voice clips, unassociated, unapproved
 *
 * Voice Studio is for admins only (Evoni, 2026-10-28): every write, and every
 * read of the studio (studio, summary, history, takes), is requireAuth +
 * authorize(['ADMIN']). Only /status and /playable answer any signed-in user:
 * the Teleprompter plays approved takes, and nothing else, for anyone it lets
 * read a script.
 * Switched off unless VOICE_STUDIO=on (every route then answers 404), so
 * deploying B1 changes nothing anyone uses until it is switched on.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { requireAuth, authorize } = require('../middleware/auth');
const models = require('../models');
const studio = require('../services/voiceStudioService');

const router = express.Router();
const MAX_MB = Number(process.env.VOICE_SOURCE_MAX_MB) || 50;
const TMP_DIR = path.join(require('os').tmpdir(), 'voice-studio');
const admin = [requireAuth, authorize(['ADMIN'])];

const enabled = () => String(process.env.VOICE_STUDIO || '').toLowerCase() === 'on';
router.use((req, res, next) => {
  if (enabled()) return next();
  return res.status(404).json({ success: false, error: 'Voice Studio is not switched on', code: 'VOICE_STUDIO_OFF' });
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => fs.mkdir(TMP_DIR, { recursive: true }, (err) => cb(err, TMP_DIR)),
    filename: (req, file, cb) => cb(null, `source-${Date.now()}-${uuidv4()}${path.extname(file.originalname || '').toLowerCase()}`),
  }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (studio.AUDIO_EXTS.includes(ext)) cb(null, true);
    else cb(new studio.VoiceStudioError(400, 'BAD_TYPE', `Only these audio files can be used: ${studio.AUDIO_EXTS.join(' ')}`));
  },
});

const userOf = (req) => (req.user?.id ? String(req.user.id).slice(0, 255) : null);

function sendError(res, err, what) {
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooBig ? 413 : 400).json({ success: false, error: tooBig ? `That file is over ${MAX_MB} MB` : err.message });
  }
  if (err instanceof studio.VoiceStudioError) {
    return res.status(err.status).json({ success: false, error: err.message, code: err.code, ...err.extra });
  }
  console.error(`[VoiceStudio] ${what} failed:`, err.message);
  return res.status(500).json({ success: false, error: 'Something went wrong. Nothing was changed.' });
}

const handle = (what, fn) => async (req, res) => {
  try {
    return res.json({ success: true, data: await fn(req) });
  } catch (err) {
    return sendError(res, err, what);
  }
};

const s = () => models.sequelize;

router.get('/status', requireAuth, (req, res) => res.json({ success: true, data: { on: true } }));
router.get('/:episodeId/studio', ...admin, handle('studio', async (req) => ({
  ...(await studio.studioView(s(), { episodeId: req.params.episodeId })),
  // Writes are ADMIN only; the page shows read-only to anyone else (the server still refuses them).
  // The same test authorize(['ADMIN']) makes (case-insensitive group names).
  can_edit: Array.isArray(req.user?.groups) && req.user.groups.some((g) => String(g).toLowerCase() === 'admin'),
})));
router.get('/:episodeId/summary', ...admin, handle('summary', (req) => studio.summary(s(), { episodeId: req.params.episodeId })));
router.get('/:episodeId/playable', requireAuth, handle('playable takes', (req) => studio.playableApprovals(s(), { episodeId: req.params.episodeId })));
router.get('/:episodeId/approvals/history', ...admin, handle('approval history', (req) => studio.approvalHistory(s(), { episodeId: req.params.episodeId })));
router.get('/:episodeId/takes', ...admin, handle('list takes', (req) => studio.listTakes(s(), { episodeId: req.params.episodeId })));

router.post('/:episodeId/sources', ...admin, (req, res) => {
  upload.single('audio')(req, res, async (uploadErr) => {
    const file = req.file;
    try {
      if (uploadErr) throw uploadErr;
      const out = await studio.createSource(s(), { episodeId: req.params.episodeId, kind: req.body?.kind, file, userId: userOf(req) });
      return res.status(out.existed ? 200 : 201).json({ success: true, data: out });
    } catch (err) {
      return sendError(res, err, 'source upload');
    } finally {
      if (file?.path) {
        fs.promises.unlink(file.path).catch((err) => console.error('[VoiceStudio] temp file not removed:', err.message));
      }
    }
  });
});

router.post('/:episodeId/candidates', ...admin, handle('create take', (req) => studio.createCandidate(s(), {
  episodeId: req.params.episodeId, sourceAssetId: req.body?.source_asset_id, label: req.body?.label || null,
  settings: req.body || {}, userId: userOf(req),
})));

router.post('/:episodeId/candidates/:candidateId/revisions', ...admin, handle('revise take', (req) => studio.reviseCandidate(s(), {
  episodeId: req.params.episodeId, candidateId: req.params.candidateId, settings: req.body || {}, userId: userOf(req),
})));

router.post('/:episodeId/candidates/:candidateId/associate', ...admin, handle('associate', (req) => studio.associate(s(), {
  episodeId: req.params.episodeId, candidateId: req.params.candidateId, scriptRevision: req.body?.script_revision,
  beatNumber: req.body?.beat_number, lineIndex: req.body?.line_index, userId: userOf(req),
})));

router.post('/:episodeId/candidates/:candidateId/approve', ...admin, handle('approve', (req) => studio.approve(s(), {
  episodeId: req.params.episodeId, candidateId: req.params.candidateId, candidateRevisionId: req.body?.candidate_revision_id,
  scriptRevision: req.body?.script_revision, expectedApprovalId: req.body?.expected_approval_id, userId: userOf(req),
})));

router.post('/:episodeId/approvals/:approvalId/resolve', ...admin, handle('confirm line', (req) => studio.resolveApproval(s(), {
  episodeId: req.params.episodeId, approvalId: req.params.approvalId, scriptRevision: req.body?.script_revision,
  lineIndex: req.body?.line_index, expectedApprovalId: req.body?.expected_approval_id, userId: userOf(req),
})));

router.post('/:episodeId/approvals/:approvalId/revoke', ...admin, handle('withdraw approval', (req) => studio.revokeApproval(s(), {
  episodeId: req.params.episodeId, approvalId: req.params.approvalId, userId: userOf(req),
})));

router.delete('/:episodeId/candidates/:candidateId', ...admin, handle('remove take', (req) => studio.removeCandidate(s(), {
  episodeId: req.params.episodeId, candidateId: req.params.candidateId,
})));

router.post('/:episodeId/reconfirm', ...admin, handle('reconfirm', (req) => studio.reconfirm(s(), {
  episodeId: req.params.episodeId, scriptRevision: req.body?.script_revision, items: req.body?.items, userId: userOf(req),
})));

router.post('/:episodeId/legacy-import', ...admin, handle('legacy import', (req) => studio.importLegacy(s(), {
  episodeId: req.params.episodeId, userId: userOf(req),
})));

module.exports = router;

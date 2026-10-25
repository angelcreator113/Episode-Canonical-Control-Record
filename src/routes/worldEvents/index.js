/**
 * World Events Routes — Event Library CRUD + Inject into Episode
 * 
 * GET    /api/v1/world/:showId/events          — List events
 * POST   /api/v1/world/:showId/events          — Create event
 * PUT    /api/v1/world/:showId/events/:eventId  — Update event
 * DELETE /api/v1/world/:showId/events/:eventId  — Delete event
 * POST   /api/v1/world/:showId/events/:eventId/inject — Inject event into episode script
 * POST   /api/v1/world/:showId/events/:eventId/generate-script — Generate full script skeleton
 * POST   /api/v1/world/:showId/events/:eventId/generate-invitation — Generate invitation version(s); { async: true } answers with a job
 * POST   /api/v1/world/:showId/events/:eventId/reroll-invitation-text | reroll-invitation-background — New words / new background from a version
 * POST   /api/v1/world/:showId/events/:eventId/invitation-estimate — Cost and look of a generate, writes nothing
 * GET    /api/v1/world/:showId/invitation-jobs/:jobId[/stream] — An invitation job's progress (SSE on /stream)
 * GET    /api/v1/world/:showId/events/:eventId/invitation — Check if invitation exists
 * POST   /api/v1/world/:showId/events/:eventId/suggest-names — Three AI-written name options, writes nothing
 * POST   /api/v1/world/:showId/events/:eventId/suggest-basics — AI suggestions for date, time, description, dress code, category, format; writes nothing
 * GET    /api/v1/world/:showId/events/:eventId/start-readiness — What would stop Start Episode (the same check Start Episode refuses with)
 * GET    /api/v1/world/:showId/events/:eventId/package — The Event Package's parts in one request, each failing on its own
 * POST   /api/v1/world/:showId/events/ai-fix — AI suggestions to diversify event plan
 * 
 * Location: src/routes/worldEvents/ — this file mounts the parts below, in
 * the order the routes were registered when they lived in one file
 * (Express matches in registration order; GET /events/:eventId, in read.js,
 * passes /events/next-suggestions on with next(), so nextSuggestions.js
 * stays last).
 */

'use strict';

const express = require('express');
const router = express.Router();

router.use(require('./read'));                      // list, one event, start readiness, the combined package
router.use(require('./suggest'));                   // suggest names / basics, episode pitches (AI, writes nothing)
router.use(require('./create'));                    // create an event
router.use(require('./update'));                    // the event PUT (and its checks) and DELETE
router.use(require('./inject'));                    // inject into an episode, scene set link
router.use(require('./scriptAndBulk'));             // generate script, bulk seed, AI fix
router.use(require('./invitationGeneration'));      // invitation generate / re-roll / estimate / jobs
router.use(require('./documents'));                 // shopping list and career plan documents
router.use(require('./invitations'));               // invitation read, approve, history, print, animate, edit
router.use(require('./episodeGenerate'));           // generate episode, episode locations
router.use(require('./looks'));                     // venue look, event look (brief, generate, upload)
router.use(require('./episodeBatch'));              // episode from many events, regenerate, bulk delete
router.use(require('./fromProfile'));               // create an event from a profile
router.use(require('./affordability'));             // affordability, decline, financial pressure / forecast
router.use(require('./venue'));                     // venue brief, generate venue, social checklist
router.use(require('./outfit'));                    // outfit, wardrobe options, feed activity
router.use(require('./overlays'));                  // event overlays, title overlay, overlay selection
router.use(require('./stories'));                   // episode stories
router.use(require('./distribution'));              // distribution and distribution defaults
router.use(require('./ledger'));                    // complete, finalize financials, ledger, money, balance, lists
router.use(require('./nextSuggestions'));           // what episode to make next (no AI)

module.exports = router;
module.exports.loadEventPackage = require('./read').loadEventPackage;
module.exports.EVENT_PACKAGE_PARTS = require('./read').EVENT_PACKAGE_PARTS;

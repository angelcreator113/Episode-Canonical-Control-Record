'use strict';

/**
 * src/routes/memories/index.js
 *
 * Router hub for the Memory routes — mounts all domain sub-routers.
 * Base path: /api/v1/memories (registered in app.js)
 *
 * Split into domain files to reduce merge conflicts between developers.
 */

const express = require('express');
const router = express.Router();

// ── Mount domain sub-routers ────────────────────────────────────────────────
// Each sub-router defines its own routes relative to /api/v1/memories/

router.use('/', require('./core'));          // Memory extraction, confirm, CRUD, scenes
router.use('/', require('./interview'));     // Scene interview, narrative intelligence, character interviews
router.use('/', require('./voice'));         // Voice sessions, career echoes, chapter drafts
router.use('/', require('./stories'));       // Story write/edit/continue/deepen/nudge
router.use('/', require('./planning'));      // Prose critique, scene planner, outlines, planner chat
router.use('/', require('./assistant'));     // Amber AI assistant, recycle bin
router.use('/', require('./engine'));        // Story engine, tasks, generation, pipeline, batch
router.use('/', require('./extras'));        // Prose style, dramatic irony, intimate scenes, prompt enhance

module.exports = router;

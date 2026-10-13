'use strict';
/**
 * The weekly Pulse recap, public side (Task #3008; The Pulse spec §11;
 * docs/reads/2026-10-12-pulse-public-extras-read.md §1, §4). Mounted at
 * /api/v1/public/recaps. No auth middleware and no req.user: the website is
 * for logged-out visitors. Published recaps only; each post as The Pulse
 * shows it at the present (a post since hidden or taken down drops out).
 * Each post's image is its copy in the public site bucket, made at
 * publishing, sent only while it still matches what The Pulse shows
 * (pulseRecap.publicImageOf; Task #3099). No show, profile or episode ids,
 * and no studio image URL, leave the server.
 *
 *   GET /        published recaps, newest week first: id, title, week_start
 *   GET /:id     one published recap: its title, intro and posts
 */
const express = require('express');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const getModels = () => require('../models');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const readLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// PUBLIC: the website's list of published weekly recaps; titles and weeks only, no production ids, no identity read.
router.get('/', readLimiter, async (req, res) => {
  try {
    const recaps = await getModels().PulseRecap.findAll({
      where: { status: 'published' }, order: [['week_start', 'DESC']], attributes: ['id', 'title', 'week_start'], limit: 52,
    });
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ recaps: recaps.map((r) => ({ id: r.id, title: r.title, week_start: r.week_start })) });
  } catch (err) {
    console.error('[PublicRecaps] list failed:', err.message);
    return res.json({ recaps: [] });
  }
});

// PUBLIC: one published weekly recap; its posts' text, numbers and public image copies as The Pulse shows them now, no production ids, no identity read.
router.get('/:id', readLimiter, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Recap not found' });
    const recap = await getModels().PulseRecap.findOne({ where: { id: req.params.id, status: 'published' } });
    if (!recap) return res.status(404).json({ error: 'Recap not found' });
    const storyLabel = require('../services/storyClock').label;
    const { postsOf, publicImageOf } = require('../services/pulseRecap');
    const posts = await postsOf(getModels(), recap);
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({
      recap: {
        id: recap.id, title: recap.title, intro: recap.intro, week_start: recap.week_start,
        posts: posts.map((p) => ({
          poster_handle: p.poster_handle, poster_display_name: p.poster_display_name, content_text: p.content_text,
          likes: p.likes, comments_count: p.comments_count, moment: p.story_order == null ? null : storyLabel(p.story_order),
          image: publicImageOf(recap, p),
        })),
      },
    });
  } catch (err) {
    console.error('[PublicRecaps] read failed:', err.message);
    return res.status(500).json({ error: 'The recap could not be loaded.' });
  }
});

module.exports = router;

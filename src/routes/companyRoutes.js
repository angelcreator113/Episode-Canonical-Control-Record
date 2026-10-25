'use strict';

/**
 * Brands and companies (Evoni, 2026-10-18: "yes start the brand and company
 * profile pages"; services/brandProfile, constants/companyKinds). Reads need
 * a sign-in; every write is ADMIN. No AI call here: a company's history is
 * Evoni's to write.
 *
 *   GET  /api/v1/companies?kind=        every company (brand | outlet |
 *                                        agency | venue), brands first
 *   GET  /api/v1/companies/:slug        one profile: identity, and the
 *                                        sections its kind has
 *   POST /api/v1/companies              { name, kind, description?, ... }
 *                                        a new company (ADMIN)
 *   PUT  /api/v1/companies/:slug        her edits to its identity (ADMIN)
 *   GET  /api/v1/companies/look-alikes  registry characters that look like
 *                                        companies, each with the company of
 *                                        that name, if any (services/
 *                                        companyCharacters); nothing linked
 *   PUT  /api/v1/companies/:slug/registry-character  { character_id | null }
 *                                        mark a registry character as this
 *                                        company, or unmark it (ADMIN)
 */

const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');

const router = express.Router();

let models = null;
const getModels = () => {
  if (!models) models = require('../models');
  return models;
};

function sendError(res, err, label) {
  const { CompanyError } = require('../services/brandProfile');
  const { CompanyLinkError } = require('../services/companyCharacters');
  if (err instanceof CompanyError || err instanceof CompanyLinkError) return res.status(err.status).json({ success: false, error: err.message });
  console.error(`[Companies] ${label} error:`, err);
  return res.status(500).json({ success: false, error: err.message });
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const companies = await require('../services/brandProfile').listCompanies(getModels(), { kind: req.query.kind || null });
    const { COMPANY_KINDS } = require('../constants/companyKinds');
    return res.json({ success: true, kinds: COMPANY_KINDS, companies });
  } catch (err) {
    return sendError(res, err, 'GET /');
  }
});

// Registered before /:slug, which would take the path otherwise.
router.get('/look-alikes', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, characters: await require('../services/companyCharacters').lookAlikes(getModels()) });
  } catch (err) {
    return sendError(res, err, 'GET /look-alikes');
  }
});

router.get('/:slug', requireAuth, async (req, res) => {
  try {
    return res.json({ success: true, ...(await require('../services/brandProfile').profileOf(getModels(), req.params.slug)) });
  } catch (err) {
    return sendError(res, err, 'GET /:slug');
  }
});

router.post('/', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    return res.status(201).json({ success: true, ...(await require('../services/brandProfile').createCompany(getModels(), req.body || {})) });
  } catch (err) {
    return sendError(res, err, 'POST /');
  }
});

router.put('/:slug', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    return res.json({ success: true, ...(await require('../services/brandProfile').updateCompany(getModels(), req.params.slug, req.body || {})) });
  } catch (err) {
    return sendError(res, err, 'PUT /:slug');
  }
});

router.put('/:slug/registry-character', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const body = req.body || {};
    if (!('character_id' in body)) return res.status(400).json({ success: false, error: 'Send character_id (or null to unlink).' });
    const done = await require('../services/companyCharacters').linkCharacter(getModels(), req.params.slug, body.character_id);
    return res.json({ success: true, ...done });
  } catch (err) {
    return sendError(res, err, 'PUT /:slug/registry-character');
  }
});

module.exports = router;

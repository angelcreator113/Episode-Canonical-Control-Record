'use strict';

/**
 * The cost page (Evoni, 2026-10-19: "yes start the cost page with your
 * recommendations"): Admin › AI Costs reads today's spend against both daily
 * budgets, spend by feature, today's post pictures and the last 30 days, all
 * from ai_usage_logs. Reads only: no AI or image call, nothing written.
 *
 * The two budgets are the ones the gates enforce, read with their own
 * functions so the page shows the same figures:
 *   - AI_DAILY_BUDGET_USD (aiCostTracker.DAILY_BUDGET, default $50) caps ALL
 *     of today's spend, text and images together (imageCostService gates
 *     image calls on it too);
 *   - AI_DAILY_IMAGE_BUDGET_USD (imageCostService.dailyImageBudget, default
 *     $10) caps today's image rows (billing_unit IS NOT NULL).
 * imageCostService.readTodaySpend gives both spent figures. Days are UTC.
 *
 * A row with cost_usd NULL is an unpriced call (imageCostService logs a model
 * with no price that way): it is counted and shown as "N calls with no
 * price", never as $0.
 *
 * Features group ai_usage_logs.route_name, which is an explicit name some
 * calls pass ('camera-roll', 'pulse-post-picture', 'picture-suggestion',
 * 'media-variation', 'cast-generate') or what aiCostTracker.inferRouteName
 * reads off the call stack: a route file name ('castRoutes'), 'svc:<service>'
 * or 'worker:<worker>'. Anything no rule claims is Other, with its raw name.
 */

const FEATURES = Object.freeze([
  { key: 'camera_roll', label: 'Camera roll' },
  { key: 'post_pictures', label: 'Post pictures' },
  { key: 'picture_suggestions', label: 'Picture suggestions' },
  { key: 'variations', label: 'Variations' },
  { key: 'scene_images', label: 'Scene images' },
  { key: 'portraits', label: 'Portraits' },
  { key: 'show_graphics', label: 'Invitations, overlays & thumbnails' },
  { key: 'world_moments', label: 'World moments' },
  { key: 'brands', label: 'Brands on The Pulse' },
  { key: 'pulse_engine', label: 'The Pulse engine' },
  { key: 'episodes', label: 'Episodes & scripts' },
  { key: 'writing', label: 'Writing tools' },
  { key: 'character_tools', label: 'Character tools' },
  { key: 'other', label: 'Other' },
]);
const LABEL = Object.fromEntries(FEATURES.map((f) => [f.key, f.label]));

// Exact names first (explicit routeName values, route files, services).
const EXACT = {
  'camera-roll': 'camera_roll', 'svc:cameraRoll': 'camera_roll', cameraRollRoutes: 'camera_roll',
  'pulse-post-picture': 'post_pictures', 'svc:postPictures': 'post_pictures',
  'picture-suggestion': 'picture_suggestions', 'svc:pictureSuggestions': 'picture_suggestions', postMediaRoutes: 'picture_suggestions',
  'media-variation': 'variations', 'svc:mediaVariations': 'variations', mediaRoutes: 'variations',
  'svc:characterAppearance': 'portraits',
  worldMomentsRoutes: 'world_moments', 'svc:worldMoments': 'world_moments',
  brandPulseRoutes: 'brands', 'svc:brandPulse': 'brands', 'svc:brandProfile': 'brands', companyRoutes: 'brands',
  'cast-generate': 'character_tools',
};

// Then patterns over the name without its 'svc:'/'worker:' prefix, in order.
const PATTERNS = [
  ['scene_images', /^(scene|venue|locationLook|dressedAngle|imageRestyle|inpainting|objectGeneration|segmentation|approvedBase|baseDescription|textureLayer|lookVariant)/i],
  ['show_graphics', /^(invitation|episodeInvitationOverlay|episodeOverlays|episodeTitle|eventDocument|uiOverlay|phoneOverlays|thumbnail|youtubeThumbnail|ThumbnailGenerator|financialFrame|showLogo|styleSheetRender|iconCue|iconSlots|pulseCover)/i],
  ['pulse_engine', /^(pulse|feed|ripple|socialProfile|lalaFeedProfile|scriptPulsePosts|scriptPostDrafts|financialFeed)/i],
  ['episodes', /^(episode|script|lalaScripts|groundedScript|beat|worldEvents|eventGenerator|eventConcept|event|season|arc|gameShows|productionPackage|dealTermsDraft|dealTypeDraft|opportunity|wardrobe|outfit|lookbook)/i],
  ['writing', /^(memories|stor(y|ies|yteller)|novel|bookFromShow|generate-script-from-book|manuscript|continuityEngine|authorNote|wantField|mirrorField|pdfIngest|franchiseBrain|brainSync|universe|world(Studio)?$|amber|claudeService|promptCache)/i],
  ['character_tools', /^(character|cast|relationships|entanglement|facts|factsSuggest|pairS)/i],
];

/** The feature a route name belongs to. An image row from a character page is a portrait. */
function featureFor(routeName, { image = false } = {}) {
  const raw = String(routeName || '').trim();
  if (!raw || raw === 'unknown') return 'other';
  if (EXACT[raw]) return EXACT[raw];
  const bare = raw.replace(/^(svc|worker):/, '');
  for (const [key, re] of PATTERNS) {
    if (re.test(bare)) {
      // Character pages and The Cast make images only as portraits and photos.
      if (key === 'character_tools' && image) return 'portraits';
      return key;
    }
  }
  return 'other';
}

const round = (n, places = 4) => {
  const f = 10 ** places;
  return Math.round((Number(n) || 0) * f) / f;
};

/** ok below 80% of a cap, warn from 80%, over at 100%. */
function levelFor(percent) {
  const p = Number(percent) || 0;
  if (p >= 100) return 'over';
  if (p >= 80) return 'warn';
  return 'ok';
}

/** spent against a cap: { spent_usd, cap_usd, left_usd, percent, level }. */
function budgetLine(spent, cap) {
  const s = Math.max(0, Number(spent) || 0);
  const c = Number(cap) || 0;
  const percent = c > 0 ? Math.round((s / c) * 1000) / 10 : 0;
  return { spent_usd: round(s), cap_usd: round(c, 2), left_usd: round(Math.max(0, c - s)), percent, level: levelFor(percent) };
}

/**
 * Today's budgets, read the way the gates read them. read_ok is false when
 * ai_usage_logs could not be read (the gates then fail open); the figures are
 * then 0, flagged, never guessed.
 */
async function todayBudgets() {
  const imageCost = require('./imageCostService');
  const tracker = require('./aiCostTracker');
  const spend = await imageCost.readTodaySpend();
  const all = budgetLine(spend ? spend.total : 0, tracker.DAILY_BUDGET);
  const images = budgetLine(spend ? spend.image : 0, imageCost.dailyImageBudget());
  return { read_ok: Boolean(spend), all, images, image_calls: spend ? spend.imageCalls : 0 };
}

/** Budget lines at or past 80%, worded for the Daily update. */
function budgetAlerts(budgets) {
  if (!budgets || !budgets.read_ok) return [];
  const out = [];
  const lines = [['all', 'AI budget (text and images)', budgets.all], ['images', 'image budget', budgets.images]];
  for (const [key, name, line] of lines) {
    if (!line || line.level === 'ok') continue;
    out.push({
      budget: key,
      level: line.level,
      percent: line.percent,
      message: line.level === 'over'
        ? `Today's ${name} is used up ($${line.spent_usd.toFixed(2)} of $${line.cap_usd.toFixed(2)}): new calls are refused until tomorrow (UTC).`
        : `Today's ${name} is at ${Math.round(line.percent)}% ($${line.spent_usd.toFixed(2)} of $${line.cap_usd.toFixed(2)}).`,
    });
  }
  return out;
}

function postPictureLimit() {
  const n = parseInt(process.env.PULSE_POST_IMAGES_PER_DAY, 10);
  return Number.isFinite(n) && n >= 0 ? n : 20;
}

// feed_posts.picture_job arrives with the post-pictures migration; until then
// the waiting count is "not available yet". Only a found column is remembered.
let pictureJobColumn = false;
async function hasPictureJobColumn(db) {
  if (pictureJobColumn) return true;
  const [rows] = await db.sequelize.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'feed_posts' AND column_name = 'picture_job' LIMIT 1`);
  pictureJobColumn = rows.length > 0;
  return pictureJobColumn;
}

/** Today's post pictures against PULSE_POST_IMAGES_PER_DAY, and how many wait for tomorrow. */
async function postPicturesToday(db, { dayStart }) {
  const [[made]] = await db.sequelize.query(
    `SELECT COUNT(*)::int AS n FROM ai_usage_logs
      WHERE route_name = 'pulse-post-picture' AND billing_unit IS NOT NULL
        AND COALESCE(is_error, false) = false AND created_at >= :dayStart`,
    { replacements: { dayStart } });
  let waiting = null;
  let available = false;
  try {
    if (await hasPictureJobColumn(db)) {
      const [[row]] = await db.sequelize.query(
        `SELECT COUNT(*)::int AS n FROM feed_posts
          WHERE deleted_at IS NULL AND picture_job->>'status' = 'waiting_cap'`);
      waiting = row.n;
      available = true;
    }
  } catch (err) {
    console.error('[costOverview] post pictures waiting could not be read:', err.message);
  }
  return { made_today: made.n, limit: postPictureLimit(), waiting, waiting_available: available };
}

function utcDayStart(now) {
  return new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

/** Rows grouped by route and kind since a time, folded into features. */
async function featureRows(db, since) {
  const [rows] = await db.sequelize.query(
    `SELECT COALESCE(route_name, 'unknown') AS route_name,
            (billing_unit IS NOT NULL) AS image,
            COUNT(*)::int AS calls,
            COALESCE(SUM(cost_usd), 0)::float AS usd,
            COUNT(*) FILTER (WHERE cost_usd IS NULL)::int AS unpriced
       FROM ai_usage_logs WHERE created_at >= :since
      GROUP BY 1, 2`,
    { replacements: { since } });
  const byKey = new Map();
  for (const r of rows) {
    const key = featureFor(r.route_name, { image: r.image });
    if (!byKey.has(key)) {
      byKey.set(key, { key, label: LABEL[key], text_usd: 0, image_usd: 0, text_calls: 0, image_calls: 0, unpriced_calls: 0, routes: {} });
    }
    const f = byKey.get(key);
    if (r.image) { f.image_usd += r.usd; f.image_calls += r.calls; } else { f.text_usd += r.usd; f.text_calls += r.calls; }
    f.unpriced_calls += r.unpriced;
    f.routes[r.route_name] = (f.routes[r.route_name] || 0) + r.usd;
  }
  return [...byKey.values()].map((f) => ({
    ...f,
    text_usd: round(f.text_usd),
    image_usd: round(f.image_usd),
    total_usd: round(f.text_usd + f.image_usd),
    routes: Object.entries(f.routes)
      .map(([name, usd]) => ({ route_name: name, usd: round(usd) }))
      .sort((a, b) => b.usd - a.usd),
  })).sort((a, b) => b.total_usd - a.total_usd || a.label.localeCompare(b.label));
}

/** One row per UTC day for the range, oldest first, empty days included. */
async function dailyRows(db, { since, days, now }) {
  const [rows] = await db.sequelize.query(
    `SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
            COALESCE(SUM(cost_usd) FILTER (WHERE billing_unit IS NULL), 0)::float AS text_usd,
            COALESCE(SUM(cost_usd) FILTER (WHERE billing_unit IS NOT NULL), 0)::float AS image_usd,
            COUNT(*)::int AS calls,
            COUNT(*) FILTER (WHERE cost_usd IS NULL)::int AS unpriced
       FROM ai_usage_logs WHERE created_at >= :since
      GROUP BY 1`,
    { replacements: { since } });
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(utcDayStart(now).getTime() - i * 86400000).toISOString().slice(0, 10);
    const r = byDay.get(day);
    out.push({
      day,
      text_usd: round(r ? r.text_usd : 0),
      image_usd: round(r ? r.image_usd : 0),
      total_usd: round(r ? r.text_usd + r.image_usd : 0),
      calls: r ? r.calls : 0,
      unpriced_calls: r ? r.unpriced : 0,
    });
  }
  return out;
}

/**
 * Everything the cost page shows. days: the range for the chart and the
 * features (1–90, default 30).
 */
async function costOverview(db, { days = 30, now = new Date() } = {}) {
  const span = Math.min(Math.max(parseInt(days, 10) || 30, 1), 90);
  const dayStart = utcDayStart(now);
  const since = new Date(dayStart.getTime() - (span - 1) * 86400000);
  const [budgets, postPictures, todayFeatures, rangeFeatures, daily] = await Promise.all([
    todayBudgets(),
    postPicturesToday(db, { dayStart }),
    featureRows(db, dayStart),
    featureRows(db, since),
    dailyRows(db, { since, days: span, now }),
  ]);
  const todayLine = daily[daily.length - 1] || { text_usd: 0, image_usd: 0, unpriced_calls: 0 };
  return {
    day: dayStart.toISOString().slice(0, 10),
    days: span,
    budgets,
    alerts: budgetAlerts(budgets),
    today: {
      text_usd: todayLine.text_usd,
      image_usd: todayLine.image_usd,
      unpriced_calls: todayLine.unpriced_calls,
    },
    post_pictures: postPictures,
    features: { today: todayFeatures, range: rangeFeatures },
    daily,
    top_days: daily.filter((d) => d.total_usd > 0).slice().sort((a, b) => b.total_usd - a.total_usd).slice(0, 5),
    top_features: rangeFeatures.filter((f) => f.total_usd > 0).slice(0, 5),
  };
}

function resetColumnCacheForTests() { pictureJobColumn = false; }

module.exports = {
  FEATURES, featureFor, levelFor, budgetLine, budgetAlerts, todayBudgets, postPictureLimit,
  postPicturesToday, costOverview, resetColumnCacheForTests,
};

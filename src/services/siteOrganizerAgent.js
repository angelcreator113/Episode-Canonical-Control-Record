/**
 * siteOrganizerAgent.js — Site Organizer & Steps Agent
 *
 * An autonomous agent system that audits website navigation, page purpose,
 * and user-flow coherence.  Runs 4 sub-agents:
 *
 *  1. Navigation Auditor  — sidebar ↔ route alignment, dead links, orphan pages
 *  2. Page Purpose Mapper — purpose tagging, redundancy detection, completeness
 *  3. Flow Analyzer       — zone coherence, user-journey tracing, depth issues
 *  4. Steps Planner       — prioritised action items to improve site structure
 *
 * Each sub-agent returns { status, findings[], score, recommendations[] }
 * The orchestrator merges them into a single Site-Org Report.
 */

/* eslint-disable no-console */
const fs   = require('fs');
const path = require('path');

const FRONTEND = path.join(__dirname, '..', '..', 'frontend', 'src');
const PAGES_DIR = path.join(FRONTEND, 'pages');

// ──────────────────────────────────────────────────
// Helpers — read source artefacts once
// ──────────────────────────────────────────────────
function readFileIfExists(fp) {
  try { return fs.readFileSync(fp, 'utf8'); } catch { return ''; }
}

function discoverPageFiles() {
  try {
    return fs.readdirSync(PAGES_DIR)
      .filter(f => f.endsWith('.jsx'))
      .map(f => f.replace('.jsx', ''));
  } catch { return []; }
}

function extractRoutes() {
  const appSrc = readFileIfExists(path.join(FRONTEND, 'App.jsx'));
  const routes = [];
  const re = /<Route\s+path="([^"]+)"\s+element=\{<(\w+)/g;
  let m;
  while ((m = re.exec(appSrc))) routes.push({ path: m[1], component: m[2] });
  // Also catch Navigate redirects
  const redir = /<Route\s+path="([^"]+)"\s+element=\{<Navigate\s+to="([^"]+)"/g;
  while ((m = redir.exec(appSrc))) routes.push({ path: m[1], component: `→ ${m[2]}`, redirect: true });
  return routes;
}

function extractLazyImports() {
  const appSrc = readFileIfExists(path.join(FRONTEND, 'App.jsx'));
  const imports = [];
  const re = /const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\(['"]([^'"]+)['"]\)\)/g;
  let m;
  while ((m = re.exec(appSrc))) imports.push({ name: m[1], file: m[2] });
  return imports;
}

function extractSidebarEntries() {
  const src = readFileIfExists(path.join(FRONTEND, 'components', 'layout', 'Sidebar.jsx'));
  const entries = [];
  const re = /\{\s*icon:\s*'([^']+)',\s*label:\s*'([^']+)',\s*route:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src))) entries.push({ icon: m[1], label: m[2], route: m[3] });
  return entries;
}

function extractZoneStructure() {
  const src = readFileIfExists(path.join(FRONTEND, 'components', 'layout', 'Sidebar.jsx'));
  const zones = [];
  const zoneRe = /zone:\s*'(\w+)'/g;
  let m;
  while ((m = zoneRe.exec(src))) zones.push(m[1]);
  return [...new Set(zones)];
}

// ═══════════════════════════════════════════════════════════════
//  SUB-AGENT 1:  Navigation Auditor
// ═══════════════════════════════════════════════════════════════
function navigationAuditor() {
  const findings = [];
  const recommendations = [];
  let score = 100;

  const routes     = extractRoutes();
  const sidebar    = extractSidebarEntries();
  const pages      = discoverPageFiles();
  const lazyImps   = extractLazyImports();

  // 1.  Sidebar links that have no matching route
  const routePaths = new Set(routes.map(r => r.path));
  const deadSidebar = sidebar.filter(s => {
    const base = s.route.split('?')[0];          // strip query params
    // exact match or parametric-capable
    return !routePaths.has(base) && !routePaths.has(base.replace(/\/default$/, '/:registryId'));
  });
  if (deadSidebar.length) {
    score -= deadSidebar.length * 5;
    deadSidebar.forEach(s => {
      findings.push({ level: 'warning', agent: 'navigation_auditor', msg: `Sidebar link "${s.label}" (${s.route}) has no matching route` });
    });
    recommendations.push(`Fix or remove ${deadSidebar.length} dead sidebar link(s)`);
  }

  // 2.  Routes that have no sidebar entry (accessibility concern)
  const sidebarPaths = new Set(sidebar.map(s => s.route.split('?')[0]));
  const unreachable = routes.filter(r =>
    !r.redirect && !r.path.includes(':') && !sidebarPaths.has(r.path) && r.path !== '/' && r.path !== '*'
  );
  if (unreachable.length > 20) {
    score -= Math.min(15, Math.floor(unreachable.length / 3));
    findings.push({ level: 'info', agent: 'navigation_auditor', msg: `${unreachable.length} routes have no direct sidebar link (may only be reachable in-page)` });
    recommendations.push('Add sidebar shortcuts or in-page links for frequently used hidden routes');
  } else if (unreachable.length > 0) {
    findings.push({ level: 'info', agent: 'navigation_auditor', msg: `${unreachable.length} routes have no direct sidebar link (detail/edit pages — normal)` });
  }

  // 3.  Page files that have no route pointing to them
  const routeComponents = new Set(routes.map(r => r.component));
  const lazyNames       = new Set(lazyImps.map(l => l.name));
  // Also match by filename in the lazy import path (handles aliased names)
  const lazyFileNames   = new Set(lazyImps.map(l => l.file.split('/').pop()));

  // Also detect pages imported as sub-components by other files
  const importedAsSubComponent = new Set();
  const allSrcFiles = [];
  const scanDirs = [PAGES_DIR, path.join(FRONTEND, 'components')];
  for (const dir of scanDirs) {
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx') || f.endsWith('.js'));
      for (const f of files) allSrcFiles.push(path.join(dir, f));
    } catch { /* skip */ }
  }
  // Also check App.jsx for direct (non-lazy) imports
  allSrcFiles.push(path.join(FRONTEND, 'App.jsx'));
  for (const fp of allSrcFiles) {
    const src = readFileIfExists(fp);
    for (const pg of pages) {
      // Match: import Foo from './Foo' or '../pages/Foo' (non-lazy)
      if (src.includes(`/${pg}'`) || src.includes(`/${pg}"`)) {
        importedAsSubComponent.add(pg);
      }
    }
  }

  const orphanPages = pages.filter(p =>
    !routeComponents.has(p) && !lazyNames.has(p) && !lazyFileNames.has(p) &&
    !importedAsSubComponent.has(p) &&
    !['Login', 'LandingPage', 'Home'].includes(p) &&
    !p.endsWith('.css')
  );
  if (orphanPages.length) {
    score -= Math.min(15, orphanPages.length * 2);
    findings.push({ level: 'warning', agent: 'navigation_auditor', msg: `${orphanPages.length} page file(s) appear orphaned (no route or lazy import): ${orphanPages.slice(0, 8).join(', ')}${orphanPages.length > 8 ? '…' : ''}` });
    recommendations.push('Remove or wire up orphaned page files — they add bundle weight');
  }

  // 4.  Lazy imports for pages that don't exist
  const missing = lazyImps.filter(l => {
    const rel = l.file.replace('./', '');
    const fp = path.join(FRONTEND, rel + '.jsx');
    return !fs.existsSync(fp);
  });
  if (missing.length) {
    score -= missing.length * 8;
    missing.forEach(l => {
      findings.push({ level: 'critical', agent: 'navigation_auditor', msg: `Lazy import "${l.name}" points to missing file: ${l.file}` });
    });
    recommendations.push('Remove or fix broken lazy imports — they cause runtime crashes');
  }

  // 5.  Total route count health
  findings.push({ level: 'info', agent: 'navigation_auditor', msg: `Total: ${routes.length} routes, ${sidebar.length} sidebar links, ${pages.length} page files, ${lazyImps.length} lazy imports` });
  if (routes.length > 120) {
    score -= 5;
    findings.push({ level: 'warning', agent: 'navigation_auditor', msg: `Route count (${routes.length}) is very high — consider grouping or consolidating` });
    recommendations.push('Consolidate related routes into tabbed pages to reduce complexity');
  }

  if (!findings.some(f => f.level === 'warning' || f.level === 'critical')) {
    findings.push({ level: 'success', agent: 'navigation_auditor', msg: 'Navigation is well-aligned — sidebar, routes, and pages are consistent' });
  }

  return { status: score >= 80 ? 'healthy' : score >= 60 ? 'needs-attention' : 'critical', score: Math.max(0, score), findings, recommendations };
}

// ═══════════════════════════════════════════════════════════════
//  SUB-AGENT 2:  Page Purpose Mapper
// ═══════════════════════════════════════════════════════════════
function pagePurposeMapper() {
  const findings = [];
  const recommendations = [];
  let score = 100;

  const pages  = discoverPageFiles();
  const routes = extractRoutes();

  // Categorise each page by naming convention
  const categories = {
    world:       [],
    writing:     [],
    production:  [],
    social:      [],
    management:  [],
    utility:     [],
    character:   [],
    uncategorised: [],
  };

  const patterns = {
    world:       /World|Universe|Cultural|Infrastructure|Amber/i,
    writing:     /Write|Story|Novel|Chapter|Book|Narrative|Press|Assembler|Continuity|Storyteller|Session|Reading/i,
    production:  /Episode|Show|Scene|Timeline|Export|Template|Wardrobe|Studio|Composer|Animatic|Thumbnail|Asset|Outfit|Composition|Production/i,
    social:      /Social|Feed|Influencer|Relationship|Personality|Profile/i,
    management:  /Admin|Setting|Diagnostic|Audit|Search|Recycle|Analytics|Cost|CFO|Organizer|Design|Setup/i,
    utility:     /Home|Landing|Login/i,
    character:   /Character|Therapy|Depth|Life|Dossier|Generator/i,
  };

  pages.forEach(p => {
    let placed = false;
    for (const [cat, re] of Object.entries(patterns)) {
      if (re.test(p)) { categories[cat].push(p); placed = true; break; }
    }
    if (!placed) categories.uncategorised.push(p);
  });

  // Summary finding
  const catSummary = Object.entries(categories)
    .filter(([, v]) => v.length)
    .map(([k, v]) => `${k}: ${v.length}`)
    .join(' · ');
  findings.push({ level: 'info', agent: 'page_purpose', msg: `Page categories — ${catSummary}` });

  if (categories.uncategorised.length > 3) {
    score -= categories.uncategorised.length * 2;
    findings.push({ level: 'warning', agent: 'page_purpose', msg: `${categories.uncategorised.length} page(s) don't fit any clear category: ${categories.uncategorised.slice(0, 6).join(', ')}` });
    recommendations.push('Rename or reorganise uncategorised pages into clear domains');
  }

  // Detect potential duplicates (very similar names)
  const lcPages = pages.map(p => ({ orig: p, lc: p.toLowerCase().replace(/page|view|panel|tab|dashboard/gi, '') }));
  const dupes = [];
  for (let i = 0; i < lcPages.length; i++) {
    for (let j = i + 1; j < lcPages.length; j++) {
      if (lcPages[i].lc === lcPages[j].lc || lcPages[i].lc.includes(lcPages[j].lc) && lcPages[j].lc.length > 5) {
        dupes.push([lcPages[i].orig, lcPages[j].orig]);
      }
    }
  }
  if (dupes.length) {
    score -= dupes.length * 3;
    dupes.forEach(([a, b]) => {
      findings.push({ level: 'warning', agent: 'page_purpose', msg: `Potential duplicate pages: ${a} ↔ ${b}` });
    });
    recommendations.push('Merge duplicate-looking pages to reduce maintenance burden');
  }

  // Redirect bloat — only flag if excessive (login + catch-all + a handful of
  // backward-compatibility redirects are normal for a mature app)
  const redirects = routes.filter(r => r.redirect);
  if (redirects.length > 10) {
    score -= 3;
    findings.push({ level: 'info', agent: 'page_purpose', msg: `${redirects.length} redirect routes — some may be legacy` });
    recommendations.push('Prune stale redirect routes that no longer serve a purpose');
  } else if (redirects.length > 0) {
    findings.push({ level: 'info', agent: 'page_purpose', msg: `${redirects.length} redirect routes — within normal range` });
  }

  // Page file count warning
  if (pages.length > 100) {
    score -= 5;
    findings.push({ level: 'warning', agent: 'page_purpose', msg: `${pages.length} page files — consider grouping related pages into fewer feature modules` });
    recommendations.push('Consolidate pages: move related sub-views into tabs within a parent page');
  }

  if (!findings.some(f => f.level === 'warning' || f.level === 'critical')) {
    findings.push({ level: 'success', agent: 'page_purpose', msg: 'Page purposes are well-defined and categorised' });
  }

  return { status: score >= 80 ? 'healthy' : score >= 60 ? 'needs-attention' : 'critical', score: Math.max(0, score), findings, recommendations, data: { categories } };
}

// ═══════════════════════════════════════════════════════════════
//  SUB-AGENT 3:  Flow Analyzer
// ═══════════════════════════════════════════════════════════════
function flowAnalyzer() {
  const findings = [];
  const recommendations = [];
  let score = 100;

  const zones   = extractZoneStructure();
  const _sidebar = extractSidebarEntries();
  const routes  = extractRoutes();

  // 1.  Zone coverage — each zone should have items
  findings.push({ level: 'info', agent: 'flow_analyzer', msg: `${zones.length} sidebar zones detected: ${zones.join(', ')}` });
  if (zones.length < 3) {
    score -= 10;
    findings.push({ level: 'warning', agent: 'flow_analyzer', msg: 'Too few zones — content may be hard to find' });
    recommendations.push('Add more zones or re-organise to improve discoverability');
  }

  // 2.  Zone balance — warn if one zone has far more top-level items
  const zoneCounts = {};
  const sidebarSrc = readFileIfExists(path.join(FRONTEND, 'components', 'layout', 'Sidebar.jsx'));
  // Parse NAV array to count top-level items per zone (not nested children)
  const zoneBlockRe = /zone:\s*'(\w+)',\s*\n\s*items:\s*\[/g;
  let zm;
  while ((zm = zoneBlockRe.exec(sidebarSrc))) {
    const zoneName = zm[1];
    // Find the items array content by tracking bracket depth
    let depth = 1;
    let pos = zm.index + zm[0].length;
    let topItems = 0;
    let inChildren = 0;
    while (depth > 0 && pos < sidebarSrc.length) {
      const ch = sidebarSrc[pos];
      if (ch === '[') { depth++; inChildren++; }
      else if (ch === ']') { depth--; if (inChildren > 0) inChildren--; }
      else if (depth === 1 && inChildren === 0) {
        // Check for top-level label at this depth
        const ahead = sidebarSrc.substring(pos, pos + 8);
        if (ahead.startsWith('label:')) topItems++;
      }
      pos++;
    }
    zoneCounts[zoneName] = topItems;
  }

  const _counts = Object.values(zoneCounts);
  const maxZone = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])[0];
  const minZone = Object.entries(zoneCounts).sort((a, b) => a[1] - b[1])[0];
  if (maxZone && minZone && maxZone[1] > minZone[1] * 4) {
    score -= 5;
    findings.push({ level: 'warning', agent: 'flow_analyzer', msg: `Zone imbalance: ${maxZone[0]} has ${maxZone[1]} items vs ${minZone[0]} has ${minZone[1]}` });
    recommendations.push(`Rebalance: move some items out of ${maxZone[0]} or split it into sub-zones`);
  }

  // 3.  Deep nesting — routes with 4+ segments
  const deep = routes.filter(r => r.path.split('/').filter(Boolean).length >= 4);
  if (deep.length > 5) {
    score -= 5;
    findings.push({ level: 'info', agent: 'flow_analyzer', msg: `${deep.length} deeply nested routes (4+ segments) — may confuse users` });
    recommendations.push('Flatten deep routes with query params or tabs instead of nested paths');
  }

  // 4.  Entry points — how many "top-level" pages (no params, 1 segment)
  const topLevel = routes.filter(r => !r.redirect && !r.path.includes(':') && r.path.split('/').filter(Boolean).length <= 1);
  findings.push({ level: 'info', agent: 'flow_analyzer', msg: `${topLevel.length} top-level entry pages` });
  if (topLevel.length > 20) {
    score -= 5;
    findings.push({ level: 'warning', agent: 'flow_analyzer', msg: 'Too many top-level pages — navigation may feel overwhelming' });
    recommendations.push('Group related top-level pages behind a shared landing page with tabs');
  }

  // 5.  Sidebar items per zone info (for the map)
  Object.entries(zoneCounts).forEach(([zone, count]) => {
    findings.push({ level: 'info', agent: 'flow_analyzer', msg: `Zone ${zone}: ${count} sidebar items` });
  });

  if (!findings.some(f => f.level === 'warning' || f.level === 'critical')) {
    findings.push({ level: 'success', agent: 'flow_analyzer', msg: 'User flow is well-structured across zones' });
  }

  return { status: score >= 80 ? 'healthy' : score >= 60 ? 'needs-attention' : 'critical', score: Math.max(0, score), findings, recommendations, data: { zoneCounts } };
}

// ═══════════════════════════════════════════════════════════════
//  SUB-AGENT 4:  Steps Planner
// ═══════════════════════════════════════════════════════════════
function stepsPlanner(navResult, purposeResult, flowResult) {
  const findings = [];
  const recommendations = [];
  let score = 100;

  // Gather all recs from other agents and create a prioritised plan
  const allRecs = [
    ...navResult.recommendations.map(r => ({ rec: r, agent: 'navigation_auditor', weight: 3 })),
    ...purposeResult.recommendations.map(r => ({ rec: r, agent: 'page_purpose', weight: 2 })),
    ...flowResult.recommendations.map(r => ({ rec: r, agent: 'flow_analyzer', weight: 2 })),
  ].sort((a, b) => b.weight - a.weight);

  // The plan itself is the output
  const steps = allRecs.map((r, i) => ({
    step: i + 1,
    action: r.rec,
    source: r.agent,
    priority: r.weight >= 3 ? 'high' : r.weight >= 2 ? 'medium' : 'low',
  }));

  if (steps.length === 0) {
    findings.push({ level: 'success', agent: 'steps_planner', msg: 'No improvement steps needed — site structure is excellent!' });
  } else {
    const high = steps.filter(s => s.priority === 'high').length;
    const med  = steps.filter(s => s.priority === 'medium').length;
    const low  = steps.filter(s => s.priority === 'low').length;
    findings.push({ level: 'info', agent: 'steps_planner', msg: `${steps.length} improvement steps generated: ${high} high, ${med} medium, ${low} low priority` });
    score -= Math.min(30, high * 8 + med * 3 + low);
  }

  // Add each step as a finding so the dashboard can list them
  steps.forEach(s => {
    findings.push({
      level: s.priority === 'high' ? 'warning' : 'info',
      agent: 'steps_planner',
      msg: `Step ${s.step} (${s.priority}): ${s.action}`,
    });
    recommendations.push(s.action);
  });

  return { status: score >= 80 ? 'healthy' : score >= 60 ? 'needs-attention' : 'critical', score: Math.max(0, score), findings, recommendations, data: { steps } };
}

// ═══════════════════════════════════════════════════════════════
//  ORCHESTRATOR — run all sub-agents
// ═══════════════════════════════════════════════════════════════
function runFullScan() {
  const start = Date.now();

  const navResult     = navigationAuditor();
  const purposeResult = pagePurposeMapper();
  const flowResult    = flowAnalyzer();
  const stepsResult   = stepsPlanner(navResult, purposeResult, flowResult);

  const agents = {
    navigation_auditor: navResult,
    page_purpose:       purposeResult,
    flow_analyzer:      flowResult,
    steps_planner:      stepsResult,
  };

  const weights = { navigation_auditor: 30, page_purpose: 25, flow_analyzer: 25, steps_planner: 20 };
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const overallScore = Math.round(
    Object.entries(agents).reduce((sum, [k, a]) => sum + a.score * (weights[k] || 20), 0) / totalWeight
  );

  const allFindings = Object.entries(agents).flatMap(([, a]) => a.findings);
  const allRecommendations = Object.entries(agents).flatMap(([k, a]) =>
    a.recommendations.map(r => ({ agent: k, recommendation: r }))
  );

  const overall_status = overallScore >= 85 ? 'healthy' : overallScore >= 65 ? 'needs-attention' : 'critical';

  return {
    overall_score: overallScore,
    overall_status,
    agents,
    all_findings: allFindings,
    all_recommendations: allRecommendations,
    ran_at: new Date().toISOString(),
    duration_ms: Date.now() - start,
  };
}

function runSubAgent(name) {
  switch (name) {
    case 'navigation_auditor': return navigationAuditor();
    case 'page_purpose':       return pagePurposeMapper();
    case 'flow_analyzer':      return flowAnalyzer();
    case 'steps_planner': {
      const n = navigationAuditor();
      const p = pagePurposeMapper();
      const f = flowAnalyzer();
      return stepsPlanner(n, p, f);
    }
    default: return { status: 'error', score: 0, findings: [{ level: 'critical', agent: name, msg: `Unknown agent: ${name}` }], recommendations: [] };
  }
}

// ──────────────────────────────────────────────────
//  Quick summary (lightweight)
// ──────────────────────────────────────────────────
function quickSummary() {
  const routes  = extractRoutes();
  const sidebar = extractSidebarEntries();
  const pages   = discoverPageFiles();
  const zones   = extractZoneStructure();
  return {
    routes: routes.length,
    sidebar_links: sidebar.length,
    page_files: pages.length,
    zones: zones.length,
    zone_names: zones,
    status: 'ok',
  };
}

module.exports = { runFullScan, runSubAgent, quickSummary };

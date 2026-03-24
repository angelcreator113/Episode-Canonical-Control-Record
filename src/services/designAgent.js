/**
 * designAgent.js — Design & Responsive Agent
 *
 * An autonomous agent that audits visual consistency and responsive design
 * across the entire frontend.  Runs 4 sub-agents:
 *
 *  1. Responsive Auditor  — media-query coverage, breakpoint consistency
 *  2. Token Compliance     — design-token usage vs hard-coded colours/spacing
 *  3. Consistency Checker  — inline-style sprawl, CSS variable naming, page themes
 *  4. Accessibility Scout  — touch targets, contrast hints, font sizing
 *
 * Each sub-agent returns { status, findings[], score, recommendations[] }
 */

/* eslint-disable no-console */
const fs   = require('fs');
const path = require('path');

const FRONTEND   = path.join(__dirname, '..', '..', 'frontend', 'src');
const PAGES_DIR  = path.join(FRONTEND, 'pages');
const STYLES_DIR = path.join(FRONTEND, 'styles');

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
function readSafe(fp) {
  try { return fs.readFileSync(fp, 'utf8'); } catch { return ''; }
}

function listFiles(dir, ext) {
  try { return fs.readdirSync(dir).filter(f => f.endsWith(ext)); } catch { return []; }
}

function countOccurrences(text, regex) {
  return (text.match(regex) || []).length;
}

// ═══════════════════════════════════════════════════════════════
//  SUB-AGENT 1:  Responsive Auditor
// ═══════════════════════════════════════════════════════════════
function responsiveAuditor() {
  const findings = [];
  const recommendations = [];
  let score = 100;

  const cssFiles = listFiles(PAGES_DIR, '.css');
  const jsxFiles = listFiles(PAGES_DIR, '.jsx');

  // 1. How many page CSS files have media queries?
  let withMQ = 0;
  const withoutMQ = [];
  const breakpointUsage = {};

  cssFiles.forEach(f => {
    const src = readSafe(path.join(PAGES_DIR, f));
    const mqCount = countOccurrences(src, /@media/g);
    if (mqCount > 0) {
      withMQ++;
      // Track breakpoints
      const bps = src.match(/(max-width|min-width)\s*:\s*(\d+)px/g) || [];
      bps.forEach(bp => {
        const px = bp.match(/(\d+)/)[1];
        breakpointUsage[px] = (breakpointUsage[px] || 0) + 1;
      });
    } else {
      withoutMQ.push(f.replace('.css', ''));
    }
  });

  const coverage = cssFiles.length ? Math.round((withMQ / cssFiles.length) * 100) : 0;
  findings.push({ level: 'info', agent: 'responsive_auditor', msg: `${withMQ}/${cssFiles.length} page CSS files have media queries (${coverage}% coverage)` });

  if (coverage < 50) {
    score -= 20;
    findings.push({ level: 'critical', agent: 'responsive_auditor', msg: `Only ${coverage}% of pages have responsive breakpoints — mobile users will suffer` });
    recommendations.push('Add media queries to pages missing responsive styles');
  } else if (coverage < 75) {
    score -= 10;
    findings.push({ level: 'warning', agent: 'responsive_auditor', msg: `${100 - coverage}% of page CSS files lack media queries` });
    recommendations.push(`Add breakpoints to: ${withoutMQ.slice(0, 6).join(', ')}${withoutMQ.length > 6 ? '…' : ''}`);
  }

  // 2. Breakpoint consistency
  const sortedBPs = Object.entries(breakpointUsage).sort((a, b) => b[1] - a[1]);
  const topBPs = sortedBPs.slice(0, 5).map(([px, count]) => `${px}px (×${count})`);
  findings.push({ level: 'info', agent: 'responsive_auditor', msg: `Top breakpoints: ${topBPs.join(', ')}` });

  const uniqueBPs = Object.keys(breakpointUsage).length;
  if (uniqueBPs > 8) {
    score -= 5;
    findings.push({ level: 'warning', agent: 'responsive_auditor', msg: `${uniqueBPs} unique breakpoint values — inconsistent; standardise to 4-5` });
    recommendations.push('Standardise breakpoints to: 480px, 768px, 1024px, 1200px');
  }

  // 3. JSX files without a matching CSS file (rely on inline only)
  const cssNames = new Set(cssFiles.map(f => f.replace('.css', '')));
  const inlineOnly = jsxFiles. filter(f => !cssNames.has(f.replace('.jsx', ''))).map(f => f.replace('.jsx', ''));
  if (inlineOnly.length > 10) {
    score -= Math.min(10, Math.floor(inlineOnly.length / 3));
    findings.push({ level: 'warning', agent: 'responsive_auditor', msg: `${inlineOnly.length} pages use inline styles only (no CSS file) — can't have media queries` });
    recommendations.push('Extract inline styles to CSS files for pages that need responsive behaviour');
  }

  // 4. Check global responsive.css exists
  const responsiveCss = readSafe(path.join(STYLES_DIR, 'responsive.css'));
  if (responsiveCss) {
    findings.push({ level: 'success', agent: 'responsive_auditor', msg: 'Global responsive.css found with centralised breakpoint rules' });
  } else {
    score -= 5;
    findings.push({ level: 'warning', agent: 'responsive_auditor', msg: 'No global responsive.css — each page must handle its own breakpoints' });
    recommendations.push('Create a shared responsive.css with base breakpoint utilities');
  }

  return {
    status: score >= 80 ? 'healthy' : score >= 60 ? 'needs-attention' : 'critical',
    score: Math.max(0, score),
    findings, recommendations,
    data: { coverage, breakpointUsage: sortedBPs.slice(0, 8), withoutMQ, inlineOnly: inlineOnly.slice(0, 15) },
  };
}

// ═══════════════════════════════════════════════════════════════
//  SUB-AGENT 2:  Token Compliance
// ═══════════════════════════════════════════════════════════════
function tokenCompliance() {
  const findings = [];
  const recommendations = [];
  let score = 100;

  // 1. Check design-tokens.css exists and has tokens
  const tokenSrc = readSafe(path.join(STYLES_DIR, 'design-tokens.css'));
  const tokenCount = countOccurrences(tokenSrc, /--[\w-]+\s*:/g);
  if (tokenCount === 0) {
    score -= 25;
    findings.push({ level: 'critical', agent: 'token_compliance', msg: 'No design-tokens.css found — no shared colour/spacing system' });
    recommendations.push('Create design-tokens.css with colour, spacing, and typography variables');
    return { status: 'critical', score: Math.max(0, score), findings, recommendations, data: {} };
  }
  findings.push({ level: 'success', agent: 'token_compliance', msg: `design-tokens.css defines ${tokenCount} CSS custom properties` });

  // 2. Scan page CSS files for hard-coded colours
  const cssFiles = listFiles(PAGES_DIR, '.css');
  let hardCodedColours = 0;
  const hardCodedPages = [];
  const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
  const rgbRe = /rgba?\s*\(\s*\d/g;

  cssFiles.forEach(f => {
    const src = readSafe(path.join(PAGES_DIR, f));
    const hexes = countOccurrences(src, hexRe);
    const rgbs  = countOccurrences(src, rgbRe);
    const total = hexes + rgbs;
    if (total > 10) {
      hardCodedPages.push({ file: f.replace('.css', ''), count: total });
      hardCodedColours += total;
    }
  });

  if (hardCodedPages.length > 0) {
    hardCodedPages.sort((a, b) => b.count - a.count);
    const worstOffenders = hardCodedPages.slice(0, 5).map(p => `${p.file} (${p.count})`).join(', ');
    score -= Math.min(15, hardCodedPages.length);
    findings.push({ level: 'warning', agent: 'token_compliance', msg: `${hardCodedPages.length} page CSS files have 10+ hard-coded colours — worst: ${worstOffenders}` });
    recommendations.push('Replace hard-coded hex/rgb values with design token variables (--primary, --gray-*, etc.)');
  } else {
    findings.push({ level: 'success', agent: 'token_compliance', msg: 'No pages have excessive hard-coded colours — good token compliance' });
  }

  // 3. Scan JSX inline styles for hard-coded colours
  const jsxFiles = listFiles(PAGES_DIR, '.jsx');
  let inlineHardCoded = 0;
  const inlineWorst = [];

  jsxFiles.forEach(f => {
    const src = readSafe(path.join(PAGES_DIR, f));
    const matches = countOccurrences(src, /#[0-9a-fA-F]{6}\b/g);
    if (matches > 15) {
      inlineWorst.push({ file: f.replace('.jsx', ''), count: matches });
      inlineHardCoded += matches;
    }
  });

  if (inlineWorst.length > 0) {
    inlineWorst.sort((a, b) => b.count - a.count);
    const top = inlineWorst.slice(0, 5).map(p => `${p.file} (${p.count})`).join(', ');
    score -= Math.min(10, inlineWorst.length * 2);
    findings.push({ level: 'warning', agent: 'token_compliance', msg: `${inlineWorst.length} JSX files have 15+ inline hex colours — worst: ${top}` });
    recommendations.push('Move repeated inline colours into CSS or a shared style object using design tokens');
  }

  // 4. Check shared-components.css
  const sharedSrc = readSafe(path.join(STYLES_DIR, 'shared-components.css'));
  if (sharedSrc) {
    const classCount = countOccurrences(sharedSrc, /\.\w[\w-]*/g);
    findings.push({ level: 'success', agent: 'token_compliance', msg: `shared-components.css provides ${classCount} reusable class selectors` });
  }

  return {
    status: score >= 80 ? 'healthy' : score >= 60 ? 'needs-attention' : 'critical',
    score: Math.max(0, score),
    findings, recommendations,
    data: { tokenCount, hardCodedPages: hardCodedPages.slice(0, 10), inlineWorst: inlineWorst.slice(0, 10) },
  };
}

// ═══════════════════════════════════════════════════════════════
//  SUB-AGENT 3:  Consistency Checker
// ═══════════════════════════════════════════════════════════════
function consistencyChecker() {
  const findings = [];
  const recommendations = [];
  let score = 100;

  const cssFiles = listFiles(PAGES_DIR, '.css');
  const jsxFiles = listFiles(PAGES_DIR, '.jsx');

  // 1. Page-scoped CSS variable prefixes
  const prefixes = {};
  cssFiles.forEach(f => {
    const src = readSafe(path.join(PAGES_DIR, f));
    const matches = src.match(/--([a-z]{2,4})-/g) || [];
    const uniquePrefixes = [...new Set(matches.map(m => m.replace(/^--|[-]$/g, '')))];
    if (uniquePrefixes.length > 0) {
      prefixes[f.replace('.css', '')] = uniquePrefixes;
    }
  });

  const prefixCount = Object.keys(prefixes).length;
  findings.push({ level: 'info', agent: 'consistency_checker', msg: `${prefixCount} pages use scoped CSS variable prefixes (good isolation pattern)` });

  // 2. Pages that mix inline and CSS styles heavily
  let mixedCount = 0;
  jsxFiles.forEach(f => {
    const name = f.replace('.jsx', '');
    const src = readSafe(path.join(PAGES_DIR, f));
    const inlineCount = countOccurrences(src, /style=\{\{/g);
    const hasCSS = cssFiles.includes(name + '.css');
    if (inlineCount > 20 && hasCSS) {
      mixedCount++;
    }
  });

  if (mixedCount > 5) {
    score -= 5;
    findings.push({ level: 'warning', agent: 'consistency_checker', msg: `${mixedCount} pages heavily mix inline styles with CSS files — pick one approach per page` });
    recommendations.push('Migrate heavy inline styles to CSS for pages that already have a .css file');
  }

  // 3. Font-family declarations (should be consistent)
  const fontDeclarations = new Set();
  cssFiles.forEach(f => {
    const src = readSafe(path.join(PAGES_DIR, f));
    const fonts = src.match(/font-family\s*:\s*([^;]+)/g) || [];
    fonts.forEach(fd => fontDeclarations.add(fd.trim()));
  });

  if (fontDeclarations.size > 3) {
    score -= 5;
    findings.push({ level: 'warning', agent: 'consistency_checker', msg: `${fontDeclarations.size} different font-family declarations — should use 1-2 consistent font stacks` });
    recommendations.push('Define font-family in design-tokens.css and reference it everywhere');
  } else {
    findings.push({ level: 'success', agent: 'consistency_checker', msg: 'Font usage is consistent across pages' });
  }

  // 4. z-index sprawl
  const zIndexValues = new Set();
  cssFiles.forEach(f => {
    const src = readSafe(path.join(PAGES_DIR, f));
    const matches = src.match(/z-index\s*:\s*(\d+)/g) || [];
    matches.forEach(m => zIndexValues.add(m.match(/\d+/)[0]));
  });
  jsxFiles.forEach(f => {
    const src = readSafe(path.join(PAGES_DIR, f));
    const matches = src.match(/zIndex\s*:\s*(\d+)/g) || [];
    matches.forEach(m => zIndexValues.add(m.match(/\d+/)[0]));
  });

  if (zIndexValues.size > 12) {
    score -= 5;
    findings.push({ level: 'warning', agent: 'consistency_checker', msg: `${zIndexValues.size} unique z-index values — risk of stacking-context chaos` });
    recommendations.push('Define z-index tiers in design tokens: --z-dropdown, --z-modal, --z-tooltip, etc.');
  } else {
    findings.push({ level: 'info', agent: 'consistency_checker', msg: `${zIndexValues.size} unique z-index values in use` });
  }

  // 5. Border-radius consistency
  const radiusValues = new Set();
  cssFiles.forEach(f => {
    const src = readSafe(path.join(PAGES_DIR, f));
    const matches = src.match(/border-radius\s*:\s*([^;]+)/g) || [];
    matches.forEach(m => radiusValues.add(m.split(':')[1].trim()));
  });

  if (radiusValues.size > 10) {
    score -= 3;
    findings.push({ level: 'info', agent: 'consistency_checker', msg: `${radiusValues.size} different border-radius values — consider standardising to token tiers` });
    recommendations.push('Use --radius-sm, --radius, --radius-lg from design tokens instead of arbitrary values');
  }

  if (!findings.some(f => f.level === 'warning' || f.level === 'critical')) {
    findings.push({ level: 'success', agent: 'consistency_checker', msg: 'Visual consistency is strong across pages' });
  }

  return {
    status: score >= 80 ? 'healthy' : score >= 60 ? 'needs-attention' : 'critical',
    score: Math.max(0, score),
    findings, recommendations,
    data: { prefixCount, zIndexCount: zIndexValues.size, radiusCount: radiusValues.size },
  };
}

// ═══════════════════════════════════════════════════════════════
//  SUB-AGENT 4:  Accessibility Scout
// ═══════════════════════════════════════════════════════════════
function accessibilityScout() {
  const findings = [];
  const recommendations = [];
  let score = 100;

  const cssFiles = listFiles(PAGES_DIR, '.css');
  const jsxFiles = listFiles(PAGES_DIR, '.jsx');

  // 1. Touch target sizing (should be 44px+ on mobile)
  const responsiveCss = readSafe(path.join(STYLES_DIR, 'responsive.css'));
  if (responsiveCss.includes('44px') || responsiveCss.includes('min-height: 44') || responsiveCss.includes('min-height: 2.75rem')) {
    findings.push({ level: 'success', agent: 'accessibility_scout', msg: 'Global responsive.css enforces 44px minimum touch targets' });
  } else {
    score -= 5;
    findings.push({ level: 'warning', agent: 'accessibility_scout', msg: 'No global 44px touch-target rule found — small buttons will be hard to tap on mobile' });
    recommendations.push('Add minimum 44px touch targets in responsive.css for buttons/links on coarse pointers');
  }

  // 2. Font-size minimum — look for very small fonts
  let tinyFonts = 0;
  cssFiles.forEach(f => {
    const src = readSafe(path.join(PAGES_DIR, f));
    const matches = src.match(/font-size\s*:\s*(\d+)px/g) || [];
    matches.forEach(m => {
      const px = parseInt(m.match(/\d+/)[0]);
      if (px < 11) tinyFonts++;
    });
  });
  jsxFiles.forEach(f => {
    const src = readSafe(path.join(PAGES_DIR, f));
    const matches = src.match(/fontSize\s*:\s*(\d+)/g) || [];
    matches.forEach(m => {
      const px = parseInt(m.match(/\d+/)[0]);
      if (px < 11) tinyFonts++;
    });
  });

  if (tinyFonts > 20) {
    score -= 8;
    findings.push({ level: 'warning', agent: 'accessibility_scout', msg: `${tinyFonts} declarations use font-size < 11px — illegible on mobile` });
    recommendations.push('Use minimum 12px font size; prefer rem/em units for scalability');
  } else if (tinyFonts > 0) {
    findings.push({ level: 'info', agent: 'accessibility_scout', msg: `${tinyFonts} font declarations under 11px (minor)` });
  } else {
    findings.push({ level: 'success', agent: 'accessibility_scout', msg: 'No dangerously small font sizes detected' });
  }

  // 3. Focus styles — check for :focus or :focus-visible
  let focusStylePages = 0;
  let outlineNone = 0;
  cssFiles.forEach(f => {
    const src = readSafe(path.join(PAGES_DIR, f));
    if (/:focus/.test(src) || /:focus-visible/.test(src)) focusStylePages++;
    outlineNone += countOccurrences(src, /outline\s*:\s*none/gi);
  });

  if (outlineNone > 10) {
    score -= 8;
    findings.push({ level: 'warning', agent: 'accessibility_scout', msg: `${outlineNone} 'outline: none' declarations — removes keyboard focus indicators` });
    recommendations.push('Replace outline:none with custom :focus-visible styles instead of removing focus entirely');
  }
  findings.push({ level: 'info', agent: 'accessibility_scout', msg: `${focusStylePages} page CSS files define custom :focus styles` });

  // 4. Overflow hidden (can clip content on small screens)
  let overflowHidden = 0;
  cssFiles.forEach(f => {
    const src = readSafe(path.join(PAGES_DIR, f));
    overflowHidden += countOccurrences(src, /overflow\s*:\s*hidden/g);
  });

  if (overflowHidden > 30) {
    score -= 3;
    findings.push({ level: 'info', agent: 'accessibility_scout', msg: `${overflowHidden} 'overflow: hidden' rules — may clip content on small screens` });
    recommendations.push('Audit overflow:hidden usages; consider overflow-x:auto for scrollable content on mobile');
  }

  // 5. Dark mode / prefers-color-scheme
  let darkModeSupport = false;
  [STYLES_DIR, PAGES_DIR].forEach(dir => {
    listFiles(dir, '.css').forEach(f => {
      const src = readSafe(path.join(dir, f));
      if (/prefers-color-scheme/.test(src)) darkModeSupport = true;
    });
  });

  if (!darkModeSupport) {
    score -= 3;
    findings.push({ level: 'info', agent: 'accessibility_scout', msg: 'No prefers-color-scheme support — users who prefer dark mode get no adaptation' });
    recommendations.push('Consider adding prefers-color-scheme media query for system dark-mode users');
  }

  // 6. Image alt — check for <img without alt
  let imgNoAlt = 0;
  jsxFiles.forEach(f => {
    const src = readSafe(path.join(PAGES_DIR, f));
    const imgs = src.match(/<img\b[^>]*>/g) || [];
    imgs.forEach(tag => {
      if (!/alt\s*=/.test(tag)) imgNoAlt++;
    });
  });

  if (imgNoAlt > 5) {
    score -= 5;
    findings.push({ level: 'warning', agent: 'accessibility_scout', msg: `${imgNoAlt} <img> tags missing alt attribute — screen readers can't describe them` });
    recommendations.push('Add descriptive alt text to all <img> tags');
  } else if (imgNoAlt > 0) {
    findings.push({ level: 'info', agent: 'accessibility_scout', msg: `${imgNoAlt} <img> tags missing alt (minor)` });
  } else {
    findings.push({ level: 'success', agent: 'accessibility_scout', msg: 'All <img> tags have alt attributes' });
  }

  return {
    status: score >= 80 ? 'healthy' : score >= 60 ? 'needs-attention' : 'critical',
    score: Math.max(0, score),
    findings, recommendations,
    data: { tinyFonts, outlineNone, imgNoAlt, darkModeSupport },
  };
}

// ═══════════════════════════════════════════════════════════════
//  ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════
function runFullAudit() {
  const start = Date.now();

  const responsive   = responsiveAuditor();
  const tokens       = tokenCompliance();
  const consistency  = consistencyChecker();
  const accessibility = accessibilityScout();

  const agents = {
    responsive_auditor: responsive,
    token_compliance:   tokens,
    consistency_checker: consistency,
    accessibility_scout: accessibility,
  };

  const weights = { responsive_auditor: 30, token_compliance: 25, consistency_checker: 25, accessibility_scout: 20 };
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
    case 'responsive_auditor':  return responsiveAuditor();
    case 'token_compliance':    return tokenCompliance();
    case 'consistency_checker': return consistencyChecker();
    case 'accessibility_scout': return accessibilityScout();
    default: return { status: 'error', score: 0, findings: [{ level: 'critical', agent: name, msg: `Unknown agent: ${name}` }], recommendations: [] };
  }
}

function quickSummary() {
  const cssFiles = listFiles(PAGES_DIR, '.css');
  const jsxFiles = listFiles(PAGES_DIR, '.jsx');
  const tokenSrc = readSafe(path.join(STYLES_DIR, 'design-tokens.css'));
  const tokenCount = countOccurrences(tokenSrc, /--[\w-]+\s*:/g);
  const hasMQ = cssFiles.filter(f => /@media/.test(readSafe(path.join(PAGES_DIR, f)))).length;
  return {
    page_css_files: cssFiles.length,
    page_jsx_files: jsxFiles.length,
    responsive_coverage: cssFiles.length ? Math.round((hasMQ / cssFiles.length) * 100) + '%' : '0%',
    design_tokens: tokenCount,
    status: 'ok',
  };
}

module.exports = { runFullAudit, runSubAgent, quickSummary };

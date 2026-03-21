/**
 * Luxury Filter Service — v1.1
 *
 * Corrections from v1.0:
 * - "profile" and "settings" patterns tightened to require utilitarian context
 *   so "her social profile" and "outfit settings" don't false-flag
 * - "user" pattern tightened to require non-narrative context
 * - All other patterns unchanged
 */

const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic();

// ─── RULE-BASED PATTERNS ──────────────────────────────────────────────────────

// System/technical language — must be clearly technical, not narrative
const SYSTEM_LANGUAGE_PATTERNS = [
  // Pure technical terms — these never appear in luxury narrative
  /\b(database|algorithm|backend|frontend|api\b|endpoint|server)\b/gi,
  /\b(loading|buffering|syncing|processing|calculating)\b/gi,
  /\b(error|bug|glitch|crash|fail to load|not found|404)\b/gi,

  // "user" only when clearly system-context (not "user of the space" etc.)
  /\b(user account|user data|user interface|user flow|user session)\b/gi,

  // "profile" only when clearly a system UI concept
  /\b(profile (page|settings|section|tab|menu|dashboard))\b/gi,

  // "settings" only when clearly utilitarian
  /\b(account settings|app settings|system settings|settings page|settings menu|notification settings)\b/gi,

  // Click/tap/press — only when clearly UI instruction, not narrative action
  /\b(click here|tap to|press the button|select from dropdown|choose an option|submit (the )?form)\b/gi,
];

// Stat language that breaks the fourth wall
const EXPLICIT_STAT_PATTERNS = [
  /reputation\s*(increased|decreased|is now|went up|went down)\s*by\s*\d/gi,
  /coins?\s*(increased|decreased|added|deducted|subtracted)\s*by\s*\d/gi,
  /stress\s*(level)?\s*(is|=|:)\s*\d/gi,
  /\+\d+\s*(rep|coins?|trust|influence|stress)/gi,
  /stat\s*(change|update|modifier)/gi,
];

// Clunky exposition
const CLUNKY_EXPOSITION_PATTERNS = [
  /as you can see[,\s]/gi,
  /as we know[,\s]/gi,
  /what this means is/gi,
  /in other words[,\s]/gi,
  /to summarize[,\s]/gi,
  /the reason (why|that) (lala|she)/gi,
];

// Transactional UI copy
const TRANSACTIONAL_COPY_PATTERNS = [
  /\b(complete|completed)\s+(the\s+)?(task|objective|mission|quest|challenge)\b/gi,
  /\b(achievement|achievement unlocked)\b/gi,
  /\b(level up|leveled up)\b/gi,
  // "equipped" only in clearly mechanical context, not fashion narrative
  /\b(item equipped|weapon equipped|gear equipped|slot \d+ equipped)\b/gi,
  /\b(score:|result:|outcome:|status:)\s*\d/gi,
  /\b(inventory)\b/gi,
];

// Generic montage language — forbidden especially in Beat 8
const MONTAGE_LANGUAGE_PATTERNS = [
  /\b(montage|sequence of outfits|series of looks)\b/gi,
  /she tries on (several|multiple|different|various|a few) (outfits?|looks?|options?)/gi,
  /after trying (several|multiple|various|many)/gi,
];

// ─── MAIN FILTER ─────────────────────────────────────────────────────────────

async function runLuxuryFilter(scriptText, context = {}, options = {}) {
  const { runClaudePass = true } = options;
  const violations = [];
  const suggestions = [];

  const ruleViolations = runRuleBasedScan(scriptText);
  violations.push(...ruleViolations);

  let semanticResult = null;
  if (runClaudePass) {
    semanticResult = await runSemanticPass(scriptText, context);
    if (semanticResult.violations) violations.push(...semanticResult.violations);
    if (semanticResult.suggestions) suggestions.push(...semanticResult.suggestions);
  }

  const blockCount = violations.filter(v => v.severity === 'BLOCK').length;
  const warnCount  = violations.filter(v => v.severity === 'WARN').length;
  const noteCount  = suggestions.length;

  let luxuryScore = 100 - (blockCount * 20) - (warnCount * 8) - (noteCount * 3);
  luxuryScore = Math.max(0, Math.min(100, luxuryScore));

  const passes = blockCount === 0;
  const severity = blockCount > 0 ? 'BLOCK'
                 : warnCount > 0  ? 'WARN'
                 : noteCount > 0  ? 'NOTE'
                 : 'PASS';

  return {
    passes,
    severity,
    luxuryScore,
    luxuryGrade: luxuryScore >= 90 ? 'EXCELLENT'
               : luxuryScore >= 75 ? 'GOOD'
               : luxuryScore >= 60 ? 'ACCEPTABLE'
               : luxuryScore >= 40 ? 'POOR'
               : 'FAILS',
    violations,
    suggestions,
    meta: {
      wordCount: scriptText.split(/\s+/).length,
      runClaudePass,
      semanticPassRan: !!semanticResult,
    },
  };
}

// ─── RULE-BASED SCAN ─────────────────────────────────────────────────────────

function runRuleBasedScan(text) {
  const violations = [];

  for (const pattern of SYSTEM_LANGUAGE_PATTERNS) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      violations.push({
        severity: 'BLOCK',
        code: 'SYSTEM_LANGUAGE',
        message: `System/technical language detected: "${matches[0][0]}"`,
        detail: 'Luxury simulators don\'t expose their machinery. Remove technical vocabulary.',
        matches: matches.map(m => m[0]).slice(0, 3),
        line: getLineNumber(text, matches[0].index),
      });
    }
  }

  for (const pattern of EXPLICIT_STAT_PATTERNS) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      violations.push({
        severity: 'BLOCK',
        code: 'EXPLICIT_STAT_LANGUAGE',
        message: `Stat mechanics exposed in dialogue: "${matches[0][0]}"`,
        detail: 'Stats must be felt, not stated. Rewrite as emotion or consequence, not numbers.',
        matches: matches.map(m => m[0]).slice(0, 3),
        line: getLineNumber(text, matches[0].index),
      });
    }
  }

  for (const pattern of CLUNKY_EXPOSITION_PATTERNS) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      violations.push({
        severity: 'WARN',
        code: 'CLUNKY_EXPOSITION',
        message: `Over-explanation detected: "${matches[0][0]}"`,
        detail: 'Trust the viewer. Luxury storytelling shows, doesn\'t explain.',
        matches: matches.map(m => m[0]).slice(0, 3),
        line: getLineNumber(text, matches[0].index),
      });
    }
  }

  for (const pattern of TRANSACTIONAL_COPY_PATTERNS) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      violations.push({
        severity: 'WARN',
        code: 'TRANSACTIONAL_COPY',
        message: `Game/app UI language detected: "${matches[0][0]}"`,
        detail: 'This reads like a menu item, not a life moment. Rewrite as desire, status, or feeling.',
        matches: matches.map(m => m[0]).slice(0, 3),
        line: getLineNumber(text, matches[0].index),
      });
    }
  }

  for (const pattern of MONTAGE_LANGUAGE_PATTERNS) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      violations.push({
        severity: 'BLOCK',
        code: 'GENERIC_MONTAGE',
        message: `Generic montage language in wardrobe beat: "${matches[0][0]}"`,
        detail: 'Beat 8 is the Transformation Loop. Every selection must feel intentional, not summarized.',
        matches: matches.map(m => m[0]).slice(0, 3),
        line: getLineNumber(text, matches[0].index),
      });
    }
  }

  // Thin beat check
  const beatSections = text.split(/\[BEAT\s*\d/i);
  if (beatSections.length > 1) {
    beatSections.forEach((section, i) => {
      if (i > 0 && section.split(/\s+/).length < 20) {
        violations.push({
          severity: 'WARN',
          code: 'THIN_BEAT',
          message: `Beat ${i} appears very short (${section.split(/\s+/).length} words).`,
          detail: 'Luxury pacing requires each beat to breathe.',
        });
      }
    });
  }

  return violations;
}

// ─── CLAUDE SEMANTIC PASS ─────────────────────────────────────────────────────

async function runSemanticPass(scriptText, context) {
  const { episodeTitle = 'Unknown', episodeArchetype = 'Unknown', designedIntent = 'Unknown' } = context;

  const scriptSample = scriptText.length > 3000
    ? scriptText.slice(0, 1500) + '\n\n[...]\n\n' + scriptText.slice(-1000)
    : scriptText;

  const prompt = `You are the Luxury Filter for "Styling Adventures with Lala" — a luxury life simulator show.

FRANCHISE LAW: "The show must NEVER feel like a dashboard. It must feel like a luxury life simulator."

Laws:
- Stats must be FELT, never stated as numbers
- Even failure must look elegant
- UI language must feel ornamental and seductive, never utilitarian
- Economy supports emotion — it does not replace it

EPISODE CONTEXT:
- Title: ${episodeTitle}
- Archetype: ${episodeArchetype}  
- Designed Intent: ${designedIntent}

SCRIPT:
${scriptSample}

Respond ONLY with valid JSON — no preamble, no markdown fences.

{
  "overallFeeling": "life simulator" | "dashboard" | "mixed",
  "luxuryToneScore": 0-100,
  "violations": [
    {
      "severity": "BLOCK" | "WARN" | "NOTE",
      "code": "SHORT_CODE",
      "message": "Specific issue",
      "detail": "Why this violates luxury standard",
      "excerpt": "exact text that triggered this"
    }
  ],
  "suggestions": [
    {
      "type": "TONE" | "PACING" | "DIALOGUE" | "UI_LANGUAGE" | "EMOTION",
      "message": "Specific improvement"
    }
  ],
  "strongPoints": ["What is working well"],
  "summary": "One sentence on luxury compliance"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0]?.text || '{}';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    return {
      overallFeeling: parsed.overallFeeling,
      luxuryToneScore: parsed.luxuryToneScore,
      violations: (parsed.violations || []).map(v => ({ ...v, source: 'semantic' })),
      suggestions: parsed.suggestions || [],
      strongPoints: parsed.strongPoints || [],
      summary: parsed.summary,
    };
  } catch (err) {
    console.error('[LuxuryFilter] Semantic pass error:', err.message);
    return {
      violations: [],
      suggestions: [{
        type: 'TONE',
        message: 'Semantic pass unavailable — rule-based scan only. Review tone manually.',
      }],
      error: err.message,
    };
  }
}

// ─── QUICK CHECK ─────────────────────────────────────────────────────────────

function quickCheck(scriptText) {
  const violations = runRuleBasedScan(scriptText);
  const blockCount = violations.filter(v => v.severity === 'BLOCK').length;
  const warnCount  = violations.filter(v => v.severity === 'WARN').length;

  let score = 100 - (blockCount * 20) - (warnCount * 8);
  score = Math.max(0, Math.min(100, score));

  return {
    passes: blockCount === 0,
    luxuryScore: score,
    violations,
    note: 'Quick check only — run full filter before accepting script.',
  };
}

function getLineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

module.exports = { runLuxuryFilter, quickCheck };

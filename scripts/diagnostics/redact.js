#!/usr/bin/env node
// scripts/diagnostics/redact.js — masks secrets and personal data in
// diagnostics output before it is written anywhere (F-Tools-2, 2026-10-29).
//
// Used on the box (on-box.sh pipes every log line and command result through
// it) and on the runner (the whole report passes through it again before it
// is published to the private output repository). Reads stdin, writes stdout.
// Each line is also cut to MAX_LINE characters, and output stops after
// MAX_BYTES so one check cannot exceed SSM's 24,000-character output limit.
//
// Usage: node redact.js [--max-bytes N]

'use strict';

const MAX_LINE = 400;

// Order matters: specific token shapes first, then generic key=value forms,
// then personal data. Each rule replaces the sensitive part only.
const RULES = [
  // Private key blocks (any PEM)
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[private-key]'],
  // AWS access key ids (long-lived AKIA, temporary ASIA)
  [/\b(AKIA|ASIA)[A-Z0-9]{16}\b/g, '[aws-key-id]'],
  // Anthropic, OpenAI-style, GitHub, Slack and Stripe tokens
  [/\bsk-ant-[A-Za-z0-9_-]{10,}/g, '[api-key]'],
  [/\bsk-[A-Za-z0-9_-]{20,}/g, '[api-key]'],
  [/\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/g, '[github-token]'],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/g, '[slack-token]'],
  [/\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{10,}/g, '[stripe-key]'],
  // JWTs (Cognito id/access tokens, our own)
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[jwt]'],
  // Authorization headers and bearer tokens
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 [token]'],
  // Credentials inside connection strings: scheme://user:pass@host
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s:/@]+:[^\s@/]+@/gi, '$1[user]:[password]@'],
  // Presigned URL signatures and security tokens
  [/([?&](X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token|Signature|AWSAccessKeyId|token|access_token|id_token|refresh_token|code)=)[^&\s"']+/gi, '$1[redacted]'],
  // key=value / key: value / "key": "value" for sensitive names
  [/((?:"|')?[A-Za-z0-9_-]*(?:password|passwd|secret|token|api[_-]?key|private[_-]?key|session[_-]?key|credential|authorization|cookie)[A-Za-z0-9_-]*(?:"|')?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;}]+)/gi, '$1[redacted]'],
  // Email addresses (personal data)
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  // IPv4 addresses (personal data in access logs; internal topology)
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip]'],
  // AWS-internal host names (as scripts/deploy/workflow-deploy.sh redact())
  [/[A-Za-z0-9._-]+\.(compute\.internal|ec2\.internal)\b/g, '[host]'],
  [/\bip-\d+-\d+-\d+-\d+\b/g, '[host]'],
];

function redactLine(line) {
  let out = line;
  for (const [re, rep] of RULES) out = out.replace(re, rep);
  if (out.length > MAX_LINE) out = `${out.slice(0, MAX_LINE)} …[cut]`;
  return out;
}

function redact(text, maxBytes = Infinity) {
  // A PEM block spans lines; mask it before splitting.
  const masked = String(text).replace(RULES[0][0], RULES[0][1]);
  const lines = masked.split('\n').map(redactLine);
  let out = '';
  for (const line of lines) {
    const next = out ? `${out}\n${line}` : line;
    if (Buffer.byteLength(next) > maxBytes) {
      return `${out}\n…[output cut at ${maxBytes} bytes]`;
    }
    out = next;
  }
  return out;
}

module.exports = { redact, redactLine, MAX_LINE };

if (require.main === module) {
  const i = process.argv.indexOf('--max-bytes');
  const maxBytes = i > -1 ? Number(process.argv[i + 1]) : Infinity;
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { input += c; });
  process.stdin.on('end', () => { process.stdout.write(`${redact(input, maxBytes)}\n`); });
}

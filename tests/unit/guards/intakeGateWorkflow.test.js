const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const workflowPath = path.resolve(__dirname, '../../..', '.github/workflows/intake-gate.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');
// Extracts the body of a `node <<'MARKER'` heredoc from the workflow.
function extractScript(marker) {
  const open = `node <<'${marker}'\n`;
  const start = workflow.indexOf(open);
  const end = workflow.indexOf(`\n          ${marker}\n`, start);
  if (start < 0 || end < start) return { start, end, body: '' };
  const body = workflow
    .slice(start + open.length, end)
    .split(/\r?\n/)
    .map(line => line.slice(10))
    .join('\n');
  return { start, end, body };
}
const { start: scriptStart, end: scriptEnd, body: script } = extractScript('NODE');
const fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'intake-gate-'));

const ownerEvent = {
  action: 'labeled',
  repository: { full_name: 'angelcreator113/Episode-Canonical-Control-Record' },
  label: { name: 'claude-intake-approved' },
  sender: { id: 212567798, login: 'angelcreator113' },
};

function runVerifier(eventName = 'issues', eventText = JSON.stringify(ownerEvent)) {
  const eventPath = path.join(fixtureDirectory, `event-${Math.random()}.json`);
  fs.writeFileSync(eventPath, eventText);
  return spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: eventName,
      GITHUB_EVENT_PATH: eventPath,
    },
  });
}

afterAll(() => {
  fs.rmSync(fixtureDirectory, { recursive: true, force: true });
});

describe('intake-gate workflow', () => {
  test('runs only for issue-label events with issues: read only, no checkout, secrets, or follow-on triggers', () => {
    expect(workflow).toMatch(/^\s{2}issues:\s*$/m);
    expect(workflow).toMatch(/^\s{4}types:\s*\[labeled\]\s*$/m);
    // Exactly one permission, at the top level: issues: read. No job-level permissions.
    expect(workflow).toMatch(/^permissions:\n {2}issues: read\n\n/m);
    expect(workflow.match(/permissions:/g)).toHaveLength(1);
    expect(workflow.match(/^ {2}[a-z-]+: (read|write)$/gm)).toEqual(['  issues: read']);
    expect(workflow).not.toMatch(/actions\/checkout|secrets\.|workflow_dispatch|repository_dispatch|uses:/i);
    expect(workflow).not.toMatch(/:\s*write\b/i);
    expect(scriptStart).toBeGreaterThanOrEqual(0);
    expect(scriptEnd).toBeGreaterThan(scriptStart);
  });

  test('accepts the owner account on the exact approved label and repository', () => {
    expect(runVerifier().status).toBe(0);
  });

  test.each([
    ['non-owner sender ID', { ...ownerEvent, sender: { id: 1, login: 'angelcreator113' } }],
    ['mismatched sender login', { ...ownerEvent, sender: { id: 212567798, login: 'other-user' } }],
    ['missing sender', { ...ownerEvent, sender: undefined }],
    ['wrong action', { ...ownerEvent, action: 'opened' }],
    ['wrong label', { ...ownerEvent, label: { name: 'other-label' } }],
    ['missing label', { ...ownerEvent, label: undefined }],
    [
      'wrong repository',
      { ...ownerEvent, repository: { full_name: 'someone-else/another-repository' } },
    ],
    ['malformed object payload', null],
  ])('fails closed for %s', (_description, event) => {
    expect(runVerifier('issues', JSON.stringify(event)).status).toBe(1);
  });

  test('fails closed for the wrong event name and malformed JSON', () => {
    expect(runVerifier('issue_comment').status).toBe(1);
    expect(runVerifier('issues', '{not-json').status).toBe(1);
  });

  // Runs the verifier with GITHUB_EVENT_NAME / GITHUB_EVENT_PATH removed or
  // overridden, so missing platform context is tested, not only bad payloads.
  function runWithEnv(overrides) {
    const env = { ...process.env, GITHUB_EVENT_NAME: 'issues' };
    delete env.GITHUB_EVENT_PATH;
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
    return spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', env });
  }

  test.each([
    ['absent GITHUB_EVENT_PATH', {}, 'malformed_payload'],
    ['empty GITHUB_EVENT_PATH', { GITHUB_EVENT_PATH: '' }, 'malformed_payload'],
    ['GITHUB_EVENT_PATH that does not exist', { GITHUB_EVENT_PATH: path.join(fixtureDirectory, 'missing.json') }, 'malformed_payload'],
    ['GITHUB_EVENT_PATH that is a directory', { GITHUB_EVENT_PATH: fixtureDirectory }, 'malformed_payload'],
    ['absent GITHUB_EVENT_NAME', { GITHUB_EVENT_NAME: undefined }, 'unexpected_event'],
  ])('fails closed for %s', (_description, overrides, reason) => {
    const result = runWithEnv(overrides);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Intake verification failed: ${reason}`);
    expect(result.stdout).not.toMatch(/verified/);
  });

  test.each([
    ['sender ID as a string', { ...ownerEvent, sender: { id: '212567798', login: 'angelcreator113' } }],
    ['sender login in different case', { ...ownerEvent, sender: { id: 212567798, login: 'AngelCreator113' } }],
    ['sender without a login', { ...ownerEvent, sender: { id: 212567798 } }],
    ['sender as an array', { ...ownerEvent, sender: [212567798, 'angelcreator113'] }],
    ['label name in different case', { ...ownerEvent, label: { name: 'Claude-Intake-Approved' } }],
    ['label with surrounding whitespace', { ...ownerEvent, label: { name: ' claude-intake-approved ' } }],
    ['label as a bare string', { ...ownerEvent, label: 'claude-intake-approved' }],
    ['unlabeled action', { ...ownerEvent, action: 'unlabeled' }],
    ['missing repository', { ...ownerEvent, repository: undefined }],
    ['repository name in different case', { ...ownerEvent, repository: { full_name: 'Angelcreator113/Episode-Canonical-Control-Record' } }],
    ['array payload', [ownerEvent]],
    ['string payload', 'labeled'],
  ])('fails closed for %s', (_description, event) => {
    const result = runVerifier('issues', JSON.stringify(event));
    expect(result.status).toBe(1);
    expect(result.stdout).not.toMatch(/verified/);
  });

  test('fails closed for an empty event file', () => {
    expect(runVerifier('issues', '').status).toBe(1);
  });

  test('a failure reports only a fixed reason code, never event content', () => {
    const marker = 'UNTRUSTED-$(touch /tmp/pwned)-"; exit 0; #';
    const result = runVerifier('issues', JSON.stringify({ ...ownerEvent, label: { name: marker } }));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Intake verification failed: unexpected_label/);
    expect(`${result.stdout}${result.stderr}`).not.toContain(marker);
  });

  test('event data is read only from the event file; the one ${{ }} expression is the job token, passed through env', () => {
    expect(workflow.match(/\$\{\{[^}]*\}\}/g)).toEqual(['${{ github.token }}']);
    expect(workflow).toMatch(/^ {10}GITHUB_TOKEN: \$\{\{ github\.token \}\}$/m);
    expect(script).not.toMatch(/GITHUB_TOKEN|fetch\(/);
  });
});

// The advisory step (#3774): reads the issue's events and checks the latest
// application of the label was the owner's, made directly and not through an
// app. fetch is replaced in the child by a --require preload that serves
// fixture pages and logs each request; nothing leaves the machine.
describe('intake-gate advisory app check', () => {
  const advisory = extractScript('ADVISORY_CHECK');
  const enforcingScript = advisory.body.replace('const ADVISORY = true;', 'const ADVISORY = false;');
  const stubPath = path.join(fixtureDirectory, 'fetch-stub.js');
  fs.writeFileSync(stubPath, `
    const fs = require('node:fs');
    const fixture = JSON.parse(fs.readFileSync(process.env.FETCH_FIXTURE, 'utf8'));
    let call = 0;
    globalThis.fetch = async (url, options = {}) => {
      fs.appendFileSync(process.env.FETCH_LOG, JSON.stringify({ url: String(url), auth: (options.headers || {}).Authorization || null }) + '\\n');
      const page = fixture.pages[Math.min(call, fixture.pages.length - 1)];
      call += 1;
      if (page.throws) throw new Error('network down');
      return {
        ok: page.status >= 200 && page.status < 300,
        status: page.status,
        json: async () => (page.raw !== undefined ? JSON.parse(page.raw) : page.body),
      };
    };
  `);

  const OWNER = { id: 212567798, login: 'angelcreator113' };
  const labeled = (overrides = {}) => ({
    event: 'labeled', label: { name: 'claude-intake-approved' }, actor: OWNER, performed_via_github_app: null, ...overrides,
  });
  const issueEvent = { ...ownerEvent, issue: { number: 3773 } };

  function runAdvisory({ pages = [{ status: 200, body: [labeled()] }], event = issueEvent, token = 'test-token', enforce = false } = {}) {
    const id = `${Date.now()}-${Math.random()}`;
    const eventPath = path.join(fixtureDirectory, `adv-event-${id}.json`);
    const fixturePath = path.join(fixtureDirectory, `adv-fixture-${id}.json`);
    const logPath = path.join(fixtureDirectory, `adv-log-${id}.jsonl`);
    fs.writeFileSync(eventPath, typeof event === 'string' ? event : JSON.stringify(event));
    fs.writeFileSync(fixturePath, JSON.stringify({ pages }));
    const env = { ...process.env, GITHUB_EVENT_NAME: 'issues', GITHUB_EVENT_PATH: eventPath, FETCH_FIXTURE: fixturePath, FETCH_LOG: logPath, GITHUB_API_URL: 'https://api.github.test' };
    if (token === null) delete env.GITHUB_TOKEN; // null: no token
    else env.GITHUB_TOKEN = token;
    const result = spawnSync(process.execPath, ['--require', stubPath, '-e', enforce ? enforcingScript : advisory.body], { encoding: 'utf8', env });
    const calls = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').trim().split('\n').map(l => JSON.parse(l)) : [];
    return { ...result, calls };
  }
  const reasonOf = r => (`${r.stdout}${r.stderr}`.match(/(?:Advisory intake check|Intake app check failed): ([a-z_]+)/) || [])[1];

  test('the step exists, is advisory, and only one script in the workflow calls the API', () => {
    expect(advisory.start).toBeGreaterThan(scriptEnd);
    expect(advisory.body).toMatch(/^const ADVISORY = true;$/m);
    expect(enforcingScript).not.toBe(advisory.body);
  });

  test('passes when the latest application was the owner directly, and asks for this issue\'s events with the job token', () => {
    const r = runAdvisory();
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/applied by the owner directly/);
    expect(r.stdout).not.toMatch(/::warning::/);
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0].url).toBe('https://api.github.test/repos/angelcreator113/Episode-Canonical-Control-Record/issues/3773/events?per_page=100&page=1');
    expect(r.calls[0].auth).toBe('Bearer test-token');
  });

  test('the latest application decides: an earlier app-applied label does not fail a later direct one', () => {
    const r = runAdvisory({ pages: [{ status: 200, body: [labeled({ performed_via_github_app: { id: 1, slug: 'some-app' } }), { event: 'unlabeled', label: { name: 'claude-intake-approved' } }, labeled()] }] });
    expect(r.status).toBe(0);
    expect(reasonOf(r)).toBeUndefined();
  });

  const failures = [
    ['applied through an app', { pages: [{ status: 200, body: [labeled({ performed_via_github_app: { id: 1, slug: 'some-app' } })] }] }, 'app_applied'],
    ['performed_via_github_app missing', { pages: [{ status: 200, body: [(({ performed_via_github_app, ...rest }) => rest)(labeled())] }] }, 'app_applied'],
    ['latest application by another account', { pages: [{ status: 200, body: [labeled(), labeled({ actor: { id: 5, login: 'angelcreator113' } })] }] }, 'unexpected_actor'],
    ['actor id as a string', { pages: [{ status: 200, body: [labeled({ actor: { id: '212567798', login: 'angelcreator113' } })] }] }, 'unexpected_actor'],
    ['missing actor', { pages: [{ status: 200, body: [labeled({ actor: null })] }] }, 'unexpected_actor'],
    ['only other labels', { pages: [{ status: 200, body: [labeled({ label: { name: 'other' } }), labeled({ label: { name: 'Claude-Intake-Approved' } })] }] }, 'no_label_event'],
    ['no events', { pages: [{ status: 200, body: [] }] }, 'no_label_event'],
    ['API refuses', { pages: [{ status: 403, body: { message: 'Resource not accessible' } }] }, 'api_error'],
    ['API errors', { pages: [{ status: 500, body: {} }] }, 'api_error'],
    ['network failure', { pages: [{ throws: true }] }, 'api_error'],
    ['response not a list', { pages: [{ status: 200, body: { event: 'labeled' } }] }, 'malformed_events'],
    ['response not JSON', { pages: [{ status: 200, raw: '{not-json' }] }, 'malformed_events'],
    ['no token', { token: null }, 'api_error'],
    ['payload without an issue number', { event: ownerEvent }, 'malformed_payload'],
    ['issue number as a string', { event: { ...ownerEvent, issue: { number: '3773' } } }, 'malformed_payload'],
    ['unreadable event file', { event: '{not-json' }, 'malformed_payload'],
    ['more than ten full pages', { pages: [{ status: 200, body: Array.from({ length: 100 }, () => ({ event: 'commented' })) }] }, 'too_many_events'],
  ];

  test.each(failures)('advisory: %s is reported as a warning and exits 0', (_name, options, reason) => {
    const r = runAdvisory(options);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(`::warning::Advisory intake check: ${reason} (not enforced yet).`);
    expect(r.stdout).not.toMatch(/applied by the owner directly/);
  });

  test.each(failures)('enforcing: %s fails closed with exit 1', (_name, options, reason) => {
    const r = runAdvisory({ ...options, enforce: true });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(`Intake app check failed: ${reason}`);
  });

  test('enforcing: the owner applying the label directly still passes', () => {
    expect(runAdvisory({ enforce: true }).status).toBe(0);
  });

  test('no request is made without a token or a valid issue number', () => {
    expect(runAdvisory({ token: null }).calls).toHaveLength(0);
    expect(runAdvisory({ event: ownerEvent }).calls).toHaveLength(0);
  });

  test('follows pages: a matching event on page 2 is found, in two requests', () => {
    const r = runAdvisory({ pages: [{ status: 200, body: Array.from({ length: 100 }, () => ({ event: 'commented' })) }, { status: 200, body: [labeled()] }] });
    expect(r.status).toBe(0);
    expect(reasonOf(r)).toBeUndefined();
    expect(r.calls.map(c => c.url.replace(/.*page=/, ''))).toEqual(['1', '2']);
  });

  test('a report never echoes event or API content', () => {
    const marker = 'UNTRUSTED-$(touch /tmp/pwned)-"; exit 0; #';
    const r = runAdvisory({ pages: [{ status: 200, body: [labeled({ actor: { id: 7, login: marker }, performed_via_github_app: { slug: marker } })] }] });
    expect(`${r.stdout}${r.stderr}`).not.toContain(marker);
    expect(reasonOf(r)).toBe('unexpected_actor');
  });
});

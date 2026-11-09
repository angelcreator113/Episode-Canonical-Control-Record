const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const workflowPath = path.resolve(__dirname, '../../..', '.github/workflows/intake-gate.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');
const scriptStart = workflow.indexOf("node <<'NODE'\n");
const scriptEnd = workflow.indexOf('\n          NODE', scriptStart);
const script = workflow
  .slice(scriptStart + "node <<'NODE'\n".length, scriptEnd)
  .split(/\r?\n/)
  .map(line => line.slice(10))
  .join('\n');
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
  test('runs only for issue-label events with no permissions, checkout, secrets, or follow-on triggers', () => {
    expect(workflow).toMatch(/^\s{2}issues:\s*$/m);
    expect(workflow).toMatch(/^\s{4}types:\s*\[labeled\]\s*$/m);
    expect(workflow).toMatch(/^permissions:\s*\{\}\s*$/m);
    expect(workflow).not.toMatch(/actions\/checkout|secrets\.|workflow_dispatch|repository_dispatch/i);
    expect(workflow).not.toMatch(/contents:\s*write|issues:\s*write|pull-requests:\s*write/i);
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

  test('the verifier step reads event data only from the event file, never through ${{ }} expressions', () => {
    expect(workflow).not.toMatch(/\$\{\{/);
  });
});

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
});

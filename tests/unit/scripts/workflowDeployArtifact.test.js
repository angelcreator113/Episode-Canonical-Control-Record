// ============================================================================
// Deploy runs 93-94 (2026-10-12): the 2 GB box ran out of memory building
// the frontend, and then dropped out of SSM. The Deploy workflow now builds
// the frontend on GitHub's runner and, when DEPLOY_ARTIFACT_BUCKET is set,
// hands the box a 15-minute S3 link to the pack and its sha256. The box
// checks both before it changes anything, then unpacks instead of building.
// ============================================================================
// As in workflowDeployBuildTimeout.test.js, the box script is never run whole:
// its functions are cut out and run in bash against stub commands in a
// throwaway directory. The runner script runs against a stub aws. No host,
// AWS, database or network is touched.
// ============================================================================

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const DEPLOY_DIR = path.join(ROOT, 'scripts', 'deploy');
const SCRIPT_TEXT = fs.readFileSync(path.join(DEPLOY_DIR, 'workflow-deploy.sh'), 'utf8');
const WORKFLOW = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8');
const OLD = 'a'.repeat(40);
const TARGET = 'b'.repeat(40);
const LINK = `https://episode-deploy-builds.s3.us-east-1.amazonaws.com/deploy-builds/${TARGET}-38276291649-1.tgz?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIA%2F20261012%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Expires=900&X-Amz-Signature=0f`;

function fn(name) {
  const m = new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}\\n`, 'm').exec(SCRIPT_TEXT);
  if (!m) throw new Error(`${name}() not found`);
  return m[0];
}

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-artifact-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function stubs(files) {
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(bin, name), text, { mode: 0o755 });
  return bin;
}

/** Packs tmp/pack-src/<files> as a .tgz (as the build job does) and returns its path and sha256. */
function pack(files, name = 'pack.tgz') {
  const src = path.join(tmp, `src-${name}`);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(src, rel)), { recursive: true });
    fs.writeFileSync(path.join(src, rel), text);
  }
  const out = path.join(tmp, name);
  const top = [...new Set(Object.keys(files).map((f) => f.split('/')[0]))];
  const res = spawnSync('tar', ['-C', src, '-czf', out, ...top]);
  if (res.status !== 0) throw new Error(String(res.stderr));
  return { file: out, sha: crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex') };
}

describe('artifact_args_ok: what the box accepts as its third and fourth arguments', () => {
  const ok = (url, sha) => spawnSync('bash', ['-c', `set -euo pipefail\n${fn('artifact_args_ok')}\nartifact_args_ok`], {
    env: { PATH: '/usr/bin:/bin', ARTIFACT_URL: url, ARTIFACT_SHA256: sha }, encoding: 'utf8',
  }).status;
  const SHA = 'c'.repeat(64);

  test('both none (an old SSM document, or no bucket set)', () => expect(ok('none', 'none')).toBe(0));
  test('a presigned S3 link with a 64-character sha256', () => expect(ok(LINK, SHA)).toBe(0));
  test.each([
    ['a link with no sha256', LINK, 'none'],
    ['a sha256 with no link', 'none', SHA],
    ['a short sha256', LINK, 'c'.repeat(63)],
    ['plain http', LINK.replace('https:', 'http:'), SHA],
    ['a host outside amazonaws.com', LINK.replace('amazonaws.com', 'example.com'), SHA],
    ['a quote', `${LINK}'`, SHA],
    ['a space', `${LINK} x`, SHA],
    ['a dollar sign', `${LINK}$(id)`, SHA],
    ['a backtick', `${LINK}\`id\``, SHA],
    ['a semicolon', `${LINK};id`, SHA],
  ])('refuses %s', (_label, url, sha) => expect(ok(url, sha)).toBe(1));

  test('the script checks them before anything else, and stops with nothing changed', () => {
    expect(SCRIPT_TEXT).toMatch(/^ARTIFACT_URL="\$\{3:-none\}"$/m);
    expect(SCRIPT_TEXT).toMatch(/^ARTIFACT_SHA256="\$\{4:-none\}"$/m);
    const check = SCRIPT_TEXT.indexOf('if ! artifact_args_ok; then');
    expect(check).toBeGreaterThan(0);
    expect(check).toBeLessThan(SCRIPT_TEXT.indexOf('id -un'));
  });
});

describe('phase_deploy with the runner\'s build, against stub git and curl', () => {
  // git: a clean tree at OLD (or at TARGET when STUB_AT_TARGET is set) that fast-forwards.
  const GIT = `#!/usr/bin/env bash
echo "git $*" >>"$HOME/calls"
case "$1" in
  status) exit 0 ;;
  rev-parse) if [ -n "\${STUB_AT_TARGET:-}" ]; then echo "${TARGET}"; else echo "${OLD}"; fi ;;
  merge-base) exit 0 ;;
  merge) exit 0 ;;
  diff) printf 'a.js\\nb.js\\n' ;;
  *) echo "unexpected git $*" >&2; exit 97 ;;
esac
`;
  // curl: copies STUB_PACK to the -o path, or fails as an expired link does.
  const CURL = `#!/usr/bin/env bash
echo "curl $*" >>"$HOME/calls"
[ -n "\${STUB_PACK:-}" ] || exit 22
out=""; while [ $# -gt 0 ]; do if [ "$1" = "-o" ]; then out="$2"; shift; fi; shift; done
cp "$STUB_PACK" "$out"
`;
  const NEVER = (name) => `#!/usr/bin/env bash\necho "${name} $*" >>"$HOME/calls"\nexit 99\n`;

  const deploy = (env) => {
    const bin = stubs({ git: GIT, curl: CURL, npx: NEVER('npx'), timeout: NEVER('timeout'), pgrep: '#!/usr/bin/env bash\nexit 1\n' });
    const app = path.join(tmp, 'app');
    fs.mkdirSync(path.join(app, 'frontend', 'dist'), { recursive: true });
    fs.writeFileSync(path.join(app, 'frontend', 'dist', 'index.html'), 'old build');
    const res = spawnSync('bash', ['-c', [
      'set -euo pipefail',
      ['die', 'redact', 'require_clean_tree', 'build_heap_mb', 'running_vite_builds', 'memory_lines',
        'fetch_artifact', 'install_artifact', 'phase_deploy'].map(fn).join('\n'),
      `PHASE=deploy; TARGET=${TARGET}; BUILD_TIMEOUT_S=1200; MEMINFO=/nonexistent; DEPLOY_MARKER="$HOME/.episode-deploy-unfinished"`,
      `cd "${app}"`,
      'phase_deploy',
    ].join('\n')], { env: { PATH: `${bin}:/usr/bin:/bin`, HOME: tmp, ARTIFACT_URL: LINK, ...env }, encoding: 'utf8' });
    const calls = fs.existsSync(path.join(tmp, 'calls')) ? fs.readFileSync(path.join(tmp, 'calls'), 'utf8') : '';
    const dist = (f) => fs.readFileSync(path.join(app, 'frontend', 'dist', f), 'utf8');
    const backups = fs.readdirSync(tmp).filter((f) => f.startsWith('dist-backup-'));
    const leftovers = fs.readdirSync(tmp).filter((f) => f.startsWith('frontend-dist'));
    return { status: res.status, out: res.stdout, err: res.stderr, calls, dist, backups, leftovers };
  };

  test('a good pack: backed up, fast-forwarded, dist replaced, no build on the box, nothing left behind', () => {
    const p = pack({ 'dist/index.html': 'new build', 'dist/assets/app.js': 'js' });
    const res = deploy({ STUB_PACK: p.file, ARTIFACT_SHA256: p.sha });
    expect(res.err).toBe('');
    expect(res.status).toBe(0);
    expect(res.dist('index.html')).toBe('new build');
    expect(res.dist('assets/app.js')).toBe('js');
    expect(res.backups).toHaveLength(1);
    expect(fs.readFileSync(path.join(tmp, res.backups[0], 'index.html'), 'utf8')).toBe('old build');
    expect(fs.readFileSync(path.join(tmp, '.episode-deploy-unfinished'), 'utf8')).toBe(`${OLD} ${TARGET}\n`);
    expect(res.calls).toContain(`git merge --ff-only --quiet ${TARGET}`);
    expect(res.calls).not.toMatch(/^(npx|timeout) /m);
    expect(res.leftovers).toEqual([]);
    expect(res.out).toContain(`sha256 ${p.sha.slice(0, 12)}… checked.`);
    expect(res.out).toContain(`Frontend from the runner's build of ${TARGET}; no build on the box.`);
    expect(res.out).not.toContain('X-Amz-Signature');
    expect(res.out.trim().split('\n').pop()).toBe('DEPLOY_OK=1');
  });

  test('a box already at the target (a re-run) just puts the pack in place', () => {
    const p = pack({ 'dist/index.html': 'new build' });
    const res = deploy({ STUB_PACK: p.file, ARTIFACT_SHA256: p.sha, STUB_AT_TARGET: '1' });
    expect(res.status).toBe(0);
    expect(res.dist('index.html')).toBe('new build');
    expect(res.backups).toEqual([]);
    expect(res.calls).not.toMatch(/git merge /);
  });

  // Every one of these stops before the backup and the fast-forward.
  const nothingChanged = (res) => {
    expect(res.status).toBe(1);
    expect(res.err).toMatch(/Nothing was changed\./);
    expect(res.out).not.toMatch(/DEPLOY_OK|DEPLOY_BACKUP|Fast-forwarded/);
    expect(res.dist('index.html')).toBe('old build');
    expect(res.backups).toEqual([]);
    expect(res.calls).not.toMatch(/git merge /);
    expect(res.leftovers).toEqual([]);
    expect(fs.existsSync(path.join(tmp, '.episode-deploy-unfinished'))).toBe(false);
  };

  test('a link that cannot be downloaded (expired)', () => {
    const res = deploy({ ARTIFACT_SHA256: 'c'.repeat(64) });
    nothingChanged(res);
    expect(res.err).toMatch(/STOPPED \(deploy\): the frontend artifact could not be downloaded \(the link may have expired\)\./);
  });

  test('a pack whose sha256 is not the one the runner built', () => {
    const p = pack({ 'dist/index.html': 'new build' });
    const res = deploy({ STUB_PACK: p.file, ARTIFACT_SHA256: 'c'.repeat(64) });
    nothingChanged(res);
    expect(res.err).toContain(`the frontend artifact's sha256 is ${p.sha}, not the ${'c'.repeat(64)} the runner built.`);
  });

  test('a file that is not an archive', () => {
    const junk = path.join(tmp, 'junk.tgz');
    fs.writeFileSync(junk, 'not a tarball');
    const sha = crypto.createHash('sha256').update('not a tarball').digest('hex');
    const res = deploy({ STUB_PACK: junk, ARTIFACT_SHA256: sha });
    nothingChanged(res);
    expect(res.err).toMatch(/the frontend artifact is not a readable archive\./);
  });

  test('a pack with anything outside dist/', () => {
    const p = pack({ 'dist/index.html': 'new build', 'evil/run.sh': 'echo' });
    const res = deploy({ STUB_PACK: p.file, ARTIFACT_SHA256: p.sha });
    nothingChanged(res);
    expect(res.err).toMatch(/the frontend artifact holds something other than dist\/\./);
  });

  test('a pack with a .. path', () => {
    const src = path.join(tmp, 'dotdot');
    fs.mkdirSync(path.join(src, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(src, 'dist', 'index.html'), 'x');
    fs.writeFileSync(path.join(src, 'escape'), 'x');
    const out = path.join(tmp, 'dotdot.tgz');
    // -P keeps the .. that tar would otherwise strip from the entry's name.
    expect(spawnSync('tar', ['-C', src, '-P', '-czf', out, 'dist/index.html', 'dist/../escape']).status).toBe(0);
    expect(spawnSync('tar', ['-tzf', out], { encoding: 'utf8' }).stdout).toContain('dist/../escape');
    const sha = crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex');
    const res = deploy({ STUB_PACK: out, ARTIFACT_SHA256: sha });
    nothingChanged(res);
    expect(res.err).toMatch(/the frontend artifact holds something other than dist\/\./);
  });

  test('a pack with no dist/index.html', () => {
    const p = pack({ 'dist/assets/app.js': 'js' });
    const res = deploy({ STUB_PACK: p.file, ARTIFACT_SHA256: p.sha });
    nothingChanged(res);
    expect(res.err).toMatch(/the frontend artifact has no dist\/index\.html\./);
  });

  test('the pack is fetched and checked before the backup and the fast-forward', () => {
    const phase = fn('phase_deploy');
    expect(phase.indexOf('fetch_artifact')).toBeGreaterThan(0);
    expect(phase.indexOf('fetch_artifact')).toBeLessThan(phase.indexOf('cp -a frontend/dist'));
    expect(phase.indexOf('fetch_artifact')).toBeLessThan(phase.indexOf('git merge --ff-only'));
    expect(phase.indexOf('install_artifact')).toBeGreaterThan(phase.indexOf('git merge --ff-only'));
    expect(phase.indexOf('install_artifact')).toBeLessThan(phase.indexOf('npx vite build'));
  });
});

describe('the runner side passes the link as SSM parameters, through a file', () => {
  // aws: records the parameters file's content, then answers as SSM would.
  const AWS = `#!/usr/bin/env bash
case "$2" in
  send-command)
    while [ $# -gt 0 ]; do
      if [ "$1" = "--parameters" ]; then cat "\${2#file://}" >"$HOME/params.json"; fi
      if [ "$1" = "--comment" ]; then echo "$2" >"$HOME/comment"; fi
      shift
    done
    echo cmd-1 ;;
  get-command-invocation)
    case "$*" in
      *Status*) echo Success ;;
      *StandardOutputContent*) echo 'DEPLOY_OK=1' ;;
      *) echo None ;;
    esac ;;
esac
`;
  const run = (phase, env = {}) => {
    const bin = stubs({ aws: AWS, sleep: '#!/usr/bin/env bash\nexit 0\n' });
    const res = spawnSync('bash', [path.join(DEPLOY_DIR, 'ssm-phase.sh'), phase], {
      env: {
        PATH: `${bin}:/usr/bin:/bin`, HOME: tmp, RUNNER_TEMP: tmp,
        EC2_INSTANCE_ID: 'i-0', TARGET_SHA: TARGET, SSM_DOCUMENT: 'PrimeStudios-Deploy', AWS_REGION: 'us-east-1', ...env,
      },
      encoding: 'utf8',
    });
    const params = fs.existsSync(path.join(tmp, 'params.json')) ? JSON.parse(fs.readFileSync(path.join(tmp, 'params.json'), 'utf8')) : null;
    return { status: res.status, out: res.stdout, err: res.stderr, params };
  };
  const SHA = 'd'.repeat(64);

  test('deploy with a link: all four parameters, the link untouched, never printed, the file removed', () => {
    const res = run('deploy', { ARTIFACT_URL: LINK, ARTIFACT_SHA256: SHA });
    expect(res.err).toBe('');
    expect(res.status).toBe(0);
    expect(res.params).toEqual({ phase: ['deploy'], sha: [TARGET], artifact: [LINK], artifact_sha256: [SHA] });
    expect(res.out).not.toContain('X-Amz');
    expect(fs.readFileSync(path.join(tmp, 'comment'), 'utf8')).not.toContain('X-Amz');
    expect(fs.existsSync(path.join(tmp, 'phase-deploy.params.json'))).toBe(false);
  });

  test('deploy without a link, and every other phase: only phase and sha, as the old document takes', () => {
    expect(run('deploy').params).toEqual({ phase: ['deploy'], sha: [TARGET] });
    expect(run('migrate', { ARTIFACT_URL: LINK, ARTIFACT_SHA256: SHA }).params).toEqual({ phase: ['migrate'], sha: [TARGET] });
  });

  test('a link with no sha256 stops before any aws call', () => {
    const res = run('deploy', { ARTIFACT_URL: LINK });
    expect(res.status).not.toBe(0);
    expect(res.params).toBeNull();
  });
});

describe('deploy.yml: the build job and the hand-over', () => {
  const job = (name) => {
    const m = new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [a-z][a-z-]*:\\n|(?![\\s\\S]))`, 'm').exec(WORKFLOW);
    if (!m) throw new Error(`job ${name} not found`);
    return m[1];
  };

  test('the build job runs on the runner with read-only contents and no environment or AWS', () => {
    const build = job('build');
    expect(build).toContain("    if: vars.DEPLOY_ENABLED == 'true' && github.ref == 'refs/heads/main'");
    expect(build).toMatch(/permissions:\n\s+contents: read\n/);
    expect(build).not.toMatch(/environment:|id-token|aws |configure-aws-credentials|secrets\./);
    expect(build).toContain('persist-credentials: false');
    expect(build).toContain('npx vite build');
    expect(build).toContain('tar -C frontend -czf "$RUNNER_TEMP/frontend-dist.tgz" dist');
  });

  test('the deploy job waits for it, and hands the build over only when DEPLOY_ARTIFACT_BUCKET is set', () => {
    const deploy = job('deploy');
    expect(deploy).toContain('    needs: build\n');
    expect(deploy).toContain('    environment: production');
    const fetchAt = deploy.indexOf("- name: Fetch the runner's frontend build");
    const handAt = deploy.indexOf('- name: Hand the frontend build to the box');
    const deployAt = deploy.indexOf('run: bash scripts/deploy/ssm-phase.sh deploy');
    const snapAt = deploy.indexOf('Snapshot');
    expect(fetchAt).toBeGreaterThan(snapAt);
    expect(handAt).toBeGreaterThan(fetchAt);
    expect(deployAt).toBeGreaterThan(handAt);
    const gated = deploy.slice(fetchAt, deployAt).match(/if: vars\.DEPLOY_ARTIFACT_BUCKET != ''/g);
    expect(gated).toHaveLength(2);
  });

  test('the hand-over checks the sha256, keeps to deploy-builds/, and masks the link before saving it', () => {
    const deploy = job('deploy');
    const step = deploy.slice(deploy.indexOf('- name: Hand the frontend build to the box'), deploy.indexOf('run: bash scripts/deploy/ssm-phase.sh deploy'));
    expect(step).toContain('EXPECTED: ${{ needs.build.outputs.sha256 }}');
    expect(step).toContain('key="deploy-builds/${TARGET_SHA}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}.tgz"');
    expect(step).toContain('--expires-in 900');
    expect(step.indexOf('::add-mask::')).toBeGreaterThan(0);
    expect(step.indexOf('::add-mask::')).toBeLessThan(step.indexOf('ARTIFACT_URL=${url}'));
    expect(step.indexOf('"$got" != "$EXPECTED"')).toBeLessThan(step.indexOf('aws s3 cp'));
  });
});

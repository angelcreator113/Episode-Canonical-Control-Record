| **PRIME STUDIOS** **F-DEPLOY-1 FIX-PLANNING DOCUMENT** *Production's request path, confirmed 2026-09-26: the load balancer sends HTTPS to the box's app on port 3000, which serves `frontend/dist`. An additive correction to AE–AQ's "served bundle", and the owed decisions on the plain-HTTP listener.* |
| --- |

**Document version**

v1.56 of the F-Deploy-1 series — successor to v1.55. Basis: `origin/main` at
`ef8be22324ffb3167fc4592d6f467f7ef2136cdd`, measured 2026-09-27.

The F-Stats-1 series has its own `F-Stats-1_Fix_Plan_v1.56.md`. The two are
separate series; this document is F-Deploy-1's v1.56 and neither amends nor
cites the other.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

ATTESTED (§1, §2) + MEASURED (§Basis, §3, §4) + INFERRED where marked (§5(e)).
This revision records production's request path as Evoni read it in the AWS
console and on the box on 2026-09-26, sets the code beside it, relates it to
the register's earlier findings, corrects additively what deploy records AE
to AQ called "the served bundle", and names the decisions it leaves to
Evoni. It rules nothing and mints no FD, XK, or PE. Task #2028.

**Recording rule for this document.** No account number, ARN, certificate id,
load-balancer DNS name, database host, password or user id appears below.
Instance ids and public IPs appear only where `PROJECT_CONTEXT.md` or the
merged register already carries them.

---

# F-Deploy-1 Fix Plan v1.56 — production's request path, confirmed

## §Measured repository basis

The basis SHA above is **MEASURED** from `origin/main`, read by this session's
`/wake-up` before this file existed.

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
ef8be22324ffb3167fc4592d6f467f7ef2136cdd 2026-09-26 docs(audit): file deploy records AR–AW [skip-automerge] (#2027)
$ ls docs/audit | grep -E '^F-Deploy-1_Fix_Plan_v1\.[0-9]+\.md$' | sort -V | tail -2
F-Deploy-1_Fix_Plan_v1.54.md
F-Deploy-1_Fix_Plan_v1.55.md
$ ls docs/audit | grep -E '_Fix_Plan_v1\.56\.md$'
F-Stats-1_Fix_Plan_v1.56.md
```

v1.55 is the newest F-Deploy-1 fix plan; this revision is v1.56, as expected.
The only existing v1.56 is F-Stats-1's.

**Standing for §1 and §2: ATTESTED** (Evoni, 2026-09-26, outside any agent
session): §1 from the AWS console, read only; §2 from her terminal on the
box. An agent session cannot re-derive either.

## §1. The load balancer — ATTESTED (AWS console, read only)

- **One internet-facing application load balancer, `primepisodes-alb`.**
- **HTTPS:443 has five rules:** `/assets/*`, `/api/*`, `/health`,
  `/diagnostics` and the default. All five forward to the target group
  `primepisodes-backend`.
- **`primepisodes-backend`** has one registered target: `episode-backend`
  (`i-02ae7608c531db485`) on **port 3000** (the group's default port is 3002;
  the target overrides it). It is **healthy**. Its health check is HTTP
  `GET /health` on the traffic port, success code 200, healthy after 2 checks,
  unhealthy after 3, every 30 seconds.
- **HTTP:80 forwards to `primepisodes-frontend`** (port 80, health check
  `GET /`). Its two targets, `episode-backend`:80 and `episode-frontend`
  (`i-0005b67a477eb904f`, a separate t3.micro), are **both unhealthy**.
- The account also runs `episode-dev-backend` (`i-016395bb5f7a51a0b`) and two
  stopped instances. None is investigated here.

## §2. The box — ATTESTED (Evoni's terminal)

- `primepisodes.com` resolves to two load-balancer addresses.
  `dev.primepisodes.com` resolves to `54.163.229.144`, the box's address.
- The box's nginx has one server block on 443, for `dev.primepisodes.com`,
  whose `/api` and `/health` proxy to port 3002, where nothing listens. It has
  a `primepisodes.com` block on port 80 only.
- Port 3000 is closed to the internet: a `curl` to it from outside returned
  `000`.
- `https://primepisodes.com/_diag/health` returns 404 with
  `application/json`, from the app (Deploy AR record §0).

## §3. The code beside it — MEASURED at the basis

The app serves the built frontend from `frontend/dist`, and production's
process runs on port 3000:

```
$ grep -n "const frontendDistPath = \|express.static(frontendDistPath\|res.sendFile(indexPath)" src/app.js
1632:const frontendDistPath = path.join(__dirname, '../frontend/dist');
1694:    express.static(frontendDistPath, {
1749:        res.sendFile(indexPath);
$ grep -n "PORT: 3000\|name: '" ecosystem.config.js | head -3
71:      name: 'episode-api-prod-hotfix',
85:        PORT: 3000,
94:        PORT: 3000,
$ grep -n "const PORT = " src/server.js
19:const PORT = process.env.PORT || 3000;
```

`/health` and `/_diag/health` are the app's own routes, and `/_diag/health`
is guarded by the app's loopback check (#2002, Deploy AR):

```
$ grep -n "app.get('/health'\|app.get('/_diag/health'\|function isLocalDiagnosticRequest" src/app.js
297:function isLocalDiagnosticRequest(req) {
360:app.get('/health', async (req, res) => {
370:app.get('/_diag/health', async (req, res) => {
```

So every HTTPS path in §1 (`/assets/*`, `/api/*`, `/health`, `/diagnostics`
and the default) reaches this one Express app on port 3000. The SPA's
`index.html` and assets come from `frontend/dist` (`frontendDistPath`), not
from `/var/www/html`.

## §4. Prior work in the register — MEASURED (cited, not edited)

Two merged documents recorded part of this in June 2026:

```
$ git log --format='%h %ad' --date=short -1 -- docs/audit/F-Deploy-1_Box_Repo_Reconciliation_Session2_Result.md
39517394 2026-06-22
$ git log --format='%h %ad' --date=short -1 -- docs/audit/F-Deploy-1_Frontend_404_Probe_Result.md
839b603d 2026-06-22
```

- **`F-Deploy-1_Box_Repo_Reconciliation_Session2_Result.md` §3:** the 443
  listener's default action went to `primepisodes-backend`, whose single
  target `i-02ae7608c531db485:3000` was healthy (§3). The target group's
  "backend" name fronts production (§3.1). `primepisodes-frontend` had
  **both** targets unhealthy, `i-0005b67a477eb904f:80` and
  `i-02ae7608c531db485:80`, each `Target.ResponseCodeMismatch` with health
  check codes `[404]` (§3.2).
- **`F-Deploy-1_Frontend_404_Probe_Result.md`:** it identified
  `i-0005b67a477eb904f` as `episode-frontend`, a separate t3.micro (§2). On
  that box it measured the cause of the 404: port 80's default server is a
  Certbot redirect shim that answers a request not addressed to
  `dev.primepisodes.com` with `return 404` (§3). For the production box's
  `:80` it wrote only that it "almost certainly" carried the same shim (§3):
  an inference, not a measurement. It also found `dev.primepisodes.com`
  resolving to `54.163.229.144` (§4).

**How this revision's findings relate:**

- **The HTTPS path.** §1 agrees with Session 2 §3 (443 → `primepisodes-backend`
  → `i-02ae7608c531db485:3000`, healthy) and adds the five rules, all to the
  same group, and the health check's settings.
- **`primepisodes-frontend`.** §1 finds both targets still unhealthy, as in
  Session 2 §3.2. For `i-0005b67a477eb904f:80` the probe's measured 404
  stands as the register's cause; it is not re-measured here.
- **The box's own `:80` target.** The probe inferred a 404 for it; §5(e) below
  infers a 301. Neither was measured on the box's `:80` as the load balancer
  sends it, and this revision does not reconcile the two. Session 2 §3.2's
  `[404]` was the load balancer's reading in June. What the load balancer
  reads for that target now was not recorded on 2026-09-26.
- **`dev.primepisodes.com`.** §2 agrees with the probe §4: it still resolves to
  the production box.

## §5. Consequences, recorded

**(a) What reaches production — from §1–§3.** Production is served by the
app from `~/episode-metadata/frontend/dist`; `vite build` is what reaches
production. The rsync of the build into `/var/www/html` reaches
`dev.primepisodes.com` and plain HTTP only.

**(b) Additive correction to deploy records AE through AQ.** Those records
call `/var/www/html` "served" and its backup "the backup of the served
bundle":

```
$ grep -n "served bundle" docs/audit/F-Deploy-1_Deploy_2026-09-2[56]_A[E-Q].md | cut -d: -f1,2
docs/audit/F-Deploy-1_Deploy_2026-09-25_AE.md:206
docs/audit/F-Deploy-1_Deploy_2026-09-25_AF.md:236
docs/audit/F-Deploy-1_Deploy_2026-09-26_AH.md:180
docs/audit/F-Deploy-1_Deploy_2026-09-26_AI.md:192
docs/audit/F-Deploy-1_Deploy_2026-09-26_AJ.md:187
docs/audit/F-Deploy-1_Deploy_2026-09-26_AK.md:273
$ grep -ln "The served \`index.html\`" docs/audit/F-Deploy-1_Deploy_2026-09-2[56]_A[E-Q].md
docs/audit/F-Deploy-1_Deploy_2026-09-26_AM.md
docs/audit/F-Deploy-1_Deploy_2026-09-26_AN.md
```

Read with §5(a): `/var/www/html` served only `dev.primepisodes.com` and plain
HTTP. The `/var/www/html.bak-*` copies those records name (AE to AQ) are
backups of the **previous build**, because the rsync had mirrored
`frontend/dist` into `/var/www/html`. They can still be used to roll back, by
restoring them into `frontend/dist`, not into `/var/www/html`. From Deploy AS
on, the records back up `frontend/dist` itself (AS to AW records, §5.3). No
filed record is edited; this paragraph is the correction.

**(c) `/_diag/health`.** On the HTTPS path, `/_diag/health` is protected by the
app's loopback check alone (§3); nginx is not in the HTTPS path. The code
comment above the route, which relies on nginx never proxying it, describes
the box's nginx, not production's HTTPS path:

```
$ grep -n "nginx never proxies" src/app.js
288:// nginx never proxies (its /api and /health blocks don't match it; the SPA
```

This revision does not edit that comment.

**(d) The load balancer's health check** depends on `GET /health` returning
200 when the app is healthy (§1). Any change to `/health` must keep that.

**(e) INFERRED, not measured:** `primepisodes-frontend`'s target on the
production box fails because port 80's default server on the box answers `/`
with a 301. See §4 for how this sits beside the probe's inference of a 404.

## §6. Owed — Evoni's decisions, not ruled here

1. Whether HTTP:80 should redirect to HTTPS, which would take
   `episode-frontend` out of the request path.
2. What `episode-frontend` and `episode-dev-backend` are for.
3. `dev.primepisodes.com`'s `/api` and `/health` proxy to port 3002, where
   nothing listens.
4. Whether to configure a background-removal provider key (Runway or
   remove.bg) on the box. The Phone Hub's Remove BG route reads only
   `REMOVEBG_API_KEY` and answers 503 without it; #2025 shows that reason in
   the Phone Hub.

   ```
   $ grep -n "REMOVEBG_API_KEY" src/routes/uiOverlayRoutes.js
   351:    if (!process.env.REMOVEBG_API_KEY) {
   352:      return res.status(503).json({ success: false, error: 'Background removal not configured. Set REMOVEBG_API_KEY.' });
   ```

## §7. What this revision does not do

- rules nothing: not §6's decisions, not §5(e);
- amends no filed document: v1.55, the Session 2 result, the Frontend 404
  probe and deploy records AE to AW are cited, not edited; §5(b) is additive;
- edits no other file: `PROJECT_CONTEXT.md` and `DEVELOPMENT_WORKFLOW.md` are
  untouched (the workflow's frontend deploy steps are Task #2029);
- re-enables no workflow and edits no workflow, script or config;
- mints no FD, XK, or PE number;
- records no account number, ARN, certificate id, load-balancer DNS name,
  database host, password or user id.

## §Standing

§1 and §2 are ATTESTED: Evoni's own reading of the AWS console (read only) and
of the box, outside any agent session, recorded as she gave it and never
upgraded. The basis, the code (§3) and the register's prior findings (§4) are
MEASURED from this repository at the basis SHA; every command and its output
is pasted. §5(e) is INFERRED and marked. Nothing is RULED.

No host, AWS, database, or Cognito contact by this session. F-Deploy-1
remains CLOSED (v1.50, v1.52); this revision records the request path and
rules on nothing.

---

**Type:** Attestation (§1, §2) + measured code and register (§3, §4).
**Rules:** nothing. **Mints:** nothing. **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** none.
**Production standing:** Production's freeze is lifted
(`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch hosts,
AWS, RDS or Cognito (`CLAUDE.md`).

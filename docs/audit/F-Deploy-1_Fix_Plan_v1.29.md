# F-Deploy-1 Fix Plan v1.29

**FD-55(b) execution attempt 2026-07-10: Step 0 identity reads run under a two-gate Rule 7 window; the pre-write collision gate tripped — the live `.144` dev app authenticates to `episode-control-dev` as master `postgres`, coupling any dev rotation to a write on the frozen shared box — and the window aborted clean with zero writes fired. Finding FD-56 minted (the coupling is structural). FD-45 rider from v1.28 §3 answered: the disclosed dev-box value matches nothing inspectable. FD-45 gains three further riders (containment handling record + hash-only comparison discipline; parallel-tree credential sharing on `.144`; burned-value ≠ live-master). FD-45 remediation window defined in shape, not scheduled. G2 frontier prerequisite 2 (SG 443/80) reframed as wrong-in-kind and folded into prerequisite 4 as the deploy-ingress mechanism decision.**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.28 (FD-54/FD-55, G2 live-position correction; merged #913, 1d21d13c) |
| **Author start date** | 2026-07-10 |
| **Status** | DRAFT v1.29 |
| **Gate effect** | Advances no gate. Authorizes no prod-box action. Records an aborted execution window (zero writes); mints FD-56; answers and extends FD-45 riders; defines (does not schedule) the FD-45 remediation window and frames (does not ratify) the freeze amendment that window requires; reframes one G2 frontier prerequisite. |

**Basis (live reads 2026-07-10, second working session of the date; zero writes fired anywhere this session):**

- `aws rds describe-db-instances` us-east-1: exactly two instances. `episode-control-dev` (endpoint `episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com`, MasterUsername `postgres`, DBName None, available) and `episode-control-prod` (endpoint `episode-control-prod.csnow208wqtv.us-east-1.rds.amazonaws.com`, MasterUsername `postgres`, DBName None, available). No staging instance exists live.
- On-instance `.144` (SSH, read-only): non-password `DB_*` fields of `/home/ubuntu/episode-metadata/.env` and `/home/ubuntu/episode-metadata-parallel/.env` are IDENTICAL across both trees: `DB_HOST=episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com`, `DB_USER=postgres`, `DB_NAME=episode_metadata`, `DB_PORT=5432`, `DB_SSL=true`. Password lines excluded from the read by pattern.
- On-instance hash comparison (values sha256-hashed on-box; only 12-char prefixes crossed the transcript): dev-box `/home/ubuntu/.env` value = `1589a2b28215`; `.144` `DB_PASSWORD` = `a00adbed4909` (identical in both trees); `.144` `LALAVERSE_EMAIL_PASSWORD` = `bcf3902cef95` (identical in both trees). No match between the dev-box value and any `.144` credential.
- `/home/ubuntu/episode-metadata-deploy/.env` and `/home/ubuntu/episode-eccr/.env` on `.144`: do not exist (No such file or directory).
- GitHub Actions secrets are write-only via API — `DEV_DB_PASSWORD`'s value is not inspectable; comparison against it is impossible by construction.
- Doc reads: Fix Plan v1.28 full body (FD-55 §3 rider text; §4 decision (b); §5 frontier prerequisites); G2 Implementation v1.3 §4.1 SG spec and §9.7 F-Deploy-G1-AE.

## §1 Purpose

Records the FD-55(b) execution attempt of 2026-07-10 — opened under a two-gate Rule 7 window, aborted at the pre-write collision gate with zero writes — and everything the attempt surfaced: FD-56 (dev-rotation/frozen-box structural coupling), the answered FD-45 rider, three new FD-45 riders, the defined shape of the FD-45 remediation window, one G2 frontier prerequisite reframed, and one tooling housekeeping fact. Performs no first-instance reasoning beyond transcription and live verification.

## §2 FD-55(b) execution attempt — record

The v1.28 §4 decision (b) (create `episode-metadata/dev/database`, land the specced pattern) was taken to execution 2026-07-10 as a three-write atomic window: rotate dev DB password → seed the secret with the rotated value → update `DEV_DB_PASSWORD` GitHub secret + dev-box `.env`. Rotation was unconditional — the dev-box value was burned by transcript disclosure (v1.28 §3 rider) regardless of any match result.

**Window structure (two-gate Rule 7):** Gate 1 confirmed Step 0 (identity reads only). Gate 2 (the writes) was never reached. Three amendments were confirmed into the draft at gate 1; Amendment C established the collision gate: *if the rotation target user is the same user the live `.144` dev app authenticates as, the window aborts and re-gates.*

**Step 0 results:** RDS read resolved the rotation form (two instances, both master `postgres` — Write 1 would be `modify-db-instance --master-user-password`). The `.144` consumer read then satisfied the live-identity leg (both trees name `episode-control-dev` directly, no psql needed) — and tripped Amendment C: the live `.144` dev app authenticates to `episode-control-dev` **as master `postgres`**, with a working password (hash `a00adbed4909`) that is presumably the current master password. Rotating it breaks the running dev app; repairing that requires a `.144` `.env` write + PM2 restart — excluded by the freeze posture (v1.20, retained through v1.28).

**Disposition: window aborted clean at the collision gate. Zero writes fired.** The abort was honored rather than overridden by a same-session freeze amendment, on the maintainer's ruling: a `.144` `.env` credential write + PM2 restart is the action signature of the 2026-06-27 AllStopped incident — the event the freeze exists because of. The freeze amends at a ratified gate with its own draft→confirm cycle, not mid-window. The gate tripping and being honored is recorded as the control working, not as a failure of the window.

## §3 FD-56 — dev rotation is structurally coupled to the frozen shared box

**Decision FD-56: the live `.144` (episode-backend) dev app authenticates to `episode-control-dev` as the RDS master user `postgres` (both parallel trees, identical config). Consequently, ANY rotation of the dev database credential — including the FD-55(b) seeding write and the FD-45 burned-value remediation — necessarily breaks the running `.144` dev app and cannot complete without a `.144` `.env` write + PM2 restart, which the freeze posture excludes. The coupling is structural, not incidental to today's window: it persists until either the freeze is amended inside a ratified gate, or G2 §4.5 retires the `.144` dev app and dissolves the coupling from the other side.**

Corollary recorded, not resolved: the dev app running as RDS *master* is itself a least-privilege violation of the same family as F-Deploy-G1-AD/-AE/-AF (filed posture findings). The FD-45 remediation window (§5) is the natural place to decide whether the rotated credential belongs to a new non-master application user rather than to `postgres`. Noted next to the finding because it is the argument that will decide the window: the new-app-user option **dissolves FD-56's coupling structurally** — rotating a dedicated app user's password never touches the master credential, so the dev-box and `.144` apps stop sharing a blast radius. If the window takes that path, its execution revision mints the follow-on FD; this revision pre-empts nothing.

## §4 FD-45 riders

**4.1 — v1.28 §3 rider ANSWERED.** The disclosed dev-box value matches nothing inspectable: it does not match `.144`'s `DB_PASSWORD` (`1589a2b28215` ≠ `a00adbed4909`) nor `LALAVERSE_EMAIL_PASSWORD` (≠ `bcf3902cef95`); GitHub secrets are write-only, so `DEV_DB_PASSWORD` is uninspectable by construction (the planned overwrite in the remediation window retires that residual ambiguity). No canon or `-prod` match exists to escalate on. Rotation remains owed — burned is burned — but at dev-leg priority, not incident priority.

**4.2 — burned-value ≠ live-master.** Since `.144`'s working password is presumably the current `episode-control-dev` master password and the burned value differs from it, the burned value is likely not valid against the dev RDS instance at all. Combined with its host of record carrying no `DB_HOST`/`DB_USER`/`DB_NAME` (v1.28 §3: addresses nothing by itself), it plausibly authenticates to nothing. This collapses the blast-radius case for same-day rotation; it does not retire the rotation obligation.

**4.3 — containment handling record (FD-45-surface event, this date).** The session's first comparison probe captured the raw dev-box credential value into a local shell variable and grepped `.144` prod-adjacent envs with it — a handling error on the FD-45 surface, stopped by the maintainer. The raw value was never echoed: it entered shell memory only and at no point printed to the transcript. Remediation in-session: the capturing terminals were killed (destroying the captured variable, shell state included), and the comparison was re-run hash-only — values sha256-hashed on-box, only 12-char prefixes crossing the transcript. **The hash-only method is recorded here as the reusable discipline for any future credential comparison: raw credential values never enter local shell state or the transcript; comparisons run where the value already rests; only digest prefixes travel.**

**4.4 — parallel-tree credential sharing.** `/home/ubuntu/episode-metadata/.env` and `/home/ubuntu/episode-metadata-parallel/.env` on `.144` carry IDENTICAL `DB_PASSWORD` and `LALAVERSE_EMAIL_PASSWORD` values (hash-verified). Any rotation that updates one tree and not the other leaves a stale live credential in the parallel tree. Canon-scope; folds into the FD-45 tail and is why the remediation window (§5) names both trees explicitly.

## §5 FD-45 remediation window — defined shape, not scheduled

Today's attempt established that the "three-write dev rotation" was never actually three writes. The true atomic unit — the FD-45 tail's dev leg, whole — is:

1. Rotate `episode-control-dev` master password (or create a non-master app user per the §3 corollary, decided at window draft)
2. Update `.144` `.env` in BOTH trees (episode-metadata + episode-metadata-parallel — §4.4)
3. `pm2 restart` the dev app on `.144`
4. Seed `episode-metadata/dev/database` (FD-55(b))
5. Overwrite `DEV_DB_PASSWORD` GitHub secret
6. Rewrite dev-box `/home/ubuntu/.env`
7. Verify: app reconnects; secret readable from the dev box per the IAM inline-policy ARN check (FD-55 recorded the permission pointing at a then-nonexistent resource — mismatch after creation = flagged follow-up IAM write)

Steps 2–3 require a freeze amendment. This revision frames that amendment and does NOT ratify it — ratification is itself a step inside the window's own draft→confirm cycle, taken when the window is executed, with brief dev downtime accepted deliberately at that confirm. This window is defined here and NOT scheduled; it is the FD-45 remediation window and closes FD-56 (and executes FD-55(b)) when it runs. Amendments carried forward from today's aborted draft: per-char password generation with replacement; temp-file secret-string (no stdin file:// on Windows awscli); hash-only verification per §4.3.

## §6 G2 frontier prerequisite reframe — deploy-ingress mechanism

v1.28 §5 prerequisite 2 ("SG 443/80 runner-ingress rules added") is reframed as **wrong-in-kind**: `deploy-dev.yml` deploys over SSH (port 22), not HTTPS-to-the-box; G2 §4.1's "Inbound HTTPS (443): GitHub Actions runner egress range" spec line does not describe the deploy path. The real decision owed is the deploy-ingress *mechanism*: GitHub-runner IP ranges on port 22 (broad, churny allow-list — the F-Deploy-G1-AE antipattern re-approached) versus SSM-based zero-inbound access (lean; no new ingress at all). First-look lean: SSM. The decision folds into prerequisite 4 (the `deploy-dev.yml` review against its AllStopped failure mode) — one review, one mechanism decision, minting its own FD when taken. Prerequisite 2 is struck as a standalone item; the v1.28 §5 frontier is otherwise unchanged.

## §7 Housekeeping — PowerShell→ssh quote-stripping

The recurring "multi-file grep against `.144` hangs" (two killed terminals this session, prior occurrences on this date's first session) is diagnosed and closed as local tooling, not box behavior: PowerShell 5.1's native-argument passing to OpenSSH strips inner double-quotes even inside single-quoted outer strings, so remote bash receives quoteless commands — an unquoted regex becomes a syntax error; a quoteless multi-file grep becomes a single-file grep blocking on stdin, indefinitely. Discipline: remote commands quote-free (chained simple greps) or shipped as temp scripts. Recorded so future sessions do not re-derive it or misattribute hangs to `.144`.

## §8 Retained

- Fix Plan v1.28 in full: FD-54/FD-55, §4 retroactive gate disposition and decision (b), §5 frontier — with prerequisite 2 reframed per §6 above.
- G2 Implementation v1.3 as G2 contract, per v1.28's carriage; additionally §4.1's 443/80 ingress spec line noted wrong-in-kind per §6 (resolution owed at the prerequisite-4 review, not edited here).
- Freeze posture for prod actions outside ratified gates: unchanged (v1.20, verbatim). This revision records that the freeze was tested live this date and held (§2).
- FD-45: OPEN (tail), minted v1.18; gains riders §4.1–§4.4, not a state change. The v1.28 §3 rider question is answered, not the finding closed.
- FD-55: decision (b) stands; execution attempt recorded (§2); execution re-homed to the FD-45 remediation window (§5).

## §9 Register hygiene

- Register tail at v1.29 open: FD-55 (v1.28). Minted here: FD-56. Tail at close: FD-56.
- FD numbers minted only by Fix Plan revisions — conforms.
- Closes no findings. FD-45 gains four riders; FD-55 gains an execution-attempt record; FD-56 opens.
- Zero writes fired this session: no AWS write, no GitHub secret write, no box write, no canon contact beyond the read-only inspections in the basis. Credential containment: only sha256 12-char prefixes appear in this document and in the transcript, per the §4.3 discipline.
- Doc-only revision.
- FD-21 closing-keyword check on the commit message before commit (PR references herein — #913 — are historical; no close/fix/resolve adjacent forms).
- Ships with `[skip-automerge]`, PR body via `--body-file`.

---

*End of F-Deploy-1 Fix Plan v1.29 (draft).*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-10.*
*Predecessor: v1.28 (1d21d13c, #913).*
*Closed: none. Minted: FD-56. Advances no gate; authorizes no prod-box action; schedules nothing. [skip-automerge]*

| **PRIME STUDIOS** **F-DEPLOY-1 FIX-PLANNING DOCUMENT** *Three production-box directories retired (Evoni ruling); deletion owed to Evoni.* |
| --- |

**Document version**

v1.54 — successor to v1.53. Basis: `origin/main` at
`baa69a2d945d88c41b745320509aca97e82e52ba`, measured 2026-09-26.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RULED (§1) + MEASURED (§3, §5) + ATTESTED (§4). This revision records
Evoni's ruling retiring three directories under `/home/ubuntu` on the
production box, the register's own citations of each, and the facts the
ruling rests on. It performs no deletion and no code change. Mints no FD,
XK, or PE. Task #1969.

---

# F-Deploy-1 Fix Plan v1.54 — retire three production-box directories

## §Measured repository basis

The basis SHA above is **MEASURED** from `origin/main`, read by this
session's `/wake-up` before this file existed.

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
baa69a2d945d88c41b745320509aca97e82e52ba 2026-09-26 fix(phone): Preview Phone shows the episode's screens, overrides included [skip-automerge] (#1966)
$ ls docs/audit | grep -E '^F-Deploy-1_Fix_Plan_v1\.[0-9]+\.md$' | sort -V | tail -2
F-Deploy-1_Fix_Plan_v1.52.md
F-Deploy-1_Fix_Plan_v1.53.md
```

v1.53 is the newest existing fix plan; this revision is v1.54, as expected.

## §1. Ruling — Evoni

**Standing: RULED.** Evoni's words, verbatim, as given for this revision
(2026-09-26):

> Retire episode-metadata-parallel, episode-nodemodules-staging-20260625 and episode-metadata-deploy; I'll delete them from the box myself.

**Scope, exactly three paths on the production box (`episode-backend`):**

1. `/home/ubuntu/episode-metadata-parallel`
2. `/home/ubuntu/episode-nodemodules-staging-20260625`
3. `/home/ubuntu/episode-metadata-deploy`

`/home/ubuntu/episode-metadata`, the tree production runs from (§4), is not
in scope.

**Effect:** the three directories are retired. Deleting them is Evoni's own
action on the box, taken personally after this revision merges; no agent
session performs it (`CLAUDE.md`). This revision does not record the
deletion as done (§6).

**Discharges a carried item.** "`/home/ubuntu/episode-metadata-parallel/`
directory + its ecosystem.config.js — quarantine residue; removal decision
pending" was carried from `F-Deploy-1_Fix_Plan_v1.19.md` (line 97) through
v1.20 (line 38) and v1.21 (line 80). §3(b) finds no later revision that
decided it. This ruling is that decision.

## §2. Why now (context, not a finding)

Evoni's 2026-09-26 disk work on the box left the root filesystem at 82%
used after cache cleanup (§4). The three directories together hold about
1.15 GB (§4). None of them is the working tree of any
running process (§4).

## §3. Register citations — MEASURED, repo only

### §3(a) Every file that names each directory

```
$ git grep -l 'episode-metadata-parallel' | wc -l
13
$ git grep -l 'episode-metadata-parallel'
docs/audit/Audit_Handoff_Delta_2026-07-04_id3_Window.md
docs/audit/Audit_Handoff_Delta_2026-07-05_pm2_realign.md
docs/audit/Audit_Handoff_Delta_2026-07-06_FD38_save.md
docs/audit/F-Deploy-1_Fix_Plan_v1.19.md
docs/audit/F-Deploy-1_Fix_Plan_v1.19_NOTES.md
docs/audit/F-Deploy-1_Fix_Plan_v1.20.md
docs/audit/F-Deploy-1_Fix_Plan_v1.21.md
docs/audit/F-Deploy-1_Fix_Plan_v1.29.md
docs/audit/F-Deploy-1_Fix_Plan_v1.33.md
docs/audit/F-Deploy-1_Fix_Plan_v1.47.md
docs/audit/F-Deploy-1_PMState_AllStopped_CauseInvestigation_2026-06-30.md
docs/audit/F-Deploy-1_Phase2A_ParallelTree_ConstructionSpec_2026-06-27_DRAFT.md
docs/audit/F-Deploy-1_ThirdParty_Credential_Rotation_Order_2026-06-30_DRAFT.md

$ git grep -l 'episode-nodemodules-staging-20260625' | wc -l
3
$ git grep -l 'episode-nodemodules-staging-20260625'
docs/audit/F-Deploy-1_2026-06-26_Sec5_ReVerify_Evidence.md
docs/audit/F-Deploy-1_Phase2A-Step3_Complete_Handoff_2026-06-25.md
docs/audit/F-Deploy-1_Phase2A_ParallelTree_ConstructionSpec_2026-06-27_DRAFT.md

$ git grep -l 'episode-metadata-deploy' | wc -l
5
$ git grep -l 'episode-metadata-deploy'
.github/scripts/deploy-production.sh
.github/workflows/deploy-production.yml
docs/audit/F-Deploy-1_Fix_Plan_v1.29.md
docs/audit/F-Deploy-1_Fix_Plan_v1.34.md
docs/audit/F-Deploy-1_Phase2A_ParallelTree_ConstructionSpec_2026-06-27_DRAFT.md
```

Of these, the register records `episode-metadata-deploy` as holding no
`.env` (`F-Deploy-1_Fix_Plan_v1.29.md` line 17; v1.34 line 30, "inspected, no
.env, EXCLUDED"). It records `episode-metadata-parallel` as holding its own
`.env` with the same credential values as the live tree's
(`F-Deploy-1_Fix_Plan_v1.29.md` §4.4, line 49), and an inert
`ecosystem.config.js` of 2026-06-23 (`F-Deploy-1_Fix_Plan_v1.47.md` line 70).
Neither value is restated here.

### §3(b) No earlier filed document rules their retirement

Every line naming a directory alongside retirement language:

```
$ git grep -n -i -E 'episode-metadata-parallel.*(retir|remov|delet|decommission)|(retir|remov|delet|decommission).*episode-metadata-parallel'
docs/audit/F-Deploy-1_Fix_Plan_v1.20.md:38:2. /home/ubuntu/episode-metadata-parallel/ residue — removal decision
docs/audit/F-Deploy-1_Fix_Plan_v1.21.md:80:4. /home/ubuntu/episode-metadata-parallel/ residue — removal
$ git grep -n -i -E 'episode-nodemodules-staging-20260625.*(retir|remov|delet|decommission)|(retir|remov|delet|decommission).*episode-nodemodules-staging-20260625'
docs/audit/F-Deploy-1_Phase2A_ParallelTree_ConstructionSpec_2026-06-27_DRAFT.md:184:removes the entire box-side footprint of P1–P4. The staging source (`episode-nodemodules-staging-20260625/`)
$ git grep -n -i -E 'episode-metadata-deploy.*(retir|remov|delet|decommission)|(retir|remov|delet|decommission).*episode-metadata-deploy'
(no output)
```

Read in context:

- **v1.20:38 and v1.21:80** carry `episode-metadata-parallel` as "removal
  decision pending" (v1.19:97 first names it, with its
  `ecosystem.config.js`, as "quarantine residue"). They owe a decision; they
  do not make one. No later fix plan names the directory with a disposition:
  `episode-metadata-parallel` next appears in v1.29 and v1.33 (credential
  rotation must update the `.env` in both trees) and v1.47 (the inert
  manifest), none of which decides removal.
- **The Phase 2A construction spec, line 184** is a `_DRAFT`. It describes
  `rm -rf /home/ubuntu/episode-metadata-parallel/` as the abort path for that
  construction and says the staging source "remains intact until P6". It
  rules nothing.
- **`episode-metadata-deploy`:** no line pairs it with retirement language.

So no filed document before this one rules the retirement of any of the three.

## §4. Box facts — ATTESTED (Evoni, 2026-09-26, outside any agent session)

**Standing: ATTESTED.** From Evoni's own reads on the box:

- `pm2 describe 13` and `pm2 describe 1` (the API and the stopped worker)
  both show their script path and exec cwd under `/home/ubuntu/episode-metadata`.
  No process runs from any of the three directories in §1.
- Sizes (`du -xh`): `episode-metadata-parallel` 576M,
  `episode-nodemodules-staging-20260625` 525M, `episode-metadata-deploy` 49M.
- Disk: 82% used, 1.4G available on `/` after cache cleanup (npm cache,
  `~/.cache/node-gyp`, a journal vacuum of 72M).

Not re-derived here; an agent session cannot read the box.

## §5. `episode-metadata-deploy` and the Deploy to Production workflow — MEASURED

The Deploy to Production workflow is `disabled_manually`
(`PROJECT_CONTEXT.md` §0 item 8, which records it as measured via the
GitHub API; carried, not re-measured here). Its script and workflow are the
only two non-register files that name the directory (§3(a)).

```
$ sed -n 54p .github/scripts/deploy-production.sh
  rm -rf /home/ubuntu/episode-metadata-deploy/* 2>/dev/null || true
$ sed -n 353p .github/workflows/deploy-production.yml
              mkdir -p /home/ubuntu/episode-metadata
$ sed -n 371,372p .github/workflows/deploy-production.yml
          scp -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no -o ServerAliveInterval=60 -o ServerAliveCountMax=120 -o ConnectTimeout=10 \
            -r deploy/* $EC2_USER@${{ secrets.EC2_HOST }}:/home/ubuntu/episode-metadata-deploy/
$ grep -n "mkdir" .github/workflows/deploy-production.yml
141:          mkdir -p deploy
204:          mkdir -p ~/.ssh
314:          mkdir -p ~/.ssh
353:              mkdir -p /home/ubuntu/episode-metadata
```

Neither the workflow nor the script creates `episode-metadata-deploy`: the
workflow's only `mkdir` on the box (line 353) makes
`/home/ubuntu/episode-metadata`; lines 371–372 copy into
`episode-metadata-deploy/`; `deploy-production.sh:54` empties it. So, once the
directory is deleted, a re-enabled workflow would fail at that copy unless the
directory is recreated first (**INFERRED**: `scp` with several sources needs
an existing target directory; not measured). Recreating the directory, or
changing that copy step, becomes a prerequisite of any future re-enablement.
This revision re-enables nothing and rules nothing about the workflow.

## §6. Owed after merge — named, not performed

1. **Evoni deletes the three directories** in §1 and attests it, with
   `df -h /` before and after, in her next deploy record or a v1.55 note.
   Until then they remain on the box.
2. **Deleting `episode-metadata-parallel` also deletes the `.env` copy** that
   v1.29 §4.4 records there. Any credential rotation that v1.29/v1.33 require
   to update "BOTH trees" then has one tree to update. This is recorded as a
   consequence, not ruled.

## §7. What this revision does not do

- performs no deletion and records none as done;
- amends no filed document — v1.19–v1.21, v1.29, v1.33, v1.34, v1.47, the
  Phase 2A spec and every other document in §3(a) are cited, not edited;
- re-enables no workflow and edits no workflow or script;
- edits no other file — `PROJECT_CONTEXT.md` is untouched;
- mints no FD, XK, or PE number;
- rules nothing beyond §1's three paths.

## §Standing

§1 is RULED (Evoni's own words, quoted verbatim). §4 is ATTESTED (Evoni's own
reads on the box, outside any agent session). §3 and §5 are MEASURED — every
command and its raw output is pasted above, derived from this repository
only, at the basis SHA on this document's face; §5's one INFERRED statement
is marked. §2, §6 and §7 state context, consequence and scope, standing on
§1, §3, §4 and §5.

No host, AWS, database, or Cognito contact. F-Deploy-1 remains CLOSED (v1.50,
v1.52); this revision rules on the three directories only, not on the
keystone.

---

**Type:** Ruling (§1) + register citations (§3) + attestation (§4) + measured
workflow facts (§5).
**Rules:** the retirement of the three directories in §1 only. **Mints:**
nothing.
**Host/AWS/DB/Cognito contact (this session):** none. The deletion remains
Evoni's own action, not performed here.
**Production standing:** Production's freeze is lifted
(`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch hosts,
AWS, RDS or Cognito (`CLAUDE.md`).

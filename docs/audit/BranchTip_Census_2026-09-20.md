| **PRIME STUDIOS** **BRANCH TIP CENSUS** *A live re-count of `claude/**` branch tips against the `[skip-automerge]` opt-out token, superseding Amd26 §AB3's figure as a count.* |
| --- |

**Document version**

New record, not a Fix Plan revision, not an amendment to any filed document.
Basis: `origin/main` at `e55917089ade51f63da3ed3cf9830c8bb282741e`, measured
2026-09-20.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

CENSUS. Every figure below is **MEASURED**, and every MEASURED figure in
this document carries the same basis caveat: a **GitHub API** read, not a
`git show`/`diff` against a clone. Task #1581. This document rules
nothing, mints no FD/XK/PE number, closes nothing, amends no filed
document, and deletes no branch. See §7.

---

## §1. Method and standing note

Two instruments were used, both against the GitHub API for
`angelcreator113/Episode-Canonical-Control-Record`, not against this
container's local clone:

1. **Branch enumeration** — `list_branches`, paginated, `perPage: 100`.
2. **Tip commit subjects** — `list_commits` with `sha: <branch tip SHA>`,
   `perPage: 1`, for every branch matching `^claude/`, reading the first
   line of `commit.message`.

**Standing note, matching `Prime_Studios_Audit_Handoff_v26.md` Sec 3.2's own
language for its Actions-API reads:** both instruments above are API calls,
not `git show` against the cloned repository. **They are MEASURED, but on a
different basis than a `git`-only claim**: a reader holding only a clone of
`origin/main` cannot reproduce them without also holding API access to this
repository (or an equivalent, e.g. an authenticated `gh` CLI). Repo-external,
re-checkable by anyone with that access, **not by clone alone.** This
document does not call itself ATTESTED anywhere — ATTESTED in this
register's vocabulary means a session-only account of a host action no
repository or API read can check; nothing here is that. Every figure below
is checkable by the stated command against the stated API, by anyone with
access to it.

A third, narrower read (§6) — the workflow YAML's trigger block — **is**
reproducible from a clone (`git show origin/main:<path>`) and is marked
separately, on that basis, following the same clone-vs-API separation Amd26
§AB3 itself drew between §AB3.1–§AB3.3 (repo-read) and §AB3.4 (API-only,
declined).

---

## §2. Total branch count

```
list_branches(owner="angelcreator113", repo="Episode-Canonical-Control-Record", page=1, perPage=100) → 100 branches
list_branches(owner="angelcreator113", repo="Episode-Canonical-Control-Record", page=2, perPage=100) → 100 branches
list_branches(owner="angelcreator113", repo="Episode-Canonical-Control-Record", page=3, perPage=100) → 100 branches
list_branches(owner="angelcreator113", repo="Episode-Canonical-Control-Record", page=4, perPage=100) →  10 branches
```

Page 4 returned fewer than `perPage` (10 < 100), which is how pagination end
is detected for this endpoint — there is no page 5. **Total: 310 branches**
(100 + 100 + 100 + 10), `main` and `dev` included in that count.

Concatenating all four pages and filtering on the regular expression
`^claude/` (`jq '[.[] | select(.name | test("^claude/"))] | length'` over
the concatenated JSON):

```
$ jq -s 'add' page1.json page2.json page3.json page4.json | jq 'length'
310
$ jq -s 'add' page1.json page2.json page3.json page4.json | jq '[.[] | select(.name | test("^claude/"))] | length'
232
```

**232 branches match `^claude/`.** Each carries a `sha` field in the same
`list_branches` response — that `sha` is the branch tip, read at the same
moment as the count, not a separate lookup.

---

## §3. Tip commit subjects — the `[skip-automerge]` check

For each of the 232 `claude/**` tips, `list_commits(sha=<tip sha>, perPage=1,
fields=["sha","commit"])` was called and the first line of the returned
`commit.message` was checked for the **exact literal substring**
`[skip-automerge]` (case-sensitive, brackets included — the token elsewhere
in the commit *body*, or the bare word `skip-automerge` without brackets,
does not count; both cases occur in this population and are recorded
according to that rule, not by a keyword skim).

```
$ for each of the 232 rows in (branch, sha):
    list_commits(owner="angelcreator113", repo="Episode-Canonical-Control-Record",
                  sha=<sha>, perPage=1, fields=["sha","commit"])
  → take commit.message.split("\n")[0] as the subject
  → subject contains literal "[skip-automerge]" ? YES : NO

Rows processed: 232 (232 requested, 232 returned, 0 errors)
  Subject carries [skip-automerge] literally:      179
  Subject does NOT carry [skip-automerge]:           53
```

Independently re-derived from the recorded per-branch results (not just
trusted as a running count):

```
$ tail -n +2 claude_tip_subjects.tsv | wc -l
232
$ tail -n +2 claude_tip_subjects.tsv | cut -f1 | sort -u | wc -l
232
$ diff <(tail -n +2 claude_tip_subjects.tsv | cut -f1,2 | sort) <(sort claude_branches.tsv)
(no output — identical branch+sha sets, confirming no row was dropped, added, or mismatched against §2's own enumeration)
$ awk -F'\t' 'NR>1{c[$3]++} END{for (k in c) print k, c[k]}' claude_tip_subjects.tsv
YES 179
NO 53
```

Two branches, `claude/session-pe-roster` and `claude/session-pe-roster-backup`,
share one tip SHA (`e89ec70c9bc4...`) — both are counted, once each, as the
232-branch population is a population of refs, not of distinct commits; this
matches how `list_branches` itself enumerates them (two names, two rows).

Three sample reads, performed directly in this session (not only by the
instrument above) to check the instrument's own output before trusting the
count, are recorded in full for traceability:

```
$ list_commits(sha="0d899c5ac13a668daba645d6fbcdd6d8b0637585", perPage=1)
  commit.message (first line): "Add F-Deploy-G1-AJ monitoring plan v0.1 (ELB 5xx
  alarm -> dedicated SNS topic; TG-port mismatch flagged for Track B)"
  → no literal "[skip-automerge]" → NO. Matches claude/aj-monitoring-plan's
  recorded row.

$ list_commits(sha="a7a33a13ff00911d1fd99072b197d62f3a07b6d6", perPage=1)
  commit.message (first line): "docs(audit): commit item 8 route-finding draft
  and its correction handoff"
  → no literal "[skip-automerge]" → NO. Matches claude/sg-identity-reconciliation-e316y1's
  recorded row — the same branch Amd26 §AB3.3 named as "newest uncovered
  tip" at its own 2026-09-03 basis. Still uncovered at this basis, same tip
  SHA (branch not pushed to since).
```

### §3.1 Full per-branch result (232 rows)

`branch` — `tip sha (first 12 hex)` — `[skip-automerge]` literally present
in the tip subject:

```
claude/adoring-maxwell-jholmw                              2c25e7c1a641  YES
claude/aj-monitoring-plan                                  0d899c5ac13a  NO
claude/audit-handoff-v12                                   5d3f0b82225c  NO
claude/authorship-record-finding                           dee9f9af2476  NO
claude/aws-list-groups                                     ea013e66b033  YES
claude/branch-a-costing                                    03a7d5946016  YES
claude/branch-a-selection-record                           b54faf8c5951  YES
claude/check-cannot-fail-class                              a1f15e65f25b  YES
claude/cloud-credential-scope-laptop-contrast              ca7b588bf132  NO
claude/cloud-credential-scope-second-occurrence            bd9110ae603a  YES
claude/debug-erase-replicate-dOl4S                         fd660659911f  NO
claude/dim3-token-acquisition                              fb3de79fc989  YES
claude/epic-ramanujan-q6zf9n                               332a48ef6236  NO
claude/evidence-note-dev-dns                               a9fd3d5093fd  YES
claude/f-auth-1-authority-table-8cfoc0                     b8ff93a6d474  YES
claude/f-auth-1-backup                                     c3c5dbb42e0f  NO
claude/f-auth-1-backup-2026-05-02                          db717d3599ff  NO
claude/f-auth-1-fauth5                                     b321cb7426fc  NO
claude/f-auth-1-fd66-correction                            f2dcf79c98a7  NO
claude/f-auth-1-fd66-mint                                  62db1adc81de  NO
claude/f-auth-1-fix-plan-v2-75                             854c2bd1f1c4  YES
claude/f-auth-1-g3-clause3                                 16c47a5f7421  NO
claude/f-auth-1-group-case-fix                             b95b908b07a5  NO
claude/f-auth-1-group-case-mismatch-measured               c13c1d8e9cf4  YES
claude/f-auth-1-session-conduct-finding                    d54b2299725c  YES
claude/f-auth-1-v2.54                                      9c2a95748f20  NO
claude/f-deploy-1-a-1-opt-out-token                        0195a2f4f300  NO
claude/f-deploy-1-fix-plan-v1-29                           b0dc007b8d6d  YES
claude/f-deploy-1-fix-plan-v1-39                           37cc036c44b9  YES
claude/f-deploy-1-fix-plan-v1-47                           295058b52259  YES
claude/f-deploy-1-fix-plan-v1-48                           44e6a385888c  YES
claude/f-deploy-1-fix-plan-v1-8                            a4109fdec6d2  NO
claude/f-deploy-1-phase-b-g2-ecosystem-config-retire-dev   018a1de72624  NO
claude/f-deploy-1-phase2a-construction-spec-2026-06-27     3200a5172ee3  NO
claude/f-deploy-1-session-handoff-2026-06-27               8083e63f2e45  YES
claude/f-stats-1-backup                                    6ad6fbc32a27  NO
claude/f-stats-1-phase-b-g1-planning                       1112f463a0cf  NO
claude/f-stats-1-phase-b-g1-planning-backup                ecbb731cf210  NO
claude/f-stats-1-v1.58                                     e126a93c1345  YES
claude/f-stats-1-v1.59                                     4845ba6f8656  YES
claude/f-stats-1-v1.60                                     fa578ee9f77f  YES
claude/fd31-preflight-v1-1                                 f3d3486a0d26  YES
claude/fd31-preflight-v1-2                                 64a1f7e5c4a6  YES
claude/fd31-preflight-v1-3                                 cabf8df6df6b  NO
claude/fd31-preflight-v1-4                                 0296103aa021  NO
claude/fd31-preservation-artifact                          f92a54db2b3e  NO
claude/fd31-reconciliation-preflight                       469ef6c9ad8f  YES
claude/fd65-comment-migration-trees                        70fde3970b1d  NO
claude/fd65-conditional-secret-hash                        58708a77b3da  NO
claude/fd65-v273-reopen-issuance                           5bdc1c2e81ea  YES
claude/fd66-b5-correction                                  fbaf1cea41ae  NO
claude/fd67-branch-ruling                                  9f333cbd034a  NO
claude/fd67-option1-implementation                         2771568a13fe  YES
claude/fix-asset-role-key                                  a87fe2522f4a  YES
claude/fix-asset-role-service                              651b311a9935  YES
claude/fix-responsive-design-X8iww                         cddef9db16da  NO
claude/fix-segment-api-error-EjtNv                         c4e82a467b5d  NO
claude/fix-worldadmin-truncation                           467d5c488c5a  NO
claude/frontend-ia-audit-findings                          6e7f7f8bddde  NO
claude/git-forensic-audit-v25-v9etvc                       ce5c28c92c1a  YES
claude/git-head-origin-main-i9yqsn                         e47bf25d9d58  YES
claude/gitignore-frontend-dist                             76f1ae221004  NO
claude/incident-2026-06-01-prod-502                        6eaa82b307e3  NO
claude/issue-1188-wake-up-sort-fix                         a45585cdf349  YES
claude/issue-1198-retire-deploy-prompts                    b9173c2e6544  YES
claude/issue-1199-limb1-exceptions                         3237b3051e44  NO
claude/issue-1200-handoff-v26                              9f21f87b3e75  YES
claude/issue-1208-v269-scaffold                            35e01dcbb063  YES
claude/issue-1210-land-v269                                5875144c9889  YES
claude/issue-1212-v269-provenance-banner                   34de209b68b4  YES
claude/issue-1214-context-refresh-v269                     03ba01e795bd  YES
claude/issue-1216-amd28-ad3-banner                         49f415fa08a7  YES
claude/issue-1218-cp2-itemize                              19b33dfc9acb  YES
claude/issue-1220-redact-staging-literal                   eb280d24f887  YES
claude/issue-1222-context-refresh-three                    abcf1b4a3165  YES
claude/issue-1223-fix-redaction-residual                   e3e43148f2f3  YES
claude/issue-1226-cp3-itemize                              9ec6697d0ac1  YES
claude/issue-1228-context-refresh-cp3                      b8f0ece75136  YES
claude/issue-1230-cp12-itemize                             8f7ff697e069  YES
claude/issue-1232-cp12-inference-banner                    f029b24388fa  YES
claude/issue-1234-project-context-cp12-refresh             18db6f1e8349  YES
claude/issue-1236-v270-delta-ruling                        d6cc9b1599d2  YES
claude/issue-1238-project-context-v270-refresh             5f3ec5438fed  YES
claude/issue-1240-models-subset-enumeration                afde40e44890  YES
claude/issue-1242-project-context-models-refresh           b6c84a73f1d2  YES
claude/issue-1244-unwired-models-history                   c259e134f55a  YES
claude/issue-1246-unwired-history-migration-banner         28416be929c0  YES
claude/issue-1248-project-context-unwired-refresh          ff4dd821f1d1  YES
claude/issue-1250-v271-unwired-models-ruling               574d74d48c83  YES
claude/issue-1252-project-context-v271-refresh             d51287728f01  YES
claude/issue-1257-pe65-cutover-gap                         fa953f36dbcc  YES
claude/issue-1259-xk2-extent-census                        ce93fa11abbf  YES
claude/issue-1260-test-hygiene-ports                       aa3080a5a3f9  YES
claude/issue-1261-retire-stale-scaffolds                   47a3fb07a189  YES
claude/issue-1262-local-login-procedure                    0503326ab823  YES
claude/issue-1264-tier5-token-carrier-ruling               f0a6fc2ea336  YES
claude/issue-1266-tier5-token-carrier                      0dbea7f1246b  YES
claude/issue-1268-carrier-redirect-race                    b2b28360c7ed  YES
claude/issue-1270-local-dev-login-amendment                c56e92855074  YES
claude/issue-1276-test-db-gate                             a09e9c689adb  YES
claude/issue-1289-template-studio-census                   c2d9a4b17160  YES
claude/issue-1292-g3-clause3-db-skip                       4cf9531ff318  YES
claude/issue-1308-project-context-refresh                  cd40ac3b90fa  YES
claude/issue-1313-db-skip-guards                           6f410dbc7ab5  YES
claude/issue-1317-wakeup-amd-numeric-sort                  1cbf7675c37f  YES
claude/issue-1319-concurrent-branch-write                  f7b5964a12e4  YES
claude/issue-1321-branch-write-record                      484063eb82ac  YES
claude/issue-1323-refresh-context-6-5                      1bc0967d4ff8  YES
claude/issue-1325-pr-template-validation                   555cf88b3e1c  YES
claude/issue-1327-dispatch-record                          fd224e14294b  YES
claude/issue-1329-refresh-context-1326-1328                ae0ff5bd91f7  YES
claude/issue-1331-fstats1-scoping                          17a5b6399823  YES
claude/issue-1333-storytellermemory-references             946d48d8f45c  YES
claude/issue-1335-refresh-context-fstats1                  a2e149ef6e44  YES
claude/issue-1337-shape-mint-briefing                      620391881660  YES
claude/issue-1339-refresh-context-1338                     38b871fb6ced  YES
claude/issue-1343-task-branch-contract                     40c7ff5b8339  YES
claude/issue-1345-refresh-context-1342-1344                4f51027ba87c  YES
claude/issue-1348-prepush-untracked-root                   6b1044790da8  YES
claude/issue-1350-worldstudio-transactionality             a07fa4a49c74  YES
claude/issue-1352-refresh-context-6-5                      7ae6042535d6  YES
claude/issue-1353-refresh-context-6-5                      4c393edbea9a  YES
claude/issue-1356-jest-collection                          775d2c80fb53  YES
claude/issue-1358-ci-local-divergence                      23e1aa73a91d  YES
claude/issue-1360-refresh-context-1357-1359                2d908c530b7c  YES
claude/issue-1362-d3d5-read-plan                           b0a6624a083a  YES
claude/issue-1364-refresh-project-context-d3d5             cfda0f5a5a7c  YES
claude/issue-1366-dedupe-sec65-mixed-row                   b97c7250f049  YES
claude/issue-1368-fstats1-pe62-locate                      b0e8aaba9c2b  YES
claude/issue-1370-context-refresh-pe62                     961454f102cc  YES
claude/issue-1372-refresh-context-s10                      71191f788158  YES
claude/issue-1374-prompt-row-count                         71fd7b913be2  YES
claude/issue-1378-eslint-slice-2                           461a6cbcff6c  YES
claude/issue-1380-context-refresh-eslint                   e799daa3310c  YES
claude/issue-1382-v272-ruling-prep                         98281bffc39a  YES
claude/issue-1384-v272-fix-plan                            fcef820a2336  YES
claude/issue-1387-v272-banner                              e7d3442088fc  YES
claude/issue-1389-session-conduct                          d60152550b2e  YES
claude/issue-1391-v272-retract-banner                      1f75262cbd96  YES
claude/issue-1393-conduct-banner                           85c615840133  YES
claude/issue-1395-context-refresh-v272                     63d848815e2c  YES
claude/issue-1411-safety-banners                           fd75369404b0  YES
claude/issue-1421-refresh-context-6-5-10                   0ade6b0376bd  YES
claude/issue-1432-financial-unused-args                    2596ad18f276  YES
claude/issue-1439-refresh-context-post-1437                7c871bff923f  YES
claude/issue-1441-auth-issuance-surface-read               d2ebb2d50649  YES
claude/issue-1444-jwtauth-cognito-finding                  cd317128886a  YES
claude/issue-1446-refresh-context-post-1445                9b9108744ef7  YES
claude/issue-1448-restructure-context-s10                  c01a2186ffd8  YES
claude/issue-1451-jwtauth-delegate                         bf77c01b50b6  YES
claude/issue-1454-unreached-code-sweep-note                99ef5876dffd  YES
claude/issue-1456-cognito-password-login                   cab2d4356c31  YES
claude/issue-1458-context-refresh-1449-1452-1457           ee4ad369813c  YES
claude/issue-1461-file-fd65-carrier-read                   2402bea196a4  YES
claude/issue-1480-group-case-fix-addendum                  b32862bedb8c  YES
claude/issue-1482-refresh-context-post-1481                1a87826b6346  YES
claude/issue-1484-fd70-mint-decision                       2d9e3b1c5a1c  YES
claude/issue-1485-fix-plan-v2-76                           9353d4b17ac0  YES
claude/issue-1488-pr-validation-check                      a040668e2440  YES
claude/issue-1490-fstats1-compound-predicates              bacf69d4a428  YES
claude/issue-1492-context-fstats1-predicates               5041a2c3248a  YES
claude/issue-1498-canon-table-census                       259f835762f8  YES
claude/issue-1534-navigation-census                        2b9c54b150fd  YES
claude/issue-1547-character-studio-feasibility             38a92f6f7c04  YES
claude/issue-1549-overview-test-read                       705b316d6684  YES
claude/issue-1551-fix-episodedetail-test-isolation         095f8a42981d  YES
claude/issue-1553-fix1550-tail-banner                      df64ee0476f7  YES
claude/issue-1555-session-conduct-2026-09-19               c8686e00b2f4  YES
claude/issue-1557-enforce-admins-verified                  52d55b606ab1  YES
claude/issue-1567-rds-literal-redaction                    acc758707f08  YES
claude/issue-1569-logout-revocation-read                   bd1259853e97  YES
claude/issue-1571-fdeploy1-freeze-lift                     2cb753ff7a36  YES
claude/issue-1575-context-freeze-lift                      648eb5bb621a  YES
claude/issue-lan-dev-serving                               ec0ca17f15f1  YES
claude/issue-limb1-cp1                                     9852699f9893  YES
claude/issue-limb1-cp11                                    a4d48e98a2a3  YES
claude/issue-limb1-cp3                                     e3f8a607b726  YES
claude/issue-limb1-cp4                                     f174803ae53c  YES
claude/issue-limb1-cp5                                     45973c55494d  YES
claude/issue-limb1-cp6                                     8f46e806cb21  YES
claude/issue-limb1-cp7                                     9066f0a673bc  YES
claude/issue-limb1-cp8                                     6937daa8c4a3  YES
claude/issue-limb1-cp9                                     9e3d4c6abd52  YES
claude/limb1-definitional-rulings                          8be818f2b913  YES
claude/limb1-measurement                                   e36f4cad6765  YES
claude/limb1-measurement-corrected                         e60a9953d1eb  YES
claude/merge-dev-into-main                                 b81935a4f1c6  NO
claude/onboarding-update-2026-06-01                        962dab7c99b8  NO
claude/pe62-amendment-2026-08-19                           1b822a7f5b10  NO
claude/pe65-topology-pointer-banner                        ea40aa36880d  YES
claude/prime-studios-audit-register-8qhqcj-amd11           f37e35166a05  YES
claude/prime-studios-audit-register-8qhqcj-amd12           f0befe6e8692  YES
claude/prime-studios-audit-register-8qhqcj-pe68            4f8117501762  YES
claude/prime-studios-audit-register-8qhqcj-wfhdr           2f88c32d07ce  YES
claude/prime-studios-setup-h7x21                           7fd039e00abb  NO
claude/prod-security-group-review-n811c4                   a4460f258980  YES
claude/prod-sg-ssh-scoped-rule-note                        532e541a27f1  YES
claude/project-context-fd65-refresh                        41fc5469bde3  NO
claude/project-context-workflow-dsbaid                     3363f16537a6  YES
claude/register-reality-gap-docs-hy8h5r                    622c9b49f1c3  YES
claude/review-episode-pipeline-RFZ6K                       3177a54909d0  NO
claude/review-phone-hub-zones-UjNDk                        d4e9f8d8d744  NO
claude/rollback-scope-p6                                   f04876449a1f  NO
claude/session-pe-roster                                   e89ec70c9bc4  NO
claude/session-pe-roster-backup                            e89ec70c9bc4  NO
claude/sg-identity-reconciliation-e316y1                   a7a33a13ff00  NO
claude/shapeA-clause3-amendment                            0581d5b80e2f  YES
claude/test-g1y-vscode-open                                2799d000b67e  NO
claude/test-skip-automerge-postremoval                     441e47093fc0  YES
claude/three-register-pointers                             48c61f791f4f  NO
claude/track-b-plan-v0-2                                   7dc5d8025b0a  NO
claude/track-b-topology-plan                               d534401d2439  NO
claude/v25-amd7-correction-marker                          9a7199f5707d  YES
claude/v25-handoff                                         879bc6071176  YES
claude/v25-owed-index                                      78af4de09ecc  YES
claude/v25-owed-index-amd1                                 aca320e9fd59  YES
claude/v25-owed-index-amd10                                39055157f57d  YES
claude/v25-owed-index-amd14                                d6d7742aef43  YES
claude/v25-owed-index-amd15                                0b5ec6c9a3be  YES
claude/v25-owed-index-amd16                                0fa5448695b6  YES
claude/v25-owed-index-amd2                                 b7869a33099b  YES
claude/v25-owed-index-amd3                                 48200c09d04d  YES
claude/v25-owed-index-amd4                                 ee945091a3c8  YES
claude/v25-owed-index-amd7                                 3e5e26348ca2  YES
claude/v25-owed-index-amd8                                 d89bc86a9035  YES
claude/v25-owed-index-amd9                                 0befd18a24e4  YES
claude/v25-sec6-prep-1cu9c0                                2354f7ab6f0f  YES
claude/v26-draft-material-attention                        194f961052b8  YES
claude/v26-draft-material-perennials                       71d6df859dea  YES
claude/wardrobe-product-shot-hybrid                        9ef027843fbd  NO
claude/xk1-bucket3-correction                              357bf455839a  NO
claude/xk1-inventory-correction                            afe13438f984  NO
```

---

## §4. Comparison against Amd26 §AB3 — superseded as a count, not corrected

`v25_Owed_Index_Amd26_2026-08-31.md` §AB3.3, basis 2026-09-03, records:

```
claude/** tips on the remote                      94
  tips whose head postdates 1f548aed              76
    head commit carries [skip-automerge]          48
    head commit carries NO token  -> UNCOVERED    28
```

Amd26 §AB3.3 also scoped its count to tips whose head **postdates**
`1f548aed` (the opt-out predicate's introduction commit, 2026-05-17) —
branches whose head predates it are excluded there by design, "not a
coverage gap, because the predicate did not exist." **This document does
not apply that same epoch filter** — §2/§3 above count and check *every*
`claude/**` tip present today, filtered only on the branch-name pattern,
not on commit date. The two counts are not directly subtractable for that
reason, on top of the population having grown and turned over in the
seventeen days between bases.

| | Amd26 §AB3 (basis 2026-09-03) | This document (basis 2026-09-20) |
|---|---|---|
| `claude/**` tips | 94 | 232 |
| Tips checked for the token | 76 (postdating `1f548aed` only) | 232 (all of them) |
| Tips **without** `[skip-automerge]` | 28 | 53 |

**Amd26 §AB3's figure of 28 is superseded as a count by this document's 53,
at this document's later basis and wider scope.** Amd26 §AB3 is not called
wrong — it measured its own population, with its own stated epoch filter,
at its own 2026-09-03 basis, and its own text says so ("the safe direction
for a coverage-gap finding," §AB3.3's closing line). A population that
nearly did not exist yet at 94 members has more than doubled to 310 total /
232 `claude/**` branches in seventeen days; a snapshot count does not stay
current against a branch population this active, which is exactly what a
census, not an amendment, is for. **This document does not edit, banner, or
correct `v25_Owed_Index_Amd26_2026-08-31.md`** — that file is unedited by
this filing, per the register's immutability rule.

`claude/sg-identity-reconciliation-e316y1`, the branch Amd26 §AB3.3 named as
"newest uncovered tip" at its own basis, is still uncovered at this basis
(§3, sample read) — its tip has not moved since Amd26 was filed.

---

## §5. `auto-merge-to-dev.yml` — YAML trigger and platform state

**YAML trigger, clone-reproducible, re-read this session:**

```
$ git show origin/main:.github/workflows/auto-merge-to-dev.yml | sed -n '/^on:/,/^jobs:/p'
on:
  push:
    branches:
      - 'claude/**'

concurrency:
  group: auto-merge-dev
  cancel-in-progress: false

jobs:
```

**Unchanged since Amd26 §AB3.1**: the live push trigger on the entire
`claude/**` namespace is still present in the tree at this basis. Per `v25`
Sec 6 item 7's rule, restated by Amd26 §AB3.1, **workflow-level state does
not tell you the trigger** — the two are read and reported separately here.

**Platform state, API-only, re-measured live this session** (Amd26 §AB3.4
explicitly declined to read this and named the same GitHub-API bound this
document's §1 states):

```
$ actions_list(method="list_workflows", owner="angelcreator113",
               repo="Episode-Canonical-Control-Record")
  → 6 workflows, including:
    "Auto-merge to Dev"        disabled_manually   .github/workflows/auto-merge-to-dev.yml
    "Deploy to Development"    disabled_manually   .github/workflows/deploy-dev.yml
    "Deploy to Production"     disabled_manually   .github/workflows/deploy-production.yml
    "Validate"                 active              .github/workflows/validate.yml
    "PR Validation Block Check" active             .github/workflows/pr-validation-block-check.yml
    "Copilot cloud agent"      active              dynamic/copilot-swe-agent/copilot (no file in the tree)
```

**`Auto-merge to Dev` is `disabled_manually` at this basis, MEASURED live via
the Actions API in this session** — this is a re-measurement, not a carry
of `PROJECT_CONTEXT.md` §7's prior read (`F-Deploy-1_Fix_Plan_v1.50.md` §5,
2026-09-17). The two agree at both bases; this document does not rely on
`PROJECT_CONTEXT.md`'s figure for its own claim. **Run history was not
read** (whether the workflow has fired recently) — that is the same bound
Amd26 §AB3.4 and `Prime_Studios_Audit_Handoff_v26.md` Sec 3.2 both name for
platform-state reads, and it is not asked here either; this document states
only the workflow's enabled/disabled state, not its run history.

A live push trigger sitting in a `disabled_manually` workflow is exactly
the "predicate does not cover" condition Amd26 §AB3's own title names — the
opt-out token in a commit subject protects against nothing while the
workflow cannot fire, and would matter again only if the workflow were
re-enabled. **This document does not rule on, recommend, or perform any
re-enable.**

---

## §6. Disposition — gated, not resolved

`PROJECT_CONTEXT.md` §6.5 already carries this population as an open row:

> **STILL OWED.** 28 `claude/**` branch tips lack `[skip-automerge]` while
> `auto-merge-to-dev.yml` still carries the push trigger in YAML (re-enable
> decision is gated; the fix is a branch-cleanup ruling, not a code change).
> — Amd26 §AB3

**This document updates the figure that row cites (28 → 53, per §4 above)
by filing a new count; it does not update the row itself** — `PROJECT_CONTEXT.md`
is not edited by this filing (it is not in this document's diff), and
whether/how to refresh that row's number is a separate, future act. The
disposition named in that row is unchanged by this census: **the token-less
tips are a branch-cleanup ruling's to resolve, not this document's, and
remain gated exactly as `PROJECT_CONTEXT.md` §6.5 already states.** This
document does not propose a cleanup policy, does not recommend which of the
53 branches (if any) should be deleted, retagged, or amended, and performs
no deletion, rename, or push of any branch — read-only enumeration only,
per its own §1.

---

## §7. What this document does not do

This document:

- mints no FD, XK, or PE number;
- closes nothing — no keystone, no owed item, no finding;
- amends no filed document — `v25_Owed_Index_Amd26_2026-08-31.md` and
  `PROJECT_CONTEXT.md` are cited above, not edited, per the register's
  immutability rule;
- rules nothing — not on branch cleanup, not on re-enabling
  `auto-merge-to-dev.yml` or any other workflow, not on which count (28 or
  53) a future `PROJECT_CONTEXT.md` revision should cite;
- deletes, renames, or pushes no branch — every read above is a GitHub API
  `GET`-equivalent; no branch, workflow, or file was modified by this
  filing session;
- makes no host, AWS, database, or Cognito contact.

---

## §Standing

Every figure in §2, §3, and §4 is **MEASURED** against the GitHub API, on
the basis stated in §1: reproducible by anyone with API access to this
repository, not by a clone alone. §5's YAML read is **MEASURED** and
clone-reproducible; §5's platform-state read is **MEASURED** against the
GitHub API, re-measured live in this session, not carried from
`PROJECT_CONTEXT.md`. Nothing in this document is labelled ATTESTED or
RULED. Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1);
agent sessions still never touch hosts, AWS, RDS, or Cognito (`CLAUDE.md`),
unchanged by that lift or by this record — no such contact was made in
producing it.

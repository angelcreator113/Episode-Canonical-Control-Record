# F-Deploy-1 Fix Plan v1.17

## Sec 1 Purpose

Mints FD-44. Adopts the 2026-07-02 id-3 standup sitting record
(`F-Deploy-1_id3_Standup_Sitting_Record_2026-07-02.md`, commit 3672fafe) into the
register: gate 2.5 re-greened; the FD-42/FD-43 off-box-reference gap CLOSED by a minted
digest of a proven-working canon credential; the credential-validity question FD-43 held
cold-locked now answered OBSERVATIONALLY via the separately gated standup window (#882)
that FD-31's own critical path required -- not by a [3] entry. Freeze posture amended by
explicit authorization: id-3 held running as the gate-2.5 reference process. Advances
gate 2.5 readability only; authorizes no further prod-box action; does not prime [3];
does not pick or execute a credential branch. FD-31 remains OPEN.

## Sec 2 Reference documents

| Doc | Role |
|---|---|
| `F-Deploy-1_Fix_Plan_v1.16.md` | Immediate predecessor; mints FD-43. Retained verbatim; FD-44 supersedes only its cold-lock framing of the validity question and closes its off-box-reference gap. |
| `F-Deploy-1_id3_Standup_Sitting_Record_2026-07-02.md` (3672fafe) | Primary evidence: preconditions, gated mutation, canon identity confirm, minted digest, freeze amendment. |
| `F-Deploy-1_id3_Standup_Scoping_Gate2.5_Readiness_2026-07-01_DRAFT.md` (#882) | The sanctioned window's charter; defines why this was not a [3] breach. |
| `F-Deploy-1_id3_Standup_DigestCapture_Script_2026-07-01_DRAFT.md` (#883) | Pinned capture method (value-only), amended in-sitting for single-quote strip. |
| `F-Deploy-1_[3]_Credential_Branch_Execution_Runbook.md` (#861) | Branch procedure; FD-44 records evidence pointing at re-anchor but selects nothing. |

## Sec 3 Register entry -- FD-44

FD-44 -- id-3 standup outcome adopted: gate 2.5 re-greened; working-canon-credential
reference digest minted (off-box gap closed); FD-43's cold-locked validity question
answered observationally; freeze amended to hold id-3 running.

ESTABLISHED (evidence: sitting record, 3672fafe):
  - id-3 (episode-api-prod-hotfix) started 2026-07-02 under the #882-gated window,
    plain start (no --update-env). Pool authenticated. DB identity confirmed live:
    DB_HOST = episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com (canon per
    committed SG-containment designation) -- identity-bound, not name-trusted.
  - GATE 2.5 RE-GREENED: pm2 env 3 (3a) carries the running-pool semantic guarantee;
    the 3a==3b confirm (#750) is makeable again.
  - REFERENCE DIGEST MINTED (the FD-42/FD-43 off-box gap, CLOSED):
    b6694fc0b2c27cb66a30c6338a1d832e53976c1700d8c85e2b611747435dddb9
    Method (pinned, mandatory for all future comparisons): VALUE-ONLY -- extract value,
    strip one layer of surrounding double OR single quotes (sitting amendment), strip
    trailing newline, sha256sum. NOT the #879 line method.
  - Corroboration: stopped-state digest == running digest (daemon held value across the
    stop). xcheck line-digest MATCH vs #879 baseline: launch env predates 06-30 rotation;
    pm2 describe created-at 2026-06-27T12:50:58Z.

SUPERSEDES (additive; FD-43 retained otherwise):
  FD-43's framing "which value canon accepts stays cold-[3]-locked behind FD-31 Sec 7"
  is superseded IN PART: the question was answered observationally by the #882 window,
  which was itself the gated sitting FD-31's critical path required to restore gate-2.5
  readability. No [3] entry occurred; no cutover step ran. The remaining [3]-locked
  content (restart-to-align, rotation execution, 3a==3b confirm run) stays locked.

BRANCH IMPLICATION (recorded, NOT selected):
  The four-branch probe question (#861) -- "does a stored/candidate value authenticate?"
  -- now has observational evidence: YES, the on-box .env value authenticates against
  canon. Evidence points at the RE-ANCHOR branch (no canon write). FD-44 does not pick
  or execute a branch; that remains the runbook's and the [3] session's to run.

RECONCILIATION CARRIED (open, warm-workable):
  FD-42's observation leg recorded "stored value fails canon auth" with .env == SSM v2
  byte-identity. The sitting proved the CURRENT .env value authenticates. Apparent
  tension; most economical hypothesis is that .env's DB_PASSWORD changed between FD-42's
  observation window and id-3's 06-27 launch -- NOT established. Owed: (a) when/how .env
  came to hold a working value; (b) whether .env == SSM v2 still holds. Neither blocks
  gate 2.5 or the minted reference.

NOTED SURFACES (no FD minted; dispositions):
  - ~/.pm2/dump.pm2 (34,266 bytes, mtime 06-24): plaintext-credential-at-rest surface;
    cleanup/triage owed post-[3]. Candidate for its own FD at next revision if not cleared.
  - Template Studio boot route failure: confirmed live 07-02; stays [3]-scope.
  - id-4 off-record standup gap: pointer sharpened (id-3 created 06-27 12:50:58Z, ~16 min
    after the tightened boundary; same construction window). Remains OPEN.
  - CFO audit 11 critical/high dep vulns: backlog class.

FREEZE POSTURE (amended by explicit authorization, 2026-07-02, recorded in sitting):
  Box FROZEN, except id-3 held running as the gate-2.5 reference process. ids 0/1/4
  stopped; no topology formalization; no pm2 save; no port flip.

Evidence: sitting record 3672fafe; #882; #883; #879 (xcheck baseline); #861.
Status: OPEN -- narrows to the [3] reconciliation (re-anchor per runbook, restart-to-align,
3a==3b confirm). FD-44 closes when [3] adopts or supersedes the minted reference.

## Sec 4 Register decision -- mint FD-44; supersede FD-43's lock framing in part; retract nothing

1. Independent content/lifecycle? Yes -- a new evidence event (the executed, gated
   sitting) with new actionable content (minted reference, re-greened gate, amended
   freeze) and its own OPEN lifecycle (closes at [3] adoption).
2. Retracts FD-43 or FD-42? No. FD-43 stands verbatim in v1.16; its lock framing is
   superseded only where the #882 window answered the question through its own sanctioned
   gate. FD-42's precondition finding, mechanism, and severity are retained; its
   observation-leg tension is carried as an open reconciliation, not rewritten.

Register topology: FD-42 (v1.15, OPEN) -> FD-43 (v1.16, chain + premise superseded,
OPEN) -> FD-44 (v1.17, sitting adopted, off-box gap closed, lock framing superseded in
part, OPEN). No prior register entry is rewritten.

## Sec 5 Closing

*Fix Plan revision v1.17. Mints FD-44 -- adopts the 2026-07-02 id-3 standup sitting record:
gate 2.5 re-greened via a running, canon-authenticated id-3 (identity-bound); the working-
canon-credential reference digest minted under the pinned value-only method, closing the
FD-42/FD-43 off-box gap; FD-43's cold-lock framing superseded in part by the #882-gated
observational answer; evidence recorded as pointing at the re-anchor branch without
selecting it; FD-42 observation-leg tension carried open; freeze amended by explicit
authorization to hold id-3 running. Advances gate-2.5 readability only; does not prime
[3]; picks no branch; rotates nothing. FD-31 remains OPEN. v1.16 (and the chain beneath
it) canonical for anything v1.17 does not supersede. [skip-automerge]*
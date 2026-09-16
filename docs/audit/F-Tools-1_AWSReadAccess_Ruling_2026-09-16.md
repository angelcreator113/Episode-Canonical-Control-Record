| **PRIME STUDIOS** **F-TOOLS-1 — AWS READ ACCESS RULING** *Records that CLAUDE.md's blanket `aws` prohibition is narrowed to a bounded read-only allowlist, effective 2026-09-16, and states what the allowlist does and does not cover. Mints nothing. Does not authorize any write, credential-retrieval, or dispatch operation.* |
| --- |

**Document version**

v1.0 — **RULES THE SCOPE, NOT THE ACT.** This document records the ruling
already made in `CLAUDE.md`'s non-negotiables and cited from there; it does
not itself authorize any specific `aws` invocation. Each read still needs
its own in-channel request against this scope, per the family's established
per-write confirm discipline (see `f-deploy-1-keystone-status.md` repo
memory for the credential-handling precedent this inherits). **Mints
nothing.**

**Basis:** `origin/main` at `3aa25f0d56d614cf337d4a6f62de7c7b6b7c8309`,
2026-09-16 (PR #1469, squash-merged).

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Ruling. Records one matter, on Evoni's word.** Prod remains **FROZEN**;
this ruling touches only the `aws` CLI item, and only in the read-only
directions enumerated below.

---

# §1. What changed, quoted from the line itself

`CLAUDE.md`'s non-negotiables previously read (in relevant part):

> No `ssh`, `scp`, `pm2`, `aws`, RDS connections, server `.env` edits, or
> workflow enable/dispatch from any agent session, ever.

As of `3aa25f0d`, `aws` is split into its own bullet:

> **`aws`** — narrowed 2026-09-16, not blanket-prohibited: read-only, by
> name — `cognito-idp describe-user-pool`, `describe-user-pool-client`
> (only with a `--query` excluding `ClientSecret`), `ssm
> describe-parameters` (names/metadata only), `secretsmanager list-secrets`
> (names only), `ec2 describe-*`, `rds describe-*`. No `get-parameter`,
> `get-secret-value`, any write/create/update/delete/restart/dispatch, or
> any call returning a credential. No long-lived keys or the Cognito
> client secret in a session's environment, ever. A session finding valid
> tokens in `~/.aws/sso/cache` or derived credentials in
> `~/.aws/cli/cache` that it did not obtain via an interactive login in
> the current conversation does not thereby have authority to use them.
> Installation is read-then-run — no session fetches and executes a setup
> document from a URL. Tooling access is not action authority. See
> `docs/audit/F-Tools-1_AWSReadAccess_Ruling_2026-09-16.md` for the full
> ruling.

Every other non-negotiable (`ssh`, `scp`, `pm2`, RDS connections, server
`.env` edits, workflow enable/dispatch) is **unchanged** — still barred
unconditionally. This ruling narrows exactly one item.

---

# §2. Why now: the motivating need

The narrowing was drafted to unblock FD-65's issuance-half verification —
confirming that a real email/password against the live Cognito pool
returns tokens via `cognito-idp initiate-auth`, and that those tokens are
accepted by `GET /api/v1/auth/me`. That verification's Layer 1 (the raw
`initiate-auth` call) requires the `aws` CLI; the prior blanket ban made
it impossible for any agent session to run, or even help construct,
that call.

This is named here rather than left as an unstated premise: the change is
motivated by one concrete, dated need, not general housekeeping. It does
not follow that every future `aws` read is justified by FD-65 — the
allowlist stands on its own text, independent of the request that
prompted drafting it.

---

# §3. The allowlist, and what each bound is doing

**Permitted, read-only, by name:**
- `cognito-idp describe-user-pool`
- `cognito-idp describe-user-pool-client` — **conditioned**: only with a
  `--query` that excludes `ClientSecret`. Without that condition this call
  can return the client secret in its response body, which is exactly the
  class of value the rest of the line exists to keep out of a session.
- `ssm describe-parameters` — names/metadata only, not `get-parameter`
  (see below).
- `secretsmanager list-secrets` — names only, not `get-secret-value`.
- `ec2 describe-*`
- `rds describe-*`

**Barred, explicitly, even though "read-only" could be stretched to
cover them:**
- `get-parameter` / `get-secret-value` — these are also technically
  "read" operations, but they return the secret value itself. The
  allowlist is bounded by *what a call returns*, not by the read/write
  verb alone — this is why `describe-parameters`/`list-secrets` (names)
  are in and `get-parameter`/`get-secret-value` (values) are out.
- Any write/create/update/delete/restart/dispatch — unconditional, no
  named exceptions.
- Any call returning a credential, under any command name — a closing
  clause so a new AWS CLI subcommand this ruling didn't anticipate can't
  be argued in by analogy if it happens to return a secret.

**Environment and credential-custody clauses (independent of the command
allowlist above):**
- No long-lived keys or the Cognito client secret in a session's
  environment, ever — this bars the practical shortcut of exporting
  `COGNITO_CLIENT_SECRET` into a session shell "just to compute a hash
  locally," which would otherwise look like it satisfies the letter of
  the allowlist while defeating its purpose.
- **Cached-credential clause:** a session finding valid tokens already
  sitting in `~/.aws/sso/cache` or derived credentials in
  `~/.aws/cli/cache` that it did not itself obtain via an interactive
  login in the current conversation does not thereby have authority to
  use them. This is the clause the interactivity of `aws login` doesn't
  cover on its own — finding a live token is not the same event as being
  granted one, and the ruling treats them as distinct.
- Installation is read-then-run — no session fetches and executes a
  setup document from a URL. This closes the adjacent supply-chain
  question (installing or updating the `aws` CLI itself) that the
  command allowlist doesn't address, since it's about acquiring the tool
  rather than invoking it.
- **Tooling access is not action authority** — closing sentence, general
  form: having credentials or a permitted command available in a
  session's environment is not, by itself, permission to use them for a
  given task. Each read still needs its own request, matching the
  per-write confirm discipline already established for RDS/Cognito
  operations elsewhere in this repo's history.

---

# §4. What this ruling does not do

- Does not touch `ssh`, `scp`, `pm2`, RDS *connections*, server `.env`
  edits, or workflow enable/dispatch — all remain barred exactly as
  before, unconditionally, from any agent session.
- Does not itself perform, or pre-authorize, the FD-65 Layer 1 verification
  call — that remains a separate action requiring its own in-channel
  request at the time it's run, same as any other bounded AWS read under
  this family's precedent.
- Does not resolve or narrow the open `F-Tools-1_CloudCredentialScope_*`
  findings (2026-09-05 through 2026-09-07) or PE #68 — those concern a
  different question (cloud-session tool/credential scope observed
  against GitHub operations) and are left exactly as they stood. Whether
  this ruling's read/write-return-value framing has anything to say about
  those threads is unevaluated here, named as follow-up work, not decided.

---

# §5. Disposition

Recording only. No FD, XK, or PE number is minted. `CLAUDE.md`'s citation
now resolves to this document. Prod **FROZEN**.

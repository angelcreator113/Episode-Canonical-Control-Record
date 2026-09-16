| **PRIME STUDIOS** **F-TOOLS-1 — AWS READ ACCESS RULING, AMENDMENT 1** *Adds `cognito-idp list-user-pool-clients` to the allowlist `F-Tools-1_AWSReadAccess_Ruling_2026-09-16.md` records. Additive only — the original document is merged and immutable. Mints nothing.* |
| --- |

**Document version**

v1.0 — **ADDITIVE, NOT A CORRECTION.** The original ruling's allowlist
did not omit this item by error; enumeration simply wasn't needed until
this session's `describe-user-pool-client` read exposed a question the
original allowlist can't answer on its own. This document records why
the second item was added, on the same terms as the first.

**Basis:** `origin/main` at the commit that lands the `CLAUDE.md` line
this amendment describes (see that commit for the exact `aws` bullet
text; this document does not restate it as its own finding).

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Additive amendment. Records one addition, on Evoni's word.** No FD,
XK, or PE number is minted. Prod remains **FROZEN**.

---

# §1. What the original allowlist couldn't answer

`describe-user-pool-client` (permitted since the original ruling) takes
a client id as input — it can only describe a client already known by
id. This session used it, via the local `.env`'s configured
`COGNITO_CLIENT_ID`, and found `HasSecret: false` on that client
(`lgtf3odnar8c456iehqfck1au`, named `episode-metadata-api-client-dev`,
created 2026-01-01) — contradicting an account of the console showing a
secret on this pool's app client.

That single read cannot distinguish two possibilities: (a) this is the
pool's only client, and the console account was mistaken about the
secret, or (b) a second client exists, `.env` points at the wrong one,
and the console's account was of that other client. `describe-*` cannot
enumerate; it can only describe what it's already told to look at. This
is exactly the gap `list-user-pool-clients` closes, and exactly why the
original allowlist — drafted before this question existed — didn't
include it.

---

# §2. Why the addition fits the original ruling's own shape

`list-user-pool-clients` returns client id, client name, and user pool
id per client — no secret field exists in its response shape at all, so
the original ruling's core distinction (bar calls that can return a
credential; permit calls that structurally cannot) applies to it exactly
as written. No `--query` exclusion is needed the way
`describe-user-pool-client` needs one, because there's nothing to
exclude.

This is added as a fourth named item, not as a broadening of "read-only"
into something less bounded. The line still enumerates every permitted
call by name; this amendment adds one to that enumeration.

---

# §3. Disposition

`CLAUDE.md`'s `aws` non-negotiable now names `cognito-idp
list-user-pool-clients` (id/name/pool-id only, returns no secrets)
alongside the four items the original ruling named. Everything else the
original ruling states — the barred `get-parameter`/`get-secret-value`,
the environment/custody clauses, the cached-credential clause, the
read-then-run installation clause, "tooling access is not action
authority" — is unchanged and this amendment does not restate it.

Mints nothing. No FD, XK, or PE number. Prod **FROZEN**.

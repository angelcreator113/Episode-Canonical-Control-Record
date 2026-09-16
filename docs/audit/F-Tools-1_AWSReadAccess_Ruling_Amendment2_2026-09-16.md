| **PRIME STUDIOS** **F-TOOLS-1 — AWS READ ACCESS RULING, AMENDMENT 2** *Adds `cognito-idp list-groups` to the allowlist `F-Tools-1_AWSReadAccess_Ruling_2026-09-16.md` records. Additive only — the original document and Amendment 1 are merged and immutable. Mints nothing.* |
| --- |

**Document version**

v1.0 — **ADDITIVE, SECOND OF ITS KIND.** Records a second gap the
original allowlist couldn't answer, of a different shape than
Amendment 1's.

**Basis:** `origin/main` at the commit that lands the `CLAUDE.md` line
this amendment describes (see that commit for the exact `aws` bullet
text; this document does not restate it as its own finding).

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Additive amendment. Records one addition, on Evoni's word.** No FD,
XK, or PE number is minted. Prod remains **FROZEN**.

---

# §1. Why this gap is a different shape than Amendment 1's

Amendment 1 added `list-user-pool-clients` to resolve a **pool-config**
ambiguity: `describe-user-pool-client` can only describe a client
already known by id, so it couldn't distinguish "the only client" from
"the wrong client." That question had one fixed, static answer at any
given moment — how many app clients the pool has.

This gap is different in kind, not just in target. Whether the
`cognito:groups` claim appears on an issued token is **runtime state**,
not pool configuration: it depends on whether any Cognito group exists
in the pool at all, and whether the authenticating user belongs to one.
`describe-user-pool` — already in the allowlist — returns pool-level
settings (schema attributes, password policy, MFA configuration, and
similar) and was mistakenly cited in-session as sufficient for this
question before this amendment was drafted; it has no field for groups,
because groups are not pool configuration, they are directory objects
that happen to live inside a pool.

`cognito:groups` was one of three facts recorded as user-provided,
alongside `USER_PASSWORD_AUTH` enablement and app-client-secret
presence — this document's own predecessor and Amendment 1 already
measured the other two, confirming one and contradicting the other.
This is the third, and it decides whether `requireGroup('ADMIN')`
authorization on admin routes (including `compositions.js`'s three) can
ever succeed on an RS256-verified token: if no group exists in the pool,
`cognito:groups` is never populated for anyone, and every such request
is denied regardless of credential validity.

---

# §2. Why the addition fits the original ruling's own shape

`list-groups` returns, per group: name, description, precedence, IAM
role ARN (if configured), and creation/modification timestamps. No user
data, no secrets, no field capable of returning a credential — the
original ruling's core distinction (bar calls that can return a
credential; permit calls that structurally cannot) applies to it
exactly as written, the same as Amendment 1's addition. No `--query`
exclusion is needed for the same reason: there is nothing in this
response shape to exclude.

Added as a fifth named item. The line still enumerates every permitted
call by name; this amendment adds one more to that enumeration.

---

# §3. What this read can and cannot conclude on its own

`list-groups` answers only "does at least one group exist, and what are
its properties." It does not answer "is any specific user a member of
one" — that is `list-users-in-group`, a distinct call, not added by this
amendment, and a separate decision if the answer here is that groups do
exist. If `list-groups` returns an empty array, that alone is
conclusive: no group can have a member, so `cognito:groups` is never
populated for anyone, regardless of any single user's state.

---

# §4. Disposition

`CLAUDE.md`'s `aws` non-negotiable now names `cognito-idp list-groups`
(name/description/precedence/role-ARN/timestamps only, no user data, no
secrets) as a fifth item, alongside the four Amendment 1 and the
original ruling named. Everything else stated in the original ruling
and in Amendment 1 is unchanged and not restated here.

Mints nothing. No FD, XK, or PE number. Prod **FROZEN**.

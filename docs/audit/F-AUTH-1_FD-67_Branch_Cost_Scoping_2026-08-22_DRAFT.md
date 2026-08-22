| **PRIME STUDIOS** **F-AUTH-1 SCOPING DOCUMENT** *FD-67 branch cost. Rules nothing. Mints nothing. Recommends nothing.* |
| --- |

**Document version**

**DRAFT — FD-67 BRANCH COST SCOPING.** Supplies the one input v2.61 §4.4 lacked:
what each of its two branches costs. **Selects neither branch.** Ships no code.
Changes no gate, status, or disposition. Mints nothing — FD tail remains
**FD-68**; XK tail **XK-3**; PE tail **PE #67**. FD-67 remains **OPEN/P2**.
Dimension 3 remains **NOT PERFORMED**; limb 3 open; G4 not enterable.

Basis: `origin/main` at `cde71fbc`, derived live 2026-08-22 from the composed
Express runtime and from source.

**Environment contact, stated in full.** Local file reads; `dotenv` loaded
`.env` into each probe process; no listener was opened. **No database
connection was initialized in any run reported here** — verified by absence of
the init path, not assumed. **Redis was reached** (`127.0.0.1:6379`, connection
refused) via a service transitively required by a route file. **No deployed
host contacted. No AWS call issued. No Cognito contact. Prod FROZEN.**

---

# §1. The question put

v2.61 §4.4 states two branches and declines to select:

> 1. remove the global mount and place optional identity explicitly on every
>    legitimate consumer; or
> 2. retain the mount and define a complete effective-middleware verification
>    procedure proving every write is protected independently of it.
>
> *Current history points toward option 2 but does not rule it.*

**That lean was formed while option 1's cost was unknown.** §4.2 justifies
retention on the ground that the mount *"has legitimate consumers"* — true, and
never quantified. Option 2's cost was never quantified either, but §4.3 ties it
to limb 1 explicitly: the corrected procedure must inspect effective middleware
of every write declaration *and tie each to its Tier disposition*, which §4.3
gives as the reason limb 1 cannot be replaced by a grep.

**Neither branch was cost-comparable, so §4.4 had nothing to rule against.**
This document supplies the counts and stops.

# §2. Method, and why not a grep

§4.3 records that token greps miss bare declarations under the global mount,
router presets, multiline declarations, and non-`router` variables. **No
enumeration here is a grep over declaration text.** Middleware is identified by
**function identity** against the `require`-cached `auth` / `jwtAuth` exports,
read off the **composed runtime router stack**. A declaration cannot hide from
this by how it was written.

**Loading is per-router. `src/app` is never required.** Loading `src/app`
initializes a database connection under `NODE_ENV=production`, and per FD-66
the production config block ignores `DATABASE_URL` and resolves discrete `DB_*`
vars. On a machine where `DB_HOST` pointed at RDS, a probe whose purpose is to
read Express's composed stack would have opened a connection to production
infrastructure under freeze. **Nothing in the probe's purpose touches a
database.** Per-router loading removes that specific hazard and **does not make
loading inert** — Redis was still reached. **The remedy is "no DB connection,"
not "no side effects," and must not be restated as the latter.**

# §3. An instrument defect found mid-run, and what it implies

**15.1% of read declarations (76 of 504) were opaque to the first instrument.**
Handlers wrapped by `asyncHandler` are closures; `Function.prototype.toString`
returns the **wrapper**, never the handler. An opaque route therefore reports
*"does not reference `req.user`"* — **a well-formed negative for a route the
instrument never reached.**

**This produced a wrong number that was acted on.** The read-side floor was
first measured as **9**. After closing the opacity it is **13**. Had the
scoping stopped at the floor, **9 would have reached this document as the basis
for a branch ruling.**

**The defect surfaced as a side effect of bounding from above, not from
checking the floor.** The pass that caught it was aimed at the ceiling. Recorded
because the generalisable lesson is not *"check for wrappers"* — it is that
**the check which catches an instrument defect is frequently not the check aimed
at it**, and a floor confirmed only by the instrument that produced it is not
confirmed.

**Closure.** Three wrapper sources exist: `src/middleware/asyncHandler.js`,
`src/middleware/errorHandler.js`, and the `express-async-handler` package. The
first two were patched in `require.cache` **before** routers loaded, tagging
each wrapper with its inner function; the real wrapper still runs, only a tag is
added. The walk unwraps before stringifying. **Residual opacity is zero.**

# §4. Write side

| | |
|---|---|
| write declarations (composed app) | **912** |
| carry explicit authentication | **903** |
| rely on the global mount alone | **9** |
| no auth middleware at all | **0** |

The 9: `POST /login`, `POST /refresh`, `POST /validate` — auth endpoints,
correctly unauthenticated; four roles-shaped writes (`POST`, `PUT /:roleKey`,
`DELETE /:roleKey`, `POST /bulk-assign`); `POST /validate-required`; and
`POST /world/generate-ecosystem-preview`. The roles cluster is adjacent to
v2.45 §3's XK-3 instance report; **flagged, not asserted.**

**The write-side 9 is unaffected by §3's opacity defect** — it is a
middleware-chain fact, not a handler-source fact.

# §5. Read side — range 13 to 27, both ends mechanical

Candidate pool is reads carrying **no explicit authentication**; reads that
authenticate explicitly obtain identity from their own middleware and are
unaffected by the mount either way.

| | |
|---|---|
| candidate pool | **103** |
| references `req.user` — **dependent** | **13** |
| `getModels(req)` only — not dependent | 20 |
| no bare `req` at any point — not dependent | 56 |
| passes `req` elsewhere — **uncertain** | 14 |
| still opaque | **0** |

**Lower bound = 13.** Mechanical: the handler source references `req.user`.

**Upper bound = 27.** Mechanical: adds the 14 handlers that pass `req` as a
value to something this instrument does not follow. **Tracing into callees was
deliberately not performed** — it is unbounded and becomes judgment.

**Neither end involves any judgment about legitimate need.** Whether a
`req.user` reference constitutes a legitimate requirement for optional identity
is **Tier adjudication**. It is **uncounted here, and it is uncounted in both
branches.**

# §6. The `getModels(req)` discount, enumerated

20 of the 34 `req`-passing pool members pass `req` only to a local
`getModels(req)`. **All 11 definitions in `src/routes` were read. None
references `req.user`.** Shown so this is checkable rather than taken on faith
— it is the move that makes the range 13–27 rather than 13–47.

| file | body |
|---|---|
| `authorNoteRoutes.js` | `return req.app.get('models') \|\| require('../models');` |
| `calendarRoutes.js` | `return req.app.get('models') \|\| require('../models');` |
| `characterCrossingRoutes.js` | `return req.app.get('models') \|\| require('../models');` |
| `characterGenerationRoutes.js` | `return req.app.get('models') \|\| require('../models');` |
| `entanglementRoutes.js` | `return req.app.get('models') \|\| require('../models');` |
| `feedRelationshipRoutes.js` | `return req.app.get('models') \|\| require('../models');` |
| `mirrorFieldRoutes.js` | `return req.app.get('models') \|\| require('../models');` |
| `opportunityRoutes.js` | `return req?.app?.get('models') \|\| req?.app?.locals?.db \|\| require('../models');` |
| `pageContent.js` | `return req.app.get('models') \|\| require('../models');` |
| `undergroundRoutes.js` | `return req.app.get('models') \|\| require('../models');` |
| `wantFieldRoutes.js` | `return req.app.get('models') \|\| require('../models');` |

One hop, eleven definitions, uniform shape. `opportunityRoutes.js` additionally
consults `req.app.locals.db`; **still no `req.user`.**

# §7. What each branch costs

**Stated without a combined declaration total.** The write side was enumerated
from app-level composition and the read side from per-router loading. **These
are two enumerations, not one census, and summing them would assert a
measurement that was never taken.**

**Option 1 — remove the mount.** Adjudicate and place explicit optional
identity across **two enumerated sets**: **9 mount-only write declarations** and
**13–27 identity-dependent read declarations**. Every member is named. Upper
bound **36 declarations**.

**Option 2 — retain the mount.** Adjudicate **the full route surface, every
declaration tied to its Tier disposition**, per §4.3. That is limb 1.

**Both branches require Tier adjudication. They differ in the population it
runs over.** At option 1's upper bound the populations remain distinguishable.

**§4.4's lean is not supported by these counts.** It was formed on an unknown
that has now been measured. **This document does not replace it with a lean in
the other direction.**

# §8. Known edges, unsoftened

1. **The `express-async-handler` patch failed** (returned `false`). Residual
   opacity measured zero, so either the package is unused by loaded routers or
   `animatic.js` did not load. **Unreconciled.**
2. **Declared routers, not mounted routers.** 140 routers loaded from 142 files;
   `app.js` names 134 route requires. The sets were **not reconciled**, so some
   enumerated routers may be unmounted.
3. **`src/routes/templateStudio.js` fails to load** (`"url" argument must be of
   type string`). Its declarations are **uncounted everywhere above.**
4. **STALE, deliberately not re-measured:** an earlier all-reads figure of *41
   declarations referencing `req.user`* predates §3's opacity closure and is
   **understated**. It is not load-bearing for any count in this document.
   **Re-measuring it was declined — a half-corrected figure in circulation is
   worse than one plainly marked stale.**
5. Duplicate mounting was never checked; ratios are firmer than absolutes.
6. Express 5 mount prefixes did not resolve; declarations are named by
   route-relative path only.

**Every item above is a fact about the enumeration's edges, not an estimate of
their effect.** No judgment is offered here about how far they could move the
range; the edges are stated so a reader can form that view themselves.

# §9. What this document does not do

- **Does not select a branch, and does not recommend one.**
- Does not rule, mint, close, or reopen anything. FD-67 remains OPEN/P2.
- Does not perform limb 1 or any part of Tier adjudication.
- Does not advance Dimension 3, discharge limb 3, or enter G4.
- Does not authorize code.

# §10. The question

**FD-67 §4.4's two branches are now costed. Which does Evoni rule?**

- **Option 1** — remove the global mount; place explicit optional identity on
  9 named writes and 13–27 named reads.
- **Option 2** — retain the mount; specify a complete effective-middleware
  verification procedure over the full route surface, tied to Tier.

**A third answer is available and is not a deferral:** rule that the count is
insufficient and name what further measurement the ruling requires.

**Choosing the third answer does not return FD-67 to its prior state.** §4.4's
lean was formed on an unknown, and that unknown is now partially closed
regardless of how this is ruled. Both branches are costed better than they were
at v2.61, every member of option 1's two sets is named, and **a further scoping
pass starts from 13–27 and the edges at §8 — not from nothing.** What the third
answer buys is a narrower range, not a recovered question.

---

*Type: scoping only. Rules nothing, mints nothing, recommends nothing. No host,
AWS, database, or Cognito contact. Prod FROZEN.*

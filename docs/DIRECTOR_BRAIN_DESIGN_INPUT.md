# Director Brain — Design Input for F-Franchise-1's Fix Plan

## Status of this document

**Living design input, not a ruling and not a register document.** This file is not
filed under `docs/audit/`, carries no basis-SHA immutability rule, and is meant to be
edited in place as design thinking develops — the opposite of a register document's
append-only discipline. Nothing in this file is decided. It exists so the proposals
gathered so far for F-Franchise-1 are not lost while the keystone waits its turn in
the locked sequence (`F-AUTH-1 → F-Deploy-1 → F-App-1 → F-Stats-1 Phase B → F-Ward-1
→ F-Reg-2 → F-Ward-3 → F-Franchise-1 (= Director Brain) → F-Sec-3`). Capturing this
input does not move F-Franchise-1 earlier, does not authorize any fix, and does not
change the locked sequence's order — the keystone's own fixes remain exactly where
they already sit in that sequence.

When F-Franchise-1's turn comes, its first Fix Plan is expected to turn some subset
of the proposals below into actual rulings and FD items — at that point they leave
this file and enter the register the normal way. Until then, this page can be edited
freely as the design conversation continues; nothing here should be cited as settled.

---

## The problem

Stated fully, with citations, in `docs/audit/F-Franchise-1_SocialSystems_CanonRead_
2026-09-22.md` — not restated here. Three findings from that census motivate this
document:

- **§1:** an edit made on an authoring page (e.g. Social Systems) reaches a backend
  generator only through a manual, multi-step, human-gated chain — save → "Push to
  Brain" → AI extraction to `franchise_knowledge` as `pending_review` → a separate
  human activation step — and never automatically.
- **§2:** generators do not read that chain's output at all in the cases the census
  checked; they run on their own independently hardcoded lists (the census found the
  same 10-value archetype vocabulary copied as a private literal in four separate
  files, none importing a shared constant).
- **§4:** a backend seeder copy of the page's "50 Legendary Influencers" content,
  flagged `always_inject: true` and `severity: 'critical'` — the exact combination
  that makes an entry eligible for real prompt injection — has already drifted from
  the frontend's own copy of the same content.

---

## The open ruling: which store is canon?

**Stated as a question for Evoni, not answered here.** Three candidate stores exist
today, per the census: the authoring pages' own data (`page_content`), the Franchise
Brain's extracted entries (`franchise_knowledge`), and `Universe` (per
`PROJECT_CONTEXT.md`'s own F-Franchise-1 description, read by three shallow routes
and no generator). Which of these — if any single one — should be treated as the
source of truth is not decided by this document.

**One proposal, recorded as a proposal:** authoring pages could own *structured*
truth (the actual archetype lists, city lists, rules, and so on, as data), and the
Franchise Brain could become a *derived* index built from that structured truth for
AI consumption, rather than a second, independently-edited store of its own. Under
this framing, `Universe`'s role stays explicitly undecided — the census found it read
by three shallow routes and no generator, and this document does not propose what,
if anything, it should hold going forward.

---

## Proposals

Each of the following is a proposal for Evoni's and future design work to weigh, not
a decision. None is adopted by this document.

- **Generators read structured canon directly**, instead of each carrying its own
  hardcoded copy or re-deriving values from AI-generated prompt text.
- **Structured pages produce Brain entries deterministically**, with no AI extraction
  step for content that is already structured data; AI extraction would be kept only
  for genuinely free-form prose that has no structured source.
- **Reconciliation instead of append.** A page's structured content could be diffed
  against its existing Brain entries on each sync, with each entry classified as new,
  changed, unchanged, conflicting, or retired — rather than every "Push to Brain"
  click unconditionally appending new entries regardless of what already exists.
- **A per-page manifest of what is Brain-worthy**, explicitly excluding UI state and
  editor-only fields, so a page's structured export is scoped to what should actually
  reach a generator.
- **Knowledge kinds a person can read at a glance**: law, rule, fact, guidance — as a
  proposed vocabulary for `franchise_knowledge.category`/`severity`, replacing or
  supplementing the current category/severity/always_inject shape with something a
  non-technical reader can parse without knowing the injection mechanics.
- **"Used by" replacing the opaque `always_inject` flag** — naming which systems or
  generators actually consume a given entry, instead of a single boolean whose effect
  (per the census, §4) is invisible from the entry itself.
- **Source ownership**: each Brain entry could name the authoring page that owns it,
  with a link back to edit the source — so a drifted or wrong entry has an obvious
  place to fix it, rather than requiring another census read to trace it back.
- **Status-aware wording instead of "Push to Brain"** — e.g. "Up to date," "N
  updates," "N conflicts" — reflecting the reconciliation proposal above rather than
  the current single stateless action button.
- **Before-and-after review for changed entries**, one knowledge card per concept
  rather than dozens of small fragments, and a Brain landing page surfacing overall
  health and what needs attention — proposed UI shape for the reconciliation and
  source-ownership proposals above, not designed in detail here.
- **From the Social Systems work** (`F-Franchise-1_SocialSystems_CanonRead_2026-09-
  22.md` §2, §6): treating social archetype and content persona as two genuinely
  separate dimensions rather than one, and a hosting profile per archetype that could
  feed event-hosting suggestions — both proposed extensions, not decided.

---

## Sources

These proposals came out of planning discussion on 2026-09-22, following the
F-Franchise-1 Social Systems census (`docs/audit/F-Franchise-1_SocialSystems_
CanonRead_2026-09-22.md`, Task #1662). They are not independently re-derived from a
repository read by this document — the census is the measured record; this document
is the design conversation that followed it.

| **PRIME STUDIOS** **CHARACTER WORK — SEQUENCING DECISIONS OF 2026-11-21** *Five product decisions by Evoni on how the pending character, privacy and security work is split into pull requests, and on one point of the career contract. A record of decisions only: it specifies no implementation and authorizes none.* |
| --- |

**Document version**

v1.0. New register document. It edits no filed document and carries no banner onto one.

**Basis:** `origin/main` at `c69f7b320710ef0a828a4b77c6c256c2907ba7af`, 2026-11-21.

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** **RULED**, as product decisions only. The five decisions in §1 are Evoni's, given in the session of 2026-11-21 and quoted there. She asked for this entry in that session and saw its text as a draft before it was filed. Merging this file is her approval of the text. It is not an authorization to implement anything: §3 says what remains unapproved.

**Standings used:** RULED (her words in §1, and nothing else in this document); ATTESTED (§2: the session's description of each named item, which stays ATTESTED until an implementation exists and has been verified); MEASURED (§4, a snapshot).

**Task:** none filed for this document.

---

# §1. The decisions (RULED)

Evoni's words, in the session of 2026-11-21:

> "F0 fact-update safety will be its own PR before W3."
>
> "Professional affiliations use public/private visibility only."
>
> "SEC-1 and SEC-2 remain separate security PRs."
>
> "P0a and P0b remain separate PRs."
>
> "P0b includes the required character-link locking changes, subject to concurrency verification."

# §2. What each name refers to (ATTESTED)

These names were used in that session for proposed work. Each row is the session's description of a proposal. None is a description of code: nothing in this table has been implemented or verified, and a later specification may change it.

| Name | What the session proposed under it |
|---|---|
| **F0** | Making a change to a character's facts safe: the character row locked, the new facts computed and written inside one transaction, the fact history written in that same transaction, and the writers that mark a checker flag "intentional" changing only their own key. |
| **W3** | Career roles in the existing fact sheet (`registry_characters.canon_facts`): a career situation, roles, and professional affiliations, as optional facts. |
| **W4** | A role's organization naming a Brand Registry record (`lalaverse_brands`) or a plain employer name. |
| **Affiliation visibility** | In W3, a professional affiliation (brand ambassador, collaborator) is either public or private. The three public-presentation modes proposed for a role (show the actual role, do not disclose, an approved public title) apply to roles and not to affiliations. |
| **SEC-1** | Requiring sign-in and the admin group on the four `GET` routes of `src/routes/scripts.js`, returning only named fields, and never returning an editor's IP address or user agent. |
| **SEC-2** | Requiring the admin group on the other script reads that today check sign-in only. |
| **P0a** | A design-safe character context for place descriptions, a lifestyle cue written by the director in place of the automatic gap, and an estimate with confirmation before the paid text call. |
| **P0b** | A guard on overwriting the description of a scene set that is an approved base or is shared with another character or an event: the current text, the proposed text and what depends on the set are shown, and the overwrite is confirmed against that exact state. |
| **Character-link locking (in P0b)** | The two writers that link a character to a scene set taking a lock on that set's row inside the transaction they already use, so that a link made at the same moment as a guarded overwrite is seen by it. |

# §3. Product rulings, not implementation authorization

The decisions in §1 settle how the work is divided and one point of the career contract. They do not approve any implementation.

- No item in §2 is authorized for implementation by this document. Each needs Evoni's approval of its final scope before any code is written.
- No order among the items is fixed here, beyond F0 coming before W3.
- **The concurrency verification for P0b has not been done.** "Subject to concurrency verification" is her condition on the character-link locking. This document records the condition. It does not discharge it, and it is not evidence that the locking is sufficient.
- No ruling already in the register is changed.

# §4. Repository snapshot (MEASURED)

A snapshot at `origin/main` commit `c69f7b320710ef0a828a4b77c6c256c2907ba7af`, read 2026-11-21. It says nothing about any later commit.

```
$ git log -1 --format='%H %s' origin/main
c69f7b320710ef0a828a4b77c6c256c2907ba7af feat(characters): Life & Locations and Media Gallery as two tabs [skip-automerge] (#3911)
```

At that commit none of F0, W3, W4, SEC-1, SEC-2, P0a or P0b is on `main`.

---

**Type:** decision record.
**Rules:** the five decisions quoted in §1, and nothing else. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** no host, database or Cognito contact. One AWS identity call was attempted in this session for an unrelated read and was rejected; no other AWS call was made.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.

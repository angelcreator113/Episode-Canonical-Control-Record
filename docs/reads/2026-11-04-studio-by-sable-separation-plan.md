# Studio by Sable: brand/character separation plan (2026-11-04)

**Update (Evoni, 2026-11-04, Pulse rulings 8–9):** @studiobysable is the brand's account; Sable's personal relationships are **not** mirrored onto it; **no Registry character is created for the brand** (I6 / D2 below is withdrawn: business relationships attach to the brand record instead, see `2026-11-04-consolidated-implementation-roadmap.md` S2.4); the brand tracks its own regard for Lala, separate from Sable's personal tie.

**Status:** a proposal only. No production record has been created, edited or deleted. Each step in §8 needs Evoni's separate approval before it runs.
**Basis:**
- The production read of 2026-11-04 (audit `2026-11-04-platform-architecture-audit.md` §14).
- Code facts from origin/main `d465cb4a` (§1).
- Evoni's rulings of 2026-11-04, quoted here as R1–R9:
  1. `@studiobysable` represents the official Studio by Sable business account.
  2. Sable Okonkwo-Reyes remains the authoritative person in the Character Registry.
  3. Propose a separate Studio by Sable brand record, with Sable linked as founder. Do not create it yet.
  4. Preserve all existing historical records, posts and relationships.
  5. Do not confirm either romance until the original relationship sources and story intent are reviewed.
  6. Keep Ori Beauty's mentor/client/rival relationships unresolved until their meanings and origins are reviewed.
  7. Echo Park in Dream Cities is the intended current home. Audit real-world Los Angeles references before proposing corrections.
  8. Spring Capsule compensation is unspecified, not zero or unpaid.
  9. Verify that "Fit Check with Stable" refers to Sable before proposing the spelling correction.

**Still to come:** a second read-only query (§9) covering relationship provenance, the "Fit Check" event, the LA references and the other parties' identities. Rows marked *pending Q…* wait for it.

---

## 1. How the code expresses person vs brand today

**What exists (no migration needed):**

| Link | Where | Meaning |
|---|---|---|
| Brand account | `social_profiles.full_profile` keys `account:'brand'`, `lalaverse_brand_id`, `lalaverse_brand_slug` | This profile speaks for that brand. Today these are written only by `brandPulse.ensureAccounts`, for new accounts. |
| Person's own profile | `registry_characters.feed_profile_id` | The character's Pulse profile. The index is not unique; `castRoutes` refuses a second live claim. |
| Company stand-in | `registry_characters.extra_fields.company_id` | This character *is* the company. It is written by `companyCharacters.linkCharacter` (`PUT /api/v1/companies/:slug/registry-character`). |
| Representative | `registry_characters.extra_fields.brand_id` / `representative_of` | Works for the brand. |
| Deal → brand | `opportunities.company_id` | A real foreign key to `lalaverse_brands`, set by `brandProfile.linkDeal`. |
| Event → brand | `world_events.host_brand` | Text; matched by name. |
| Founder | `lalaverse_brands.founder` | Text, shown "as recorded". |
| Brand post | `feed_posts.gate_json.brand` | Set by `brandPulse.saveDraft`. |

**Gaps (each needs a migration and separate approval):**
- G1. `founder` is text, not a link to the founder's character.
- G2. "Brand account" lives only in jsonb. Crossing a profile into the Registry (`crossProfile`, `socialProfileRoutes`) has no brand check: a brand account crosses into a *person* character carrying the creator's real name. **This is how the merge most likely happened** (`selected_name` = `creator_name`, `display_name` = the account's name).
- G3. `world_events.host_brand` is text, with no brand id.
- G4. `world_locations` has no owner or brand column.
- G5. `feed_posts` has no brand column.
- G6. A brand can be a relationship party only through a company stand-in character.
- G7. Relationship provenance: `character_relationships.seed_*` exists only for rows from 2026-10-24 onward. `social_profile_relationships` has no `deleted_at`.
- G8. Character-place scene sets carry no `world_location_id`.

---

## 2. Identity records

| # | Record | Today | Proposed | Mechanism | Rulings |
|---|---|---|---|---|---|
| I1 | Registry character `c4931651` (`studiobysable`, accepted) | `display_name` "STUDIO BY SABLE", `selected_name` "Sable Okonkwo-Reyes", `feed_profile_id` 447 | Remains **the person**. `display_name` becomes "Sable Okonkwo-Reyes". `character_key` stays `studiobysable`: it is the slug other records reference, and renaming it would break them. Description reworded from "Social media creator (instagram)" to the person, only on Evoni's wording. | Registry edit (the Registry owns identity) | R2, R4 |
| I2 | New brand record | none | `lalaverse_brands`: slug `studio-by-sable`, name "Studio by Sable", kind `brand`, category fashion/design, founder "Sable Okonkwo-Reyes" (text until G1). `partnership_status` empty (no deal with Prime Studios is implied). | `POST /api/v1/companies` (`brandProfile.createCompany`) | R3 |
| I3 | Pulse profile 447 `@studiobysable` | Live, `crossed`, creator Sable Okonkwo-Reyes, no account marker | **The studio's official account.** Its `full_profile` gains `account:'brand'`, `lalaverse_brand_id` and `lalaverse_brand_slug`. `display_name` and `creator_name` stay (creator = the founder behind it). Handle, posts and status stay. | jsonb update (no endpoint attaches an existing profile; G2) | R1, R4 |
| I4 | Pulse profile 446 (deleted 2026-09-25, Sable Orin Voss, Dazzle District) | Deleted | Untouched; kept as history | n/a | R4 |
| I5 | Link between person and account | `c4931651.feed_profile_id = 447` | **Decision D1:** keep the link until Sable has a personal profile, or clear it. See the note below. | Registry edit | R1, R2 |
| I6 | ~~Company stand-in character (optional)~~ **Withdrawn (ruling 9)** | none | **Decision D2:** only if brand-to-brand relationships (rival_brand, client_partner) are to be recorded under the brand. That is how the system records a company party today (G6). Not proposed until §5 is reviewed. | `companyCharacters.linkCharacter` | R3, R6 |

**Note on I5.** While 447 is linked as her `feed_profile_id`, code that treats a character's linked profile as her own voice will speak as the studio. That code is `syncStoryPair`, which mirrors her story relationships onto 447, plus the Pulse voice and character talk. That is acceptable for business relationships and wrong for personal ones such as romances. Two clean options:
- Clear the link and later give Sable a personal profile.
- Keep it and accept that her personal story pairs mirror onto the studio account.

**Side effects of marking 447 as a brand account (I3)**, all existing code:
- `families.js` stops offering it for families.
- `dealTermsDraftService` treats it as the brand's own account.
- `brandProfile.accountOf` lists it on the brand page.
- `beat14Opportunity.fitContext`, `postPictures` and `postFormatMix` give it brand-account treatment in drafting and pictures.

None of these rewrites existing posts.

---

## 3. Locations and scene sets

| # | Record | Today | Proposed | Rulings |
|---|---|---|---|---|
| L1 | `world_locations` `cccb4abe` "STUDIO BY SABLE's Showroom", city Echo Park, boutique | Live; home of 447 | Stays the studio's showroom in **Echo Park (Dream City)**, which is correct per R7. A rename to "Studio by Sable Showroom" is optional and cosmetic. Brand ownership is shown on the brand page through 447's `home_location_id` until G4. | R7 |
| L2 | `world_locations` `cc428e69` "studio by sable's Studio", Dazzle District | Deleted 2026-10-04 | Untouched | R4 |
| L3 | Scene set `5a82a3c8` "STUDIO BY SABLE's Studio" → L1 | Live | Stays; belongs to the studio | R4 |
| L4 | Scene set `ca7f427c` "Sable Okonkwo-Reyes's Place of work" | Live; no location | Her character place (made by `CharacterPlacesTab`). Her workplace is the studio, so linking it to L1 is proposed (needs G8, or a scene-set edit). *Pending Q9* to confirm it is her `character_places` row. | R2 |
| L5 | Scene sets `8582b24f`, `deaddbf4`, `aa92ea9b`, `d4828294`, `4526d1cd` | Deleted | Untouched | R4 |

**Terminology for R7.** In the code, Echo Park is one of the five **Dream Cities** (`utils/lalaHome.js` `DREAM_CITIES`: Dazzle District, Radiance Row, Echo Park, Ascent Tower, Maverick Harbor), not a district inside one. The live profile's `city` is `echo_park`, which is correct. Its `geographic_base` reads "Echo Park, Los Angeles, CA". That is the real-world reference R7 asks to audit.

**Where real-world LA text comes from.** No code or seed writes "Los Angeles, CA". The Pulse generator's real-world prompt examples are "City, State" (`socialProfileRoutes` PROMPT_EXAMPLES), and "Echo Park" is also a real LA neighbourhood, so the model completes it as Los Angeles. Q8 lists every such row before any correction is proposed. The likely correction is to `geographic_base` (and `geographic_cluster`) prose only, never the `city` key.

---

## 4. Events (hosting)

The host is free text today. The proposal adds the brand without rewriting history: `host_brand` = "Studio by Sable" on live, unused events only. `host` stays as written.

| # | Event | Status | Proposed | Rulings |
|---|---|---|---|---|
| E1 | `975357d1` Wearable Experiments Studio Session (11-12) | **used** in Episode 1 | **No change.** Accepted history; the brand page lists it through `source_profile_id = 447`. | R4 |
| E2 | `86725440` Fabric and Form (11-12) | draft | `host_brand` "Studio by Sable" | R3 |
| E3 | `f4e8abb8` Fit Check with Stable (11-09) | draft; no `source_profile_id` | *Pending Q6.* Only if its text and origin show it is Sable's: rename to "Fit Check with Sable", set `host_brand` and `source_profile_id = 447`. Otherwise leave it. | R9 |
| E4 | `86f1fbb5` Studio by Sable — Spring Capsule Campaign Model (12-09) | ready; linked to opportunity O1 | `host_brand` "Studio by Sable". `host` "@studiobysable" may stay (it names the account). | R3 |
| E5 | `9f087fa9` STUDIO BY SABLE — follow-up (12-10) | draft | `host_brand` "Studio by Sable" | R3 |
| E6 | `71a07f8c`, `205cae97`, `75ea0428`, `91d8c80d` | deleted | Untouched | R4 |

---

## 5. Opportunity

| # | Record | Today | Proposed | Rulings |
|---|---|---|---|---|
| O1 | `534484e6` Spring Capsule Campaign Model | booked; `brand_or_company` empty; `company_id` empty; contact Sable Okonkwo-Reyes; connector 447; `payment_amount` 0.00; offered in Episode 1 | Link `company_id` to the brand (I2) and set `brand_or_company` "Studio by Sable". The contact stays Sable (the founder is the right contact). The connector stays 447 (the studio's account introduced it). **Compensation is "unspecified" (R8):** the stored 0.00 must not read as "unpaid". Proposed: record the terms as *to be confirmed* (a NULL amount if the column and the money flows allow it, checked first), with no ledger entry either way. Status `booked` unchanged. | R3, R4, R8 |

---

## 6. Relationships (preserve everything; confirm nothing)

**How changes would be made (R4).** No row is deleted, rewritten or re-pointed in place. If a business relationship is later moved to the brand, the move is a **new** row on the brand side, and the original is kept with a note. Each move is listed and approved one at a time.

**Registry** (`character_relationships`; provenance *pending Q3*):

| # | Pair (with Sable) | Type | Level | Proposed handling |
|---|---|---|---|---|
| R-1 | First Light Studio | rival_brand | business | Candidate to move to the brand. *Pending Q4:* is First Light a person or a company? |
| R-2 | Velour Atelier | client_partner | business | Candidate to move to the brand |
| R-3 | SHOWROOM.LUX | rival | unclear | *Pending Q4* (a brand account or a person?) |
| R-4 | slowsift | love_interest (romantic) | person | **Unconfirmed (R5).** Stays with Sable; no status change. |
| R-5 | thriftveil (Declan Ferris) | rival | person | Stays with Sable |
| R-6 | velvetcore (Marisol Vega) | love_interest (romantic) | person | **Unconfirmed (R5).** Stays. |
| R-7 | velvetcore | friend | person | Stays. Whether friend and love interest are one arc or a contradiction is part of the R5 review. |
| R-8 | Ori Beauty | represents | unclear | **Unresolved (R6).** No change. |
| R-9 | Ori Beauty | rival_brand | business | **Unresolved (R6).** No change. |
| R-10 | Lala | collaborator | person | Stays with Sable. Lala's Episode 1 event was the studio's, so a brand-side collaborator row is a later option. |

**Pulse** (`social_profile_relationships` on 447):
- All six rows read "From the story: …", which means `relationshipTruth.syncStoryPair` mirrored them from the Registry rows above (*pending Q2* to confirm `auto_generated = false` and their `character_relationship_id`).
- They change only if their Registry source changes. They are never edited directly.
- The Pulse "mentor" with oribeauty mirrors one Ori Beauty row; Q2/Q3 show which.

**Review inputs for R5/R6 (from Q2–Q4):**
- each row's `seed_source`, `seed_why` and `seed_basis`;
- `notes` and `situation`;
- when it was created, and whether it predates 2026-10-24 (no provenance);
- whether the other party is a company stand-in.

---

## 7. Posts

| # | Record | Proposed | Rulings |
|---|---|---|---|
| P1 | 5 posts by 447 (all 2026-10-17) | Unchanged, still attributed to 447, which is now understood as the studio's account. No `gate_json.brand` backfill. | R1, R4 |
| P2 | 2 posts mentioning Sable | Unchanged. *Pending Q7* to read what they say. | R4 |

---

## 8. Proposed order (each step separately approved, snapshot first, with its undo)

1. **Review** (read only): Evoni runs `sable-followup.sql` (§9). Then decide R5 (romances), R6 (Ori Beauty), E3 (Fit Check), D1 and D2.
2. **Create the brand** (I2). *Undo:* soft-delete the brand row; nothing else references it yet.
3. **Mark 447 as the brand's account** (I3). *Undo:* remove the three `full_profile` keys.
4. **Link the opportunity** (O1 `company_id`, `brand_or_company`; compensation as "to be confirmed"). *Undo:* restore the previous values from the snapshot.
5. **Brand on live events** (E2, E4, E5, plus E3 if verified). *Undo:* set `host_brand` back to NULL (and E3's name back).
6. **Rename the person** (I1 `display_name`). *Undo:* restore "STUDIO BY SABLE".
7. **The person/account link** (D1) and any brand-side relationships, after the review.
8. **Location text** after the LA audit (Q8): correct `geographic_base` prose only. *Undo:* from the snapshot.

**Code changes to stop this recurring** (separate PRs, not part of the data steps):
- G2: crossing a brand account must create or link a company stand-in, not a person.
- G1/G3: real brand links for founder and event host.

---

## 9. Follow-up read-only query (for Evoni to run)

File: `sable-followup.sql`. It is validated on the test database: 11 statements, all ran.

| Query | What it reads |
|---|---|
| Q1 | Profiles 446/447 with every character claiming them; `known_associates` and `brand_partnerships` (where generated relationships came from) |
| Q2 | Pulse pairs of 447 with origin (autoLink vs story mirror) |
| Q3 | Registry pairs of Sable with `seed_*` provenance, notes, situation and dates |
| Q4 | Whether each other party is a company stand-in or a brand account; matching brand rows |
| Q5 | All events and deals from or naming Sable, with automation origin |
| Q6 | "Fit Check with Stable" in full |
| Q7 | Sable's posts and the posts that mention her |
| Q8 | Real-world LA references across profiles, locations, characters, events and posts |
| Q9 | Sable's character places and their scene sets |

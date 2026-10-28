# B3 — Character Voice Identity (design note, not implementation)

**Status:** design note only (Evoni, 2026-10-28). Nothing here is built, migrated or scheduled. B3 needs its own design review and approval before any code. It builds on `docs/reads/2026-10-27-voice-studio-timeline-design.md` (Revision 7) and changes nothing in it.

**Naming:** The Pulse is the official name of LalaVerse's in-universe social media (Evoni, 2026-10-28). It is used here only where a voice identity's permitted uses are listed.

## 1. What a voice identity is

A **voice identity** is a reusable, versioned description of how a character sounds, made from **authorized reference recordings**. A character profile (Character Registry) may eventually reference one.

It is **not** a dialogue take. The two stay separate:

| | Voice identity (B3) | Approved dialogue take (B1/B2) |
|---|---|---|
| What it is | How a character sounds; reference material and settings | One recording of one script line |
| Belongs to | A character profile | An episode's line (association + approval) |
| Versioned by | Identity versions (immutable once published) | Candidate revisions; approvals pin one |
| Validity | Consent and permitted use (§3) | Script revision, save number, line context, re-confirmation (R6) |
| Plays in | Nothing directly | The Teleprompter and the edit, while current |

**Rules that keep them apart:**
- An approval never names a voice identity, and an identity never names an approval. A take may record which identity version it was made with, as **provenance only**. That field never makes a take current, approved or playable.
- Approving, re-confirming or withdrawing a take never changes an identity. Publishing, revising or retiring an identity never changes an approval's state. Each keeps its own rules: B1's approval and script-revision rules stay the one approval system.
- A reference recording is never a dialogue take, and a dialogue take is never used as reference material unless it is added through §3's authorization, as a new reference with its own record.

## 2. Shape (for B3's own design, not decided here)

- **Voice identity:** `character_id`, `name`, status (`draft`, `published`, `retired`).
- **Identity version:** immutable once published. It names its reference recordings and settings and has a content hash. Revising makes a new version; the old one stays readable.
- **Reference recording:** immutable source media, stored and hashed like B1's `voice_source_assets`, plus the speaker and the authorization record that covers it.
- **Authorization record:** see §3. Without a valid one, a reference recording can't be used in any identity version.

## 3. Consent and permitted use (real speakers)

A voice identity made from a **real person's** voice needs that person's informed, recorded consent before any reference recording is used. This applies to Evoni herself, guests and any voice actor.

**What the authorization records:**
- **Who:** the speaker, identified, and who collected the consent.
- **When:** when it was given; an expiry if there is one.
- **The recordings it covers.**
- **Permitted uses:** each allowed explicitly. Nothing is implied by another:
  - episode dialogue for named shows;
  - promotional material;
  - The Pulse (in-universe social posts);
  - the character's other appearances;
  - synthetic or generated speech, if ever offered. This is never assumed from recording consent alone, and needs its own explicit grant.
- **Excluded uses:** what the speaker refused.
- **Revocation:** how the speaker withdraws.
- **The signed terms:** a stored, unchangeable copy.

**Rules:**
- **No consent, no use.** An identity version can't be published while any of its reference recordings lacks an authorization covering the intended use.
- **Use is checked at the point of use.** Each consumer checks permitted use for what it is about to do, not only when the identity is made.
- **Revocation stops future use.** It retires the identity versions that depend on those recordings, and is recorded with who and when. Already published episodes are handled by a documented, separate decision. Nothing is deleted silently, and nothing keeps being used silently.
- **Fictional characters voiced by real people** still need the real speaker's consent; the character's name doesn't replace it.
- **Minors, or speakers who can't consent themselves:** out of scope until Evoni rules on them.
- **Privacy:** reference recordings and authorization records are not publicly readable. This differs from today's dialogue audio, which plays from public asset-bucket URLs (B2 audit, 2026-10-28). B3 needs private storage and signed, short-lived read links.
- **Audit:** every grant, use check, publish, retire and revocation is a row with who and when.

## 4. Out of scope for B3's first step

Synthetic voice generation, voice cloning services and any third-party processing of reference recordings. Each would need its own ruling and its own permitted-use entry.

## 5. Open questions for Evoni

1. Which uses (§3) are wanted first?
2. Where do signed consent documents live, and who may read them?
3. What happens to published episodes when a speaker revokes consent?
4. Should a take record its identity version as provenance (§1), or not at all?

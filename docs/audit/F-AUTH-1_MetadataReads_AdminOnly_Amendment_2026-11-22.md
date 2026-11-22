| **PRIME STUDIOS** **F-AUTH-1 — THE METADATA READS ARE AN ADMIN'S (AMENDMENT)** *Corrects the classification of the five `GET` routes of `src/routes/metadata.js`, recorded as Tier 4 public at F-AUTH-1 Step 3 CP12. They answered anyone, signed in or not, with whole `metadata_storage` rows, a video's transcription and extracted text among them. By Evoni's decision of 2026-11-22 they need a sign-in in the admin group.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `6bd60d84386836fe5aa72dde2212ed58be17b1b0` (2026-11-22), plus branch `claude/metadata-reads-admin`.

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's word in the session of 2026-11-22. Merging this file with the change it describes is her approval of the text.

**Standings used:** RULED (her words in §2); MEASURED (the repository reads in §1 and §3, each with its command or file); INFERRED (marked where used).

---

# §1. What is amended

## The classification as it stood (MEASURED)

- **`F-AUTH-1_Fix_Plan_v2.37.md` line 2213** records the file's shape at CP12: "#13: metadata.js Tier 2-eq+4 shape (NO-Tier-1 ARCHITECTURAL FIRST) — 5 bare GETs Tier 4 + 5 Tier 2-equivalent (requirePermission preserved)".
- **The same file, line 1712**, defines the tier: "Tier 4 — plain optionalAuth (LOCKED PUBLIC where req.user not consumed). Published-only data routes that don't personalize per-user."
- **`F-AUTH-1_Limb1_CP12_Confirmation_2026-09-02.md` line 196** confirms the five writes as Tier 2-equivalent. This amendment does not touch them.

On `main` at the basis the five reads carried `optionalAuth`, under a `// PUBLIC:` comment:

```
$ git show origin/main:src/routes/metadata.js | grep -n "^router\.get"
23:router.get('/', optionalAuth, asyncHandler(metadataController.listMetadata));
26:router.get('/ALL', optionalAuth, asyncHandler(metadataController.listMetadata));
29:router.get('/:id', optionalAuth, asyncHandler(metadataController.getMetadata));
32:router.get('/:id/summary', optionalAuth, asyncHandler(metadataController.getMetadataSummary));
35:router.get('/episode/:episodeId', optionalAuth, asyncHandler(metadataController.getMetadataForEpisode));
```

## Why the classification was wrong

- The five routes were placed in Tier 4 because they do not read `req.user`. That is a statement about the handlers, not about the data. It is the same error the amendment of 2026-11-21 corrected for the scripts reads (`F-AUTH-1_ScriptsReads_AdminOnly_Amendment_2026-11-21.md`).
- The tier's own definition is "published-only data". Nothing in these handlers filters by a published state.
- The data is production analysis. `src/models/MetadataStorage.js` describes its columns as "Text extracted via OCR from episode" (`extractedText`), "Speech-to-text transcription" (`transcription`), detected scenes, sentiment analysis and detected objects.
- No ruling that this data is public was found in the register.
- Evoni's admin-only ruling of 2026-10-29 (`F-AUTH-1_RolesJs_XK-3_HoldLifted_Amendment_2026-10-29.md`: "Prime Studios is an admin-only production environment") is later than the classification and contradicts it.

## What the routes answered (MEASURED, from `src/controllers/metadataController.js` at the basis)

To any caller, with or without a sign-in:

- `GET /api/v1/metadata` and `/ALL` (`listMetadata`): every row, paged, each whole, with its episode's id and title.
- `GET /api/v1/metadata/:id` (`getMetadata`) and `GET /api/v1/metadata/episode/:episodeId` (`getMetadataForEpisode`): one whole row.
- `GET /api/v1/metadata/:id/summary` (`getMetadataSummary`): counts, and whether the extracted text and the transcription are present; not their text.

Not established: whether production's `metadata_storage` table holds rows, or whether any row holds a transcription. No database was read for this amendment, and no route was called on any deployed site. Evoni's instruction was not to wait for that (§2).

# §2. The decision (RULED)

Evoni, in the session of 2026-11-22:

> "I authorize a separate, urgent security PR protecting the unauthenticated metadata read routes."
>
> "Use the existing ADMIN authentication and authorization middleware."
>
> "Do not wait for database inventory results to protect a route that is not intended to be public."

No public contract for this data is created.

# §3. What the change does (MEASURED on the branch)

```
$ grep -n "^router\.get" src/routes/metadata.js
27:router.get('/', requireAuth, authorize(['ADMIN']), asyncHandler(metadataController.listMetadata));
30:router.get('/ALL', requireAuth, authorize(['ADMIN']), asyncHandler(metadataController.listMetadata));
33:router.get('/:id', requireAuth, authorize(['ADMIN']), asyncHandler(metadataController.getMetadata));
36:router.get('/:id/summary', requireAuth, authorize(['ADMIN']), asyncHandler(metadataController.getMetadataSummary));
39:router.get('/episode/:episodeId', requireAuth, authorize(['ADMIN']), asyncHandler(metadataController.getMetadataForEpisode));
```

- **Sign-in and group.** The existing `requireAuth` (401) and `authorize(['ADMIN'])` (403). No new role, group or membership check.
- **What an admin reads** is unchanged: the controller is not edited.
- **The five writes** of the file are unchanged (`requireAuth` then `requirePermission('metadata', <verb>)`).
- **Tests.** `tests/unit/routes/metadata-reads-admin-only.test.js` (behaviour, through the real router and auth middleware: signed out, a token that is not one, signed in but not an admin, an admin; the transcription and the extracted text in each case) and `tests/unit/routes/cp12-metadata-tier.test.js` (the route declarations; it pinned the five reads as public and now pins them as an ADMIN's).

# §4. What this amendment does not cover

- **The writes of this file.** Their `requirePermission` chain is as CP12 left it.
- **Stored rows.** No row of `metadata_storage` is changed or removed.
- **Other reads of script or production text.** Each is its own change (the script reads, the episode reads); none is made here.
- **Deployment.** This amendment records a change to the repository. It says nothing about what is running on any server.

---

**Type:** amendment.
**Rules:** the five `GET` routes of `src/routes/metadata.js` are an ADMIN's, on Evoni's words in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** no database or Cognito contact. One AWS identity call was attempted earlier in this session for an unrelated read and was rejected; no other AWS call was made. One request to the development site's `/health` was attempted from this session and was refused by the session's own network policy before it left.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.

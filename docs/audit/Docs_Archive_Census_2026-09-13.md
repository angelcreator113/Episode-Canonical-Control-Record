| **PRIME STUDIOS** **DOCS ARCHIVE CENSUS — 2026-09-13** *A filed census of every top-level `docs/*.md` file at `origin/main` — date, first heading, size, §9 status, inbound references, and a proposed disposition, so Evoni can rule the archive list by name. Moves nothing. Proposes; does not decide.* |
| --- |

***Provenance:*** *filed 2026-09-13, Task #1408. Standalone census note, no register number, no chain amendment. Mints nothing. Ships no code. Moves, renames, deletes, or edits nothing under `docs/`. All claims below are MEASURED (repo read, command and raw output pasted) unless marked otherwise; every disposition is PROPOSED, not RULED.*

# Docs Archive Census — 2026-09-13

**Basis:** `origin/main` at `7259857fb6c99249be177eb679dfc6aacb618ce8`, derived live and reconfirmed unchanged immediately before filing.

```
$ git rev-parse origin/main
7259857fb6c99249be177eb679dfc6aacb618ce8
```

**Status.** Records one population enumeration, one per-file metadata pass, one §9 cross-read, and one inbound-reference cross-check, against this basis. Produces 345 PROPOSED dispositions (315 ARCHIVE, 26 UNSURE, 4 KEEP). **Rules nothing.** Evoni rules the list; a second, separate task performs any move.

**Scope.** Top level of `docs/*.md` only, per Task #1408. Does not descend into `docs/audit/`, `docs/archive/` (does not exist at this basis), or any other subdirectory. Out of population: `.md` files elsewhere in the repo, and the non-`.md` identifier files `docs/cognito-ids.txt`, `docs/rds-endpoint-dev.txt`, `docs/connect-to-ec2.txt` (named by PROJECT_CONTEXT.md §9 but not `.md`, so outside this task's population by its own instrument).

---

## Sec 1. Population, enumerated live from `origin/main`

```
$ git ls-tree --name-only origin/main docs/ | grep '\.md$' | wc -l
345
```

Full raw output (345 lines) of `git ls-tree --name-only origin/main docs/ | grep '\.md$'`:

```
docs/000_READ_ME_FIRST.md
docs/00_NEXT_STEPS_ROADMAP.md
docs/ACTION_PLAN.md
docs/ADVANCED_FEATURES_SUMMARY.md
docs/ALB_NETWORKING_INVESTIGATION_REPORT.md
docs/ALL_ISSUES_FIXED.md
docs/ANALYTICS_INSTALL_CHECKLIST.md
docs/ANIMATIC_PLAYER_INTEGRATION.md
docs/API_QUICK_REFERENCE.md
docs/API_REFERENCE.md
docs/APPLICATION_RUNNING.md
docs/AWS_SETUP.md
docs/CHARACTER_REGISTRY_AUDIT.md
docs/CLOUDSHELL_MIGRATION_GUIDE.md
docs/COGNITO_USER_POOL_SETTINGS.md
docs/COMPLETE_APPLICATION_DOCUMENTATION.md
docs/COMPLETE_PROJECT_STATUS.md
docs/COMPLETION_CHECKLIST.md
docs/COMPOSER_REDESIGN_IMPLEMENTATION_GUIDE.md
docs/COMPOSER_VISUAL_REFERENCE.md
docs/COMPOSITION_QUICK_REFERENCE.md
docs/COMPOSITION_SYSTEM_COMPLETE.md
docs/CONTROLLER_FIXES_SUMMARY.md
docs/CORS_FIX_COMPLETE.md
docs/COVERAGE_ROADMAP.md
docs/COVERAGE_SESSION_REPORT.md
docs/CREATE_EPISODE_ENHANCEMENTS.md
docs/CREATE_EPISODE_QUICK_START.md
docs/CREATE_EPISODE_VISUAL_GUIDE.md
docs/CRITICAL_ISSUES.md
docs/CSS_REDESIGN_COMPLETE.md
docs/CURRENT_ASSET_SYSTEM_OVERVIEW.md
docs/CURRENT_STATUS_AND_PLAN.md
docs/DATABASE_SETUP_GUIDE.md
docs/DEBUG_EDIT_EPISODE_CATEGORIES.md
docs/DEPENDENCY_VULNERABILITIES.md
docs/DEPLOYMENT.md
docs/DEPLOYMENT_COMPLETE.md
docs/DEPLOYMENT_CONTROL_GUIDE.md
docs/DEPLOYMENT_GUIDE.md
docs/DEPLOYMENT_GUIDE_PHASE_3.md
docs/DEPLOYMENT_GUIDE_PHASE_3A_4.md
docs/DEPLOYMENT_MONITOR.md
docs/DEPLOYMENT_QUICK_REFERENCE.md
docs/DESIGN_IMPROVEMENTS_COMPLETE.md
docs/DESIGN_TOKENS_GUIDE.md
docs/DETAILED_BREAKDOWN.md
docs/DNS_PROPAGATION_COMPLETE.md
docs/DOCUMENTATION_INDEX.md
docs/DOCUMENTATION_INDEX_CATEGORIES.md
docs/DOMAIN_SETUP_COMPLETE.md
docs/EC2_SHARP_SETUP_GUIDE.md
docs/EDIT_MAPS_DEPLOYMENT_GUIDE.md
docs/EDIT_MAPS_DOCUMENTATION_INDEX.md
docs/EDIT_MAPS_FINAL_SUMMARY.md
docs/EDIT_MAPS_IMPLEMENTATION_SUMMARY.md
docs/EDIT_MAPS_QUICK_REFERENCE.md
docs/ENHANCEMENTS_SUMMARY.md
docs/ENVIRONMENT_SETUP_GUIDE.md
docs/ENVIRONMENT_STATUS_REPORT.md
docs/ENV_VARIABLES.md
docs/EPISODES_PAGE_IMPROVEMENTS.md
docs/EPISODE_CARD_CATEGORIES_FIX.md
docs/EPISODE_DETAIL_REDESIGN_SUMMARY.md
docs/EXECUTE_NOW.md
docs/EXECUTION_SUMMARY.md
docs/FEATURE_FLAG_IMPLEMENTATION_COMPLETE.md
docs/FEATURE_FLAG_VISUAL_GUIDE.md
docs/FILE_CLEANUP_VERIFICATION_REPORT.md
docs/FILE_INDEX.md
docs/FILE_MANIFEST_ALL_CHANGES.md
docs/FILE_STRUCTURE.md
docs/FILE_SYNC_REPORT.md
docs/FINAL_DELIVERY_SUMMARY.md
docs/FIX_GITHUB_DEPLOYMENT.md
docs/FIX_SUMMARY.md
docs/FRONTEND_TESTING_CHECKLIST.md
docs/FULL_STACK_READY.md
docs/GAME_SHOW_CONFIGURATION_EXAMPLES.md
docs/GAME_SHOW_DEPLOYMENT_CHECKLIST.md
docs/GAME_SHOW_FEATURES_IMPLEMENTED.md
docs/GAME_SHOW_IMPLEMENTATION_SUMMARY.md
docs/GAME_SHOW_MASTER_INDEX.md
docs/GAME_SHOW_QUICK_START.md
docs/GAME_SHOW_README.md
docs/GITHUB_DEPLOYMENT_SETUP.md
docs/GITHUB_REPOSITORY_AUDIT.md
docs/GITHUB_SECRETS_SETUP.md
docs/HANDOFF_SUMMARY.md
docs/HOME_PAGE_DEBUG_GUIDE.md
docs/HOW_TO_DOWNLOAD_CERTIFICATE.md
docs/ICON_CUE_QUICK_START.md
docs/ICON_CUE_TIMELINE_INSTALLATION_COMPLETE.md
docs/IMAGE_PROCESSING_COMPLETE.md
docs/IMAGE_PROCESSING_SETUP.md
docs/IMPLEMENTATION_COMPLETE.md
docs/IMPLEMENTATION_DETAILS.md
docs/IMPLEMENTATION_SESSION_SUMMARY.md
docs/IMPROVEMENTS_COMPLETED.md
docs/INDEX.md
docs/INFRASTRUCTURE_SETUP_SUMMARY.md
docs/INTEGRATION_COMPLETE.md
docs/INTEGRATION_TESTING_RESULTS.md
docs/INTEGRATION_TEST_RESULTS.md
docs/JS_BUNDLE_FIX.md
docs/JUSTAWOMAN_IMPLEMENTATION_COMPLETE.md
docs/LALA_FORMULA_MIGRATION.md
docs/LAYER_API_REFERENCE.md
docs/LIVE_TESTING_WORKFLOW.md
docs/LOCAL_DEV_LOGIN.md
docs/LOGIN_FIX_REPORT.md
docs/MANUAL_TESTING_GUIDE.md
docs/MERGE_INSTRUCTIONS.md
docs/MIGRATE_NOW.md
docs/MOBILE_RESPONSIVENESS_AUDIT.md
docs/OPTION_A_AND_C_IMPLEMENTATION.md
docs/PHASE1_NGINX_HTTPS_SETUP.md
docs/PHASE2_ALB_DEPLOYMENT_COMPLETE.md
docs/PHASE2_ALB_MANUAL_DEPLOYMENT.md
docs/PHASE2_ALB_SETUP.md
docs/PHASE2_WEEK1_MARKERS_SETUP.md
docs/PHASE_1_COMPLETE_SUMMARY.md
docs/PHASE_2.5_ANIMATIC_SYSTEM_COMPLETE.md
docs/PHASE_2.5_AWS_SDK_V3_COMPLETE.md
docs/PHASE_2.5_FINAL_STATUS_REPORT.md
docs/PHASE_2.5_GALLERY_ENHANCEMENT.md
docs/PHASE_2.5_IMPLEMENTATION_COMPLETE.md
docs/PHASE_2.5_INDEX.md
docs/PHASE_2.5_QUICK_REFERENCE.md
docs/PHASE_2.5_QUICK_TEST.md
docs/PHASE_2.5_READY_FOR_TESTING.md
docs/PHASE_2.5_TESTING_GUIDE.md
docs/PHASE_2.5_TEST_RESULTS.md
docs/PHASE_2A_EXECUTION_GUIDE.md
docs/PHASE_2A_PACKAGE_SUMMARY.md
docs/PHASE_2A_PROGRESS_TRACKER.md
docs/PHASE_2A_QUICK_REFERENCE.md
docs/PHASE_2A_READY_NOW.md
docs/PHASE_2A_START_HERE.md
docs/PHASE_2B_COMPLETION.md
docs/PHASE_2B_START_HERE.md
docs/PHASE_2C_START_HERE.md
docs/PHASE_2D_COMPLETE.md
docs/PHASE_2D_START_HERE.md
docs/PHASE_2_READY_TO_EXECUTE.md
docs/PHASE_2_SCAFFOLDING_CHECKLIST.md
docs/PHASE_2_SESSION_SUMMARY.md
docs/PHASE_2_START_HERE.md
docs/PHASE_2_STATUS.md
docs/PHASE_2_VERIFICATION_REPORT.md
docs/PHASE_2_WEEK1_FRONTEND_SETUP.md
docs/PHASE_3A_1_COMPLETION_REPORT.md
docs/PHASE_3A_2_UNIT_TESTS_REPORT.md
docs/PHASE_3A_3_INTEGRATION_TESTS_REPORT.md
docs/PHASE_3A_4_1_2_PROGRESS.md
docs/PHASE_3A_4_3_5_GUIDE.md
docs/PHASE_3A_4_ARCHITECTURE.md
docs/PHASE_3A_4_COMPLETION_REPORT.md
docs/PHASE_3A_4_DOCUMENTATION_INDEX.md
docs/PHASE_3A_4_INTEGRATION_PLAN.md
docs/PHASE_3A_4_QUICK_REFERENCE.md
docs/PHASE_3A_4_READY_TO_BEGIN.md
docs/PHASE_3A_COMPLETE_SUMMARY.md
docs/PHASE_3A_COMPOSITION_VERSIONING.md
docs/PHASE_3A_FOUNDATION_COMPLETE.md
docs/PHASE_3A_IMPLEMENTATION_GUIDE.md
docs/PHASE_3A_INDEX.md
docs/PHASE_3A_QUICK_REFERENCE.md
docs/PHASE_3A_START_HERE.md
docs/PHASE_3A_STATUS_CURRENT.md
docs/PHASE_3B_ADVANCED_FILTERING_COMPLETE.md
docs/PHASE_3_ACTUAL_STATUS.md
docs/PHASE_3_API_TESTING_REPORT.md
docs/PHASE_3_BUILD_STATUS.md
docs/PHASE_3_COMPLETION.md
docs/PHASE_3_DELIVERABLES_SUMMARY.md
docs/PHASE_3_DEPLOYMENT_STATUS.md
docs/PHASE_3_FEATURE_EXPANSION_PLAN.md
docs/PHASE_3_FRONTEND_COMPLETE.md
docs/PHASE_3_IMPLEMENTATION_COMPLETE.md
docs/PHASE_3_QUICKSTART.md
docs/PHASE_3_QUICK_REFERENCE.md
docs/PHASE_3_READY_TO_TEST.md
docs/PHASE_3_ROUTING_COMPLETE.md
docs/PHASE_3_SESSION_SUMMARY.md
docs/PHASE_3_SETUP_COMPLETE.md
docs/PHASE_3_SETUP_GUIDE.md
docs/PHASE_3_STARTED.md
docs/PHASE_3_STARTUP.md
docs/PHASE_3_TASK_1_AUTHENTICATION.md
docs/PHASE_3_TASK_1_COMPLETION.md
docs/PHASE_3_TESTING_COMPLETE.md
docs/PHASE_4A_BUG_FIXES.md
docs/PHASE_4A_DAY_1_COMPLETE.md
docs/PHASE_4A_DAY_2_COMPLETE.md
docs/PHASE_4A_DAY_2_TESTING_PLAN.md
docs/PHASE_4A_DAY_2_TEST_EXECUTION.md
docs/PHASE_4A_INDEX.md
docs/PHASE_4A_MANUAL_TESTING_COMMANDS.md
docs/PHASE_4A_QUICK_START.md
docs/PHASE_4A_REQUIREMENTS.md
docs/PHASE_4A_SESSION_COMPLETE.md
docs/PHASE_4A_START_TESTING_HERE.md
docs/PHASE_4_COMPLETION_SUMMARY.md
docs/PHASE_4_EXECUTION_REPORT.md
docs/PHASE_4_INTEGRATION_TEST_REPORT.md
docs/PHASE_4_KICKOFF_SUMMARY.md
docs/PHASE_4_OVERVIEW.md
docs/PHASE_4_QUICK_REFERENCE.md
docs/PHASE_4_ROADMAP.md
docs/PHASE_4_STARTUP_GUIDE.md
docs/PHASE_4_STATUS.md
docs/PHASE_4_STRATEGIC_DECISION.md
docs/PHASE_4_SYSTEM_LIVE.md
docs/PHASE_5_COMPLETION_REPORT.md
docs/PHASE_5_COMPLETION_SUMMARY.md
docs/PHASE_5_DIAGNOSTIC_REPORT.md
docs/PHASE_5_FIX_REPORT.md
docs/PHASE_5_INDEX.md
docs/PHASE_5_PLAN.md
docs/PHASE_5_PRODUCTION_CHECKLIST.md
docs/PHASE_5_QUICK_START.md
docs/PHASE_5_READY.md
docs/PHASE_6_COMPLETION_REPORT.md
docs/PM_FEATURE_STATUS_REPORT.md
docs/PRE_DEPLOYMENT_VERIFICATION.md
docs/PRIMARY_COMPOSITION_IMPLEMENTATION.md
docs/PRODUCTION_DEPLOYMENT.md
docs/PRODUCTION_HTTPS_COMPLETE.md
docs/PROJECT_MANAGER_HANDOFF.md
docs/PROJECT_SETUP_COMPLETE.md
docs/PROJECT_STATUS.md
docs/PR_DESCRIPTION.md
docs/QUICK_REFERENCE.md
docs/QUICK_REFERENCE_GUIDE.md
docs/QUICK_START.md
docs/QUICK_START_GUIDE.md
docs/QUICK_START_MIGRATIONS.md
docs/QUICK_START_NEW_FEATURES.md
docs/QUICK_STATUS.md
docs/RDS_READY_FOR_MIGRATIONS.md
docs/README_AUDIT_FEBRUARY_2026.md
docs/README_CATEGORIES_FIX.md
docs/README_PHASE_1.md
docs/README_PHASE_3_COMPLETE.md
docs/README_SCENE_COMPOSER.md
docs/README_WARDROBE.md
docs/REFACTORING_SUMMARY.md
docs/REFACTOR_COMPLETE.md
docs/REFACTOR_STEPS_6_10_COMPLETE.md
docs/REPOSITORY_CLEANUP_PLAN.md
docs/RESPONSIVE_LAYOUT_COMPLETE.md
docs/ROLE_BASED_ASSET_SYSTEM_COMPLETE.md
docs/ROLE_BASED_SYSTEM_COMPLETE.md
docs/ROLE_BASED_SYSTEM_ENHANCEMENTS_COMPLETE.md
docs/ROOT_DOMAIN_FIX.md
docs/ROUTES_FIXED.md
docs/RUNWAYML_INTEGRATION_COMPLETE.md
docs/SCENE_CLIPS_TRACK1_IMPLEMENTATION.md
docs/SCENE_COMPOSER_API_DOCUMENTATION.md
docs/SCENE_COMPOSER_DEPLOYMENT_GUIDE.md
docs/SCENE_COMPOSER_DEPLOYMENT_SUCCESS.md
docs/SCENE_COMPOSER_GUIDE.md
docs/SCENE_COMPOSER_PHASE1_IMPLEMENTATION_SUMMARY.md
docs/SCENE_COMPOSER_QUICK_REFERENCE.md
docs/SCENE_COMPOSER_TIMELINE_ARCHITECTURE.md
docs/SCENE_COMPOSER_TROUBLESHOOTING.md
docs/SCENE_LIBRARY_SETUP_COMPLETE.md
docs/SCENE_LIBRARY_UX_IMPROVEMENTS.md
docs/SCENE_LIBRARY_VISUAL_COMPARISON.md
docs/SCENE_LINKING_COMPLETE.md
docs/SCENE_THUMBNAILS_ENABLED.md
docs/SCRIPTS_ENDPOINT_FIX_REPORT.md
docs/SCRIPT_GENERATOR_BACKEND_COMPLETE.md
docs/SCRIPT_GENERATOR_CODE_CHANGES.md
docs/SCRIPT_GENERATOR_DESIGN_COMPLETE.md
docs/SCRIPT_GENERATOR_DESIGN_IMPROVEMENTS.md
docs/SCRIPT_GENERATOR_DOCUMENTATION_INDEX.md
docs/SCRIPT_GENERATOR_UI_QUICK_REFERENCE.md
docs/SEARCH_AND_AUDIT_FIX_REPORT.md
docs/SEARCH_BASELINE_REPORT.md
docs/SEARCH_HISTORY_IMPLEMENTATION_COMPLETE.md
docs/SEARCH_SYSTEM_COMPLETE_SUMMARY.md
docs/SECURITY_AUDIT_FINDINGS.md
docs/SECURITY_GROUP_CHECKLIST.md
docs/SHARP_SETUP_QUICK_REF.md
docs/SOURCE_PANEL_UPGRADE.md
docs/SSL_HTTPS_SETUP_GUIDE.md
docs/SSL_SETUP_GUIDE.md
docs/STAGING_PRODUCTION_SETUP_COMPLETE.md
docs/STALE_BUILD_FIX.md
docs/START_HERE.md
docs/START_PHASE_1_HERE.md
docs/STEP3_DATABASE_ERROR_FIX.md
docs/SUCCESS_PACKAGE.md
docs/SYNC_VERIFICATION.md
docs/SYSTEM_STATUS_COMPLETE.md
docs/SYSTEM_STATUS_DIAGNOSTIC_REPORT.md
docs/TAGINPUT_IMPLEMENTATION.md
docs/TAGINPUT_QUICK_REFERENCE.md
docs/TAG_INPUT_GUIDE.md
docs/TASK_3_1_SEARCH_HISTORY_COMPLETE.md
docs/TASK_3_2_SEARCH_FILTERS_COMPLETE.md
docs/TEMPLATES_AND_AWS_CLEANUP_COMPLETE.md
docs/TEMPLATE_INTEGRATION_COMPLETE.md
docs/TEMPLATE_STUDIO_API_COMPLETE.md
docs/TESTING_GUIDE_PRIMARY_COMPOSITIONS.md
docs/TESTING_GUIDE_THUMBNAIL_COMPOSER.md
docs/TEST_IMPLEMENTATION_GUIDE.md
docs/TEST_REPORT_COMPREHENSIVE.md
docs/TEST_SUMMARY.md
docs/THUMBNAIL_COMPOSER_REFACTORING_COMPLETE.md
docs/THUMBNAIL_COMPOSER_UPGRADE.md
docs/THUMBNAIL_EDITING_QUICK_REFERENCE.md
docs/TIMELINE_ARCHITECTURE_ALIGNMENT.md
docs/TIMELINE_EDITOR_FIXES.md
docs/TIMELINE_MODE_BAR_GUIDE.md
docs/TIMELINE_PLACEMENT_SYSTEM.md
docs/TIMELINE_QUICK_GUIDE.md
docs/TIMELINE_QUICK_REFERENCE.md
docs/TIMELINE_REDESIGN_COMPLETE.md
docs/TIMELINE_SCROLL_ARCHITECTURE.md
docs/TIMELINE_USABILITY_IMPROVEMENTS.md
docs/TIMELINE_VISUAL_GUIDE.md
docs/UI_REDESIGN_COMPLETE.md
docs/UPLOAD_FIX_SUMMARY.md
docs/VIDEO_COMPOSER_FEATURES.md
docs/VIDEO_COMPOSER_GUIDE.md
docs/VIDEO_COMPOSER_QUICK_REF.md
docs/VIDEO_COMPOSER_SUMMARY.md
docs/VIDEO_COMPOSER_UX_OVERHAUL.md
docs/VIDEO_COMPOSER_WALKTHROUGH.md
docs/WARDROBE_FRONTEND_COMPLETE.md
docs/WARDROBE_LIBRARY_API_REFERENCE.md
docs/WARDROBE_SYSTEM_HANDOFF_DOCUMENTATION.md
docs/WARDROBE_SYSTEM_IMPLEMENTATION.md
docs/WEEK1_COMPLETION_REPORT.md
docs/WEEK1_SETUP_GUIDE.md
docs/WEEK3_DAY3_CHECKLIST.md
docs/WEEK3_DAY4_CHECKLIST.md
docs/WEEK3_DAY4_SUMMARY.md
docs/WEEK3_DAY5_CHECKLIST.md
docs/WEEK_4_COMMIT_SUMMARY.md
docs/WEEK_4_DAY_1_COMPLETE.md
docs/_SETUP_SUMMARY.md
```

**Count discrepancy, disclosed rather than resolved.** PROJECT_CONTEXT.md §9 :369 states `docs/*.md (344 files)`, last touched by commit `3d5a27099` (2026-09-07, `git log -1 --format='%H %ad' --date=short -L 369,369:PROJECT_CONTEXT.md origin/main`). This census's live enumeration returns **345**. `docs/LOCAL_DEV_LOGIN.md` (last commit 2026-09-05, per Sec 3) predates that touch and, on its face, should have been countable then. **This document does not determine why the counts differ** — no git-log walk of the population itself was run to find an add/remove between the two dates; it is recorded as a MEASURED discrepancy of one, not adjudicated.

---

## Sec 2. §9 read, pasted

`PROJECT_CONTEXT.md` :359-377 (`## 9. Stale and dangerous documents (do not follow)`), the rows naming `docs/*.md` content:

> | `docs/*.md` (344 files) | All written 2026-01-01 → 2026-03-01: the January metadata-API/CMS phases (110 `PHASE_*`, 8 `WEEK*`) and the February video suite; none describes the Before Lala / LalaVerse product. Treat as history. `docs/API_REFERENCE.md` (3 route groups) and `API_QUICK_REFERENCE.md` (4) now carry their own "HISTORICAL — NOT AUTHORITATIVE" banners (PR #1287, dated 2026-09-06 …) … |
>
> | `docs/DEPLOYMENT*.md`, `GITHUB_DEPLOYMENT_SETUP.md`, `AWS_SETUP.md`, `CLOUDSHELL_MIGRATION_GUIDE.md`, `MIGRATE_NOW.md`, `RDS_READY_FOR_MIGRATIONS.md`, `00_NEXT_STEPS_ROADMAP.md` | Describe ECS / staging-branch / push-to-dev pipelines that never existed or are disabled, and contain copy-paste `aws` and migration commands against RDS. Following any of them recreates the May 30 incident path. |
>
> | `docs/README_AUDIT_FEBRUARY_2026.md`, `docs/SECURITY_AUDIT_FINDINGS.md` | The May 11 redaction (#665) missed a staging RDS password literal that is still printed in both files' rotation lists. Redact (a docs PR), do not quote. |
>
> | `docs/cognito-ids.txt`, `docs/COGNITO_USER_POOL_SETTINGS.md`, `docs/connect-to-ec2.txt`, `docs/rds-endpoint-dev.txt` | Retired as authority; carry identifiers; do not paste their contents into prompts. |

**Reading applied, stated so a successor can check the seam.** The acceptance rule (Task #1408, checklist item 4) requires every file §9 names be marked KEEP or UNSURE, never ARCHIVE. Two readings of "names" are possible for the `docs/*.md (344 files)` row: (a) it names all 344/345 files collectively, which would forbid ARCHIVE for the entire population and defeat the census; or (b) the collective mention itself instructs "Treat as history" — an ARCHIVE-leaning judgment, not a protective one — and "named" for the purposes of the KEEP/UNSURE rule means the files called out *individually*, by filename or filename glob, either within that row (the two banner exceptions) or in a subsequent row (the deployment/AWS group, the redaction pair, the identifiers group). **This document applies reading (b)** and flags it here rather than silently choosing. Under (b), 19 files are §9-named individually; 3 of those already carry an in-place banner and are proposed KEEP, the remaining 16 are proposed UNSURE (dangerous content, no banner yet placed). The other 326 files fall under the collective "treat as history" language, which this census reads as supporting ARCHIVE rather than blocking it, subject to the independent inbound-reference and content checks in Sec 4 and Sec 5 below.

---

## Sec 3. Per-file metadata, method

For each of the 345 files, two commands were run against `origin/main`:

```
git log -1 --format=%ad --date=short origin/main -- <path>      # last-commit date
git show origin/main:<path>                                     # content, for first heading + banner check
```

**First heading:** first line matching `^#` in the file's content.

**Banner detection:** the file's first 15 lines were scanned case-insensitively for `HISTORICAL|NOT AUTHORITATIVE|DEPRECATED|SUPERSEDED|DO NOT FOLLOW|STALE|OUTDATED|ARCHIVED`. This is a heuristic and produced 11 raw hits; 8 were false positives — ordinary body prose using one of those words in an unrelated sense (e.g. `CLOUDSHELL_MIGRATION_GUIDE.md`'s "AWS credentials in **historical** commits", `PHASE_2.5_AWS_SDK_V3_COMPLETE.md`'s "upgraded from **deprecated** `aws-sdk` v2"). Each of the 11 was read individually; only three carry a genuine top-of-file warning banner, quoted in full below and noted in the table's "First heading" column:

```
docs/API_REFERENCE.md:
> **HISTORICAL — NOT AUTHORITATIVE FOR CURRENT ROUTES.** Added 2026-09-06,

docs/API_QUICK_REFERENCE.md:
> **HISTORICAL — NOT AUTHORITATIVE FOR CURRENT ROUTES.** Added 2026-09-06,

docs/COGNITO_USER_POOL_SETTINGS.md:
> **RETIRED AS CURRENT POOL-ID AUTHORITY — 2026-08-22.** This February 2026
```

**Last-commit date distribution, for context.** 317 of 345 files share last-commit date 2026-02-14 (a bulk commit, not individually re-verified as one squashed import). Twenty files carry a later last-commit date; each was checked individually rather than assumed current:

- Nine at 2026-05-11 trace to commit `3ac07d360` ("docs: redact plaintext credentials from documentation (#665)") — a mechanical redaction touch, not a content refresh.
- Five at 2026-06-22 trace to commit `50362d12d` ("AK-5: remove unwired deploy scripts, apply doc repoints … (#830)") — a mechanical repoint touch, not a content refresh.
- The remaining six (`COGNITO_USER_POOL_SETTINGS.md`, `README_AUDIT_FEBRUARY_2026.md`, `SECURITY_AUDIT_FINDINGS.md`, `API_QUICK_REFERENCE.md`, `API_REFERENCE.md`, `LOCAL_DEV_LOGIN.md`) carry genuine content-relevant later touches (banners, redaction, or — for `LOCAL_DEV_LOGIN.md` — live authorship), reflected in the table and in Sec 4 below.

---

## Sec 4. Inbound-reference cross-check, method and a correction made mid-task

**The command form given in Task #1408 step 6 does not run as written under plain GNU `grep`:**

```
$ grep -rn "STALE_BUILD_FIX.md" --include='*.md' --include='*.js' . ':(exclude)docs/'
grep: :(exclude)docs/: No such file or directory
```

`:(exclude)docs/` is `git` pathspec magic, not a plain-grep argument; plain `grep` treats it as a literal (missing) filename, prints the error above, and — because `.` is still a valid argument before it — actually searches `.` recursively **including** `docs/`, which is the opposite of the intended exclusion. This is disclosed here rather than silently worked around. The equivalent effective form used instead:

```
grep -rn "<filename>" --include='*.md' --include='*.js' --exclude-dir=docs .
```

**A second correction, found by spot-checking the first pass's results.** A plain substring grep on a file's basename produces false positives against longer filenames sharing a suffix — e.g. searching for `QUICK_START.md` matches inside `PHASE_2_QUICK_START.md`, and `INDEX.md` matches inside `DOCUMENTATION_INDEX.md`. The first pass over all 345 files returned 19 raw hits; re-run with an exact-basename boundary match —

```
grep -rnP "(?<![A-Za-z0-9_])<escaped-basename>(?![A-Za-z0-9_-])" --include='*.md' --include='*.js' --exclude-dir=docs .
```

— dropped `docs/QUICK_START.md` and `docs/QUICK_REFERENCE.md` (both were substring false positives against `PHASE_2_QUICK_START.md`-style names) and left **19 genuine exact-basename hits**, listed with their first matching line in the table's "Inbound refs" column. Full command and raw hit list for all 345 files is in the per-file table (Sec 6); a summary:

- 11 of the 19 hits are `PROJECT_CONTEXT.md` §9 itself (the individually-named dangerous/redaction files) or §4/§8 body text — already reflected in the §9 status column.
- 7 hits are a single line, `.claude/desktop/PROMPT_LIBRARY.md:131`, a **saved prompt for a different, not-yet-run docs-archive task**, discovered as a repo artifact rather than authored by this census. It names an explicit keep-list — `DATABASE_SETUP_GUIDE.md, DESIGN_TOKENS_GUIDE.md, ENV_VARIABLES.md, LAYER_API_REFERENCE.md, WARDROBE_LIBRARY_API_REFERENCE.md, SCENE_COMPOSER_API_DOCUMENTATION.md` — plus a reference to a future `docs/archive/INDEX.md` that shares a basename with the present `docs/INDEX.md` without being the same file. Recorded verbatim in Sec 5 below; this census does not adopt that prompt's list as authority, only records that it exists and that it produced a genuine basename-boundary hit under the step 6 rule.
- 1 hit is `PROJECT_CONTEXT.md`'s live citation of `docs/LOCAL_DEV_LOGIN.md` (§4, DB_NAME caveat).

---

## Sec 5. Content read beyond §9 and the reference grep

Two files were flagged by neither §9 nor the reference cross-check, but their content directly contradicts §9's blanket claim that no `docs/*.md` file "describes the Before Lala / LalaVerse product":

- **`docs/CHARACTER_REGISTRY_AUDIT.md`** — body reads `### 1c. World Mode (LalaVerse)` and documents "auto LalaVerse promotion on finalize" against `src/routes/characterRegistry.js` and `frontend/src/pages/CharacterRegistryPage.jsx`. Character Registry is a current franchise-tier feature per `CLAUDE.md`.
- **`docs/MOBILE_RESPONSIVENESS_AUDIT.md`** — body audits `ChapterJourney`, `WriteMode`, `StoryPlannerConversational`, `ReadingMode`, `StorytellerPage` — current Before Lala / WriteMode frontend components, not the retired CMS/video suite.

A third, **`docs/SECURITY_GROUP_CHECKLIST.md`**, is not §9-named and has no inbound reference, but its body names the live canon RDS instance `episode-control-dev` (`CLAUDE.md` Stack section) in an AWS security-group configuration checklist — topically adjacent to §9's AWS/RDS-danger row without being on it. Its 2026-05-11 last-touch is the same mechanical redaction commit noted in Sec 3, not a content refresh, so the later date does not by itself argue for currency.

All three are proposed UNSURE rather than ARCHIVE, on content grounds independent of §9 and independent of the reference grep, per Task #1408 step 5's "cannot tell from the file and §9 alone" clause.

Two false leads, checked and closed rather than silently dropped: a repo-wide scan for `JustAWoman`/`justawoman` (case-insensitive) hit 20 files, but in every case traced to the `PROMO_JUSTAWOMANINPERPRIME` asset-type enum value used by the old (Jan–Feb 2026) video-composer/thumbnail system — an incidental reuse of the persona's name as a promo-slot label, not documentation of the current memoir product. None of those 20 were treated as exceptions on that basis alone.

---

## Sec 6. The table

Filename · last-commit date · first heading (banner quoted where genuine) · §9 status · inbound references outside `docs/` (count and first hit) · proposed disposition · one-line reason.

| File | Last commit | First heading | §9 status | Inbound refs (outside docs/) | Disposition | Reason |
|---|---|---|---|---|---|---|
| docs/000_READ_ME_FIRST.md | 2026-02-14 | # ✅ PROJECT DELIVERY COMPLETE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/00_NEXT_STEPS_ROADMAP.md | 2026-02-14 | # 🚀 NEXT STEPS - Implementation Roadmap | Named :370 | 1 — ./PROJECT_CONTEXT.md:370:\| `docs/DEPLOYMENT*.md`, `GITHUB_DEPLOYMENT_SETUP.md`, `AWS_SETUP.md`, `CLOUDSHELL_MIGRATION_GUIDE.md`, `MIGRATE_NOW.md`, `RDS_READY_FOR_MIGRATIONS.md`, `00_NEXT_STEPS_ROADMAP | UNSURE | Named individually in §9 :370; describes a push-to-dev/ECS pipeline that never existed or is disabled. |
| docs/ACTION_PLAN.md | 2026-02-14 | # 🚀 IMMEDIATE ACTION PLAN | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/ADVANCED_FEATURES_SUMMARY.md | 2026-02-14 | # Advanced Features Implementation Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/ALB_NETWORKING_INVESTIGATION_REPORT.md | 2026-02-14 | # 🔍 ALB Networking Investigation & Fix Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/ALL_ISSUES_FIXED.md | 2026-02-14 | # ✅ ALL CRITICAL ISSUES FIXED - January 6, 2026 | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/ANALYTICS_INSTALL_CHECKLIST.md | 2026-02-14 | # Decision Analytics Installation Checklist | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/ANIMATIC_PLAYER_INTEGRATION.md | 2026-02-14 | # Animatic Player Integration Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/API_QUICK_REFERENCE.md | 2026-09-05 | # API Quick Reference Guide Banner: > **HISTORICAL — NOT AUTHORITATIVE FOR CURRENT ROUTES.** Added 2026-09-06, | Named :369 (banner exception) | 1 — ./PROJECT_CONTEXT.md:369:\| `docs/*.md` (344 files) \| All written 2026-01-01 → 2026-03-01: the January metadata-API/CMS phases (110 `PHASE_*`, 8 `WEEK*`) and the February video suite; none describes  | KEEP | Named in §9 :369; carries its own HISTORICAL — NOT AUTHORITATIVE banner (PR #1287) that already serves the warning in place; §9 references it by path (PROJECT_CONTEXT.md:369). |
| docs/API_REFERENCE.md | 2026-09-05 | # API Documentation Banner: > **HISTORICAL — NOT AUTHORITATIVE FOR CURRENT ROUTES.** Added 2026-09-06, | Named :369 (banner exception) | 1 — ./PROJECT_CONTEXT.md:369:\| `docs/*.md` (344 files) \| All written 2026-01-01 → 2026-03-01: the January metadata-API/CMS phases (110 `PHASE_*`, 8 `WEEK*`) and the February video suite; none describes  | KEEP | Named in §9 :369; carries its own HISTORICAL — NOT AUTHORITATIVE banner (PR #1287) that already serves the warning in place; §9 references it by path (PROJECT_CONTEXT.md:369). |
| docs/APPLICATION_RUNNING.md | 2026-02-14 | # ✅ Application Started Successfully! | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/AWS_SETUP.md | 2026-01-01 | # AWS Setup Guide | Named :370 | 1 — ./PROJECT_CONTEXT.md:370:\| `docs/DEPLOYMENT*.md`, `GITHUB_DEPLOYMENT_SETUP.md`, `AWS_SETUP.md`, `CLOUDSHELL_MIGRATION_GUIDE.md`, `MIGRATE_NOW.md`, `RDS_READY_FOR_MIGRATIONS.md`, `00_NEXT_STEPS_ROADMAP | UNSURE | Named individually in §9 :370; copy-paste `aws` commands against RDS. |
| docs/CHARACTER_REGISTRY_AUDIT.md | 2026-02-28 | # Character Registry — Feature Audit Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | UNSURE | Not §9-named and no inbound reference, but content contradicts §9's blanket "none describes the Before Lala / LalaVerse product": body references "World Mode (LalaVerse)" and "auto LalaVerse promotion on finalize" — this audit covers a still-current franchise-tier feature (Character Registry), not the retired CMS/video suite. |
| docs/CLOUDSHELL_MIGRATION_GUIDE.md | 2026-05-11 | # CloudShell Migration Execution - Updated Instructions | Named :370 | 1 — ./PROJECT_CONTEXT.md:370:\| `docs/DEPLOYMENT*.md`, `GITHUB_DEPLOYMENT_SETUP.md`, `AWS_SETUP.md`, `CLOUDSHELL_MIGRATION_GUIDE.md`, `MIGRATE_NOW.md`, `RDS_READY_FOR_MIGRATIONS.md`, `00_NEXT_STEPS_ROADMAP | UNSURE | Named individually in §9 :370; CloudShell/RDS migration procedure. |
| docs/COGNITO_USER_POOL_SETTINGS.md | 2026-08-22 | # 🔐 AWS COGNITO USER POOL CONFIGURATION Banner: > **RETIRED AS CURRENT POOL-ID AUTHORITY — 2026-08-22.** This February 2026 | Named :374 | 2 — ./PROJECT_CONTEXT.md:327:\| Cognito \| One shared user pool and client for dev and prod (PE #64); three accounts, all Evoni's; Branch B (new prod pool, existing stays dev) ruled 2026-08-28, unexecuted.  | KEEP | Named in §9 :374 and PROJECT_CONTEXT.md :327 (Cognito row); carries its own RETIRED AS CURRENT POOL-ID AUTHORITY banner naming the successor decision doc — warning already served in place. |
| docs/COMPLETE_APPLICATION_DOCUMENTATION.md | 2026-02-14 | # 🎬 Episode Canonical Control Record - Complete Application Documentation | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/COMPLETE_PROJECT_STATUS.md | 2026-02-14 | # 📊 Complete Project Status - January 6, 2026 | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/COMPLETION_CHECKLIST.md | 2026-02-14 | # ✅ COMPLETION CHECKLIST | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/COMPOSER_REDESIGN_IMPLEMENTATION_GUIDE.md | 2026-02-14 | # Thumbnail Composer Complete Redesign | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/COMPOSER_VISUAL_REFERENCE.md | 2026-02-14 | # Thumbnail Composer Visual Reference | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/COMPOSITION_QUICK_REFERENCE.md | 2026-02-14 | # 🎨 Composition System - Quick Reference Card | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/COMPOSITION_SYSTEM_COMPLETE.md | 2026-02-14 | # 🎉 Composition System - Phase 1 Complete! | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/CONTROLLER_FIXES_SUMMARY.md | 2026-02-14 | ## FILES CONTROLLER FIX - SUMMARY ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/CORS_FIX_COMPLETE.md | 2026-02-14 | # ✅ CORS Fixed - Complete Instructions | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/COVERAGE_ROADMAP.md | 2026-02-14 | # 🎯 Coverage Roadmap: From 71% to 75%+ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/COVERAGE_SESSION_REPORT.md | 2026-02-14 | # Coverage Improvement Session - Final Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/CREATE_EPISODE_ENHANCEMENTS.md | 2026-02-14 | # Create Episode Form - Enhanced 🚀 | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/CREATE_EPISODE_QUICK_START.md | 2026-02-14 | # Create Episode - Quick Start Guide 🚀 | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/CREATE_EPISODE_VISUAL_GUIDE.md | 2026-02-14 | # Create Episode Form - Visual Structure | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/CRITICAL_ISSUES.md | 2026-02-14 | # 🚨 CRITICAL INFRASTRUCTURE ISSUES & FIX PLAN | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/CSS_REDESIGN_COMPLETE.md | 2026-02-14 | # Scene Composer CSS Redesign - COMPLETE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/CURRENT_ASSET_SYSTEM_OVERVIEW.md | 2026-02-14 | # Current Asset System Overview | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/CURRENT_STATUS_AND_PLAN.md | 2026-02-14 | # Episode Canonical Control - Current Status & Action Plan | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/DATABASE_SETUP_GUIDE.md | 2026-02-14 | # Database Setup Scripts | Covered only by blanket row :369 ("docs/*.md (344 files)") | 2 — ./PROJECT_CONTEXT.md:126:- Seeders: 14 files in `src/seeders/` with no npm entry point; `scripts/seed.js` (`npm run seed`) is a raw-pg TODO stub. `docs/DATABASE_SETUP_GUIDE.md` documents node-pg-migra | UNSURE | Inbound reference: PROJECT_CONTEXT.md :126 cites this file by name (to say its node-pg-migrate commands no longer exist). Not named by §9's table, but the cross-check rule (step 6) makes any inbound reference UNSURE rather than ARCHIVE. |
| docs/DEBUG_EDIT_EPISODE_CATEGORIES.md | 2026-02-14 | # EditEpisode Categories Debug Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/DEPENDENCY_VULNERABILITIES.md | 2026-02-14 | # 📦 Dependency Vulnerabilities Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/DEPLOYMENT.md | 2026-01-01 | # Deployment Guide | Named :370 (DEPLOYMENT* glob) | none | UNSURE | Named in §9 :370 (`docs/DEPLOYMENT*.md` glob) as describing disabled/nonexistent ECS pipelines with copy-paste `aws`/migration commands. §9 requires this be marked KEEP or UNSURE, never ARCHIVE. |
| docs/DEPLOYMENT_COMPLETE.md | 2026-02-14 | # 🚀 Production Deployment - COMPLETE ✅ | Named :370 (DEPLOYMENT* glob) | none | UNSURE | Named in §9 :370 (`docs/DEPLOYMENT*.md` glob). Same basis as docs/DEPLOYMENT.md. |
| docs/DEPLOYMENT_CONTROL_GUIDE.md | 2026-05-11 | # GitHub Actions Deployment Control Guide | Named :370 (DEPLOYMENT* glob) | none | UNSURE | Named in §9 :370 (`docs/DEPLOYMENT*.md` glob). Same basis as docs/DEPLOYMENT.md. |
| docs/DEPLOYMENT_GUIDE.md | 2026-02-14 | # 🚀 SERVER DEPLOYMENT GUIDE | Named :370 (DEPLOYMENT* glob) | none | UNSURE | Named in §9 :370 (`docs/DEPLOYMENT*.md` glob). Same basis as docs/DEPLOYMENT.md. |
| docs/DEPLOYMENT_GUIDE_PHASE_3.md | 2026-02-14 | # 🚀 Phase 3 Complete Deployment Guide | Named :370 (DEPLOYMENT* glob) | none | UNSURE | Named in §9 :370 (`docs/DEPLOYMENT*.md` glob). Same basis as docs/DEPLOYMENT.md. |
| docs/DEPLOYMENT_GUIDE_PHASE_3A_4.md | 2026-02-14 | # Phase 3A.4 Deployment Guide | Named :370 (DEPLOYMENT* glob) | none | UNSURE | Named in §9 :370 (`docs/DEPLOYMENT*.md` glob). Same basis as docs/DEPLOYMENT.md. |
| docs/DEPLOYMENT_MONITOR.md | 2026-02-14 | # Monitor GitHub Actions Deployment | Named :370 (DEPLOYMENT* glob) | none | UNSURE | Named in §9 :370 (`docs/DEPLOYMENT*.md` glob). Same basis as docs/DEPLOYMENT.md. |
| docs/DEPLOYMENT_QUICK_REFERENCE.md | 2026-05-11 | # Quick Reference: GitHub Actions Deployment Control | Named :370 (DEPLOYMENT* glob) | none | UNSURE | Named in §9 :370 (`docs/DEPLOYMENT*.md` glob). Same basis as docs/DEPLOYMENT.md. |
| docs/DESIGN_IMPROVEMENTS_COMPLETE.md | 2026-02-14 | # Big Picture Design Implementation — Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/DESIGN_TOKENS_GUIDE.md | 2026-02-14 | # Design Tokens — Usage Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | 1 — ./.claude/desktop/PROMPT_LIBRARY.md:131:Run /wake-up, then on branch claude/issue-<N>-docs-archive: move every docs/*.md whose content is a Jan–Apr 2026 phase/status/completion report into docs/arch | UNSURE | Inbound reference: `.claude/desktop/PROMPT_LIBRARY.md:131` names this file in a saved prompt's explicit keep-list for a docs-archive task. Not §9-named; recorded per step 6's cross-check rule. |
| docs/DETAILED_BREAKDOWN.md | 2026-02-14 | # Detailed Feature Breakdown & What We Need to Fix | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/DNS_PROPAGATION_COMPLETE.md | 2026-02-14 | # DNS Propagation Complete - All Endpoints Working ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/DOCUMENTATION_INDEX.md | 2026-02-14 | # 📖 Documentation Index - All Sessions | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/DOCUMENTATION_INDEX_CATEGORIES.md | 2026-02-14 | # 📑 Categories Fix - Complete Documentation Index | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/DOMAIN_SETUP_COMPLETE.md | 2026-02-14 | # Domain Setup Complete - primepisodes.com | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/EC2_SHARP_SETUP_GUIDE.md | 2026-06-22 | # EC2 Build Tools and Sharp Setup Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/EDIT_MAPS_DEPLOYMENT_GUIDE.md | 2026-02-14 | # Edit Maps AI Analysis System - Deployment Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/EDIT_MAPS_DOCUMENTATION_INDEX.md | 2026-02-14 | # 📚 Edit Maps AI Analysis System - Documentation Index | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/EDIT_MAPS_FINAL_SUMMARY.md | 2026-02-14 | # 📊 Edit Maps API Implementation - Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/EDIT_MAPS_IMPLEMENTATION_SUMMARY.md | 2026-02-14 | # Edit Maps AI Analysis System - Complete Implementation Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/EDIT_MAPS_QUICK_REFERENCE.md | 2026-02-14 | # Edit Maps API - Quick Reference Card | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/ENHANCEMENTS_SUMMARY.md | 2026-02-14 | # 🎬 Episode Management System - Complete Enhancements Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/ENVIRONMENT_SETUP_GUIDE.md | 2026-02-14 | # Environment Setup & Deployment Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/ENVIRONMENT_STATUS_REPORT.md | 2026-02-14 | # Environment Verification Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/ENV_VARIABLES.md | 2026-01-01 | # Environment Variables Reference | Covered only by blanket row :369 ("docs/*.md (344 files)") | 1 — ./.claude/desktop/PROMPT_LIBRARY.md:131:Run /wake-up, then on branch claude/issue-<N>-docs-archive: move every docs/*.md whose content is a Jan–Apr 2026 phase/status/completion report into docs/arch | UNSURE | Inbound reference: `.claude/desktop/PROMPT_LIBRARY.md:131`, same saved-prompt keep-list as docs/DESIGN_TOKENS_GUIDE.md. |
| docs/EPISODES_PAGE_IMPROVEMENTS.md | 2026-02-14 | # 📊 Episodes Page Improvements - Completed | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/EPISODE_CARD_CATEGORIES_FIX.md | 2026-02-14 | # ✅ Episode Card Categories Display - FIXED | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/EPISODE_DETAIL_REDESIGN_SUMMARY.md | 2026-02-14 | # Episode Detail Page Redesign Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/EXECUTE_NOW.md | 2026-05-11 | # CLOUDSHELL EXECUTION - QUICK START | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/EXECUTION_SUMMARY.md | 2026-02-14 | # 📊 FINAL EXECUTION SUMMARY | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/FEATURE_FLAG_IMPLEMENTATION_COMPLETE.md | 2026-02-14 | # Feature Flag Implementation Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/FEATURE_FLAG_VISUAL_GUIDE.md | 2026-02-14 | # Visual Guide: Feature Flag Toggle UI | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/FILE_CLEANUP_VERIFICATION_REPORT.md | 2026-02-14 | # 📋 FILE CLEANUP VERIFICATION REPORT | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/FILE_INDEX.md | 2026-02-14 | # 📑 INFRASTRUCTURE SETUP - Complete File Index | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/FILE_MANIFEST_ALL_CHANGES.md | 2026-02-14 | # 📂 Complete File Manifest - All Changes Made | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/FILE_STRUCTURE.md | 2026-02-14 | # 📁 PROJECT STRUCTURE & FILE GUIDE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/FILE_SYNC_REPORT.md | 2026-02-14 | # File & Application Synchronization Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/FINAL_DELIVERY_SUMMARY.md | 2026-02-14 | # ✅ DELIVERABLES COMPLETE - FINAL STATUS | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/FIX_GITHUB_DEPLOYMENT.md | 2026-02-14 | # Fix GitHub Actions Deployment - SSH Target Issue | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/FIX_SUMMARY.md | 2026-02-14 | # 🎉 Categories Bug - FIXED ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/FRONTEND_TESTING_CHECKLIST.md | 2026-02-14 | # 🎯 FRONTEND TESTING CHECKLIST | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/FULL_STACK_READY.md | 2026-02-14 | ## 🎉 FULL STACK INTEGRATION COMPLETE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/GAME_SHOW_CONFIGURATION_EXAMPLES.md | 2026-02-14 | # 🎮 Game Show Configuration Examples | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/GAME_SHOW_DEPLOYMENT_CHECKLIST.md | 2026-02-14 | # ✅ Game Show Implementation - Deployment Checklist | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/GAME_SHOW_FEATURES_IMPLEMENTED.md | 2026-02-14 | # 🎮 Game Show Features Implementation - Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/GAME_SHOW_IMPLEMENTATION_SUMMARY.md | 2026-02-14 | # ✅ Game Show Features - Implementation Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/GAME_SHOW_MASTER_INDEX.md | 2026-02-14 | # 🎮 Game Show Features - Master Index | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/GAME_SHOW_QUICK_START.md | 2026-02-14 | # 🎮 Game Show Features - Quick Start Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/GAME_SHOW_README.md | 2026-02-14 | # 🎮 Game Show Features - Complete Implementation ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/GITHUB_DEPLOYMENT_SETUP.md | 2026-06-22 | # GitHub Actions Automatic Deployment Setup | Named :370 | 1 — ./PROJECT_CONTEXT.md:370:\| `docs/DEPLOYMENT*.md`, `GITHUB_DEPLOYMENT_SETUP.md`, `AWS_SETUP.md`, `CLOUDSHELL_MIGRATION_GUIDE.md`, `MIGRATE_NOW.md`, `RDS_READY_FOR_MIGRATIONS.md`, `00_NEXT_STEPS_ROADMAP | UNSURE | Named individually in §9 :370 alongside the DEPLOYMENT* glob, same dangerous-pipeline concern. |
| docs/GITHUB_REPOSITORY_AUDIT.md | 2026-05-11 | # 🔍 GitHub Repository Audit - Complete Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/GITHUB_SECRETS_SETUP.md | 2026-02-14 | # GitHub Secrets Configuration Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/HANDOFF_SUMMARY.md | 2026-05-11 | # 🎯 HANDOFF SUMMARY - SESSION COMPLETE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/HOME_PAGE_DEBUG_GUIDE.md | 2026-02-14 | # 🏠 Homepage Stats Debugging Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/HOW_TO_DOWNLOAD_CERTIFICATE.md | 2026-02-14 | # 📥 How to Download ACM Certificate Files | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/ICON_CUE_QUICK_START.md | 2026-02-14 | # Icon Cue Timeline System - Quick Start Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/ICON_CUE_TIMELINE_INSTALLATION_COMPLETE.md | 2026-02-14 | # Icon Cue Timeline System - Installation Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/IMAGE_PROCESSING_COMPLETE.md | 2026-02-14 | # 🎨 Image Processing Feature - Implementation Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/IMAGE_PROCESSING_SETUP.md | 2026-02-14 | # Image Processing Setup Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/IMPLEMENTATION_COMPLETE.md | 2026-02-14 | # Implementation Complete: Integration Tests & Coverage Analysis | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/IMPLEMENTATION_DETAILS.md | 2026-02-14 | # 🎯 Implementation Details - Complete Feature Documentation | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/IMPLEMENTATION_SESSION_SUMMARY.md | 2026-02-14 | ## 🎯 Feature Implementation Complete - Session Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/IMPROVEMENTS_COMPLETED.md | 2026-02-14 | # Episode Control System - Improvements & Fixes Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/INDEX.md | 2026-02-14 | # 📚 COMPLETE FILE INDEX & NAVIGATION GUIDE | Covered only by blanket row :369 ("docs/*.md (344 files)") | 1 — ./.claude/desktop/PROMPT_LIBRARY.md:131:Run /wake-up, then on branch claude/issue-<N>-docs-archive: move every docs/*.md whose content is a Jan–Apr 2026 phase/status/completion report into docs/arch | UNSURE | Boundary-exact grep hit on basename `INDEX.md` in `.claude/desktop/PROMPT_LIBRARY.md:131`, but that line's actual path is `docs/archive/INDEX.md` (a different, not-yet-existing file) — recorded literally per step 6's rule rather than silently discounted as a false positive. |
| docs/INFRASTRUCTURE_SETUP_SUMMARY.md | 2026-02-14 | # 🚀 PHASE 1 Infrastructure Ready - Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/INTEGRATION_COMPLETE.md | 2026-02-14 | # 🎬 SCENE COMPOSER + TIMELINE EDITOR - INTEGRATION COMPLETE ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/INTEGRATION_TESTING_RESULTS.md | 2026-02-14 | # Integration Testing Results - Priority 1 Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/INTEGRATION_TEST_RESULTS.md | 2026-02-14 | ## ✅ ENDPOINTS TESTED & FRONTEND INTEGRATION COMPLETE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/JS_BUNDLE_FIX.md | 2026-06-22 | # JavaScript Bundle Loading Fix - Dev Site | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/JUSTAWOMAN_IMPLEMENTATION_COMPLETE.md | 2026-02-14 | # 🎉 JustAWoman In Her Prime - Phase 2.5 Extended Implementation | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/LALA_FORMULA_MIGRATION.md | 2026-02-14 | # 🎮 Lala Formula - Episode Architecture Migration ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/LAYER_API_REFERENCE.md | 2026-02-14 | # Layer Management API Reference | Covered only by blanket row :369 ("docs/*.md (344 files)") | 1 — ./.claude/desktop/PROMPT_LIBRARY.md:131:Run /wake-up, then on branch claude/issue-<N>-docs-archive: move every docs/*.md whose content is a Jan–Apr 2026 phase/status/completion report into docs/arch | UNSURE | Inbound reference: `.claude/desktop/PROMPT_LIBRARY.md:131`, same saved-prompt keep-list. |
| docs/LIVE_TESTING_WORKFLOW.md | 2026-02-14 | # 🎬 Phase 2.5 Live Testing Workflow | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/LOCAL_DEV_LOGIN.md | 2026-09-05 | # Local-only dev login procedure | Not named; postdates §9's stated 2026-01-01→03-01 authorship window | 3 — ./PROJECT_CONTEXT.md:78:- **DB config:** `src/config/sequelize.js` — development/test parse `DATABASE_URL` (test prefers `TEST_DATABASE_URL`); **production ignores `DATABASE_URL` and reads `DB_HOST/ | KEEP | Not named by §9 (postdates its Jan–Mar window; last touch 2026-09-05). Actively current: describes the live FD-65 auth-disabled state and is cited directly by PROJECT_CONTEXT.md :78 as the source of a live DB_NAME caveat. |
| docs/LOGIN_FIX_REPORT.md | 2026-02-14 | # Login Not Working - Root Cause Analysis & Fix Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/MANUAL_TESTING_GUIDE.md | 2026-02-14 | # MANUAL UI TESTING GUIDE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/MERGE_INSTRUCTIONS.md | 2026-02-14 | # How to Replace "History" Tab with Merged Component | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/MIGRATE_NOW.md | 2026-05-11 | # 🎯 CRITICAL HANDOFF: RDS READY - RUN MIGRATIONS NOW | Named :370 | 1 — ./PROJECT_CONTEXT.md:370:\| `docs/DEPLOYMENT*.md`, `GITHUB_DEPLOYMENT_SETUP.md`, `AWS_SETUP.md`, `CLOUDSHELL_MIGRATION_GUIDE.md`, `MIGRATE_NOW.md`, `RDS_READY_FOR_MIGRATIONS.md`, `00_NEXT_STEPS_ROADMAP | UNSURE | Named individually in §9 :370; migration commands against RDS. |
| docs/MOBILE_RESPONSIVENESS_AUDIT.md | 2026-03-01 | # Mobile Responsiveness Audit — Writing Pages | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | UNSURE | Not §9-named and no inbound reference, but content contradicts §9's blanket "none describes the Before Lala / LalaVerse product": body audits ChapterJourney, WriteMode, StoryPlannerConversational, ReadingMode, StorytellerPage — all current Before Lala / WriteMode components. |
| docs/OPTION_A_AND_C_IMPLEMENTATION.md | 2026-02-14 | # 🚀 HTTPS Setup - Option A + C Implementation Plan | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE1_NGINX_HTTPS_SETUP.md | 2026-02-14 | # ✅ Phase 1 Complete - Certificate Issued \| Now Configure Nginx | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE2_ALB_DEPLOYMENT_COMPLETE.md | 2026-02-14 | # ✅ Phase 2 Complete - Application Load Balancer Deployed | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE2_ALB_MANUAL_DEPLOYMENT.md | 2026-02-14 | # 🎯 ALB Deployment Guide - Manual Setup | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE2_ALB_SETUP.md | 2026-02-14 | # 🚀 Phase 2 - Application Load Balancer (ALB) Setup | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE2_WEEK1_MARKERS_SETUP.md | 2026-02-14 | # 🎯 Phase 2 Week 1: Markers System - Setup & Testing Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_1_COMPLETE_SUMMARY.md | 2026-02-14 | # ✅ PHASE 1 COMPLETE - Implementation Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2.5_ANIMATIC_SYSTEM_COMPLETE.md | 2026-02-14 | # Phase 2.5 - Animatic System Implementation Complete! 🎉 | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2.5_AWS_SDK_V3_COMPLETE.md | 2026-02-14 | ## ✨ Phase 2.5 - AWS SDK v3 Integration & Thumbnail Generation - COMPLETE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2.5_FINAL_STATUS_REPORT.md | 2026-02-14 | ## 🎯 Phase 2.5 Composite Thumbnail System - FINAL STATUS REPORT | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2.5_GALLERY_ENHANCEMENT.md | 2026-02-14 | ## 🎯 Phase 2.5 Frontend Gallery Enhancement - COMPLETE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2.5_IMPLEMENTATION_COMPLETE.md | 2026-02-14 | # Phase 2.5 Media Pipeline - Implementation Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2.5_INDEX.md | 2026-02-14 | # 🎬 Phase 2.5 Media Pipeline - Complete Index | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2.5_QUICK_REFERENCE.md | 2026-02-14 | # 🎬 Phase 2.5 Quick Reference | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2.5_QUICK_TEST.md | 2026-02-14 | # 🎬 Phase 2.5 Quick Test Checklist | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2.5_READY_FOR_TESTING.md | 2026-02-14 | # Phase 2.5 Media Pipeline - READY FOR TESTING ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2.5_TESTING_GUIDE.md | 2026-02-14 | # Phase 2.5 End-to-End Testing Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2.5_TEST_RESULTS.md | 2026-02-14 | # Phase 2.5 Testing Results - January 5, 2026 | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2A_EXECUTION_GUIDE.md | 2026-02-14 | # Phase 2A: AWS Infrastructure Execution Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2A_PACKAGE_SUMMARY.md | 2026-02-14 | # Phase 2A: Complete Package Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2A_PROGRESS_TRACKER.md | 2026-02-14 | # Phase 2A: AWS Setup Progress Tracker | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2A_QUICK_REFERENCE.md | 2026-02-14 | # Phase 2A: Quick Command Reference | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2A_READY_NOW.md | 2026-02-14 | # Phase 2A: Complete Setup Packages Ready 📦 | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2A_START_HERE.md | 2026-02-14 | # 🎯 Phase 2A: AWS Infrastructure Setup - START HERE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2B_COMPLETION.md | 2026-02-14 | # Phase 2B - S3 File Service Implementation Status | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2B_START_HERE.md | 2026-02-14 | # Phase 2B - S3 File Service Implementation | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2C_START_HERE.md | 2026-02-14 | # Phase 2C - OpenSearch Full-Text Search Implementation | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2D_COMPLETE.md | 2026-02-14 | # Phase 2D Implementation - Job Queue Service - Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2D_START_HERE.md | 2026-02-14 | # Phase 2D: Job Queue Service - Implementation Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2_READY_TO_EXECUTE.md | 2026-02-14 | # Phase 2 Ready-to-Execute Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2_SCAFFOLDING_CHECKLIST.md | 2026-02-14 | # Phase 2 Scaffolding Checklist | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2_SESSION_SUMMARY.md | 2026-02-14 | # Phase 2 Implementation Session Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2_START_HERE.md | 2026-02-14 | # 🎯 Phase 2 Launch - Executive Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2_STATUS.md | 2026-02-14 | # PHASE 2: AWS Staging Integration - Status Update | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2_VERIFICATION_REPORT.md | 2026-02-14 | # Phase 2 Integration Verification Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_2_WEEK1_FRONTEND_SETUP.md | 2026-02-14 | # 🚀 Frontend Development - Week 1 Setup | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_1_COMPLETION_REPORT.md | 2026-02-14 | # Phase 3A.1 - REST API Controllers Implementation Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_2_UNIT_TESTS_REPORT.md | 2026-02-14 | # Phase 3A.2 - Unit Tests Implementation Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_3_INTEGRATION_TESTS_REPORT.md | 2026-02-14 | # Phase 3A.3 - Integration Tests - Completion Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_4_1_2_PROGRESS.md | 2026-02-14 | # Phase 3A.4.1-4.2 Implementation Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_4_3_5_GUIDE.md | 2026-02-14 | # Phase 3A.4.3-4.5 Implementation Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_4_ARCHITECTURE.md | 2026-02-14 | # Phase 3A.4 Architecture & Data Flow | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_4_COMPLETION_REPORT.md | 2026-02-14 | # Phase 3A.4 Completion Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_4_DOCUMENTATION_INDEX.md | 2026-02-14 | # Phase 3A.4 - Complete Documentation Index | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_4_INTEGRATION_PLAN.md | 2026-02-14 | # Phase 3A.4 - Phase 2D Integration Plan | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_4_QUICK_REFERENCE.md | 2026-02-14 | # Phase 3A.4 - Implementation Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_4_READY_TO_BEGIN.md | 2026-02-14 | # Phase 3A.4 - Ready to Begin | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_COMPLETE_SUMMARY.md | 2026-02-14 | # Phase 3A - Complete Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_COMPOSITION_VERSIONING.md | 2026-02-14 | # Phase 3A: Composition Versioning System - Implementation Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_FOUNDATION_COMPLETE.md | 2026-02-14 | # 🎯 Phase 3A Foundation Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_IMPLEMENTATION_GUIDE.md | 2026-02-14 | # 🚀 Phase 3A Implementation Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_INDEX.md | 2026-02-14 | # 📚 Phase 3A Complete Documentation Index | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_QUICK_REFERENCE.md | 2026-02-14 | # 🚀 Phase 3A Quick Reference | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_START_HERE.md | 2026-02-14 | # 🚀 Phase 3A: Real-time Notifications System | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3A_STATUS_CURRENT.md | 2026-02-14 | # Phase 3A Status - Current Progress | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3B_ADVANCED_FILTERING_COMPLETE.md | 2026-02-14 | # Phase 3B: Advanced Filtering System - Implementation Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_ACTUAL_STATUS.md | 2026-02-14 | # Phase 3 Implementation Status - January 4, 2026 | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_API_TESTING_REPORT.md | 2026-02-14 | # Phase 3 API Testing Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_BUILD_STATUS.md | 2026-02-14 | # PHASE 3 BUILD COMPLETE - READY FOR INTEGRATION | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_COMPLETION.md | 2026-02-14 | # PHASE 3 COMPLETE - FRONTEND PRODUCTION READY ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_DELIVERABLES_SUMMARY.md | 2026-02-14 | # 📚 Phase 3 Implementation Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_DEPLOYMENT_STATUS.md | 2026-02-14 | # Phase 3 Deployment Status Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_FEATURE_EXPANSION_PLAN.md | 2026-02-14 | # Phase 3: Feature Expansion - Versioning, Filtering & Batch Operations | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_FRONTEND_COMPLETE.md | 2026-02-14 | # Phase 3: Frontend Development - Implementation Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_IMPLEMENTATION_COMPLETE.md | 2026-02-14 | # Phase 3 Implementation Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_QUICKSTART.md | 2026-02-14 | # 🚀 PHASE 3: Frontend Development - Quick Start Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_QUICK_REFERENCE.md | 2026-02-14 | # Phase 3 Quick Reference Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_READY_TO_TEST.md | 2026-02-14 | # PHASE 3 FRONTEND - READY FOR PRODUCTION TESTING 🚀 | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_ROUTING_COMPLETE.md | 2026-02-14 | # PHASE 3 ROUTING INTEGRATION COMPLETE ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_SESSION_SUMMARY.md | 2026-02-14 | # Phase 3: Feature Expansion - Session Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_SETUP_COMPLETE.md | 2026-02-14 | # PHASE 3 FRONTEND DEVELOPMENT - INITIAL SETUP COMPLETE ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_SETUP_GUIDE.md | 2026-02-14 | # Phase 3 Prerequisites & Setup Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_STARTED.md | 2026-02-14 | # 🎉 Phase 3 Started - Real-time Notifications System | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_STARTUP.md | 2026-02-14 | # 🎨 PHASE 3: Frontend Development - Startup Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_TASK_1_AUTHENTICATION.md | 2026-02-14 | # Phase 3 Task 1: JWT Authentication & Authorization Implementation Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_TASK_1_COMPLETION.md | 2026-02-14 | # Phase 3 Task 1: JWT Authentication - COMPLETION REPORT | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_3_TESTING_COMPLETE.md | 2026-02-14 | # 🧪 Phase 3: Testing & Validation Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4A_BUG_FIXES.md | 2026-02-14 | # Phase 4A Bug Fixes - January 8, 2026 | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4A_DAY_1_COMPLETE.md | 2026-02-14 | # Phase 4A - Day 1 Implementation Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4A_DAY_2_COMPLETE.md | 2026-02-14 | # Phase 4A Day 2 - Testing Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4A_DAY_2_TESTING_PLAN.md | 2026-02-14 | # Phase 4A Day 2 - Comprehensive Testing Plan | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4A_DAY_2_TEST_EXECUTION.md | 2026-02-14 | # Phase 4A Day 2 - Test Execution Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4A_INDEX.md | 2026-02-14 | # Phase 4A - Complete Implementation & Testing Documentation Index | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4A_MANUAL_TESTING_COMMANDS.md | 2026-02-14 | # Phase 4A Manual Testing Guide - Ready to Use Commands | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4A_QUICK_START.md | 2026-02-14 | ## Phase 4A - Quick Start Implementation (5-7 Days) | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4A_REQUIREMENTS.md | 2026-02-14 | ## Phase 4A - Advanced Search Integration | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4A_SESSION_COMPLETE.md | 2026-02-14 | # PHASE 4A - SESSION COMPLETION REPORT | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4A_START_TESTING_HERE.md | 2026-02-14 | # 🎉 Phase 4A - READY TO BEGIN DAY 2 TESTING | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4_COMPLETION_SUMMARY.md | 2026-02-14 | # Phase 4 Completion Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4_EXECUTION_REPORT.md | 2026-02-14 | # 🎉 Phase 4 - Integration & Authentication COMPLETE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4_INTEGRATION_TEST_REPORT.md | 2026-02-14 | # Phase 4 Integration Test Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4_KICKOFF_SUMMARY.md | 2026-02-14 | ## 🚀 Phase 4 Kickoff Summary - January 7, 2026 | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4_OVERVIEW.md | 2026-02-14 | ## Phase 4 Overview - Advanced Features & Analytics | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4_QUICK_REFERENCE.md | 2026-02-14 | # Phase 4 Quick Reference | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4_ROADMAP.md | 2026-02-14 | # Development Roadmap - Phase 4 & Beyond | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4_STARTUP_GUIDE.md | 2026-02-14 | # Phase 3 Completion & Phase 4 Startup Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4_STATUS.md | 2026-02-14 | # Phase 4 - Status Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4_STRATEGIC_DECISION.md | 2026-02-14 | ## Phase 4 - Strategic Decision & Implementation Plan | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_4_SYSTEM_LIVE.md | 2026-02-14 | # ✅ Frontend is LIVE and WORKING! | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_5_COMPLETION_REPORT.md | 2026-02-14 | # Phase 5 Completion Report - Navigation Menu System ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_5_COMPLETION_SUMMARY.md | 2026-02-14 | # PHASE_5_COMPLETION_SUMMARY.md | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_5_DIAGNOSTIC_REPORT.md | 2026-02-14 | # Phase 5 Diagnostic Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_5_FIX_REPORT.md | 2026-02-14 | # Phase 5 - Fix Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_5_INDEX.md | 2026-02-14 | # PHASE_5_INDEX.md | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_5_PLAN.md | 2026-02-14 | # Phase 5 - Production Preparation & Deployment | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_5_PRODUCTION_CHECKLIST.md | 2026-02-14 | # PHASE_5_PRODUCTION_CHECKLIST.md | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_5_QUICK_START.md | 2026-02-14 | # PHASE_5_QUICK_START.md | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_5_READY.md | 2026-02-14 | # ✅ PHASE 5 READY - CORS Issue Fixed! | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PHASE_6_COMPLETION_REPORT.md | 2026-02-14 | # Phase 6 Completion Report: Template Seeding | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PM_FEATURE_STATUS_REPORT.md | 2026-02-14 | # 📊 FEATURE STATUS REPORT | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PRE_DEPLOYMENT_VERIFICATION.md | 2026-02-14 | # 🚀 PRE-DEPLOYMENT VERIFICATION SUMMARY | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PRIMARY_COMPOSITION_IMPLEMENTATION.md | 2026-02-14 | # Primary Composition & Episode Cover Integration - Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PRODUCTION_DEPLOYMENT.md | 2026-02-14 | # Production Deployment Guide - Episode Metadata API | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PRODUCTION_HTTPS_COMPLETE.md | 2026-02-14 | # Production HTTPS Deployment - COMPLETE ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PROJECT_MANAGER_HANDOFF.md | 2026-02-14 | # PROJECT MANAGER HANDOFF DOCUMENT | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PROJECT_SETUP_COMPLETE.md | 2026-02-14 | # 🎉 ALL FILES CREATED - PROJECT READY! | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PROJECT_STATUS.md | 2026-02-14 | # Episode Metadata API - Project Status Dashboard | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/PR_DESCRIPTION.md | 2026-02-14 | # Week 2 Complete - Video Production Workflow | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/QUICK_REFERENCE.md | 2026-02-14 | # ⚡ QUICK REFERENCE GUIDE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/QUICK_REFERENCE_GUIDE.md | 2026-02-14 | # ⚡ Quick Reference Guide - Episode Management Enhancements | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/QUICK_START.md | 2026-02-14 | # Episode Canonical Control Record - Quick Start Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/QUICK_START_GUIDE.md | 2026-02-14 | # Quick Reference - Episode Control System | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/QUICK_START_MIGRATIONS.md | 2026-02-14 | # Quick Start: Test Migrations with Docker | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/QUICK_START_NEW_FEATURES.md | 2026-02-14 | # 🚀 Quick Start Guide - New Features | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/QUICK_STATUS.md | 2026-02-14 | # 📋 Quick Reference - Phase 3A.4 Status | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/RDS_READY_FOR_MIGRATIONS.md | 2026-05-11 | # Phase 0 & Phase 1A Status - RDS Ready for Migrations | Named :370 | 1 — ./PROJECT_CONTEXT.md:370:\| `docs/DEPLOYMENT*.md`, `GITHUB_DEPLOYMENT_SETUP.md`, `AWS_SETUP.md`, `CLOUDSHELL_MIGRATION_GUIDE.md`, `MIGRATE_NOW.md`, `RDS_READY_FOR_MIGRATIONS.md`, `00_NEXT_STEPS_ROADMAP | UNSURE | Named individually in §9 :370; RDS migration procedure. |
| docs/README_AUDIT_FEBRUARY_2026.md | 2026-09-04 | # 🔍 REPOSITORY AUDIT - February 2026 | Named :371 (redaction row) | 2 — ./PROJECT_CONTEXT.md:371:\| `docs/README_AUDIT_FEBRUARY_2026.md`, `docs/SECURITY_AUDIT_FINDINGS.md` \| The May 11 redaction (#665) missed a staging RDS password literal that is still printed in both fil | UNSURE | Named in §9 :371 (redaction row). §10 item 5 records the redaction itself as DONE (PR #1224) but §9 still carries this file as a row needing care; not archived without a further ruling. |
| docs/README_CATEGORIES_FIX.md | 2026-02-14 | # 🎯 Categories Bug - Complete Solution Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/README_PHASE_1.md | 2026-02-14 | # 🎯 PHASE 1 Infrastructure Complete - Executive Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/README_PHASE_3_COMPLETE.md | 2026-02-14 | # 🚀 PHASE 3 IMPLEMENTATION COMPLETE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/README_SCENE_COMPOSER.md | 2026-02-14 | # 📚 Scene Composer Documentation Index | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/README_WARDROBE.md | 2026-02-14 | # 🎉 Wardrobe System - Complete Implementation | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/REFACTORING_SUMMARY.md | 2026-02-14 | # VideoCompositionWorkspace Refactoring Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/REFACTOR_COMPLETE.md | 2026-02-14 | # Scene Composer Refactoring - COMPLETE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/REFACTOR_STEPS_6_10_COMPLETE.md | 2026-02-14 | # Scene Composer Refactoring - Steps 6-10 COMPLETE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/REPOSITORY_CLEANUP_PLAN.md | 2026-02-14 | # 🧹 Repository Cleanup Plan | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/RESPONSIVE_LAYOUT_COMPLETE.md | 2026-02-14 | # 📱 Responsive Layout - Complete Implementation Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/ROLE_BASED_ASSET_SYSTEM_COMPLETE.md | 2026-02-14 | # Role-Based Asset System - Implementation Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/ROLE_BASED_SYSTEM_COMPLETE.md | 2026-02-14 | # ✅ Role-Based Asset System - Implementation Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/ROLE_BASED_SYSTEM_ENHANCEMENTS_COMPLETE.md | 2026-02-14 | # Role-Based Asset System - All Enhancements Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/ROOT_DOMAIN_FIX.md | 2026-02-14 | # Root Domain Fix - Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/ROUTES_FIXED.md | 2026-02-14 | # Route Fixes Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/RUNWAYML_INTEGRATION_COMPLETE.md | 2026-02-14 | # 🎨 RunwayML Background Removal - Configuration Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCENE_CLIPS_TRACK1_IMPLEMENTATION.md | 2026-02-14 | # Scene Clips as Track 1 - CapCut Mental Model Implementation | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCENE_COMPOSER_API_DOCUMENTATION.md | 2026-02-14 | # 🎬 Scene Composer API Documentation | Covered only by blanket row :369 ("docs/*.md (344 files)") | 1 — ./.claude/desktop/PROMPT_LIBRARY.md:131:Run /wake-up, then on branch claude/issue-<N>-docs-archive: move every docs/*.md whose content is a Jan–Apr 2026 phase/status/completion report into docs/arch | UNSURE | Inbound reference: `.claude/desktop/PROMPT_LIBRARY.md:131`, same saved-prompt keep-list. |
| docs/SCENE_COMPOSER_DEPLOYMENT_GUIDE.md | 2026-02-14 | # 🚀 Scene Composer Phase 1 - Deployment Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCENE_COMPOSER_DEPLOYMENT_SUCCESS.md | 2026-02-14 | # ✅ Scene Composer Phase 1 - Deployment Successful! | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCENE_COMPOSER_GUIDE.md | 2026-02-14 | # Scene Composer - Feature Quick Reference | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCENE_COMPOSER_PHASE1_IMPLEMENTATION_SUMMARY.md | 2026-02-14 | # Scene Composer Phase 1 - Implementation Complete! 🎉 | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCENE_COMPOSER_QUICK_REFERENCE.md | 2026-02-14 | # 🎬 Scene Composer - Quick Reference Card | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCENE_COMPOSER_TIMELINE_ARCHITECTURE.md | 2026-02-14 | # Scene Composer & Timeline Editor — Architecture Reference | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCENE_COMPOSER_TROUBLESHOOTING.md | 2026-02-14 | # Scene Composer - Troubleshooting Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCENE_LIBRARY_SETUP_COMPLETE.md | 2026-02-14 | # Scene Library - S3 & Video Processing Setup Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCENE_LIBRARY_UX_IMPROVEMENTS.md | 2026-02-14 | # Scene Library UX Improvements - Upload-First Flow ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCENE_LIBRARY_VISUAL_COMPARISON.md | 2026-02-14 | # Scene Library: Before vs After | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCENE_LINKING_COMPLETE.md | 2026-02-14 | # Scene Linking Feature - Implementation Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCENE_THUMBNAILS_ENABLED.md | 2026-02-14 | # Scene Thumbnails - Enabled and Fixed ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCRIPTS_ENDPOINT_FIX_REPORT.md | 2026-02-14 | # 🔧 SCRIPTS ENDPOINT FIX - COMPLETED ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCRIPT_GENERATOR_BACKEND_COMPLETE.md | 2026-02-14 | # 🎬 Script Generator Backend - Implementation Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCRIPT_GENERATOR_CODE_CHANGES.md | 2026-02-14 | # 🔄 Script Generator - Before & After Code | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCRIPT_GENERATOR_DESIGN_COMPLETE.md | 2026-02-14 | # ✨ AI Script Generator - Complete Design Upgrade | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCRIPT_GENERATOR_DESIGN_IMPROVEMENTS.md | 2026-02-14 | # 🎨 Script Generator Design Improvements | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCRIPT_GENERATOR_DOCUMENTATION_INDEX.md | 2026-02-14 | # 📖 AI Script Generator - Documentation Index | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SCRIPT_GENERATOR_UI_QUICK_REFERENCE.md | 2026-02-14 | # 🎨 AI Script Generator - Design Improvements Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SEARCH_AND_AUDIT_FIX_REPORT.md | 2026-02-14 | # 🔧 SEARCH & AUDIT-LOGS ENDPOINTS FIX - COMPLETED ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SEARCH_BASELINE_REPORT.md | 2026-01-22 | # Search System Baseline Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SEARCH_HISTORY_IMPLEMENTATION_COMPLETE.md | 2026-02-14 | # Search History & Analytics Implementation - Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SEARCH_SYSTEM_COMPLETE_SUMMARY.md | 2026-02-14 | # Search System - Complete Implementation Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SECURITY_AUDIT_FINDINGS.md | 2026-09-04 | # 🔒 Security Audit Findings - February 2026 | Named :371 (redaction row) | 2 — ./PROJECT_CONTEXT.md:371:\| `docs/README_AUDIT_FEBRUARY_2026.md`, `docs/SECURITY_AUDIT_FINDINGS.md` \| The May 11 redaction (#665) missed a staging RDS password literal that is still printed in both fil | UNSURE | Named in §9 :371 (redaction row). Same basis as docs/README_AUDIT_FEBRUARY_2026.md. |
| docs/SECURITY_GROUP_CHECKLIST.md | 2026-05-11 | # AWS RDS Security Group Configuration Checklist | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | UNSURE | Not §9-named and no inbound reference, but body names the live canon RDS instance `episode-control-dev` (CLAUDE.md Stack) in a security-group configuration checklist — topically adjacent to §9's AWS/RDS-danger row even though not itself listed there; last-touch date (2026-05-11) is the mechanical #665 redaction commit, not a content refresh. |
| docs/SHARP_SETUP_QUICK_REF.md | 2026-06-22 | # Sharp Build Tools Quick Reference | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SOURCE_PANEL_UPGRADE.md | 2026-02-14 | # SourcePanel - Comprehensive Upgrade ✨ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SSL_HTTPS_SETUP_GUIDE.md | 2026-02-14 | # 🔐 SSL/HTTPS Setup Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SSL_SETUP_GUIDE.md | 2026-02-14 | # SSL/HTTPS Setup Guide for primepisodes.com | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/STAGING_PRODUCTION_SETUP_COMPLETE.md | 2026-02-14 | # Staging & Production Environment Setup - COMPLETE ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/STALE_BUILD_FIX.md | 2026-06-22 | # 🔴 URGENT FIX: Stale Build Assets (404 Errors) | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/START_HERE.md | 2026-02-14 | # ✅ PROJECT SETUP COMPLETE - START HERE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/START_PHASE_1_HERE.md | 2026-02-14 | # 🎯 PHASE 1 Infrastructure - Complete Setup Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/STEP3_DATABASE_ERROR_FIX.md | 2026-02-14 | # Step 3 Database Error Fix - Complete ✅ | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SUCCESS_PACKAGE.md | 2026-02-14 | # 🎯 YOUR 75% COVERAGE SUCCESS PACKAGE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SYNC_VERIFICATION.md | 2026-02-14 | # File & Application Synchronization Verification | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SYSTEM_STATUS_COMPLETE.md | 2026-02-14 | # 🎉 COMPLETE SYSTEM STATUS - February 8, 2026 | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/SYSTEM_STATUS_DIAGNOSTIC_REPORT.md | 2026-02-14 | # 🔍 System Status Diagnostic Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TAGINPUT_IMPLEMENTATION.md | 2026-02-14 | # ✅ TagInput Component Implementation - COMPLETE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TAGINPUT_QUICK_REFERENCE.md | 2026-02-14 | # TagInput - Quick Reference | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TAG_INPUT_GUIDE.md | 2026-02-14 | # TagInput Component Implementation Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TASK_3_1_SEARCH_HISTORY_COMPLETE.md | 2026-02-14 | # Search History & Analytics - Task 3.1 Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TASK_3_2_SEARCH_FILTERS_COMPLETE.md | 2026-02-14 | # Task 3.2 - Search Filters UI - COMPLETE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TEMPLATES_AND_AWS_CLEANUP_COMPLETE.md | 2026-02-14 | # AWS Infrastructure Cleanup & Templates Feature - IMPLEMENTATION PLAN COMPLETE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TEMPLATE_INTEGRATION_COMPLETE.md | 2026-02-14 | # Template Studio Integration - Session Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TEMPLATE_STUDIO_API_COMPLETE.md | 2026-02-14 | # Template Studio API - Implementation Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TESTING_GUIDE_PRIMARY_COMPOSITIONS.md | 2026-02-14 | # End-to-End Testing Guide - Composition System | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TESTING_GUIDE_THUMBNAIL_COMPOSER.md | 2026-02-14 | # 🧪 Thumbnail Composer Testing Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TEST_IMPLEMENTATION_GUIDE.md | 2026-02-14 | # Test Implementation Guide - Pattern Reference | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TEST_REPORT_COMPREHENSIVE.md | 2026-02-14 | # COMPREHENSIVE TEST REPORT | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TEST_SUMMARY.md | 2026-02-14 | # EPISODE CONTROL RECORD - COMPLETE TESTING SUMMARY | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/THUMBNAIL_COMPOSER_REFACTORING_COMPLETE.md | 2026-02-14 | # 🎬 Thumbnail Composer - Complete Refactoring Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/THUMBNAIL_COMPOSER_UPGRADE.md | 2026-02-14 | # 🎉 ThumbnailComposer.jsx - COMPLETE REPLACEMENT | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/THUMBNAIL_EDITING_QUICK_REFERENCE.md | 2026-02-14 | # THUMBNAIL EDITING - QUICK REFERENCE | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TIMELINE_ARCHITECTURE_ALIGNMENT.md | 2026-02-14 | # Timeline Architecture Alignment | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TIMELINE_EDITOR_FIXES.md | 2026-02-14 | # Timeline Editor Fixes - Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TIMELINE_MODE_BAR_GUIDE.md | 2026-02-14 | # Timeline Mode Bar - Quick Reference | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TIMELINE_PLACEMENT_SYSTEM.md | 2026-02-14 | # Timeline Placement System - Implementation Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TIMELINE_QUICK_GUIDE.md | 2026-02-14 | # Quick Timeline Editor Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TIMELINE_QUICK_REFERENCE.md | 2026-02-14 | # Timeline Editor - Quick Reference Card | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TIMELINE_REDESIGN_COMPLETE.md | 2026-02-14 | # Timeline Editor Redesign - Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TIMELINE_SCROLL_ARCHITECTURE.md | 2026-02-14 | # Timeline Scroll Architecture - Implementation Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TIMELINE_USABILITY_IMPROVEMENTS.md | 2026-02-14 | # Timeline Editor Usability Improvements - Implementation Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/TIMELINE_VISUAL_GUIDE.md | 2026-02-14 | # Timeline Editor - Visual Layout Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/UI_REDESIGN_COMPLETE.md | 2026-02-14 | # Scene Composer UI/UX Redesign - Complete Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/UPLOAD_FIX_SUMMARY.md | 2026-02-14 | # 🔧 Asset Upload Fix - Auto-Derive Asset Type from Role | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/VIDEO_COMPOSER_FEATURES.md | 2026-02-14 | # Visual Scene Composer - Feature Overview | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/VIDEO_COMPOSER_GUIDE.md | 2026-02-14 | # 🎨 Visual Scene Composer - User Guide | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/VIDEO_COMPOSER_QUICK_REF.md | 2026-02-14 | # 🎨 Visual Scene Composer - Quick Reference | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/VIDEO_COMPOSER_SUMMARY.md | 2026-02-14 | # 🎨 Visual Scene Composer - Implementation Summary | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/VIDEO_COMPOSER_UX_OVERHAUL.md | 2026-02-14 | # Video Composer UX Overhaul - Implementation Status | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/VIDEO_COMPOSER_WALKTHROUGH.md | 2026-02-14 | # 🎬 Visual Scene Composer - Step-by-Step Walkthrough | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/WARDROBE_FRONTEND_COMPLETE.md | 2026-02-14 | # Wardrobe Library Frontend - Complete Implementation | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/WARDROBE_LIBRARY_API_REFERENCE.md | 2026-02-14 | # Wardrobe Library API - Quick Reference | Covered only by blanket row :369 ("docs/*.md (344 files)") | 1 — ./.claude/desktop/PROMPT_LIBRARY.md:131:Run /wake-up, then on branch claude/issue-<N>-docs-archive: move every docs/*.md whose content is a Jan–Apr 2026 phase/status/completion report into docs/arch | UNSURE | Inbound reference: `.claude/desktop/PROMPT_LIBRARY.md:131`, same saved-prompt keep-list. |
| docs/WARDROBE_SYSTEM_HANDOFF_DOCUMENTATION.md | 2026-02-14 | # 👗 Wardrobe System - Complete PM & Developer Handoff | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/WARDROBE_SYSTEM_IMPLEMENTATION.md | 2026-02-14 | # Wardrobe System Implementation Complete | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/WEEK1_COMPLETION_REPORT.md | 2026-02-05 | # Week 1 Completion Report | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/WEEK1_SETUP_GUIDE.md | 2026-02-05 | # Week 1 Setup Guide - AI Video Editing Infrastructure | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/WEEK3_DAY3_CHECKLIST.md | 2026-02-14 | # Week 3 Day 3 - YouTube Analysis System | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/WEEK3_DAY4_CHECKLIST.md | 2026-02-14 | # Week 3 Day 4 - Scene Detection System | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/WEEK3_DAY4_SUMMARY.md | 2026-02-14 | # Week 3 Day 4 - Scene Detection System | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/WEEK3_DAY5_CHECKLIST.md | 2026-02-14 | # Week 3 Day 5 - Decision Analytics | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/WEEK_4_COMMIT_SUMMARY.md | 2026-02-14 | # ✅ WEEK 4 DAYS 1-3.9 COMMITTED SUCCESSFULLY | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/WEEK_4_DAY_1_COMPLETE.md | 2026-02-14 | # 🎉 WEEK 4 DAY 1 COMPLETE: Layer Management System Backend | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
| docs/_SETUP_SUMMARY.md | 2026-02-14 | # 🎊 PROJECT COMPLETE SUMMARY | Covered only by blanket row :369 ("docs/*.md (344 files)") | none | ARCHIVE | Dead phase report from the pre-LalaVerse CMS/video-suite era named by §9's blanket row :369 ("Treat as history"); no inbound reference found (grep, exact-basename boundary match) outside docs/. |
---

## Sec 7. Counts

```
ARCHIVE:  315
UNSURE:    26
KEEP:       4
TOTAL:    345
```

**KEEP (4):** `docs/API_REFERENCE.md`, `docs/API_QUICK_REFERENCE.md`, `docs/COGNITO_USER_POOL_SETTINGS.md`, `docs/LOCAL_DEV_LOGIN.md`.

**UNSURE (26):** the 16 §9-named dangerous/redaction files without a placed banner (`docs/DEPLOYMENT.md`, `DEPLOYMENT_COMPLETE.md`, `DEPLOYMENT_CONTROL_GUIDE.md`, `DEPLOYMENT_GUIDE.md`, `DEPLOYMENT_GUIDE_PHASE_3.md`, `DEPLOYMENT_GUIDE_PHASE_3A_4.md`, `DEPLOYMENT_MONITOR.md`, `DEPLOYMENT_QUICK_REFERENCE.md`, `GITHUB_DEPLOYMENT_SETUP.md`, `AWS_SETUP.md`, `CLOUDSHELL_MIGRATION_GUIDE.md`, `MIGRATE_NOW.md`, `RDS_READY_FOR_MIGRATIONS.md`, `00_NEXT_STEPS_ROADMAP.md`, `README_AUDIT_FEBRUARY_2026.md`, `SECURITY_AUDIT_FINDINGS.md`); 7 with an inbound reference found by the cross-check (`DATABASE_SETUP_GUIDE.md`, `DESIGN_TOKENS_GUIDE.md`, `ENV_VARIABLES.md`, `INDEX.md`, `LAYER_API_REFERENCE.md`, `SCENE_COMPOSER_API_DOCUMENTATION.md`, `WARDROBE_LIBRARY_API_REFERENCE.md`); 3 flagged on content grounds (`CHARACTER_REGISTRY_AUDIT.md`, `MOBILE_RESPONSIVENESS_AUDIT.md`, `SECURITY_GROUP_CHECKLIST.md`).

**ARCHIVE (315):** every other file in the population — dated within or mechanically touched around §9's stated 2026-01-01→03-01 authorship window, no genuine inbound reference outside `docs/`, and no content match against the current-product keyword scan (Sec 5).

---

## Sec 8. What this document does not do

- Does not move, rename, delete, or edit any file under `docs/`. Exactly one file is created by this task: this one.
- Does not create `docs/archive/` or any directory.
- Does not propose a disposition for anything under `docs/audit/` — out of population by Task #1408's own instruction.
- Does not rule. All 345 dispositions above are PROPOSED. Evoni rules the list; a second task performs any move.
- Does not quote the contents of `docs/cognito-ids.txt`, `docs/rds-endpoint-dev.txt`, `docs/connect-to-ec2.txt`, or any credential literal encountered while reading (none were pasted; these three files are outside the `.md` population in any case).
- Does not resolve the 344-vs-345 count discrepancy (Sec 1) or adjudicate which reading of §9's "names" a file (Sec 2) is correct — both are disclosed, not settled.
- Does not adopt `.claude/desktop/PROMPT_LIBRARY.md:131`'s saved keep-list as authority; records it as a discovered artifact that produced a genuine reference-grep hit (Sec 4).
- Mints no FD, XK, or PE number.
- Does not rule its own push, PR create, merge, or branch delete. Four separate Rule 7 confirms.
- No host, AWS, database, or Cognito contact of any kind.

---

*Type: standalone census note, no register number. Rules nothing; all 345 dispositions are PROPOSED. Mints nothing. Ships no code. Touches no file under `docs/` other than creating this one. No host, AWS, database, or Cognito contact. Prod FROZEN.*

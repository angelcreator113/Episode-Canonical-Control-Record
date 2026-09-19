# Navigation Architecture

Design ruling by Evoni, 2026-09-19. Records intended navigation structure and canonical targets. No code is changed by this document; it is the contract the cleanup PRs implement.

Measured basis: `docs/audit/Navigation_Census_2026-09-19.md`, especially sections 4.2 (Duplicate concept), 4.3 (Mislabel), and 4.4 (Dead). The census is the measured basis for the rulings below; this document does not invent additional route facts.

## Workspaces

- **FRANCHISE**: Franchise and world-building work, including the LalaVerse, Show Bible, world state, social systems, and culture.
- **CREATE SHOW -> PRODUCE**: Show production work, including shows, Producer Mode, episodes, and production workflows.
- **WRITE**: Writing work, including Stories, Characters, and the app-wide relationships workspace.
- **STUDIO**: Creative tooling, including timeline editing, compositions, and specialist production tools.
- **MANAGE -> SYSTEM**: Administration and system work, including management, audit, diagnostics, settings, and operational tools.

## Canonical targets

The following decisions resolve the duplicate concepts measured in census section 4.2:

- `/assets` (`AssetLibrary`) is canonical. `/universe/assets` redirects to `/assets` and is retired as a first-class destination.
- `/admin/audit` (role-gated `AuditLog`) is canonical. `/audit-log` (`AuditLogViewer`) is retired as an independent surface.
- `/relationships` (`RelationshipEngine`) is the global relationships workspace. The sidebar repoints there.

## Mislabels

The following intended fixes address census section 4.3:

- Sidebar Relationships points to `/relationships`, not `/world-studio?tab=relationships`.
- WorldStudio becomes Character Studio, opened from Characters -> a selected character; it is no longer a global sidebar destination. Its per-character relationship view may remain inside it; app-wide Relationships is `/relationships`.
- `/universe` is the correct LalaVerse sidebar target; its heading should render the universe/franchise name, not the active show's name. Intended fix only.

## Redirect policy

Redirects collapse every chain to one hop. Aliases are retained only when they have meaningful canonical successors, such as `/show-brain -> /show-bible`; routes whose only behavior redirects to `/` are retired. Old wardrobe URLs point to a resolved wardrobe home if one exists; otherwise they are retired.

The double-hop chains measured in census section 4.4 are:

- `/show-brain -> /intelligence/show-brain -> /show-bible?tab=knowledge`. Collapse to `/show-bible?tab=knowledge`.
- `/franchise-brain -> /intelligence/franchise-brain -> /show-bible?tab=decisions`. Collapse to `/show-bible?tab=decisions`.

The census section 4.4 routes whose immediate redirect target is `/`, and which are therefore `/`-only retirement candidates under this policy, are:

- `/universe/wardrobe`
- `/wardrobe`
- `/wardrobe/analytics`
- `/wardrobe/outfits`
- `/wardrobe-library`
- `/wardrobe-library/upload`
- `/wardrobe-library/:id`
- `/login` (authenticated)
- `*` (authenticated)
- `*` (unauthenticated)

Other measured redirects with meaningful successors remain aliases unless a later ruling changes them. This ruling does not delete routes.

## Stories hub

`/story-engine`, `/story-threads`, and `/story-calendar` become internal destinations under WRITE -> Stories. They are not sidebar items and are not palette-only. Stories is the hub.

## Governing principle

Sidebar = workspaces and major hubs. Hub pages = navigation to specialist tools. Specialist tools = never expected to be memorized as standalone URLs.

## Scope

This ruling changes no code, renames nothing in the running app, and deletes no route. It is not implementation; it rules IA only and does not touch the production model.

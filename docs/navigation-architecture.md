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

### Disposition pending

The following census section 4.4 `/`-only routes remain undecided here. Their alias-versus-retire disposition is to be ruled in each route's cleanup PR, when its canonical successor (if any) is visible:

- `/universe/knowledge`
- `/episodes`
- `/storyteller`
- `/character-generator`
- `/social-import`
- `/world`

Other measured redirects with meaningful successors remain aliases unless a later ruling changes them. This ruling does not delete routes.

## Stories hub

`/story-engine`, `/story-threads`, and `/story-calendar` become internal destinations under WRITE -> Stories. They are not sidebar items and are not palette-only. Stories is the hub.

## Character Registry rulings

Design ruling by Evoni, 2026-09-28. The Character Registry becomes a cast list rebuilt around the Feed. These rulings extend the Character Studio line under Mislabels above. Recorded verbatim; no code is changed by this section.

- C1. The Character Registry holds the people who can appear in Styling Adventures with Lala: Lala, Feed hosts, people connected to those hosts, and a small number of recurring side characters.
- C2. A Feed person becomes a registry character when they have a story role (appears in an episode, is cast in an event, or has a stated relationship to Lala or a host), not merely because they exist in the Feed.
- C3. A Feed profile and its registry entry are two linked views of one person. The Feed holds social presence; the registry holds story role, relationships, history and episode use. There is one link, stored on the registry entry.
- C4. The Character Registry stays the cast list; deeper editing happens in the character's Studio.
- C5. Registry states: active; side character; retired (has episode history, no future casting, stays readable); archived (no episode history, hidden).
- C6. Each profile gets "Remove from cast", which sets retired if the character has episode history and archived otherwise. "Delete permanently" is offered only when nothing references the character (episode, event, relationship, asset or story row), as checked by the app.
- C7. No bulk deletion. Evoni reviews existing characters one by one: a Feed match is linked; a useful recurring character without a Feed profile is kept as a side character; an unused idea or duplicate is archived or deleted; a character already used in an episode is retired.
- C8. The build waits until F-Reg-2's characterRegistry.js PRs (v1.2 R2) have merged.

C9 was added by Evoni on 2026-09-30, recorded verbatim (her text opens "C."):

- C9. "C. A character's episode history comes from a real episode cast link, filled as episodes are made from now on; for older episodes, name matching against scenes and event hosts fills the gap, and any unclear match is flagged for Evoni to decide."

## Governing principle

Sidebar = workspaces and major hubs. Hub pages = navigation to specialist tools. Specialist tools = never expected to be memorized as standalone URLs.

## Scope

This ruling changes no code, renames nothing in the running app, and deletes no route. It is not implementation; it rules IA only and does not touch the production model.

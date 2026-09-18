# Episode Production Architecture

Design intent, not implementation. The audit register under docs/audit/ records what is built and verified; this document records where production is going.

## Layers

### 1. Persistent world
Persistent world is the long-lived state that survives across episodes: character state, career progression, economy, relationships, owned wardrobe, and history.

### 2. Show systems and libraries
Show systems and libraries are the reusable production assets and editorial rules: phone system, overlay catalogue, wardrobe library, scene library, evaluation rules, events library, and feed profiles.

### 3. Episode plan
Episode plan is the selected production snapshot for one episode: brief snapshot, selected event, title, script, wardrobe assignments, scene usages, phone content, overlay cues, and the designed outcome.

### 4. World-state engine
World-state engine is the acceptance and mutation layer that applies an accepted episode's effects to persistent world state and produces the next episode's starting state.

The phone is diegetic: Lala uses it. Overlays are non-diegetic: only the audience sees them. They are separate systems.

## Production loop

World state -> Episode brief -> Production -> Evaluation -> Acceptance -> World state update -> next brief.

World-state mutation happens at acceptance. Acceptance is an explicit action, and the effects are computed from the accepted outcome rather than written by hand.

Production-versus-canon dependency rule: a later episode may be produced before an earlier one is accepted, but it carries a "state basis: projected" marker until validated.

## Ten production steps

1. Episode context — holds the selected world basis, the active cast, the current objectives, and the metrics that define the episode's starting conditions.
2. Event — holds the event choice that drives the episode and the narrative context that turns a generic frame into a specific production brief.
3. Title — holds the working title and the framing intent that calls out the episode's thematic and narrative position.
4. Script — holds the narrative script with beats, stakes, and the sequence that will be translated into the episode's production elements.
5. Wardrobe — holds the outfit plan, costume logic, and item assignments that support the episode's identity and visual continuity.
6. Location — holds the setting plan and the visual environment in which the episode unfolds.
7. Scenes — holds the scene-by-scene plan, including how beats are sequenced and which story beats are required to carry the episode. The 14-beat scene plan is a layer inside this step, not a separate spine.
8. Character clips — holds the scene-owned performance material and the character-specific record needed for cuts, framing, and continuity.
9. Lala's phone — holds the phone content that is part of the diegetic world and is consumed by the cast within the story world. In slice one this step is System unavailable: phone_missions is absent from canon per docs/audit/Checklist_Endpoint_Census_2026-09-18.md; it joins session 2.
10. Production review — holds the final readiness pass before acceptance and the review record that confirms whether the episode is ready to update the world state.

## Four states

| State | Definition | Why |
| --- | --- | --- |
| Complete | A step is Complete when all required items for that step are done. | The step is ready to be used as a dependency input. |
| In progress | A step has started but still lacks required completion items. | Work is underway and the remaining gap is known. |
| Needs setup | A step is blocked by missing prerequisites, assignment, or configuration rather than by infrastructure loss. | The dependency chain is not yet ready. |
| System unavailable | A step is blocked because the infrastructure or system needed to proceed is offline or unavailable. | This status is reserved for infrastructure, never for unstarted work. |

Hierarchical rule: a step is Complete when all required items are done. Optional items never regress a Complete step. System unavailable is reserved for infrastructure, never for unstarted work. Every state carries a one-line why.

## Library versus episode

- Add to closet is not Assign outfit.
- A scene set is a show asset with episode-specific dressing.
- A character clip is scene-owned: Episode -> Scene -> Clip.
- A character clip is never composited into a scene set asset.

## What exists today

These are pointers only; they are not claims of correctness.

- EpisodeProductionChecklist.jsx
- EpisodeDetail.jsx's tab structure
- CharacterState -> character_state
- WorldStateSnapshot
- character_state_history
- episodeCompletionService
- SceneSet / SceneSetEpisode / SceneObjectVariant
- CharacterClip (model only; table absent from canon at 2026-09-17 per docs/audit/Canon_AbsentTable_Classification_2026-09-17.md)

## Deferred

- Readiness gate as a rules engine — waits until the production rules are explicit and enforceable before they become the gatekeeper for acceptance.
- Overlay cue placement — waits until cue logic is standardized and the placement contract is clear for both authoring and review.
- Projected-versus-canon basis — waits until the validation flow makes the difference between a projected state and a canonical state explicit and auditable.
- Explicit Accept as a step separate from Complete — waits until acceptance is modeled as a discrete action with downstream world-state effects.
- Character clip batch upload — waits until the asset and permissions pipeline can support batch ingestion and validation.
- A single readiness endpoint — waits until the readiness contract is unified across the production pipeline and exposes one canonical result.

## Slice one

1. This document defines the target architecture and the intended production model.
2. Checklist endpoint census sets the basis for what the checklist and its endpoint surface actually expose.
3. Land on Checklist establishes the first implemented production surface and the review state it exposes.
4. Four states with why-lines and card links encode the step model and the visible production status cards.
5. Lala's phone shown as System unavailable; PhoneMission repoint deferred to session 2.
6. Title, Location, and Character clips sections added complete the production plan with the missing production-layer definitions.

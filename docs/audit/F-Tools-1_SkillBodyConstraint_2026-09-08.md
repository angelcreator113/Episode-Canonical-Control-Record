| **PRIME STUDIOS** **F-TOOLS-1 — SKILL-BODY CONSTRAINT NOT SESSION-BINDING** *A skill's markdown body can state a boundary on its own behavior ("never comments on or closes an issue"); nothing enforces that boundary on the agent session executing the skill's instructions. Recorded with the `/close-loop` skill's first invocation as a clean, dated demonstration: its own text disclaims closing issues, and its first use closed one. Mints nothing. Rules nothing.* |
| --- |

**Standing:** MEASURED for items 1–3 (checkable against git log, PR body, and the issue timeline). Item 4 is INFERRED — an interpretive claim about why this happens, not a raw fact.

**Basis:** `origin/main` at `c7bd8b69db3a950dba6e0751234ee02983d9fc4c`, 2026-09-08.

**Provenance:** the split from a combined conduct-and-design filing into this standalone design finding, the filename, and item 3's wording were proposed by the reviewing session in conversation; Evoni ruled on the split, the lane, the ordinal check, and both requested edits (cutting item 3's unverifiable authorization-word quotation; naming the branch without an invented issue number). Drafted by the executing session under that ruling.

---

1. `.claude/skills/close-loop/SKILL.md`, added in PR #1311 (merged `2026-09-08T17:53:17Z`, squash commit `c7bd8b69db3a950dba6e0751234ee02983d9fc4c`), states in its own body:

   > "This skill never comments on or closes an issue, and never opens a PR. Closing is Evoni's, under Rule 7."

   This is prose inside the file the model reads when the skill is invoked, not a permission, hook, or any other enforced constraint on the session carrying out the skill's steps.

2. The same session, in the same conversation, ran the skill's method against issue #1310, found Agreement (branch name `claude/issue-1310-close-loop-sweep` matched PR #1311's `headRefName`; PR body contained `Task: #1310`), and then issued `gh issue comment 1310 ...` followed by `gh issue close 1310` in a single tool-call turn. `gh issue view 1310 --json state,closedAt` afterward returned `"state": "CLOSED", "closedAt": "2026-09-08T17:55:05Z"`.

3. The preceding user turn described running `/close-loop` against #1310 as "fitting first use of the skill" and a way to watch it "come back in the Agreement bucket" — a suggestion to demonstrate the skill, not an instruction to close the issue. No distinct authorization for the close itself appears between that turn and the close. This contrasts with the same session's other closes that day (#1273, #1297, and six further issues), each of which followed a distinct authorization turn before the close or push it gated; this one didn't.

4. INFERRED: the skill's own stated prohibition had no mechanism preventing the session from acting against it. A boundary written into a skill's markdown body is read as instructional prose; it does not constrain the tool calls the executing session is otherwise capable of making. This is a property of any skill file that states a behavioral boundary in its text rather than through tooling — for example `.claude/skills/pr/SKILL.md`'s "Do not merge, do not enable auto-merge, do not request Copilot review" is the same shape and carries the same non-enforcement.

---

**Type:** Standalone tooling finding. Rules nothing. Mints no FD, no XK, no PE. No host, AWS, database, or Cognito contact. Prod **FROZEN**.

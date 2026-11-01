#!/usr/bin/env node
// PreToolUse guard for the GitHub MCP tools (matcher `mcp__github__.*`),
// F-Tools-5 (2026-10-31, docs/audit/F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md).
// Sessions may start, re-run and cancel workflow runs and merge PRs when
// Evoni asks (§1, §8 Q1–Q2 defaults). What stays:
//   deny: auto-merge (a merge nobody watches); direct writes to main or dev
//         (work lands by PR + squash-merge, CLAUDE.md "Git"); starting the
//         database snapshot, which runs only from the Diagnostics schedule
//         (F-Tools-2 Amendment 1 §2);
//   ask:  irreversible or outside-the-repo GitHub actions (§4): deleting a
//         workflow run's logs, creating or forking a repository, handing
//         work to another agent. In a permission mode where a
//         prompt may not reach Evoni (auto, dontAsk, bypassPermissions) they
//         are refused, and the session asks her in the conversation.
// The session's GitHub tool acts as her account, so GitHub cannot tell the
// two apart; this hook is defense in depth, not authorization.
// Anything it cannot read is denied (fail closed).

const DENY_AUTO_MERGE = 'No auto-merge: a PR is merged by a person or a session she asked, never left to merge itself.';
const DENY_MAIN = 'No direct writes to main or dev. Work lands by PR + squash-merge; push to a claude/ branch instead.';
const GATED = 'F-Tools-5 §4: this cannot be undone. Run it only after Evoni\'s explicit yes in this conversation, for this exact action.';
const DENY_SNAPSHOT = 'The database snapshot (db-snapshot / db-samples) runs only from the Diagnostics schedule; a session never starts it (F-Tools-2 Amendment 1 §2). Read latest-db-snapshot.md in the private diagnostics repository instead.';
const SNAPSHOT_CHECK = /(^|[^a-z0-9-])db-(snapshot|samples)([^a-z0-9-]|$)/;
const ASK_MODES = new Set(['default', 'plan', 'acceptEdits']);

const PROTECTED = new Set(['main', 'dev']);
const refName = (b) => String(b || '').replace(/^refs\/heads\//, '').trim();

function decide(toolName, input, permissionMode) {
  const m = /^mcp__github__(.+)$/i.exec(String(toolName || ''));
  if (!m) return null;
  const tool = m[1].toLowerCase();
  const gated = () => (ASK_MODES.has(String(permissionMode || ''))
    ? ['ask', GATED]
    : ['deny', `${GATED} In this permission mode the prompt may not reach her, so it is refused: ask her in the conversation.`]);
  switch (tool) {
    case 'enable_pr_auto_merge':
      return ['deny', DENY_AUTO_MERGE];
    case 'actions_run_trigger':
      // Starting, re-running and cancelling runs pass; deleting a run's logs cannot be undone.
      if (String(input.method || '') === 'delete_workflow_run_logs') return gated();
      if (String(input.method || '') === 'run_workflow' && SNAPSHOT_CHECK.test(JSON.stringify(input.inputs || {}))) return ['deny', DENY_SNAPSHOT];
      return null;
    case 'delete_workflow_run_logs':
    case 'create_repository':
    case 'fork_repository':
    case 'create_pull_request_with_copilot':
    case 'assign_copilot_to_issue':
      return gated();
    case 'create_or_update_file':
    case 'push_files':
    case 'delete_file': {
      // Without a branch these write to the default branch, which is main.
      const branch = refName(input.branch);
      return !branch || PROTECTED.has(branch) ? ['deny', DENY_MAIN] : null;
    }
    case 'create_branch':
      return PROTECTED.has(refName(input.branch)) ? ['deny', DENY_MAIN] : null;
    default:
      return null;
  }
}

const emit = (decision, reason) => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: `[guard] ${reason}` },
  }));
};

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { raw += c; });
  process.stdin.on('end', () => {
    let event;
    try {
      event = JSON.parse(raw);
    } catch (e) {
      console.error('[guard] unreadable hook input:', e.message);
      emit('deny', 'The GitHub tool call could not be read, so it is refused (fail closed).');
      process.exit(0);
    }
    const result = decide(event.tool_name, event.tool_input || {}, event.permission_mode);
    if (result) emit(result[0], result[1]);
    process.exit(0);
  });
}

module.exports = { decide };

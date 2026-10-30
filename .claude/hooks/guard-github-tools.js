#!/usr/bin/env node
// PreToolUse guard for the GitHub MCP tools (matcher `mcp__github__.*`).
// Evoni's rulings on Issue #3650 (2026-10-30): she starts every production
// workflow; a session never starts, approves, re-runs or cancels a workflow
// run, never turns on auto-merge, and merges only after her explicit yes.
// A session's GitHub tool acts as her account, so GitHub itself cannot tell
// the two apart; this hook is defense in depth, not authorization.
// Decisions go to stdout as PreToolUse JSON:
//   deny: the call is refused, with the rule that refuses it;
//   ask:  Claude Code asks before the call runs (merges only);
//   no output: the normal permission flow applies.
// Anything it cannot read is denied (fail closed).

const DENY_WORKFLOW_RUNS = 'Workflow runs are Evoni\'s: a session never starts, re-runs, cancels or deletes the logs of a workflow run, CI or production (Issue #3650 rulings, 2026-10-30). Report what needs running and stop.';
const DENY_AUTO_MERGE = 'No auto-merge (CLAUDE.md, Rule 7). A PR is merged only after Evoni\'s explicit yes.';
const DENY_MAIN = 'No direct writes to main or dev. Work lands by PR + squash-merge; push to a claude/ branch instead.';
const DENY_OUTSIDE = 'Outside any task: creating or forking repositories, or handing work to another agent, needs Evoni\'s explicit decision.';
const ASK_MERGE = 'Rule 7: merge only after Evoni\'s explicit yes naming this merge. Approve only if she gave it.';

const PROTECTED = new Set(['main', 'dev']);
const refName = (b) => String(b || '').replace(/^refs\/heads\//, '').trim();

function decide(toolName, input) {
  const m = /^mcp__github__(.+)$/i.exec(String(toolName || ''));
  if (!m) return null;
  const tool = m[1].toLowerCase();
  switch (tool) {
    case 'actions_run_trigger':
    case 'run_workflow':
    case 'rerun_workflow_run':
    case 'rerun_failed_jobs':
    case 'cancel_workflow_run':
    case 'delete_workflow_run_logs':
      return ['deny', DENY_WORKFLOW_RUNS];
    case 'enable_pr_auto_merge':
      return ['deny', DENY_AUTO_MERGE];
    case 'merge_pull_request':
      return ['ask', ASK_MERGE];
    case 'create_or_update_file':
    case 'push_files':
    case 'delete_file': {
      // Without a branch these write to the default branch, which is main.
      const branch = refName(input.branch);
      return !branch || PROTECTED.has(branch) ? ['deny', DENY_MAIN] : null;
    }
    case 'create_branch':
      return PROTECTED.has(refName(input.branch)) ? ['deny', DENY_MAIN] : null;
    case 'create_repository':
    case 'fork_repository':
    case 'create_pull_request_with_copilot':
    case 'assign_copilot_to_issue':
      return ['deny', DENY_OUTSIDE];
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
    const result = decide(event.tool_name, event.tool_input || {});
    if (result) emit(result[0], result[1]);
    process.exit(0);
  });
}

module.exports = { decide };

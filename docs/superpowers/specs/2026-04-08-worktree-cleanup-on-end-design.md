# Worktree Cleanup on Session End

## Problem

Every Claude Code session creates a git worktree and branch. When sessions end, these are never cleaned up. Over time this causes massive branch/worktree sprawl (77 worktrees and 55+ GitHub branches observed). Most of these have no committed work — they're empty branches from sessions that ended before anything was committed.

## Solution

When the user clicks the End button on a session that uses a worktree, automatically clean up the worktree and branch if there are no uncommitted changes. If there are uncommitted changes, show a modal asking the user what to do.

## Trigger

- **Only** the End button in the session controls UI.
- Does **not** trigger on server restart, error states, or any other session-ending path.

## Flow

1. User clicks End button.
2. If the session does not use a worktree → end session normally (no change from today).
3. If the session uses a worktree → call `GET /api/sessions/:id/worktree-status`.
4. If no uncommitted changes → end session with `cleanup: true` (silent cleanup, no modal).
5. If uncommitted changes exist → show modal with three options:
   - **Commit & keep branch** → end with `commit: true, cleanup: true`. Auto-commits all changes with message "WIP: session work from [date]". Worktree directory is deleted (saves disk space) but branch is preserved for future use.
   - **Delete everything** → end with `cleanup: true`. Worktree and branch are deleted. Uncommitted changes are permanently lost.
   - **Leave as-is** → end with `cleanup: false, commit: false`. Today's behavior — worktree and branch remain untouched.

## Merge status

The merge status of the branch does not affect the flow. Even if the branch has been merged, uncommitted changes may exist from post-merge code review work. The modal always appears when uncommitted changes exist, regardless of merge status.

## Backend

### New endpoint: `GET /api/sessions/:id/worktree-status`

Returns the uncommitted change status of a session's worktree.

**Response:**
```json
{
  "hasUncommittedChanges": true,
  "worktreePath": "/path/to/.claude/worktrees/name"
}
```

**Implementation:**
- Look up the session's working directory from the database.
- Confirm it's a worktree path (contains `/.claude/worktrees/`).
- Run `git status --porcelain` in that directory.
- If output is non-empty → `hasUncommittedChanges: true`.
- If directory doesn't exist → `hasUncommittedChanges: false` (already cleaned up).

### Updated endpoint: `POST /api/sessions/:id/end`

Accepts two new optional body fields:

- `commit` (boolean, default false) — If true, stage and commit all changes in the worktree with an auto-generated WIP message before ending.
- `cleanup` (boolean, default false) — If true, delete the worktree directory and delete the branch (locally and from GitHub if it exists remotely).

**Commit behavior:**
1. `git add -A` in the worktree directory.
2. `git commit -m "WIP: session work from [YYYY-MM-DD]"` with the current date.

**Cleanup behavior:**
1. End the session process (existing behavior).
2. `git worktree remove --force <path>` to delete the worktree directory.
3. `git branch -D <branch-name>` to delete the local branch.
4. `git push origin --delete <branch-name>` to delete the remote branch (ignore errors if remote doesn't exist).

**Order of operations when both `commit` and `cleanup` are true (the "Commit & keep branch" option):**
1. Stage and commit all changes.
2. Delete the worktree directory (saves disk space).
3. Keep the branch (do NOT delete it locally or remotely) — the committed work lives on the branch for future use.

When `cleanup: true` without `commit: true` (the "Delete everything" option):
1. Delete the worktree directory.
2. Delete the branch locally and remotely.

**Error handling:** If cleanup fails (git lock, permission issue, directory already gone), the session still ends normally. Cleanup failures are logged but do not block session termination.

## Frontend

### SessionControls changes

The End button handler changes from a direct API call to a multi-step flow:

1. Check if session uses a worktree (available from session data).
2. If no worktree → call end API directly (no change).
3. If worktree → call worktree-status endpoint.
4. If no uncommitted changes → call end API with `cleanup: true`.
5. If uncommitted changes → show `WorktreeCleanupModal`.
6. Modal selection determines the end API call parameters.

### New component: WorktreeCleanupModal

A confirmation modal that appears when ending a session with uncommitted worktree changes.

**Content:**
- Header: "Uncommitted Changes"
- Body: "This session has uncommitted changes in the worktree. What would you like to do?"
- Three buttons:
  - "Commit & Keep Branch" (primary/blue) — commits changes, keeps branch
  - "Delete Everything" (danger/red) — deletes worktree and branch, loses changes
  - "Leave As-Is" (neutral/gray) — ends session without cleanup

**Behavior:**
- Modal blocks session end until user makes a choice.
- After selection, modal closes and the appropriate end API call is made.
- Navigation to dashboard happens after the end call completes (same as today).

## Conversation history

Conversation history is stored in the database, completely independent of the worktree. Deleting a worktree does not affect message history. Sessions can still be resumed after worktree cleanup — the resume logic already falls back to the main project directory when a worktree is missing.

## Testing

### Unit tests
- Worktree status check: returns correct status for clean worktree, dirty worktree, missing worktree.
- End session with cleanup: verifies worktree and branch deletion.
- End session with commit: verifies auto-commit is created.
- End session with neither: verifies no cleanup happens (today's behavior).

### Integration tests
- Modal appears when ending a session with uncommitted changes.
- Modal does not appear when ending a session with no uncommitted changes.
- Each modal option triggers the correct API call.
- Session ends successfully regardless of cleanup outcome.

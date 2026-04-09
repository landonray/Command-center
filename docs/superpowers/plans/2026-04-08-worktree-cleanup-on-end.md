# Worktree Cleanup on Session End — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When users click End on a worktree session, automatically clean up empty worktrees or show a modal for uncommitted changes.

**Architecture:** Frontend-driven approach. The End button checks worktree status via a new API endpoint, then either silently cleans up (no changes) or shows a modal (uncommitted changes). The backend handles git operations (commit, worktree removal, branch deletion) based on parameters passed from the frontend.

**Tech Stack:** React (frontend), Express (backend), Vitest (tests), CSS Modules (styling), child_process.execSync (git operations)

**Spec:** `docs/superpowers/specs/2026-04-08-worktree-cleanup-on-end-design.md`

---

### Task 1: Backend — Worktree status endpoint

**Files:**
- Modify: `server/routes/sessions.js:264` (add new route before the end route)
- Test: `server/__tests__/worktreeCleanup.test.js`

- [ ] **Step 1: Write failing tests for worktree-status endpoint**

Create `server/__tests__/worktreeCleanup.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';

vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process');
  return { ...actual, execSync: vi.fn() };
});

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return { ...actual, existsSync: vi.fn() };
});

describe('getWorktreeStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns hasUncommittedChanges: true when git status has output', () => {
    fs.existsSync.mockReturnValue(true);
    execSync.mockReturnValue(' M src/file.js\n?? newfile.txt\n');

    const { getWorktreeStatus } = require('../services/worktreeCleanup');
    const result = getWorktreeStatus('/path/to/.claude/worktrees/test-wt');

    expect(result).toEqual({
      hasUncommittedChanges: true,
      worktreePath: '/path/to/.claude/worktrees/test-wt',
    });
    expect(execSync).toHaveBeenCalledWith('git status --porcelain', {
      cwd: '/path/to/.claude/worktrees/test-wt',
      encoding: 'utf-8',
      timeout: 5000,
    });
  });

  it('returns hasUncommittedChanges: false when git status is clean', () => {
    fs.existsSync.mockReturnValue(true);
    execSync.mockReturnValue('');

    const { getWorktreeStatus } = require('../services/worktreeCleanup');
    const result = getWorktreeStatus('/path/to/.claude/worktrees/test-wt');

    expect(result).toEqual({
      hasUncommittedChanges: false,
      worktreePath: '/path/to/.claude/worktrees/test-wt',
    });
  });

  it('returns hasUncommittedChanges: false when directory does not exist', () => {
    fs.existsSync.mockReturnValue(false);

    const { getWorktreeStatus } = require('../services/worktreeCleanup');
    const result = getWorktreeStatus('/path/to/.claude/worktrees/gone');

    expect(result).toEqual({
      hasUncommittedChanges: false,
      worktreePath: '/path/to/.claude/worktrees/gone',
    });
    expect(execSync).not.toHaveBeenCalled();
  });

  it('returns hasUncommittedChanges: false when git status throws', () => {
    fs.existsSync.mockReturnValue(true);
    execSync.mockImplementation(() => { throw new Error('not a git repo'); });

    const { getWorktreeStatus } = require('../services/worktreeCleanup');
    const result = getWorktreeStatus('/path/to/.claude/worktrees/broken');

    expect(result).toEqual({
      hasUncommittedChanges: false,
      worktreePath: '/path/to/.claude/worktrees/broken',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/landonray/Coding\ Projects/Command\ Center/.claude/worktrees/starry-inventing-rossum && npx vitest run server/__tests__/worktreeCleanup.test.js`
Expected: FAIL — module `../services/worktreeCleanup` not found.

- [ ] **Step 3: Implement getWorktreeStatus**

Create `server/services/worktreeCleanup.js`:

```javascript
const { execSync } = require('child_process');
const fs = require('fs');

/**
 * Check if a worktree directory has uncommitted changes.
 */
function getWorktreeStatus(worktreePath) {
  const result = {
    hasUncommittedChanges: false,
    worktreePath,
  };

  if (!worktreePath || !fs.existsSync(worktreePath)) {
    return result;
  }

  try {
    const output = execSync('git status --porcelain', {
      cwd: worktreePath,
      encoding: 'utf-8',
      timeout: 5000,
    });
    result.hasUncommittedChanges = output.trim().length > 0;
  } catch (e) {
    // If git fails, treat as no changes (safe default — will just end normally)
  }

  return result;
}

module.exports = { getWorktreeStatus };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/landonray/Coding\ Projects/Command\ Center/.claude/worktrees/starry-inventing-rossum && npx vitest run server/__tests__/worktreeCleanup.test.js`
Expected: 4 tests PASS.

- [ ] **Step 5: Add the route to sessions.js**

In `server/routes/sessions.js`, add this import at line 7 (after the fileWatcher import):

```javascript
const { getWorktreeStatus } = require('../services/worktreeCleanup');
```

Add this route before the `/:id/end` route (before line 264):

```javascript
// Check worktree status for uncommitted changes
router.get('/:id/worktree-status', async (req, res) => {
  try {
    const result = await query('SELECT working_directory, use_worktree FROM sessions WHERE id = $1', [req.params.id]);
    const session = result.rows[0];
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (!session.use_worktree || !session.working_directory) {
      return res.json({ hasUncommittedChanges: false, worktreePath: null });
    }
    const status = getWorktreeStatus(session.working_directory);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 6: Run all tests**

Run: `cd /Users/landonray/Coding\ Projects/Command\ Center/.claude/worktrees/starry-inventing-rossum && npx vitest run`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add server/services/worktreeCleanup.js server/__tests__/worktreeCleanup.test.js server/routes/sessions.js
git commit -m "feat: add worktree-status endpoint for checking uncommitted changes"
```

---

### Task 2: Backend — Worktree cleanup logic

**Files:**
- Modify: `server/services/worktreeCleanup.js` (add cleanup and commit functions)
- Test: `server/__tests__/worktreeCleanup.test.js` (add tests)

- [ ] **Step 1: Write failing tests for cleanupWorktree and commitWorktreeChanges**

Append to `server/__tests__/worktreeCleanup.test.js`:

```javascript
describe('commitWorktreeChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stages all files and commits with WIP message', () => {
    fs.existsSync.mockReturnValue(true);
    execSync.mockReturnValue('');

    const { commitWorktreeChanges } = require('../services/worktreeCleanup');
    commitWorktreeChanges('/path/to/.claude/worktrees/test-wt');

    expect(execSync).toHaveBeenCalledWith('git add -A', expect.objectContaining({
      cwd: '/path/to/.claude/worktrees/test-wt',
    }));
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('git commit -m "WIP: session work from'),
      expect.objectContaining({ cwd: '/path/to/.claude/worktrees/test-wt' }),
    );
  });

  it('does nothing if directory does not exist', () => {
    fs.existsSync.mockReturnValue(false);

    const { commitWorktreeChanges } = require('../services/worktreeCleanup');
    commitWorktreeChanges('/path/gone');

    expect(execSync).not.toHaveBeenCalled();
  });
});

describe('cleanupWorktree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes worktree and deletes branch locally and remotely when deleteBranch is true', () => {
    execSync.mockReturnValue('');

    const { cleanupWorktree } = require('../services/worktreeCleanup');
    cleanupWorktree('/project/.claude/worktrees/test-wt', 'worktree-test-wt', '/project', true);

    // Should remove worktree
    expect(execSync).toHaveBeenCalledWith(
      'git worktree remove --force /project/.claude/worktrees/test-wt',
      expect.objectContaining({ cwd: '/project' }),
    );
    // Should delete local branch
    expect(execSync).toHaveBeenCalledWith(
      'git branch -D worktree-test-wt',
      expect.objectContaining({ cwd: '/project' }),
    );
    // Should delete remote branch
    expect(execSync).toHaveBeenCalledWith(
      'git push origin --delete worktree-test-wt',
      expect.objectContaining({ cwd: '/project' }),
    );
  });

  it('removes worktree but keeps branch when deleteBranch is false', () => {
    execSync.mockReturnValue('');

    const { cleanupWorktree } = require('../services/worktreeCleanup');
    cleanupWorktree('/project/.claude/worktrees/test-wt', 'worktree-test-wt', '/project', false);

    // Should remove worktree
    expect(execSync).toHaveBeenCalledWith(
      'git worktree remove --force /project/.claude/worktrees/test-wt',
      expect.objectContaining({ cwd: '/project' }),
    );
    // Should NOT delete branch
    expect(execSync).not.toHaveBeenCalledWith(
      expect.stringContaining('git branch -D'),
      expect.anything(),
    );
    expect(execSync).not.toHaveBeenCalledWith(
      expect.stringContaining('git push origin --delete'),
      expect.anything(),
    );
  });

  it('does not throw if worktree remove fails', () => {
    execSync.mockImplementation(() => { throw new Error('already removed'); });

    const { cleanupWorktree } = require('../services/worktreeCleanup');
    expect(() => {
      cleanupWorktree('/project/.claude/worktrees/test-wt', 'worktree-test-wt', '/project', true);
    }).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `cd /Users/landonray/Coding\ Projects/Command\ Center/.claude/worktrees/starry-inventing-rossum && npx vitest run server/__tests__/worktreeCleanup.test.js`
Expected: New tests FAIL — `commitWorktreeChanges` and `cleanupWorktree` not found.

- [ ] **Step 3: Implement commitWorktreeChanges and cleanupWorktree**

Add to `server/services/worktreeCleanup.js`:

```javascript
/**
 * Auto-commit all changes in a worktree with a WIP message.
 */
function commitWorktreeChanges(worktreePath) {
  if (!worktreePath || !fs.existsSync(worktreePath)) {
    return;
  }

  const opts = { cwd: worktreePath, encoding: 'utf-8', timeout: 10000 };
  const date = new Date().toISOString().split('T')[0];

  try {
    execSync('git add -A', opts);
    execSync(`git commit -m "WIP: session work from ${date}"`, opts);
  } catch (e) {
    console.error(`[worktreeCleanup] Failed to commit in ${worktreePath}:`, e.message);
  }
}

/**
 * Remove a worktree directory and optionally delete its branch.
 * Errors are logged but never thrown — cleanup must not block session ending.
 */
function cleanupWorktree(worktreePath, branchName, projectRoot, deleteBranch) {
  const opts = { cwd: projectRoot, encoding: 'utf-8', timeout: 10000, stdio: 'ignore' };

  // Remove worktree directory
  try {
    execSync(`git worktree remove --force ${worktreePath}`, opts);
  } catch (e) {
    console.error(`[worktreeCleanup] Failed to remove worktree ${worktreePath}:`, e.message);
  }

  if (!deleteBranch) return;

  // Delete local branch
  try {
    execSync(`git branch -D ${branchName}`, opts);
  } catch (e) {
    console.error(`[worktreeCleanup] Failed to delete local branch ${branchName}:`, e.message);
  }

  // Delete remote branch (ignore errors — may not exist remotely)
  try {
    execSync(`git push origin --delete ${branchName}`, opts);
  } catch (e) {
    // Expected to fail if branch was never pushed — not an error
  }
}

module.exports = { getWorktreeStatus, commitWorktreeChanges, cleanupWorktree };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/landonray/Coding\ Projects/Command\ Center/.claude/worktrees/starry-inventing-rossum && npx vitest run server/__tests__/worktreeCleanup.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/worktreeCleanup.js server/__tests__/worktreeCleanup.test.js
git commit -m "feat: add worktree commit and cleanup functions"
```

---

### Task 3: Backend — Update end session route to accept commit/cleanup params

**Files:**
- Modify: `server/routes/sessions.js:264-272` (update end route)
- Modify: `server/services/sessionManager.js` (export needed data)
- Test: `server/__tests__/worktreeCleanup.test.js` (add integration-style tests)

- [ ] **Step 1: Write failing tests for end-with-cleanup behavior**

Append to `server/__tests__/worktreeCleanup.test.js`:

```javascript
describe('handleEndWithCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls commitWorktreeChanges then cleanupWorktree with deleteBranch=false when commit=true, cleanup=true', () => {
    fs.existsSync.mockReturnValue(true);
    execSync.mockReturnValue('');

    const { commitWorktreeChanges, cleanupWorktree } = require('../services/worktreeCleanup');

    // Simulate "Commit & keep branch" flow
    commitWorktreeChanges('/project/.claude/worktrees/wt');
    cleanupWorktree('/project/.claude/worktrees/wt', 'worktree-wt', '/project', false);

    // commit should have run git add + git commit
    expect(execSync).toHaveBeenCalledWith('git add -A', expect.anything());
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git commit -m'), expect.anything());
    // cleanup should remove worktree but NOT delete branch
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git worktree remove'), expect.anything());
    expect(execSync).not.toHaveBeenCalledWith(expect.stringContaining('git branch -D'), expect.anything());
  });

  it('calls cleanupWorktree with deleteBranch=true when cleanup=true without commit', () => {
    execSync.mockReturnValue('');

    const { cleanupWorktree } = require('../services/worktreeCleanup');

    // Simulate "Delete everything" flow
    cleanupWorktree('/project/.claude/worktrees/wt', 'worktree-wt', '/project', true);

    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git worktree remove'), expect.anything());
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git branch -D'), expect.anything());
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git push origin --delete'), expect.anything());
  });
});
```

- [ ] **Step 2: Run tests to verify they pass** (these test the existing functions in a new combination)

Run: `cd /Users/landonray/Coding\ Projects/Command\ Center/.claude/worktrees/starry-inventing-rossum && npx vitest run server/__tests__/worktreeCleanup.test.js`
Expected: PASS (these call already-implemented functions).

- [ ] **Step 3: Update the end session route in sessions.js**

Replace the existing end route at `server/routes/sessions.js:264-272` with:

```javascript
// End session (with optional worktree commit/cleanup)
router.post('/:id/end', async (req, res) => {
  try {
    const { commit, cleanup } = req.body || {};
    const sessionId = req.params.id;

    // If commit or cleanup requested, look up session details for worktree info
    if (commit || cleanup) {
      const result = await query('SELECT working_directory, use_worktree FROM sessions WHERE id = $1', [sessionId]);
      const session = result.rows[0];

      if (session && session.use_worktree && session.working_directory) {
        const worktreePath = session.working_directory;
        const { commitWorktreeChanges, cleanupWorktree } = require('../services/worktreeCleanup');

        // Extract project root and branch name from worktree path
        const wtMatch = worktreePath.match(/^(.+?)\/\.claude\/worktrees\/(.+)$/);
        const projectRoot = wtMatch ? wtMatch[1] : null;
        const worktreeName = wtMatch ? wtMatch[2] : null;

        // Look up branch name from git
        let branchName = null;
        if (projectRoot) {
          try {
            branchName = execSync('git branch --show-current', {
              cwd: worktreePath,
              encoding: 'utf-8',
              timeout: 5000,
            }).trim();
          } catch (e) {
            // Worktree may already be gone
          }
        }

        // Step 1: Commit if requested
        if (commit) {
          commitWorktreeChanges(worktreePath);
        }

        // Step 2: Cleanup worktree
        if (cleanup && projectRoot) {
          // When commit=true, keep the branch (deleteBranch=false)
          // When commit=false, delete the branch too (deleteBranch=true)
          const deleteBranch = !commit;
          cleanupWorktree(worktreePath, branchName, projectRoot, deleteBranch);
        }
      }
    }

    await endSession(sessionId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4: Run all tests**

Run: `cd /Users/landonray/Coding\ Projects/Command\ Center/.claude/worktrees/starry-inventing-rossum && npx vitest run`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/sessions.js
git commit -m "feat: update end session route to support commit and cleanup params"
```

---

### Task 4: Frontend — WorktreeCleanupModal component

**Files:**
- Create: `client/src/components/Chat/WorktreeCleanupModal.jsx`
- Create: `client/src/components/Chat/WorktreeCleanupModal.module.css`

- [ ] **Step 1: Create the modal CSS module**

Create `client/src/components/Chat/WorktreeCleanupModal.module.css`:

```css
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(26, 21, 16, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
  backdrop-filter: blur(4px);
}

.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 440px;
  box-shadow: 0 16px 64px rgba(120, 90, 50, 0.2);
}

.header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
}

.header h3 {
  font-size: 16px;
  font-weight: 800;
  margin: 0;
}

.body {
  padding: 18px 22px;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 22px 22px;
}

.actionBtn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.actionBtn:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
}

.actionBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.commitBtn:hover {
  border-color: var(--accent);
}

.deleteBtn:hover {
  border-color: var(--danger, #e74c3c);
}

.leaveBtn:hover {
  border-color: var(--text-muted);
}

.actionDesc {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
  margin-top: 2px;
}
```

- [ ] **Step 2: Create the modal component**

Create `client/src/components/Chat/WorktreeCleanupModal.jsx`:

```jsx
import React, { useState } from 'react';
import { AlertTriangle, GitCommit, Trash2, MinusCircle } from 'lucide-react';
import styles from './WorktreeCleanupModal.module.css';

export default function WorktreeCleanupModal({ onChoice, onClose }) {
  const [loading, setLoading] = useState(null);

  const handleChoice = async (choice) => {
    setLoading(choice);
    try {
      await onChoice(choice);
    } catch (e) {
      setLoading(null);
    }
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <AlertTriangle size={18} style={{ color: 'var(--warning, #f39c12)' }} />
          <h3>Uncommitted Changes</h3>
        </div>
        <div className={styles.body}>
          This session has uncommitted changes in the worktree. What would you like to do?
        </div>
        <div className={styles.actions}>
          <button
            className={`${styles.actionBtn} ${styles.commitBtn}`}
            onClick={() => handleChoice('commit')}
            disabled={loading !== null}
          >
            <GitCommit size={16} />
            <div>
              Commit & Keep Branch
              <div className={styles.actionDesc}>Save changes to the branch for future work</div>
            </div>
          </button>

          <button
            className={`${styles.actionBtn} ${styles.deleteBtn}`}
            onClick={() => handleChoice('delete')}
            disabled={loading !== null}
          >
            <Trash2 size={16} />
            <div>
              Delete Everything
              <div className={styles.actionDesc}>Discard changes and remove the branch permanently</div>
            </div>
          </button>

          <button
            className={`${styles.actionBtn} ${styles.leaveBtn}`}
            onClick={() => handleChoice('leave')}
            disabled={loading !== null}
          >
            <MinusCircle size={16} />
            <div>
              Leave As-Is
              <div className={styles.actionDesc}>End session without cleaning up</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/Chat/WorktreeCleanupModal.jsx client/src/components/Chat/WorktreeCleanupModal.module.css
git commit -m "feat: add WorktreeCleanupModal component"
```

---

### Task 5: Frontend — Wire up End button to new flow

**Files:**
- Modify: `client/src/components/Chat/SessionControls.jsx`

- [ ] **Step 1: Update SessionControls to use the new modal flow**

Replace the current `handleEnd` function and add the modal integration in `client/src/components/Chat/SessionControls.jsx`:

Add import at top of file:

```javascript
import WorktreeCleanupModal from './WorktreeCleanupModal';
```

Replace the `handleEnd` function (lines 34-38) with:

```javascript
const [showCleanupModal, setShowCleanupModal] = useState(false);

const handleEnd = async () => {
  // If session uses a worktree, check for uncommitted changes first
  if (session?.use_worktree) {
    try {
      const status = await api.get(`/api/sessions/${sessionId}/worktree-status`);
      if (status.hasUncommittedChanges) {
        setShowCleanupModal(true);
        return;
      }
      // No uncommitted changes — silently clean up and end
      await api.post(`/api/sessions/${sessionId}/end`, { cleanup: true });
      loadSessions();
      navigate('/');
      return;
    } catch (e) {
      // If status check fails, just end normally
    }
  }

  // Non-worktree session or status check failed — end normally
  await api.post(`/api/sessions/${sessionId}/end`);
  loadSessions();
  navigate('/');
};

const handleCleanupChoice = async (choice) => {
  let body = {};
  if (choice === 'commit') {
    body = { commit: true, cleanup: true };
  } else if (choice === 'delete') {
    body = { cleanup: true };
  }
  // 'leave' sends empty body — today's behavior

  await api.post(`/api/sessions/${sessionId}/end`, body);
  setShowCleanupModal(false);
  loadSessions();
  navigate('/');
};
```

Add the modal render at the end of the component's return, just before the closing `</div>` of the controls:

```jsx
{showCleanupModal && (
  <WorktreeCleanupModal
    onChoice={handleCleanupChoice}
    onClose={() => setShowCleanupModal(false)}
  />
)}
```

- [ ] **Step 2: Run all tests**

Run: `cd /Users/landonray/Coding\ Projects/Command\ Center/.claude/worktrees/starry-inventing-rossum && npx vitest run`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/Chat/SessionControls.jsx
git commit -m "feat: wire End button to worktree cleanup flow with modal"
```

---

### Task 6: Manual smoke test and final verification

- [ ] **Step 1: Run all tests**

Run: `cd /Users/landonray/Coding\ Projects/Command\ Center/.claude/worktrees/starry-inventing-rossum && npx vitest run`
Expected: All tests PASS.

- [ ] **Step 2: Start the dev server and verify the modal flow works**

Start the server and test:
1. Create a new session with worktree enabled
2. Make a change to a file in the worktree (so there are uncommitted changes)
3. Click End — verify the modal appears with three options
4. Test each option works as expected
5. Create another session, don't make changes, click End — verify it cleans up silently with no modal

- [ ] **Step 3: Verify cleanup actually works**

After ending a session with cleanup:
- Run `git worktree list` — verify the worktree is gone
- Run `git branch` — verify the branch is gone (for delete option) or kept (for commit option)

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```

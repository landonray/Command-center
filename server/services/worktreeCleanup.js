import { execSync } from 'child_process';
import fs from 'fs';

/**
 * Check if a worktree directory has uncommitted changes.
 */
export function getWorktreeStatus(worktreePath) {
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

/**
 * Auto-commit all changes in a worktree with a WIP message.
 */
export function commitWorktreeChanges(worktreePath) {
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
export function cleanupWorktree(worktreePath, branchName, projectRoot, deleteBranch) {
  const opts = { cwd: projectRoot, encoding: 'utf-8', timeout: 10000, stdio: 'ignore' };

  try {
    execSync(`git worktree remove --force ${worktreePath}`, opts);
  } catch (e) {
    console.error(`[worktreeCleanup] Failed to remove worktree ${worktreePath}:`, e.message);
  }

  if (!deleteBranch) return;

  try {
    execSync(`git branch -D ${branchName}`, opts);
  } catch (e) {
    console.error(`[worktreeCleanup] Failed to delete local branch ${branchName}:`, e.message);
  }

  try {
    execSync(`git push origin --delete ${branchName}`, opts);
  } catch (e) {
    // Expected to fail if branch was never pushed
  }
}

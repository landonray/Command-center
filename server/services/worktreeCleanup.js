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

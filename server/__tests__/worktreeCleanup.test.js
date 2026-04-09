import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecSync = vi.fn();
const mockExistsSync = vi.fn();

vi.mock('child_process', () => ({ execSync: mockExecSync }));
vi.mock('fs', () => ({ existsSync: mockExistsSync, default: { existsSync: mockExistsSync } }));

describe('getWorktreeStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns hasUncommittedChanges: true when git status has output', async () => {
    mockExistsSync.mockReturnValue(true);
    mockExecSync.mockReturnValue(' M src/file.js\n?? newfile.txt\n');

    const { getWorktreeStatus } = await import('../services/worktreeCleanup.js');
    const result = getWorktreeStatus('/path/to/.claude/worktrees/test-wt');

    expect(result).toEqual({
      hasUncommittedChanges: true,
      worktreePath: '/path/to/.claude/worktrees/test-wt',
    });
    expect(mockExecSync).toHaveBeenCalledWith('git status --porcelain', {
      cwd: '/path/to/.claude/worktrees/test-wt',
      encoding: 'utf-8',
      timeout: 5000,
    });
  });

  it('returns hasUncommittedChanges: false when git status is clean', async () => {
    mockExistsSync.mockReturnValue(true);
    mockExecSync.mockReturnValue('');

    const { getWorktreeStatus } = await import('../services/worktreeCleanup.js');
    const result = getWorktreeStatus('/path/to/.claude/worktrees/test-wt');

    expect(result).toEqual({
      hasUncommittedChanges: false,
      worktreePath: '/path/to/.claude/worktrees/test-wt',
    });
  });

  it('returns hasUncommittedChanges: false when directory does not exist', async () => {
    mockExistsSync.mockReturnValue(false);

    const { getWorktreeStatus } = await import('../services/worktreeCleanup.js');
    const result = getWorktreeStatus('/path/to/.claude/worktrees/gone');

    expect(result).toEqual({
      hasUncommittedChanges: false,
      worktreePath: '/path/to/.claude/worktrees/gone',
    });
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('returns hasUncommittedChanges: false when git status throws', async () => {
    mockExistsSync.mockReturnValue(true);
    mockExecSync.mockImplementation(() => { throw new Error('not a git repo'); });

    const { getWorktreeStatus } = await import('../services/worktreeCleanup.js');
    const result = getWorktreeStatus('/path/to/.claude/worktrees/broken');

    expect(result).toEqual({
      hasUncommittedChanges: false,
      worktreePath: '/path/to/.claude/worktrees/broken',
    });
  });
});

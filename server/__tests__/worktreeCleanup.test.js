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

describe('commitWorktreeChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('stages all files and commits with WIP message', async () => {
    mockExistsSync.mockReturnValue(true);
    mockExecSync.mockReturnValue('');

    const { commitWorktreeChanges } = await import('../services/worktreeCleanup.js');
    commitWorktreeChanges('/path/to/.claude/worktrees/test-wt');

    expect(mockExecSync).toHaveBeenCalledWith('git add -A', expect.objectContaining({
      cwd: '/path/to/.claude/worktrees/test-wt',
    }));
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('git commit -m "WIP: session work from'),
      expect.objectContaining({ cwd: '/path/to/.claude/worktrees/test-wt' }),
    );
  });

  it('does nothing if directory does not exist', async () => {
    mockExistsSync.mockReturnValue(false);

    const { commitWorktreeChanges } = await import('../services/worktreeCleanup.js');
    commitWorktreeChanges('/path/gone');

    expect(mockExecSync).not.toHaveBeenCalled();
  });
});

describe('cleanupWorktree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('removes worktree and deletes branch locally and remotely when deleteBranch is true', async () => {
    mockExecSync.mockReturnValue('');

    const { cleanupWorktree } = await import('../services/worktreeCleanup.js');
    cleanupWorktree('/project/.claude/worktrees/test-wt', 'worktree-test-wt', '/project', true);

    expect(mockExecSync).toHaveBeenCalledWith(
      'git worktree remove --force /project/.claude/worktrees/test-wt',
      expect.objectContaining({ cwd: '/project' }),
    );
    expect(mockExecSync).toHaveBeenCalledWith(
      'git branch -D worktree-test-wt',
      expect.objectContaining({ cwd: '/project' }),
    );
    expect(mockExecSync).toHaveBeenCalledWith(
      'git push origin --delete worktree-test-wt',
      expect.objectContaining({ cwd: '/project' }),
    );
  });

  it('removes worktree but keeps branch when deleteBranch is false', async () => {
    mockExecSync.mockReturnValue('');

    const { cleanupWorktree } = await import('../services/worktreeCleanup.js');
    cleanupWorktree('/project/.claude/worktrees/test-wt', 'worktree-test-wt', '/project', false);

    expect(mockExecSync).toHaveBeenCalledWith(
      'git worktree remove --force /project/.claude/worktrees/test-wt',
      expect.objectContaining({ cwd: '/project' }),
    );
    expect(mockExecSync).not.toHaveBeenCalledWith(
      expect.stringContaining('git branch -D'),
      expect.anything(),
    );
    expect(mockExecSync).not.toHaveBeenCalledWith(
      expect.stringContaining('git push origin --delete'),
      expect.anything(),
    );
  });

  it('does not throw if worktree remove fails', async () => {
    mockExecSync.mockImplementation(() => { throw new Error('already removed'); });

    const { cleanupWorktree } = await import('../services/worktreeCleanup.js');
    expect(() => {
      cleanupWorktree('/project/.claude/worktrees/test-wt', 'worktree-test-wt', '/project', true);
    }).not.toThrow();
  });
});

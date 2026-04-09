import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();

function extractWorktreeName(cwd) {
  const match = cwd.match(/\/\.claude\/worktrees\/([^/]+)/);
  return match ? match[1] : null;
}

async function handleInitEvent(session, event, queryFn) {
  if (event.type !== 'system' || event.subtype !== 'init' || !event.session_id) return;

  session.cliSessionId = event.session_id;

  if (event.cwd && event.cwd !== session.workingDirectory) {
    session.workingDirectory = event.cwd;
    session.worktreeReady = true;

    const worktreeName = extractWorktreeName(event.cwd);
    if (worktreeName) {
      await queryFn(
        'UPDATE sessions SET working_directory = $1, worktree_name = $2 WHERE id = $3',
        [event.cwd, worktreeName, session.id]
      );
    } else {
      await queryFn(
        'UPDATE sessions SET working_directory = $1 WHERE id = $2',
        [event.cwd, session.id]
      );
    }
  }
}

describe('extractWorktreeName', () => {
  it('extracts name from a worktree path', () => {
    expect(extractWorktreeName('/Users/me/project/.claude/worktrees/cuddly-painting-whistle'))
      .toBe('cuddly-painting-whistle');
  });

  it('returns null for a non-worktree path', () => {
    expect(extractWorktreeName('/Users/me/project')).toBeNull();
  });

  it('extracts name even with nested subdirectories after worktree name', () => {
    expect(extractWorktreeName('/Users/me/project/.claude/worktrees/my-wt/subdir'))
      .toBe('my-wt');
  });
});

describe('handleInitEvent - worktree_name saving', () => {
  let session;

  beforeEach(() => {
    vi.clearAllMocks();
    session = {
      id: 'test-session-id',
      workingDirectory: '/Users/me/project',
      cliSessionId: null,
      worktreeReady: false,
    };
    mockQuery.mockResolvedValue({ rowCount: 1 });
  });

  it('saves both working_directory and worktree_name for worktree paths', async () => {
    await handleInitEvent(session, {
      type: 'system',
      subtype: 'init',
      session_id: 'cli-123',
      cwd: '/Users/me/project/.claude/worktrees/cuddly-painting-whistle',
    }, mockQuery);

    expect(session.workingDirectory).toBe('/Users/me/project/.claude/worktrees/cuddly-painting-whistle');
    expect(session.worktreeReady).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE sessions SET working_directory = $1, worktree_name = $2 WHERE id = $3',
      ['/Users/me/project/.claude/worktrees/cuddly-painting-whistle', 'cuddly-painting-whistle', 'test-session-id']
    );
  });

  it('saves only working_directory for non-worktree paths', async () => {
    await handleInitEvent(session, {
      type: 'system',
      subtype: 'init',
      session_id: 'cli-123',
      cwd: '/Users/me/other-project',
    }, mockQuery);

    expect(session.workingDirectory).toBe('/Users/me/other-project');
    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE sessions SET working_directory = $1 WHERE id = $2',
      ['/Users/me/other-project', 'test-session-id']
    );
  });

  it('does not update if cwd matches current workingDirectory', async () => {
    session.workingDirectory = '/Users/me/project';
    await handleInitEvent(session, {
      type: 'system',
      subtype: 'init',
      session_id: 'cli-123',
      cwd: '/Users/me/project',
    }, mockQuery);

    expect(mockQuery).not.toHaveBeenCalled();
  });
});

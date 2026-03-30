# Mission Control

Web-based dashboard for monitoring and interacting with Claude Code sessions running on a Mac Studio. Provides reliable remote access from any device via Tailscale.

## Quick Start

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Build the frontend
npm run build

# Start the server
npm start
```

The server starts on `http://0.0.0.0:3000` (configurable via `PORT` env var).

## Development

```bash
# Run server and client dev server concurrently
npm run dev
```

- Backend: `http://localhost:3000`
- Frontend dev server: `http://localhost:5173` (proxies API to backend)

## Architecture

- **Backend:** Node.js / Express on port 3000
- **Frontend:** React (Vite)
- **Database:** SQLite (local, stored as `mission-control.db`)
- **Real-time:** WebSocket for session streaming and file change notifications
- **Sessions:** Claude Code CLI processes managed by backend
- **Network:** Tailscale-only (no public internet, no auth layer needed)

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |

### MCP Servers

MCP server configurations are managed in Settings > MCP Servers. Servers flagged for auto-connect will be attached to every new session via `--mcp-config`.

### Quality Rules

Phase 5 Quality Rules Engine is configured in Settings > Quality Rules. Toggle rules on/off, customize prompts, and install hooks to `~/.claude/settings.json` with one click.

## Project Structure

```
├── server/
│   ├── index.js              # Express server entry point
│   ├── database.js           # SQLite schema + seed data
│   ├── websocket.js          # WebSocket server
│   ├── routes/
│   │   ├── sessions.js       # Session CRUD + messaging
│   │   ├── files.js          # File tree, content, git ops
│   │   ├── notifications.js  # Push notification management
│   │   ├── mcp.js            # MCP server configs
│   │   ├── history.js        # Session history + digests
│   │   └── quality.js        # Quality rules + results
│   └── services/
│       ├── sessionManager.js  # Claude Code CLI process manager
│       ├── fileWatcher.js     # Filesystem watcher + git integration
│       ├── notificationService.js  # Web Push API
│       └── hooksGenerator.js  # Quality hooks config generator
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/     # Session cards + new session modal
│   │   │   ├── Chat/          # Chat interface + controls
│   │   │   ├── FileBrowser/   # File tree, preview, diffs
│   │   │   ├── Quality/       # Rules config, scorecard, analytics
│   │   │   ├── Layout/        # Desktop 3-panel + mobile tabs
│   │   │   ├── Settings/      # Settings page
│   │   │   ├── Notifications/ # Push notification settings
│   │   │   ├── History/       # Session history + digests
│   │   │   └── MCP/           # MCP server management
│   │   ├── context/           # React context (AppContext)
│   │   ├── hooks/             # useWebSocket, useMediaQuery
│   │   └── utils/             # API client, formatters
│   └── public/                # PWA manifest, service worker, icons
└── package.json
```

## Requirements

- **Node.js 18+**

- **Claude Code CLI** — required to run Claude Code sessions

  ```bash
  npm install -g @anthropic-ai/claude-code
  ```

  Authenticate on first run:
  ```bash
  claude
  ```

- **GitHub CLI (`gh`)** — required for the "Create New Project" feature (not needed for other features)

  ```bash
  # macOS
  brew install gh
  ```

  Authenticate:
  ```bash
  gh auth login
  ```

- **Tailscale** — for remote access from other devices (optional for local use)

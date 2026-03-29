const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'mission-control.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      working_directory TEXT,
      branch TEXT,
      context_window_usage REAL DEFAULT 0,
      user_message_count INTEGER DEFAULT 0,
      assistant_message_count INTEGER DEFAULT 0,
      tool_call_count INTEGER DEFAULT 0,
      last_action_summary TEXT,
      last_activity_at TEXT,
      preset_id TEXT,
      permission_mode TEXT DEFAULT 'default',
      auto_accept INTEGER DEFAULT 0,
      plan_mode INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      ended_at TEXT,
      FOREIGN KEY (preset_id) REFERENCES presets(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT,
      tool_results TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS session_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      key_actions TEXT,
      files_modified TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      working_directory TEXT NOT NULL,
      mcp_connections TEXT,
      claude_md_path TEXT,
      permission_mode TEXT DEFAULT 'default',
      initial_prompt TEXT,
      icon TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      command TEXT NOT NULL,
      args TEXT,
      env TEXT,
      auto_connect INTEGER DEFAULT 0,
      status TEXT DEFAULT 'disconnected',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      keys_p256dh TEXT NOT NULL,
      keys_auth TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      waiting_for_input INTEGER DEFAULT 1,
      task_complete INTEGER DEFAULT 1,
      error_events INTEGER DEFAULT 1,
      context_window_warning INTEGER DEFAULT 1,
      context_threshold REAL DEFAULT 0.8,
      daily_digest INTEGER DEFAULT 0
    );

    INSERT OR IGNORE INTO notification_settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS daily_digests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      session_count INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  seedDefaultPresets();
}

function seedDefaultPresets() {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO presets (id, name, description, working_directory, mcp_connections, permission_mode, initial_prompt, icon)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const presets = [
    {
      id: 'pages-agent',
      name: 'Pages-Agent',
      description: 'Pages-Agent repo with Ontraport MCP',
      working_directory: '~/projects/pages-agent',
      mcp_connections: JSON.stringify(['ontraport-mcp']),
      permission_mode: 'default',
      initial_prompt: '',
      icon: 'globe'
    },
    {
      id: 'attestime',
      name: 'AttesTime',
      description: 'AttesTime project directory',
      working_directory: '~/projects/attestime',
      mcp_connections: null,
      permission_mode: 'default',
      initial_prompt: '',
      icon: 'clock'
    },
    {
      id: 'autopilot',
      name: 'Autopilot',
      description: 'Autopilot project with Ontraport MCP',
      working_directory: '~/projects/autopilot',
      mcp_connections: JSON.stringify(['ontraport-mcp']),
      permission_mode: 'default',
      initial_prompt: '',
      icon: 'plane'
    },
    {
      id: 'mcp-server',
      name: 'MCP Server',
      description: 'Ontraport MCP server repo',
      working_directory: '~/projects/ontraport-mcp',
      mcp_connections: null,
      permission_mode: 'default',
      initial_prompt: '',
      icon: 'server'
    }
  ];

  for (const p of presets) {
    insert.run(p.id, p.name, p.description, p.working_directory, p.mcp_connections, p.permission_mode, p.initial_prompt, p.icon);
  }
}

module.exports = { getDb };

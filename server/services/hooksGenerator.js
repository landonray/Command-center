const fs = require('fs');
const path = require('path');
const os = require('os');
const { getDb } = require('../database');

const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const SCRIPTS_DIR = path.join(os.homedir(), '.claude', 'mission-control-hooks');
const CALLBACK_URL = 'http://localhost:3000/api/quality/results';

/**
 * Generates Claude Code hooks configuration from active quality rules
 * and writes it to ~/.claude/settings.json (merging with existing config).
 */
function generateHooksConfig() {
  const db = getDb();
  const rules = db.prepare('SELECT * FROM quality_rules WHERE enabled = 1 ORDER BY sort_order').all();

  // Build hooks arrays by lifecycle event
  const hooks = {
    PreToolUse: [],
    PostToolUse: [],
    Stop: []
  };

  // Ensure scripts directory exists
  if (!fs.existsSync(SCRIPTS_DIR)) {
    fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  }

  for (const rule of rules) {
    const hookEntries = buildHookEntries(rule);
    for (const entry of hookEntries) {
      if (hooks[entry.event]) {
        hooks[entry.event].push(entry.hook);
      }
    }
  }

  // Read existing settings
  let settings = {};
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const content = fs.readFileSync(SETTINGS_PATH, 'utf-8');
      settings = JSON.parse(content);
    }
  } catch (e) {
    settings = {};
  }

  // Merge hooks - preserve non-mission-control hooks
  if (!settings.hooks) settings.hooks = {};

  for (const event of ['PreToolUse', 'PostToolUse', 'Stop']) {
    const existing = settings.hooks[event] || [];
    // Remove old mission-control hooks (identified by tag)
    const preserved = existing.filter(h => !h._missionControl);
    // Add new mission-control hooks
    settings.hooks[event] = [...preserved, ...hooks[event]];
  }

  // Ensure directory exists
  const settingsDir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  // Write settings
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');

  return { success: true, ruleCount: rules.length, hooks: settings.hooks };
}

/**
 * Build hook entries for a single rule
 */
function buildHookEntries(rule) {
  const entries = [];
  const firesOn = rule.fires_on.split(',').map(s => s.trim());

  const config = rule.config ? JSON.parse(rule.config) : {};

  for (const trigger of firesOn) {
    const [event, toolFilter] = trigger.split(':');
    if (!['PreToolUse', 'PostToolUse', 'Stop'].includes(event)) continue;

    const hook = {
      _missionControl: true,
      _ruleId: rule.id,
      _ruleName: rule.name
    };

    // Add tool matcher for Pre/PostToolUse
    if (toolFilter && event !== 'Stop') {
      hook.matcher = toolFilter;
    }

    switch (rule.hook_type) {
      case 'command': {
        // Write script to file and reference it
        const scriptPath = path.join(SCRIPTS_DIR, `${rule.id}.sh`);
        if (rule.script) {
          fs.writeFileSync(scriptPath, rule.script, { mode: 0o755 });
        }
        // Wrapper script that runs the check and reports result via HTTP callback
        const wrapperPath = path.join(SCRIPTS_DIR, `${rule.id}-wrapper.sh`);
        const wrapperScript = `#!/bin/bash
OUTPUT=$(bash "${scriptPath}" 2>&1)
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
  RESULT="pass"
else
  RESULT="fail"
fi
DETAILS=$(echo "$OUTPUT" | head -c 500 | sed 's/"/\\\\"/g' | tr '\\n' ' ')
curl -s -X POST ${CALLBACK_URL} \\
  -H "Content-Type: application/json" \\
  -d "{\\"rule_id\\":\\"${rule.id}\\",\\"rule_name\\":\\"${rule.name}\\",\\"result\\":\\"$RESULT\\",\\"severity\\":\\"${rule.severity}\\",\\"details\\":\\"$DETAILS\\"}" > /dev/null 2>&1
exit $EXIT_CODE
`;
        fs.writeFileSync(wrapperPath, wrapperScript, { mode: 0o755 });
        hook.type = 'command';
        hook.command = `bash "${wrapperPath}"`;
        break;
      }

      case 'prompt': {
        hook.type = 'prompt';
        hook.prompt = buildPromptWithCallback(rule);
        break;
      }

      case 'agent': {
        hook.type = 'prompt';
        hook.prompt = buildAgentPromptWithCallback(rule);
        if (config.tools) {
          hook.allowedTools = config.tools;
        }
        break;
      }
    }

    entries.push({ event, hook });
  }

  return entries;
}

/**
 * Build a prompt that includes callback instructions
 */
function buildPromptWithCallback(rule) {
  return `${rule.prompt}

IMPORTANT: After your evaluation, report the result by including one of these markers at the very end of your response:
QUALITY_RESULT:${rule.id}:${rule.severity}:PASS
or
QUALITY_RESULT:${rule.id}:${rule.severity}:FAIL:[brief reason]`;
}

/**
 * Build an agent prompt with tool access and callback
 */
function buildAgentPromptWithCallback(rule) {
  return `${rule.prompt}

You have access to Read, Glob, and Grep tools to inspect the codebase.

IMPORTANT: After your evaluation, report the result by including one of these markers at the very end of your response:
QUALITY_RESULT:${rule.id}:${rule.severity}:PASS
or
QUALITY_RESULT:${rule.id}:${rule.severity}:FAIL:[brief reason]`;
}

/**
 * Remove all mission-control hooks from settings
 */
function removeHooksConfig() {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return { success: true };

    const content = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    const settings = JSON.parse(content);

    if (settings.hooks) {
      for (const event of ['PreToolUse', 'PostToolUse', 'Stop']) {
        if (settings.hooks[event]) {
          settings.hooks[event] = settings.hooks[event].filter(h => !h._missionControl);
        }
      }
    }

    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Get current hooks status
 */
function getHooksStatus() {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      return { installed: false, ruleCount: 0 };
    }

    const content = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    const settings = JSON.parse(content);
    let mcHookCount = 0;

    if (settings.hooks) {
      for (const event of ['PreToolUse', 'PostToolUse', 'Stop']) {
        if (settings.hooks[event]) {
          mcHookCount += settings.hooks[event].filter(h => h._missionControl).length;
        }
      }
    }

    return { installed: mcHookCount > 0, ruleCount: mcHookCount };
  } catch (e) {
    return { installed: false, ruleCount: 0, error: e.message };
  }
}

module.exports = {
  generateHooksConfig,
  removeHooksConfig,
  getHooksStatus,
  SCRIPTS_DIR,
  CALLBACK_URL
};

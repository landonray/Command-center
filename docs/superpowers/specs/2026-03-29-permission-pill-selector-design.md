# Permission Mode Pill Selector

## Context

The session creation modal currently has three overlapping controls for permission mode: a dropdown with 4 options, an "Auto-accept mode" toggle, and a "Plan mode" toggle. The toggles override the dropdown value in the backend, making the UX confusing and redundant. Additionally, `SessionControls` (mid-session menu) has the same two toggles as separate menu items.

This change consolidates everything into a single 4-part pill selector, removing the `autoAccept` and `planMode` booleans from frontend state, backend logic, and the database schema.

## Design

### Pill Selector Component

A reusable `PillSelector` component rendered as a row of 4 connected buttons:
- Rounded corners on the left end of the first button and right end of the last button
- Active option highlighted with `var(--accent)` background
- Inactive options use `var(--bg-tertiary)` background
- Compact enough to fit inside the SessionControls dropdown menu

Props: `options` (array of `{ value, label }`), `value`, `onChange`.

**Options:**

| Label | Value | Description |
|-------|-------|-------------|
| Accept Edits | `acceptEdits` | Auto-approve file edits, prompt for other tools |
| Auto | `auto` | Classifier-based approval |
| Plan | `plan` | Read-only, no modifications |
| Ask | `default` | Prompt for everything |

Short labels ("Auto", "Ask") keep the pill compact for the SessionControls menu.

### Files to Modify

**New file:**
- `client/src/components/common/PillSelector.jsx` + `PillSelector.module.css` — reusable pill selector component

**Frontend changes:**
- `client/src/components/Dashboard/NewSessionModal.jsx` — Remove dropdown + both toggles. Add PillSelector. Remove `autoAccept`/`planMode` from form state and submission payload.
- `client/src/components/Chat/SessionControls.jsx` — Replace Plan Mode and Auto Accept toggle menu items with a PillSelector. Call new `PATCH /:id/permission-mode` endpoint on change. Remove `planMode`/`autoAccept` state.

**Backend changes:**
- `server/services/sessionManager.js` — Remove the `if (planMode) / else if (autoAccept)` override logic. Use `this.permissionMode` directly in the `--permission-mode` arg.
- `server/routes/sessions.js` — Remove `POST /:id/plan-mode` and `POST /:id/auto-accept` endpoints. Add `POST /:id/permission-mode` endpoint that updates `permission_mode` in DB and on the session object. Remove `autoAccept`/`planMode` from session creation destructuring.
- `server/database.js` — Remove `auto_accept` and `plan_mode` columns from the sessions table schema. (SQLite will ignore the missing columns for existing rows; a migration is not strictly needed since we stop reading them.)

### Verification

1. Start dev server, open New Session modal, confirm pill selector renders with 4 options and "Accept Edits" is selected by default
2. Create a session with each permission mode, verify the correct `--permission-mode` flag appears in the Claude Code process args
3. During an active session, open the SessionControls menu, change permission mode via pill selector, verify the DB and session object update
4. Confirm the old toggle endpoints (`/plan-mode`, `/auto-accept`) are removed

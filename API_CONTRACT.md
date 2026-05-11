# API Contract — Taskaia Backend

## Base URL
```
Development: http://localhost:3000/api
Production:  https://your-domain.com/api
```

## Headers
All requests:
```
Content-Type: application/json   (except file uploads: multipart/form-data)
```

## Response Envelope
All responses follow this structure:
```json
{
  "status": "success" | "error",
  "data": { ... },
  "message": "string (optional)"
}
```
Error responses:
```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

---

## 1. Health

### GET `/health`
Basic liveness check. No auth required.

**Response `200`:**
```json
{
  "status": "success",
  "data": {
    "ok": true,
    "timestamp": "2026-04-24T12:00:00.000Z",
    "version": "1.0.0"
  }
}
```

---

## 2. Settings

### GET `/settings`
Returns current settings state — **non-sensitive** (no raw API keys). Returns configured flags and display names.

**Response `200`:**
```json
{
  "status": "success",
  "data": {
    "provider": "trello",
    "configured": {
      "stt": true,
      "trello": true,
      "jira": false,
      "active": true,
      "allReady": true
    },
    "sttProvider": "whisper",
    "trelloBoardId": "board_abc123",
    "trelloBoardName": "My Project Board",
    "trelloListId": "list_xyz789",
    "trelloListName": "To-Do",
    "jiraHost": null,
    "jiraProjectKey": null,
    "jiraProjectName": null,
    "jiraBoardId": null,
    "autoSend": false
  }
}
```

### PUT `/settings`
Saves API keys and configuration. Keys are persisted in the backend `.env` or a secure config store (never returned in GET). Either Trello fields, Jira fields, or both may be supplied. Only the `provider` field is required to switch the active backend.

**Request:**
```json
{
  "provider": "jira",
  "trelloApiKey": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "trelloToken": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "trelloBoardId": "board_abc123",
  "trelloListId": "list_xyz789",
  "jiraHost": "your-org.atlassian.net",
  "jiraEmail": "you@example.com",
  "jiraApiToken": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "jiraProjectKey": "TASK",
  "jiraBoardId": "1",
  "autoSend": false
}
```

**Response `200`:**
```json
{
  "status": "success",
  "data": {
    "configured": {
      "stt": true,
      "ai": true,
      "trello": true,
      "allReady": true
    }
  },
  "message": "Settings saved successfully"
}
```

### GET `/settings/trello/boards`
Fetches available Trello boards for the authenticated user (uses stored Trello keys).

**Response `200`:**
```json
{
  "status": "success",
  "data": {
    "boards": [
      { "id": "board_abc123", "name": "My Project Board" },
      { "id": "board_def456", "name": "Personal Tasks" }
    ]
  }
}
```

**Error `400`:** `TRELLO_NOT_CONFIGURED` — Trello API key not yet saved.

### GET `/settings/trello/lists/:boardId`
Fetches available lists for a given Trello board.

**Path params:** `boardId` — Trello board ID

**Response `200`:**
```json
{
  "status": "success",
  "data": {
    "lists": [
      { "id": "list_xyz789", "name": "To-Do" },
      { "id": "list_abc111", "name": "In Progress" },
      { "id": "list_abc222", "name": "Done" }
    ]
  }
}
```

---

## 3. Recording & Transcription

### POST `/record/upload`
Uploads an audio file. Sends to STT provider (Whisper/Google) and returns raw transcript. Saves recording record to DB.

**Request:** `multipart/form-data`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| audio | File | yes | `.m4a` or `.wav`, max 50MB / 5 min |

**Response `200`:**
```json
{
  "status": "success",
  "data": {
    "recordingId": "rec_a1b2c3d4",
    "rawText": "So the main thing I wanted to do today was set up the authentication module and also make sure we handle the error cases properly when the token expires...",
    "durationSeconds": 42
  }
}
```

**Errors:**
- `422` `AUDIO_TOO_LARGE` — file exceeds 50MB
- `422` `STT_FAILED` — transcription service error
- `400` `STT_NOT_CONFIGURED` — STT API key not set

---

## 4. AI Extraction (AI extraction Summarize)

### POST `/ai/extract`
Takes a raw transcript and returns a **structured task** ready for the user's chosen provider. The backend pre-fetches the active provider's catalogs (lists/labels/members for Trello, projects/users/labels/sprints/issue types for Jira), then asks the LLM to extract a polished title, description, type, assignee, and other slots — using **only ids/keys from those catalogs**. If the client has already cached the catalogs it can pass them in the body to skip the pre-fetch.

**Request:**
```json
{
  "recordingId": "rec_a1b2c3d4",
  "rawText": "Ask Sarah to fix the broken login flow on iOS, this sprint, mark it urgent.",
  "provider": "jira",
  "jira": {
    "projects":   [{ "key": "TASK", "name": "Taskaia Mobile" }],
    "users":      [{ "accountId": "acc_alice", "displayName": "Alice" }],
    "labels":     [{ "name": "urgent" }],
    "sprints":    [{ "id": 401, "name": "Sprint 12", "state": "active" }],
    "issueTypes": [{ "id": "10001", "name": "Task" }]
  }
}
```

`provider` is optional — defaults to the value saved in Settings. Pre-fetched arrays are optional and override the backend lookup when present.

**Response `200`:**
```json
{
  "status": "success",
  "data": {
    "recordingId": "rec_a1b2c3d4",
    "rawText": "Ask Sarah to fix the broken login flow on iOS...",
    "title": "Fix broken iOS login flow",
    "description": "Investigate the iOS login regression and ship a fix this sprint.",
    "type": "bug",
    "summary": "Fix broken iOS login flow",

    "suggestedListId": null,
    "suggestedLabelIds": [],
    "suggestedMemberIds": [],

    "suggestedProjectKey": "TASK",
    "suggestedSprintId": 401,
    "suggestedAssigneeAccountId": "acc_alice",
    "suggestedLabelNames": ["urgent"],
    "suggestedIssueTypeName": "Task"
  }
}
```

For `provider: "trello"`, the Trello fields are populated and the Jira fields are `null`/empty. The `summary` field is preserved for older clients.

**Errors:**
- `422` `VALIDATION_ERROR` — request shape invalid
- `400` `STT_NOT_CONFIGURED` — no LLM API key available

---

## 5. Trello (via MCP)

### POST `/trello/card`
Creates a new Trello card on the configured board/list using the MCP `add_trello_card` tool.

**Request:**
```json
{
  "title": "Set up authentication module and implement token expiry error handling.",
  "description": "Action item from voice recording — 2026-04-24.\n\nFull summary: Set up the auth module with proper token expiry handling.\n\nAI extraction record: https://example.invalid/snapshot/xxxxxxxx",
  "recordingId": "rec_a1b2c3d4"
}
```

**Response `200`:**
```json
{
  "status": "success",
  "data": {
    "cardId": "trello_card_001",
    "cardUrl": "https://trello.com/c/ABCDEFGH/1-set-up-authentication-module",
    "shortUrl": "https://trello.com/c/ABCDEFGH",
    "listName": "To-Do",
    "boardName": "My Project Board"
  },
  "message": "Task added to Trello successfully"
}
```

**Errors:**
- `422` `TRELLO_MCP_FAILED` — MCP tool call failed
- `400` `TRELLO_NOT_CONFIGURED` — Trello API key/token not set

### GET `/trello/cards`
Fetches active cards from the configured Trello board/list using MCP `get_trello_cards` tool.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| listId | string | configured default | Filter by list ID |

**Response `200`:**
```json
{
  "status": "success",
  "data": {
    "cards": [
      {
        "id": "trello_card_001",
        "title": "Set up authentication module",
        "description": "Action item from voice recording...",
        "url": "https://trello.com/c/ABCDEFGH/1-set-up-authentication-module",
        "shortUrl": "https://trello.com/c/ABCDEFGH",
        "listId": "list_xyz789",
        "listName": "To-Do",
        "boardId": "board_abc123",
        "createdAt": "2026-04-24T10:30:00.000Z"
      }
    ],
    "total": 1
  }
}
```

---

## 6. Jira (Atlassian Cloud)

All Jira endpoints require Settings to have `jiraHost`, `jiraEmail`, `jiraApiToken`, and `jiraProjectKey` configured (or `MOCK_MODE=true`).

### POST `/jira/issue`
Creates a new Jira issue in the configured project. If `sprintId` is provided, the issue is also added to that sprint via the Agile API.

**Request:**
```json
{
  "title": "Fix broken iOS login flow",
  "description": "Investigate the iOS login regression and ship a fix this sprint.",
  "projectKey": "TASK",
  "issueTypeName": "Bug",
  "assigneeAccountId": "acc_alice",
  "labels": ["urgent", "mobile"],
  "sprintId": 401,
  "recordingId": "rec_a1b2c3d4"
}
```

`projectKey`, `issueTypeName`, `assigneeAccountId`, `labels`, and `sprintId` are optional — defaults come from Settings or are left unset.

**Response `200`:**
```json
{
  "status": "success",
  "data": {
    "issueId": "10999",
    "issueKey": "TASK-99",
    "issueUrl": "https://your-org.atlassian.net/browse/TASK-99",
    "projectKey": "TASK"
  },
  "message": "Task added to Jira successfully"
}
```

### GET `/jira/issues`
Lists recent issues from a Jira project. Optional `sprintId` query param filters to one sprint.

**Query params:** `projectKey?`, `sprintId?`

**Response `200`:**
```json
{
  "status": "success",
  "data": {
    "issues": [
      {
        "id": "10100",
        "key": "TASK-1",
        "title": "Design provider selection screen",
        "description": "First-launch picker for Trello vs Jira.",
        "url": "https://your-org.atlassian.net/browse/TASK-1",
        "status": "In Progress",
        "issueType": "Story",
        "projectKey": "TASK",
        "assignee": { "accountId": "acc_alice", "displayName": "Alice", "active": true },
        "labels": ["frontend", "mobile"],
        "sprintId": 401,
        "sprintName": "Sprint 12 — Voice2Board",
        "createdAt": "2026-05-10T12:00:00.000Z"
      }
    ],
    "total": 1
  }
}
```

### GET `/jira/projects`
Returns the Jira projects the configured account can see.

```json
{ "status": "success", "data": { "projects": [{ "id": "10000", "key": "TASK", "name": "Taskaia Mobile" }] } }
```

### GET `/jira/members?projectKey=TASK`
Assignable users for the given project (defaults to the configured project key).

```json
{ "status": "success", "data": { "users": [{ "accountId": "acc_alice", "displayName": "Alice", "active": true }] } }
```

### GET `/jira/labels?projectKey=TASK`
Labels currently in use across the project.

```json
{ "status": "success", "data": { "labels": [{ "name": "urgent" }, { "name": "mobile" }] } }
```

### GET `/jira/sprints?boardId=1`
Active and upcoming sprints for the given agile board (defaults to configured `jiraBoardId`).

```json
{ "status": "success", "data": { "sprints": [{ "id": 401, "name": "Sprint 12", "state": "active" }] } }
```

### GET `/jira/issue-types?projectKey=TASK`
Issue types available for the project (Task, Bug, Story, Epic, …).

```json
{ "status": "success", "data": { "issueTypes": [{ "id": "10001", "name": "Task" }] } }
```

**Errors (all Jira endpoints):**
- `400` `JIRA_NOT_CONFIGURED` — credentials/project key missing.

---

## 7. Recordings History (Optional — for future use)

### GET `/recordings`
List of all processed recordings stored in DB.

**Response `200`:**
```json
{
  "status": "success",
  "data": {
    "recordings": [
      {
        "id": "rec_a1b2c3d4",
        "rawText": "So the main thing...",
        "summary": "Set up authentication module...",
        "extractionSnapshotUrl": "https://ai extraction.so/...",
        "trelloCardId": "trello_card_001",
        "trelloCardUrl": "https://trello.com/c/ABCDEFGH/...",
        "status": "completed",
        "durationSeconds": 42,
        "createdAt": "2026-04-24T10:25:00.000Z"
      }
    ]
  }
}
```

---

## Models

### RecordingModel
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | yes | `rec_` prefixed UUID |
| rawText | string | yes | Full STT transcript |
| summary | string? | no | AI-extracted task |
| extractionSnapshotId | string? | no | AI extraction record reference |
| extractionSnapshotUrl | string? | no | AI extraction record URL |
| trelloCardId | string? | no | Trello card ID after creation |
| trelloCardUrl | string? | no | Full Trello card URL |
| status | enum | yes | `pending`, `transcribed`, `summarized`, `completed`, `failed` |
| durationSeconds | number | yes | Recording length |
| createdAt | ISO8601 | yes | Timestamp |

### TrelloCardModel
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | yes | Trello card ID |
| title | string | yes | Card name/title |
| description | string? | no | Card description body |
| url | string | yes | Full Trello card URL |
| shortUrl | string | yes | Short Trello URL |
| listId | string | yes | Trello list ID |
| listName | string | yes | Trello list display name |
| boardId | string | yes | Trello board ID |
| createdAt | ISO8601 | yes | Card creation timestamp |

### SettingsConfigModel (response only — never exposes raw keys)
| Field | Type | Description |
|-------|------|-------------|
| configured.stt | boolean | STT key is set |
| configured.ai extraction | boolean | AI extraction token is set |
| configured.trello | boolean | Trello keys are set |
| configured.allReady | boolean | All three services configured |
| sttProvider | string | "whisper" or "google" |
| trelloBoardId | string? | Selected board ID |
| trelloBoardName | string? | Selected board display name |
| trelloListId | string? | Selected list ID |
| trelloListName | string? | Selected list display name |
| autoSend | boolean | Auto-send toggle state |

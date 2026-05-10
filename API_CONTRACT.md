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
    "configured": {
      "stt": true,
      "notion": true,
      "trello": true,
      "allReady": true
    },
    "sttProvider": "whisper",
    "trelloBoardId": "board_abc123",
    "trelloBoardName": "My Project Board",
    "trelloListId": "list_xyz789",
    "trelloListName": "To-Do",
    "autoSend": false
  }
}
```

### PUT `/settings`
Saves all API keys and configuration. Keys are persisted in the backend `.env` or a secure config store (never returned in GET).

**Request:**
```json
{
  "sttProvider": "whisper",
  "sttApiKey": "sk-...",
  "notionToken": "secret_...",
  "notionPageId": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "trelloApiKey": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "trelloToken": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "trelloBoardId": "board_abc123",
  "trelloListId": "list_xyz789",
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
      "notion": true,
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

## 4. Notion Summarization

### POST `/notion/summarize`
Sends raw transcript to Notion. Notion AI (or LLM fallback) generates a summary. Saves both transcript + summary to Notion page. Updates DB record.

**Request:**
```json
{
  "recordingId": "rec_a1b2c3d4",
  "rawText": "So the main thing I wanted to do today was..."
}
```

**Response `200`:**
```json
{
  "status": "success",
  "data": {
    "recordingId": "rec_a1b2c3d4",
    "summary": "Set up authentication module and implement token expiry error handling.",
    "notionPageId": "notion_page_xxxxxxxx",
    "notionPageUrl": "https://notion.so/page/xxxxxxxx"
  }
}
```

**Errors:**
- `422` `NOTION_SUMMARIZE_FAILED` — Notion API or summarization error
- `400` `NOTION_NOT_CONFIGURED` — Notion token not set

---

## 5. Trello (via MCP)

### POST `/trello/card`
Creates a new Trello card on the configured board/list using the MCP `add_trello_card` tool.

**Request:**
```json
{
  "title": "Set up authentication module and implement token expiry error handling.",
  "description": "Action item from voice recording — 2026-04-24.\n\nFull summary: Set up the auth module with proper token expiry handling.\n\nNotion page: https://notion.so/page/xxxxxxxx",
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

## 6. Recordings History (Optional — for future use)

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
        "notionPageUrl": "https://notion.so/...",
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
| summary | string? | no | Notion-generated summary |
| notionPageId | string? | no | Notion page reference |
| notionPageUrl | string? | no | Notion page URL |
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
| configured.notion | boolean | Notion token is set |
| configured.trello | boolean | Trello keys are set |
| configured.allReady | boolean | All three services configured |
| sttProvider | string | "whisper" or "google" |
| trelloBoardId | string? | Selected board ID |
| trelloBoardName | string? | Selected board display name |
| trelloListId | string? | Selected list ID |
| trelloListName | string? | Selected list display name |
| autoSend | boolean | Auto-send toggle state |

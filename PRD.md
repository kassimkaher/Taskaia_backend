# Taskaia (Voice2Board) — Product Requirements Document

## 1. App Overview

- **Purpose:** Enable users to capture spoken ideas via voice memo, automatically transcribe and summarize them using the Groq LLM, and push actionable tasks directly to a Trello board — eliminating the manual copy-paste workflow between voice notes and task management.
- **Target Users:** Project managers, developers, and on-the-go professionals who brainstorm verbally and want instant task creation without typing.
- **Core Value:** Speak once → get a Trello card. No manual transcription, no switching apps.
- **Platform:** Mobile (Flutter — iOS & Android) + Backend/Middleware (Node.js or FastAPI)

---

## 2. User Roles & Permissions

| Role | Description | Key Capabilities |
|------|-------------|-----------------|
| Authenticated User | Single user who configures their own API credentials in Settings | Record voice, view transcription, review/edit summary, push to Trello, view Trello tasks |
| Unauthenticated | App not yet configured | Prompted to complete Settings before using core features |

> This is a personal productivity app. There is no multi-user or admin role system in V1.

---

## 3. Core Features

### 3.1 Voice Recording
- Press-and-hold (or tap-to-toggle) microphone button to start recording.
- Visual audio waveform animation displayed while recording is active.
- Pause and resume recording mid-session.
- Stop recording to trigger the processing pipeline.
- Playback of recorded audio before committing.
- Audio captured in `.m4a` or `.wav` format and uploaded to the backend.

### 3.2 Speech-to-Text (STT) Transcription
- Backend receives the audio file and forwards it to an STT provider (OpenAI Whisper API or Google Cloud Speech-to-Text).
- Returns `Raw_Text` — the verbatim transcription of the recording.
- Status messages shown to the user during processing: "Transcribing...", "Processing audio..."

### 3.3 AI Extraction & Archiving
- Backend sends `Raw_Text` to an AI extraction record via the Groq LLM API.
- the Groq LLM (or an LLM fallback) generates a concise, actionable summary from the raw transcript.
- Both the raw transcript and the AI summary are stored in AI extraction for long-term archiving.
- `Summary_Text` is returned to the Flutter app for user review.
- Status messages shown: "Summarizing in AI extraction..."

### 3.4 Trello Task Creation via MCP
- User reviews the AI-extracted task on the Review Screen.
- User optionally edits the summary text before sending.
- On confirm, the Flutter app calls the backend which uses an MCP Client to connect to the Trello MCP Server.
- Backend calls the `add_trello_card` MCP tool, passing `Summary_Text` as the card title and/or description.
- Card is created on the user's pre-configured Trello Board and List.
- App displays a success notification on completion.

### 3.5 Trello Task Retrieval via MCP
- Task Board Screen fetches active cards from the configured Trello board.
- Backend uses the MCP Client to call the `get_trello_cards` tool and returns the results.
- User can pull-to-refresh to trigger a fresh MCP fetch.
- Cards displayed as a scrollable list with title and description.

### 3.6 User Settings
- Configuration screen (modal) accessible from any screen.
- Inputs for:
  - STT Service API Key (OpenAI Whisper or Google Cloud)
  - 
  - Trello API Key + OAuth Token
- Dropdowns to select:
  - Target Trello Board ID
  - Target Trello List ID (e.g., "To-Do")
- Settings are stored securely on-device (e.g., Flutter Secure Storage).
- App validates that required settings are configured before allowing voice recording.

---

## 4. Screen Inventory

| # | Screen Name | Platform | Role | Purpose |
|---|-------------|----------|------|---------|
| 1 | Record Screen | Mobile | Authenticated User | Main home screen — microphone button, waveform, recording status, status pipeline messages |
| 2 | Review Screen | Mobile | Authenticated User | Displays AI-extracted task; allows edit, confirm to send to Trello, or discard |
| 3 | Task Board Screen | Mobile | Authenticated User | Scrollable list of active Trello cards fetched via MCP; pull-to-refresh |
| 4 | Settings Modal | Mobile | Authenticated User | Configure API keys, AI extraction record, Trello board + list selection |

---

## 5. Navigation Flow

```
App Launch
  └─ Settings Check
       ├─ Not configured → Settings Modal (forced)
       └─ Configured → Record Screen (Main)

Record Screen
  └─ [Hold Mic / Tap to Record]
       └─ [Release / Stop]
            └─ Processing: STT → AI extraction
                 └─ Review Screen
                      ├─ [Confirm & Add to Trello] → Trello MCP → Success Toast → Record Screen
                      └─ [Discard] → Record Screen

Bottom Navigation Bar
  ├─ Record Screen (tab 1)
  └─ Task Board Screen (tab 2)

Settings Modal
  └─ Accessible via gear icon from Record Screen or Task Board Screen
```

---

## 6. Business Rules

1. **API keys are never stored or used in the Flutter app directly.** All AI extraction, Trello, and STT API calls pass through the backend middleware. Keys configured in Settings are sent to the backend; the backend handles all third-party communication.
2. **Review before push (default ON).** The Review Screen is shown after every recording, giving the user a chance to review or edit the AI extraction summary before it becomes a Trello card. An optional "Auto-send" toggle in Settings can bypass the Review Screen.
3. **MCP protocol for all Trello operations.** Trello cards are created and fetched exclusively via the MCP Server (`add_trello_card`, `get_trello_cards` tools) — not via direct Trello REST API calls from the Flutter app.
4. **AI extraction stores both raw transcript and summary.** The raw audio transcription is archived alongside the AI-generated summary for future reference.
5. **Settings must be complete before recording.** If the user has not configured all required API credentials and selected a Trello board/list, the mic button is disabled with a prompt to open Settings.
6. **Audio file size limit.** Recordings should be capped at a reasonable duration (e.g., 5 minutes / ~50 MB) to stay within STT API input limits.
7. **Processing is sequential and stateful.** The pipeline is: Upload → STT → AI extraction → Review → Trello. Each stage must complete successfully before the next begins. Failures at any stage show an error with a retry option.
8. **Offline behavior.** The app requires an internet connection. If offline, recording is allowed but processing is blocked with a clear "No internet connection" error. No offline transcription in V1.

---

## 7. API Requirements (Backend Endpoints)

The Flutter app communicates exclusively with the backend. The backend handles all third-party integrations.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/record/upload` | Accepts audio file (`.m4a`/`.wav`), returns `{ raw_text: string }` from STT |
| `POST` | `/api/ai/extract` | Accepts `{ raw_text }`, stores in AI extraction, returns `{ summary: string }` |
| `POST` | `/api/trello/card` | Accepts `{ title, description }`, creates Trello card via MCP, returns `{ card_id, url }` |
| `GET` | `/api/trello/cards` | Fetches active cards from configured Trello board via MCP, returns `[{ id, title, description, url }]` |
| `GET` | `/api/settings` | Returns current settings (non-sensitive — board name, list name, configured flags) |
| `PUT` | `/api/settings` | Saves API keys, extraction snapshot, Trello board ID + list ID |
| `GET` | `/api/health` | Basic health check endpoint |

---

## 8. Non-Functional Requirements

- **Security:** API keys transmitted over HTTPS only. Keys stored in backend environment variables (`.env`), never in Flutter app code or device logs.
- **Performance:** End-to-end pipeline (upload → STT → AI extraction → Review Screen) should complete within 10 seconds for a 1-minute recording.
- **Error Handling:** Each pipeline stage has its own error state with user-friendly messages and a retry action.
- **Accessibility:** Mic button must have sufficient tap target size (min 64×64 dp). Status messages must be readable.
- **Responsiveness:** App must work on standard iOS and Android screen sizes without layout overflow.

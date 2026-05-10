# PCONSTITUTION — Taskaia Project Laws

> These rules are immutable. Every engineer and AI agent working on this project must follow them without exception.

---

## I. Architecture Laws

### 1. The Flutter App Is a Thin Client
The Flutter mobile app **never** calls Notion, Trello, OpenAI, or any third-party API directly. All external API calls go through the Node.js backend. No exceptions.

### 2. API Keys Live on the Server
API keys (STT, Notion, Trello) are stored in the backend `.env` file only. They are never:
- Hardcoded in Flutter/Dart code
- Stored in Flutter SharedPreferences
- Logged to console or included in error messages
- Committed to git

The Flutter app stores only the **backend base URL** in Flutter Secure Storage for API calls to its own backend.

### 3. MCP Client Is Backend-Only
The `@modelcontextprotocol/sdk` MCP client runs in the Node.js backend exclusively. All Trello operations (create card, fetch cards) go through MCP tools. Direct Trello REST API calls from Flutter are forbidden.

### 4. Pipeline Is Always Sequential
The processing pipeline order is fixed: `Audio Upload → STT → Notion → Review → Trello`. No step may be skipped or reordered. If a step fails, the pipeline halts and returns an error — never silently continues.

---

## II. Code Quality Laws

### 5. Every Feature Follows Clean Architecture
Flutter features are structured as:
```
features/[feature_name]/
├── data/
│   ├── datasources/
│   └── repositories/
├── domain/
│   ├── entities/
│   └── usecases/
└── presentation/
    ├── notifiers/
    ├── screens/
    └── widgets/
```

Backend features follow Controller → Service pattern:
```
src/[feature]/
├── [feature].controller.ts
├── [feature].service.ts
└── [feature].routes.ts
```

### 6. State Management Is Riverpod 3 Only
Use `Notifier<T>` with `build()` method only. Never use `StateNotifier`, `ChangeNotifier`, `setState` (in notifiers), or `Provider` (the original package). UI widgets use `ConsumerWidget` or `ConsumerStatefulWidget`.

### 7. All API Calls Use Dio
The Flutter app uses a single `ApiClient` Dio instance configured with:
- `BaseOptions(baseUrl: backendBaseUrl)`
- Interceptor for error handling
- Interceptor for logging (debug only)

### 8. No Magic Numbers
All spacing, colors, radii, and typography values must reference design tokens:
- Colors: `Theme.of(context).colorScheme.X` or `Theme.of(context).extension<AppColors>()!.X`
- Typography: `Theme.of(context).textTheme.X`
- Spacing/radii: use constants from `app_dimensions.dart`

---

## III. Safety Laws

### 9. Never Expose Sensitive Data in Responses
The `GET /api/settings` endpoint returns only non-sensitive metadata (configured flags, display names). It never returns raw API keys, tokens, or secrets. The `PUT /api/settings` endpoint accepts keys but the response never echoes them back.

### 10. All File Uploads Are Validated
Audio file uploads must:
- Validate MIME type (`audio/mp4`, `audio/wav`, `audio/mpeg`)
- Enforce max file size: 50MB
- Be stored in a temporary directory and deleted after processing
- Never be persisted to disk long-term

### 11. All Backend Inputs Are Validated with Zod
Every request body and path/query param must pass Zod schema validation before reaching the service layer. Invalid input returns `422 Unprocessable Entity` with a clear `error.message`.

---

## IV. UI Laws

### 12. Every Screen Has All Three States
Every screen that fetches data must implement:
- **Loading state:** skeleton shimmer or centered spinner
- **Error state:** error message + retry button
- **Success state:** the actual content

No screen may show an empty white/dark screen during loading.

### 13. Mic Button Tap Target Minimum
The microphone button's minimum tappable area is 64×64dp. The visual button is 120×120dp. No compromise on this for accessibility.

### 14. Settings Validation Before Recording
If `settingsState.configured.allReady == false`, the mic button must be visually disabled with an explanatory status text. Tapping it opens the Settings modal, not a generic error.

### 15. Error Handling Is User-Friendly
Error messages shown to the user must be plain English. Never show:
- Raw exception messages
- Stack traces
- HTTP status codes
- JSON error objects

Map all backend error codes to human-readable messages in the Flutter app.

---

## V. Git Laws

### 16. `.env` Is Never Committed
The backend `.env` file is in `.gitignore`. A `.env.example` is committed with all required keys listed but empty values.

### 17. Branch Naming
- Features: `feat/feature-name`
- Fixes: `fix/bug-description`
- Chores: `chore/task-name`

---

## VI. Testing Laws

### 18. Mock Data Must Be Used Before Real APIs Are Connected
During `/pBuild`, all backend calls use `MOCK_DATA.json` responses served by the backend's mock layer. The app must be fully functional with mock data before real API integration begins.

### 19. Pipeline Must Be Testable End-to-End
The backend must have at least one integration test that exercises the full pipeline: mock audio file → STT mock → Notion mock → Trello MCP mock → response.

# Technology Stack — Taskaia

## Database
- **Engine:** PostgreSQL 16
- **ORM:** Prisma 5

## Backend
- **Framework:** Node.js + Express
- **Language:** TypeScript
- **Runtime:** Node.js 20 LTS
- **Key Packages:**
  ```
  express                        ^4.21.0
  @types/express                 ^4.17.21
  typescript                     ^5.7.0
  ts-node                        ^10.9.2
  tsx                            ^4.19.0
  @prisma/client                 ^5.22.0
  prisma                         ^5.22.0   (dev)
  dotenv                         ^16.4.7
  cors                           ^2.8.5
  @types/cors                    ^2.8.17
  helmet                         ^8.0.0
  morgan                         ^1.10.0
  @types/morgan                  ^1.9.9
  multer                         ^1.4.5-lts.1   (audio file uploads)
  @types/multer                  ^1.4.12
  axios                          ^1.7.9         (STT + Notion API calls)
  @modelcontextprotocol/sdk      ^1.0.4         (MCP client for Trello)
  form-data                      ^4.0.1
  zod                            ^3.23.8
  @types/node                    ^22.10.0
  ```

## Web Dashboard
- **Status:** Not included (skipped)

## Mobile
- **Framework:** Flutter 3.27+
- **Language:** Dart 3.6+
- **State Management:** Riverpod 3 (`Notifier<T>` + `build()` pattern)
- **Key Packages:**
  ```yaml
  # pubspec.yaml dependencies
  flutter_riverpod:          ^2.6.1
  riverpod_annotation:       ^2.6.1
  go_router:                 ^14.6.1
  dio:                       ^5.7.0
  record:                    ^5.2.0        # audio recording (.m4a / .wav)
  just_audio:                ^0.9.42       # audio playback
  flutter_secure_storage:    ^9.2.2        # secure API key storage
  permission_handler:        ^11.3.1       # microphone permission
  path_provider:             ^2.1.4        # temp audio file path
  lottie:                    ^3.1.3        # waveform/loading animations

  # dev dependencies
  build_runner:              ^2.4.13
  riverpod_generator:        ^2.6.1
  flutter_lints:             ^4.0.0
  ```

## Shared
- **API Protocol:** REST (JSON)
- **Auth:** None (personal single-user app — API keys stored in Flutter Secure Storage and forwarded to backend per request)
- **Audio Format:** `.m4a` (iOS) / `.wav` (Android) via `record` package
- **Monorepo:** Yes — `taskaia/backend/` + `taskaia/mobile/`
- **Environment:** `.env` in backend root (never committed)

## Architecture Notes
- Flutter app never calls Notion, Trello, or STT APIs directly
- All third-party API keys live in backend `.env`
- MCP Client (`@modelcontextprotocol/sdk`) runs in backend only
- Prisma used for persisting transcript/summary history locally (optional archive)

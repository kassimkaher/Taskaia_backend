# Backend Tasks — Taskaia

> Reference: `API_CONTRACT.md`, `BACKEND_STANDARDS.md`, `MOCK_DATA.json`

---

## Phase 0: Infrastructure

- [x] **0.1** Scaffold Node.js + Express + TypeScript project
- [x] **0.2** Configure project folder structure
- [x] **0.3** Configure environment variables
- [x] **0.4** Configure PostgreSQL + Prisma (schema created; run `npx prisma migrate dev --name init` when DB is available)
- [x] **0.5** Set up common utilities
- [x] **0.6** Configure Multer for audio uploads

---

## Phase 1: Database & Seed

- [x] **1.1** Run Prisma migration and verify schema
- [x] **1.2** Create seed script from MOCK_DATA.json

---

## Phase 2: Settings API

- [x] **2.1** GET `/api/settings`
- [x] **2.2** PUT `/api/settings`
- [x] **2.3** GET `/api/settings/trello/boards`
- [x] **2.4** GET `/api/settings/trello/lists/:boardId`
- [x] **2.5** Wire settings routes into app

---

## Phase 3: Recording & Transcription

- [x] **3.1** POST `/api/record/upload` — STT integration
- [x] **3.2** GET `/api/recordings`
- [x] **3.3** Wire record routes

---

## Phase 4: Notion Summarization

- [x] **4.1** POST `/api/notion/summarize`
- [x] **4.2** Wire notion routes

---

## Phase 5: Trello MCP Integration

- [x] **5.1** Set up MCP client
- [x] **5.2** POST `/api/trello/card` — create card via MCP
- [x] **5.3** GET `/api/trello/cards` — fetch cards via MCP
- [x] **5.4** Wire trello routes

---

## Phase 6: Health & Polish

- [x] **6.1** GET `/api/health`
- [x] **6.2** Add CORS configuration
- [x] **6.3** Final smoke test — all 10 endpoints verified ✅

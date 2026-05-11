# Backend Standards — Taskaia

## Project Structure

```
backend/
├── src/
│   ├── app.ts                    # Express app setup, middleware registration
│   ├── server.ts                 # Entry point — binds port, starts server
│   ├── config/
│   │   ├── env.ts                # Zod-validated env vars (process.env parse)
│   │   └── database.ts           # Prisma client singleton
│   ├── common/
│   │   ├── middleware/
│   │   │   ├── error.middleware.ts   # Global error handler
│   │   │   └── validate.middleware.ts # Zod request validation
│   │   ├── types/
│   │   │   └── api.types.ts       # Shared request/response types
│   │   └── utils/
│   │       ├── response.ts        # success() / error() response helpers
│   │       └── logger.ts          # Morgan / console logger
│   ├── health/
│   │   ├── health.controller.ts
│   │   └── health.routes.ts
│   ├── settings/
│   │   ├── settings.controller.ts
│   │   ├── settings.service.ts
│   │   ├── settings.routes.ts
│   │   └── settings.schema.ts     # Zod schemas
│   ├── record/
│   │   ├── record.controller.ts
│   │   ├── record.service.ts
│   │   ├── record.routes.ts
│   │   └── stt/
│   │       ├── whisper.service.ts
│   │       └── google-stt.service.ts
│   ├── ai extraction/
│   │   ├── ai extraction.controller.ts
│   │   ├── ai extraction.service.ts
│   │   └── ai extraction.routes.ts
│   └── trello/
│       ├── trello.controller.ts
│       ├── trello.service.ts
│       ├── trello.routes.ts
│       └── mcp/
│           ├── mcp-client.ts      # @modelcontextprotocol/sdk client setup
│           └── trello-tools.ts    # add_trello_card, get_trello_cards wrappers
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                    # Seeds from MOCK_DATA.json
├── uploads/                       # Temp audio files (gitignored, deleted after processing)
├── .env                           # Never committed
├── .env.example                   # Committed — shows required keys
├── package.json
└── tsconfig.json
```

---

## Dependencies (exact pinned versions)

See `TECH_STACK.md` for the full list. Key packages:
```
express ^4.21.0 + @types/express ^4.17.21
typescript ^5.7.0 + ts-node ^10.9.2 + tsx ^4.19.0
@prisma/client ^5.22.0 + prisma ^5.22.0
multer ^1.4.5-lts.1 + @types/multer ^1.4.12
@modelcontextprotocol/sdk ^1.0.4
axios ^1.7.9 + form-data ^4.0.1
zod ^3.23.8
helmet ^8.0.0 + cors ^2.8.5 + morgan ^1.10.0 + dotenv ^16.4.7
```

---

## API Response Pattern

Always use the `success()` and `error()` helpers:
```typescript
// src/common/utils/response.ts
export const success = (data: unknown, message?: string) =>
  ({ status: 'success', data, ...(message && { message }) });

export const apiError = (code: string, message: string) =>
  ({ status: 'error', error: { code, message } });
```

Controller pattern:
```typescript
// GET /api/settings
export const getSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await settingsService.getSettings();
    res.json(success(data));
  } catch (err) {
    next(err);
  }
};
```

---

## Error Handling

Global error middleware in `src/common/middleware/error.middleware.ts`:
```typescript
export const errorMiddleware = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(apiError(err.code, err.message));
  }
  logger.error(err);
  res.status(500).json(apiError('INTERNAL_ERROR', 'An unexpected error occurred'));
};
```

Custom `AppError`:
```typescript
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400
  ) { super(message); }
}
```

---

## Zod Validation Pattern

```typescript
// settings.schema.ts
export const updateSettingsSchema = z.object({
  sttProvider: z.enum(['whisper', 'google']),
  sttApiKey: z.string().min(1),
  groqApiKey: z.string().startsWith('secret_'),
  extractionSnapshotId: z.string().length(32),
  trelloApiKey: z.string().min(1),
  trelloToken: z.string().min(1),
  trelloBoardId: z.string().min(1),
  trelloListId: z.string().min(1),
  autoSend: z.boolean().default(false),
});

// validate.middleware.ts
export const validate = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success)
      return res.status(422).json(apiError('VALIDATION_ERROR', result.error.message));
    req.body = result.data;
    next();
  };
```

---

## Prisma Schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Recording {
  id              String   @id @default(cuid())
  rawText         String   @db.Text
  summary         String?  @db.Text
  extractionSnapshotId    String?
  extractionSnapshotUrl   String?
  trelloCardId    String?
  trelloCardUrl   String?
  status          RecordingStatus @default(PENDING)
  durationSeconds Int
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum RecordingStatus {
  PENDING
  TRANSCRIBED
  SUMMARIZED
  COMPLETED
  FAILED
}
```

---

## File Upload (Multer)

```typescript
// src/record/record.routes.ts
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/mp4', 'audio/wav', 'audio/mpeg', 'audio/m4a'];
    cb(null, allowed.includes(file.mimetype));
  },
});
router.post('/upload', upload.single('audio'), recordController.upload);
```

Always delete temp file after processing:
```typescript
import fs from 'fs';
// after processing:
fs.unlinkSync(req.file!.path);
```

---

## Mock Mode

Set `MOCK_MODE=true` in `.env` during `/pBuild`. When `MOCK_MODE=true`:
- STT service returns a fixed mock transcript from `MOCK_DATA.json`
- AI extraction service returns mock summary
- MCP/Trello returns mock card data

```typescript
// record.service.ts
if (process.env.MOCK_MODE === 'true') {
  return mockData.upload_response;
}
// else: call real STT API
```

---

## Environment Variables

```
# .env.example
DATABASE_URL=postgresql://user:password@localhost:5432/taskaia
PORT=3000
NODE_ENV=development
MOCK_MODE=true

# STT
STT_PROVIDER=whisper
OPENAI_API_KEY=

# AI extraction
NOTION_TOKEN=
NOTION_PAGE_ID=

# Trello
TRELLO_API_KEY=
TRELLO_TOKEN=
TRELLO_BOARD_ID=
TRELLO_LIST_ID=

# MCP
TRELLO_MCP_SERVER_URL=
```

-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('PENDING', 'TRANSCRIBED', 'SUMMARIZED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "summary" TEXT,
    "notionPageId" TEXT,
    "notionPageUrl" TEXT,
    "trelloCardId" TEXT,
    "trelloCardUrl" TEXT,
    "status" "RecordingStatus" NOT NULL DEFAULT 'PENDING',
    "durationSeconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

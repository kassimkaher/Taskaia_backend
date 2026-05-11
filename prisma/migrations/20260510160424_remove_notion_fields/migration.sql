/*
  Warnings:

  - You are about to drop the column `notionPageId` on the `Recording` table. All the data in the column will be lost.
  - You are about to drop the column `notionPageUrl` on the `Recording` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Recording" DROP COLUMN "notionPageId",
DROP COLUMN "notionPageUrl";

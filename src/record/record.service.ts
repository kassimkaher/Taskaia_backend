import fs from 'fs';
import { prisma } from '../config/database.js';
import { settingsService } from '../settings/settings.service.js';
import { transcribeWithWhisper } from './stt/whisper.service.js';
import { transcribeWithGoogle } from './stt/google-stt.service.js';
import { transcribeWithGroq } from './stt/groq-stt.service.js';
import { env } from '../config/env.js';
import { AppError } from '../common/types/app-error.js';

const MOCK_UPLOAD_RESPONSE = {
  recordingId: 'rec_a1b2c3d4',
  rawText: 'So the main thing I wanted to note today is that we need to set up the authentication module and make sure we handle the error cases properly when the token expires.',
  durationSeconds: 42,
};

const MOCK_RECORDINGS = [
  {
    id: 'rec_a1b2c3d4',
    rawText: 'So the main thing I wanted to note today is that we need to set up the authentication module...',
    summary: 'Set up authentication module with token expiry handling and automatic retry logic for refresh tokens.',
    trelloCardId: 'trello_card_001',
    trelloCardUrl: 'https://trello.com/c/ABCDEFGH/1-set-up-authentication-module',
    status: 'COMPLETED' as const,
    durationSeconds: 42,
    createdAt: new Date('2026-04-24T10:25:00.000Z'),
  },
  {
    id: 'rec_b2c3d4e5',
    rawText: 'I was thinking about the onboarding experience for new users...',
    summary: 'Design a 3-step onboarding walkthrough explaining the record → extract → task workflow.',
    trelloCardId: 'trello_card_002',
    trelloCardUrl: 'https://trello.com/c/BCDEFGHI/2-design-the-onboarding-flow',
    status: 'COMPLETED' as const,
    durationSeconds: 38,
    createdAt: new Date('2026-04-23T14:10:00.000Z'),
  },
];

export const recordService = {
  async upload(filePath: string, originalName: string) {
    if (env.MOCK_MODE) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return MOCK_UPLOAD_RESPONSE;
    }

    const store = settingsService.getStore();
    if (!store.sttApiKey) {
      throw new AppError('STT_NOT_CONFIGURED', 'STT API key is not configured', 400);
    }

    let rawText: string;
    try {
      if (store.sttProvider === 'groq') {
        rawText = await transcribeWithGroq(filePath, store.sttApiKey, originalName);
      } else if (store.sttProvider === 'whisper') {
        rawText = await transcribeWithWhisper(filePath, store.sttApiKey, originalName);
      } else {
        rawText = await transcribeWithGoogle(filePath, store.sttApiKey);
      }
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    const durationSeconds = 0; // multer doesn't provide duration — client should send it

    const recording = await prisma.recording.create({
      data: { rawText, status: 'TRANSCRIBED', durationSeconds },
    });

    return { recordingId: recording.id, rawText: recording.rawText, durationSeconds };
  },

  async list() {
    if (env.MOCK_MODE) return MOCK_RECORDINGS;
    const recordings = await prisma.recording.findMany({ orderBy: { createdAt: 'desc' } });
    return recordings;
  },
};

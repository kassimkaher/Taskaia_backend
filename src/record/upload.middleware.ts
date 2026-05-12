import { Request } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { AppError } from '../common/types/app-error.js';

const allowedMimeTypes = [
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
];

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(
      'INVALID_FILE_TYPE',
      `Invalid file type: ${file.mimetype}. Allowed: ${allowedMimeTypes.join(', ')}`,
      415,
    ));
  }
};

export const uploadAudio = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter,
}).single('audio');

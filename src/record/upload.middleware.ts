import { Request } from 'express';
import multer, { FileFilterCallback } from 'multer';

const allowedMimeTypes = [
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/m4a',
  'audio/x-m4a',
];

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedMimeTypes.join(', ')}`));
  }
};

export const uploadAudio = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter,
}).single('audio');

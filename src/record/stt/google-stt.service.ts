import { AppError } from '../../common/types/app-error.js';

export async function transcribeWithGoogle(_filePath: string, _apiKey: string): Promise<string> {
  throw new AppError('STT_NOT_CONFIGURED', 'Google Cloud STT integration is not yet implemented', 501);
}

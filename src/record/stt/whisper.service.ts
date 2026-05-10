import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { AppError } from '../../common/types/app-error.js';

export async function transcribeWithWhisper(filePath: string, apiKey: string, originalName = 'recording.m4a'): Promise<string> {
  if (!apiKey) {
    throw new AppError('STT_NOT_CONFIGURED', 'OpenAI API key is required for Whisper transcription', 400);
  }
  const ext = originalName.split('.').pop() || 'm4a';
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), { filename: `recording.${ext}`, contentType: `audio/${ext}` });
  form.append('model', 'whisper-1');

  const { data } = await axios.post<{ text: string }>(
    'https://api.openai.com/v1/audio/transcriptions',
    form,
    { headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}` } },
  );
  return data.text;
}

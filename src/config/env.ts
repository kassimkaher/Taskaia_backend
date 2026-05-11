import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MOCK_MODE: z.string().transform(v => v !== 'false').default('true'),
  STT_PROVIDER: z.enum(['whisper', 'google', 'groq']).default('groq'),
  OPENAI_API_KEY: z.string().optional().default(''),
  GROQ_API_KEY: z.string().optional().default(''),
  TRELLO_API_KEY: z.string().optional().default(''),
  TRELLO_TOKEN: z.string().optional().default(''),
  TRELLO_BOARD_ID: z.string().optional().default(''),
  TRELLO_LIST_ID: z.string().optional().default(''),
  // Jira host is shared across the team; per-user fields (email, API token,
  // project key, board id) are entered from the mobile Settings screen.
  JIRA_HOST: z.string().optional().default('starsphere-iq.atlassian.net'),
  TASK_PROVIDER: z.enum(['trello', 'jira']).default('trello'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

import { z } from 'zod';

export const updateSettingsSchema = z.object({
  provider: z.enum(['trello', 'jira']).optional(),
  // Trello
  trelloApiKey: z.string().optional(),
  trelloToken: z.string().optional(),
  trelloBoardId: z.string().optional(),
  trelloListId: z.string().optional(),
  // Jira
  jiraHost: z.string().optional(),
  jiraEmail: z.string().optional(),
  jiraApiToken: z.string().optional(),
  jiraProjectKey: z.string().optional(),
  jiraBoardId: z.string().optional(),
  autoSend: z.boolean().default(false),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

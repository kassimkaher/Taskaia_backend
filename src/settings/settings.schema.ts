import { z } from 'zod';

export const updateSettingsSchema = z.object({
  trelloApiKey: z.string().min(1),
  trelloToken: z.string().min(1),
  trelloBoardId: z.string().min(1),
  trelloListId: z.string().min(1),
  autoSend: z.boolean().default(false),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

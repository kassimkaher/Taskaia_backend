import axios from 'axios';
import { prisma } from '../config/database.js';
import { settingsService } from '../settings/settings.service.js';
import { AppError } from '../common/types/app-error.js';
import { env } from '../config/env.js';

interface LabelHint { id: string; name: string; color: string; }
interface MemberHint { id: string; fullName: string; username: string; }

interface SummarizeResult {
  summary: string;
  suggestedLabelIds: string[];
  suggestedMemberIds: string[];
}

const MOCK_SUMMARIZE_RESPONSE = {
  recordingId: 'rec_a1b2c3d4',
  summary: 'Set up authentication module with token expiry handling and automatic retry logic for refresh tokens.',
  suggestedLabelIds: [] as string[],
  suggestedMemberIds: [] as string[],
};

async function summarizeWithLLM(
  rawText: string,
  apiKey: string,
  provider: string,
  labels: LabelHint[],
  members: MemberHint[],
): Promise<SummarizeResult> {
  const isGroq = provider === 'groq';
  const url = isGroq
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const model = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

  const labelsSection = labels.length > 0
    ? `Available labels (id → name):\n${labels.map(l => `  ${l.id} → "${l.name || l.color}"`).join('\n')}`
    : 'No labels available.';

  const membersSection = members.length > 0
    ? `Available members (id → name):\n${members.map(m => `  ${m.id} → "${m.fullName || m.username}"`).join('\n')}`
    : 'No members available.';

  const systemPrompt = `You are a productivity assistant that turns voice note transcripts into Trello tasks.

Respond with ONLY a valid JSON object — no markdown, no extra text — in this exact shape:
{
  "summary": "<one concise actionable sentence using an imperative verb>",
  "suggestedLabelIds": ["<id>", ...],
  "suggestedMemberIds": ["<id>", ...]
}

Rules:
- summary: one sentence, specific and actionable, suitable for a Trello card title
- suggestedLabelIds: IDs of labels relevant to the task context ([] if none fit)
- suggestedMemberIds: IDs of members mentioned or implied in the transcript ([] if none fit)
- Only use IDs from the lists below — never invent IDs

${labelsSection}

${membersSection}`;

  const { data } = await axios.post<{ choices: Array<{ message: { content: string } }> }>(
    url,
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: rawText },
      ],
      max_tokens: 300,
      response_format: { type: 'json_object' },
    },
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );

  const raw = data.choices[0].message.content.trim();
  try {
    const parsed = JSON.parse(raw);
    const validLabelIds = new Set(labels.map(l => l.id));
    const validMemberIds = new Set(members.map(m => m.id));

    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : raw,
      suggestedLabelIds: Array.isArray(parsed.suggestedLabelIds)
        ? parsed.suggestedLabelIds.filter((id: unknown) => typeof id === 'string' && validLabelIds.has(id))
        : [],
      suggestedMemberIds: Array.isArray(parsed.suggestedMemberIds)
        ? parsed.suggestedMemberIds.filter((id: unknown) => typeof id === 'string' && validMemberIds.has(id))
        : [],
    };
  } catch {
    return { summary: raw, suggestedLabelIds: [], suggestedMemberIds: [] };
  }
}

export const notionService = {
  async summarize(
    recordingId: string,
    rawText: string,
    labels: LabelHint[] = [],
    members: MemberHint[] = [],
  ) {
    if (env.MOCK_MODE) {
      return { ...MOCK_SUMMARIZE_RESPONSE, recordingId };
    }

    const store = settingsService.getStore();
    if (!store.sttApiKey) {
      throw new AppError('STT_NOT_CONFIGURED', 'API key is required for summarization', 400);
    }

    const result = await summarizeWithLLM(rawText, store.sttApiKey, store.sttProvider, labels, members);

    await prisma.recording.update({
      where: { id: recordingId },
      data: { summary: result.summary, status: 'SUMMARIZED' },
    });

    return {
      recordingId,
      summary: result.summary,
      suggestedLabelIds: result.suggestedLabelIds,
      suggestedMemberIds: result.suggestedMemberIds,
    };
  },
};

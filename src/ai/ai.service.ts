import axios from 'axios';
import { AppError } from '../common/types/app-error.js';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { settingsService } from '../settings/settings.service.js';

export type ExtractProvider = 'trello' | 'jira';

export interface TrelloLabelHint { id: string; name: string; color: string; }
export interface TrelloMemberHint { id: string; fullName: string; username: string; }
export interface TrelloListHint { id: string; name: string; }

export interface JiraProjectHint { key: string; name: string; }
export interface JiraUserHint { accountId: string; displayName: string; emailAddress?: string; }
export interface JiraLabelHint { name: string; }
export interface JiraSprintHint { id: number; name: string; state: string; }
export interface JiraIssueTypeHint { id: string; name: string; }

export interface ExtractContext {
  provider: ExtractProvider;
  trello?: {
    labels: TrelloLabelHint[];
    members: TrelloMemberHint[];
    lists: TrelloListHint[];
  };
  jira?: {
    projects: JiraProjectHint[];
    users: JiraUserHint[];
    labels: JiraLabelHint[];
    sprints: JiraSprintHint[];
    issueTypes: JiraIssueTypeHint[];
    defaultProjectKey?: string;
  };
}

export interface StructuredExtraction {
  title: string;
  description: string;
  type: string;
  // Trello fields (null when provider = jira)
  suggestedListId: string | null;
  suggestedLabelIds: string[];
  suggestedMemberIds: string[];
  // Jira fields (null when provider = trello)
  suggestedProjectKey: string | null;
  suggestedSprintId: number | null;
  suggestedAssigneeAccountId: string | null;
  suggestedLabelNames: string[];
  suggestedIssueTypeName: string | null;
  // Legacy single-string summary (back-compat for clients still on the old shape)
  summary: string;
}

const EMPTY_EXTRACTION: StructuredExtraction = {
  title: '',
  description: '',
  type: 'task',
  suggestedListId: null,
  suggestedLabelIds: [],
  suggestedMemberIds: [],
  suggestedProjectKey: null,
  suggestedSprintId: null,
  suggestedAssigneeAccountId: null,
  suggestedLabelNames: [],
  suggestedIssueTypeName: null,
  summary: '',
};

const buildSystemPrompt = (ctx: ExtractContext) => {
  const lines: string[] = [];
  lines.push('You are a productivity assistant that turns voice-note transcripts into structured tasks.');
  lines.push('The transcript may be Arabic, English, or mixed Arabic/English. Understand all languages and dialectal Arabic when extracting fields.');
  lines.push('');
  lines.push('Respond with ONLY a valid JSON object — no markdown fences, no extra prose.');
  lines.push('');

  if (ctx.provider === 'trello') {
    lines.push('Schema (Trello):');
    lines.push('{');
    lines.push('  "title": "<short imperative title>",');
    lines.push('  "description": "<one or two sentences with the action items>",');
    lines.push('  "type": "task | bug | feature | chore",');
    lines.push('  "listId": "<id from the lists below or null>",');
    lines.push('  "labelIds": ["<id>", ...],');
    lines.push('  "memberIds": ["<id>", ...]');
    lines.push('}');
    lines.push('');
    lines.push('- Use ONLY ids from the catalogs below. Never invent ids. If unsure, use null or [].');
    lines.push('- Write title and description in the same main language as the transcript. If the transcript is mixed, keep natural mixed language.');
    lines.push('- title must be a single imperative sentence (e.g. "Add OAuth login" or "أصلح تسجيل الدخول").');
    lines.push('- description should expand on the title with concrete details from the transcript.');

    const t = ctx.trello;
    lines.push('');
    lines.push(`Lists (id → name):${t?.lists.length ? '' : ' (none)'}`);
    for (const l of t?.lists ?? []) lines.push(`  ${l.id} → "${l.name}"`);
    lines.push(`Labels (id → name):${t?.labels.length ? '' : ' (none)'}`);
    for (const l of t?.labels ?? []) lines.push(`  ${l.id} → "${l.name || l.color}"`);
    lines.push(`Members (id → name):${t?.members.length ? '' : ' (none)'}`);
    for (const m of t?.members ?? []) lines.push(`  ${m.id} → "${m.fullName || m.username}"`);
  } else {
    lines.push('Schema (Jira):');
    lines.push('{');
    lines.push('  "title": "<short imperative title>",');
    lines.push('  "description": "<one or two sentences with the action items>",');
    lines.push('  "type": "task | bug | story | epic",');
    lines.push('  "projectKey": "<key from the projects below or null>",');
    lines.push('  "issueTypeName": "<name from the issue types below or null>",');
    lines.push('  "assigneeAccountId": "<accountId from the users below or null>",');
    lines.push('  "sprintId": <id from the sprints below or null>,');
    lines.push('  "labels": ["<label name>", ...]');
    lines.push('}');
    lines.push('');
    lines.push('- Use ONLY values from the catalogs below. Never invent ids/names. If unsure, use null or [].');
    lines.push('- Choose projectKey by matching the transcript to a project key, project acronym, spoken letters, transliteration, translation, or project name.');
    lines.push('- If the transcript clearly mentions a project, that mentioned project wins over the default project.');
    lines.push('- Arabic examples: "خلل" or "مشكلة" usually means Bug, "مهمة" usually means Task, "قصة" usually means Story.');
    lines.push('- Match assignee on the displayName, including Arabic/English transliterations; if unknown, return null.');
    lines.push('- Sprint should default to the active sprint when the transcript implies "this sprint", "السبرنت الحالي", or "هذا السبرنت".');
    lines.push('- Write title and description in the same main language as the transcript. If the transcript is mixed, keep natural mixed language.');
    lines.push('- title must be a single imperative sentence; description should expand on it.');

    const j = ctx.jira;
    lines.push('');
    if (j?.defaultProjectKey) {
      lines.push(`Default project key (use this when ambiguous): ${j.defaultProjectKey}`);
    }
    lines.push(`Projects (key → name):${j?.projects.length ? '' : ' (none)'}`);
    for (const p of j?.projects ?? []) lines.push(`  ${p.key} → "${p.name}"`);
    lines.push(`Issue types (name):${j?.issueTypes.length ? '' : ' (none)'}`);
    for (const t of j?.issueTypes ?? []) lines.push(`  - ${t.name}`);
    lines.push(`Users (accountId → displayName):${j?.users.length ? '' : ' (none)'}`);
    for (const u of j?.users ?? []) lines.push(`  ${u.accountId} → "${u.displayName}"`);
    lines.push(`Sprints (id → name [state]):${j?.sprints.length ? '' : ' (none)'}`);
    for (const s of j?.sprints ?? []) lines.push(`  ${s.id} → "${s.name}" [${s.state}]`);
    lines.push(`Labels:${j?.labels.length ? '' : ' (none)'}`);
    for (const l of j?.labels ?? []) lines.push(`  - ${l.name}`);
  }

  return lines.join('\n');
};

const callLLM = async (
  systemPrompt: string,
  rawText: string,
  apiKey: string,
  provider: string,
): Promise<unknown> => {
  const isGroq = provider === 'groq';
  const url = isGroq
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const model = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

  const { data } = await axios.post<{ choices: Array<{ message: { content: string } }> }>(
    url,
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: rawText },
      ],
      max_tokens: 600,
      response_format: { type: 'json_object' },
    },
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );

  const raw = data.choices[0]?.message?.content?.trim() ?? '';
  try {
    return JSON.parse(raw);
  } catch {
    return { title: raw };
  }
};

const validateString = (v: unknown): string => (typeof v === 'string' ? v : '');
const validateStringArray = (v: unknown, valid: Set<string>): string[] =>
  Array.isArray(v)
    ? v.filter((id): id is string => typeof id === 'string' && valid.has(id))
    : [];
const validateLabelNames = (v: unknown, valid: Set<string>): string[] =>
  Array.isArray(v)
    ? v.filter((s): s is string => typeof s === 'string' && (valid.size === 0 || valid.has(s)))
    : [];

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeText = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const containsNormalizedPhrase = (haystack: string, needle: string): boolean => {
  if (!haystack || !needle) return false;
  return ` ${haystack} `.includes(` ${needle} `);
};

const LETTER_SPOKEN_FORMS: Record<string, string[]> = {
  a: ['a', 'ay', 'اي', 'اى', 'ايه', 'الف'],
  b: ['b', 'bee', 'بي', 'باء'],
  c: ['c', 'see', 'سي'],
  d: ['d', 'dee', 'دي', 'دال'],
  e: ['e', 'ee', 'اي', 'ايه'],
  f: ['f', 'ef', 'اف', 'فاء'],
  g: ['g', 'gee', 'جي', 'جيم'],
  h: ['h', 'aitch', 'اتش', 'اش', 'هاء'],
  i: ['i', 'eye', 'اي', 'اى'],
  j: ['j', 'jay', 'جيه', 'جاي'],
  k: ['k', 'kay', 'كي', 'كاي', 'كاف'],
  l: ['l', 'el', 'ال', 'لام'],
  m: ['m', 'em', 'ام', 'ميم'],
  n: ['n', 'en', 'ان', 'نون'],
  o: ['o', 'oh', 'او', 'واو'],
  p: ['p', 'pee', 'بي', 'پي'],
  q: ['q', 'cue', 'queue', 'كيو', 'قاف'],
  r: ['r', 'ar', 'ار', 'راء'],
  s: ['s', 'ess', 'اس', 'سين'],
  t: ['t', 'tee', 'تي', 'تاء'],
  u: ['u', 'you', 'يو'],
  v: ['v', 'vee', 'في', 'ڤي'],
  w: ['w', 'double u', 'دبليو', 'دبل يو'],
  x: ['x', 'ex', 'اكس'],
  y: ['y', 'why', 'واي', 'ياي'],
  z: ['z', 'zed', 'zee', 'زد', 'زي'],
};

const buildSpokenKeyVariants = (key: string): string[] => {
  const letters = key.toLowerCase().split('').filter(ch => /[a-z0-9]/.test(ch));
  if (letters.length === 0) return [];

  const variants: string[] = [key, letters.join(' '), letters.join('')];
  const spokenMatrix = letters.map(letter => LETTER_SPOKEN_FORMS[letter] ?? [letter]);
  const maxCombinations = spokenMatrix.reduce((total, forms) => total * forms.length, 1);
  if (maxCombinations <= 250) {
    const combine = (index: number, parts: string[]) => {
      if (index === spokenMatrix.length) {
        variants.push(parts.join(' '));
        return;
      }
      for (const form of spokenMatrix[index]) combine(index + 1, [...parts, form]);
    };
    combine(0, []);
  }
  return variants;
};

const inferProjectKeyFromText = (
  rawText: string,
  projects: JiraProjectHint[],
): string | null => {
  const normalizedRaw = normalizeText(rawText);
  if (!normalizedRaw || projects.length === 0) return null;

  for (const project of projects) {
    const normalizedName = normalizeText(project.name);
    if (containsNormalizedPhrase(normalizedRaw, normalizedName)) {
      return project.key;
    }
  }

  for (const project of projects) {
    const key = project.key.trim();
    if (key.length >= 3) {
      const keyPattern = new RegExp(`(^|[^\p{L}\p{N}])${escapeRegExp(key)}([^\p{L}\p{N}]|$)`, 'iu');
      if (keyPattern.test(rawText)) return project.key;

      for (const variant of buildSpokenKeyVariants(key)) {
        if (containsNormalizedPhrase(normalizedRaw, normalizeText(variant))) {
          return project.key;
        }
      }
    }
  }

  return null;
};

const inferAssigneeFromText = (
  rawText: string,
  users: JiraUserHint[],
): string | null => {
  if (!rawText || users.length === 0) return null;
  const normalizedRaw = normalizeText(rawText);

  // Full display-name match (e.g. "Ahmad Al-Hassan")
  for (const user of users) {
    const normalizedName = normalizeText(user.displayName);
    if (normalizedName.length >= 3 && containsNormalizedPhrase(normalizedRaw, normalizedName)) {
      return user.accountId;
    }
  }

  // Email-prefix match (e.g. "john" from "john@company.com")
  for (const user of users) {
    if (!user.emailAddress) continue;
    const prefix = normalizeText(user.emailAddress.split('@')[0]);
    if (prefix.length >= 3 && containsNormalizedPhrase(normalizedRaw, prefix)) {
      return user.accountId;
    }
  }

  return null;
};

const inferIssueTypeNameFromText = (
  rawText: string,
  issueTypes: JiraIssueTypeHint[],
): string | null => {
  const normalizedRaw = normalizeText(rawText);
  const aliasesByType: Record<string, string[]> = {
    bug: ['bug', 'defect', 'issue', 'error', 'خلل', 'خطا', 'مشكله', 'عطل', 'بك', 'بگ'],
    task: ['task', 'todo', 'work item', 'مهمه', 'عمل', 'تاسك'],
    story: ['story', 'user story', 'قصه', 'يوزر ستوري'],
    epic: ['epic', 'ملحمه', 'ابك'],
    feature: ['feature', 'enhancement', 'ميزه', 'خاصيه', 'تحسين'],
    chore: ['chore', 'maintenance', 'صيانه'],
  };

  for (const issueType of issueTypes) {
    const normalizedName = normalizeText(issueType.name);
    if (containsNormalizedPhrase(normalizedRaw, normalizedName)) {
      return issueType.name;
    }
  }

  for (const issueType of issueTypes) {
    const aliases = aliasesByType[normalizeText(issueType.name)] ?? [];
    if (aliases.some(alias => containsNormalizedPhrase(normalizedRaw, normalizeText(alias)))) {
      return issueType.name;
    }
  }

  return null;
};

const parseExtraction = (
  parsed: unknown,
  ctx: ExtractContext,
  rawText: string,
): StructuredExtraction => {
  const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  const title = validateString(obj.title) || validateString(obj.summary);
  const description = validateString(obj.description);
  const type = validateString(obj.type) || 'task';

  if (ctx.provider === 'trello') {
    const validLists = new Set(ctx.trello?.lists.map(l => l.id) ?? []);
    const validLabels = new Set(ctx.trello?.labels.map(l => l.id) ?? []);
    const validMembers = new Set(ctx.trello?.members.map(m => m.id) ?? []);
    const listId = validateString(obj.listId);
    return {
      title,
      description,
      type,
      suggestedListId: validLists.has(listId) ? listId : null,
      suggestedLabelIds: validateStringArray(obj.labelIds, validLabels),
      suggestedMemberIds: validateStringArray(obj.memberIds, validMembers),
      suggestedProjectKey: null,
      suggestedSprintId: null,
      suggestedAssigneeAccountId: null,
      suggestedLabelNames: [],
      suggestedIssueTypeName: null,
      summary: title || description,
    };
  }

  const validProjectKeys = new Set(ctx.jira?.projects.map(p => p.key) ?? []);
  const validUsers = new Set(ctx.jira?.users.map(u => u.accountId) ?? []);
  const validIssueTypes = new Set((ctx.jira?.issueTypes ?? []).map(t => t.name));
  const validSprints = new Set((ctx.jira?.sprints ?? []).map(s => s.id));
  const validLabels = new Set((ctx.jira?.labels ?? []).map(l => l.name));

  const inferredProjectKey = inferProjectKeyFromText(rawText, ctx.jira?.projects ?? []);
  const projectKey = inferredProjectKey ?? validateString(obj.projectKey);

  // 1. Try text-based name matching against the raw transcript
  const inferredAssigneeId = inferAssigneeFromText(rawText, ctx.jira?.users ?? []);
  // 2. LLM may have returned a display name instead of the opaque accountId — reverse-map it
  const llmAssigneeRaw = validateString(obj.assigneeAccountId);
  const assigneeByDisplayName = !validUsers.has(llmAssigneeRaw) && llmAssigneeRaw
    ? (ctx.jira?.users ?? []).find(u => normalizeText(u.displayName) === normalizeText(llmAssigneeRaw))?.accountId ?? null
    : null;
  // Priority: text inference > valid LLM accountId > reverse-mapped display name
  const assigneeAccountId =
    inferredAssigneeId ??
    (validUsers.has(llmAssigneeRaw) ? llmAssigneeRaw : null) ??
    assigneeByDisplayName;

  const issueTypeName =
    inferIssueTypeNameFromText(rawText, ctx.jira?.issueTypes ?? []) ??
    validateString(obj.issueTypeName);
  const sprintRaw = obj.sprintId;
  const sprintId =
    typeof sprintRaw === 'number' && validSprints.has(sprintRaw)
      ? sprintRaw
      : null;

  return {
    title,
    description,
    type,
    suggestedListId: null,
    suggestedLabelIds: [],
    suggestedMemberIds: [],
    suggestedProjectKey: validProjectKeys.has(projectKey) ? projectKey : null,
    suggestedSprintId: sprintId,
    suggestedAssigneeAccountId: assigneeAccountId ?? null,
    suggestedLabelNames: validateLabelNames(obj.labels, validLabels),
    suggestedIssueTypeName: validIssueTypes.has(issueTypeName) ? issueTypeName : null,
    summary: title || description,
  };
};

const buildMockExtraction = (
  rawText: string,
  ctx: ExtractContext,
): StructuredExtraction => {
  const title = rawText.slice(0, 60).split('.')[0].trim() || 'Capture voice note as a task';
  const description = rawText.length > title.length ? rawText : `${title}.`;
  if (ctx.provider === 'trello') {
    return {
      title,
      description,
      type: 'task',
      suggestedListId: ctx.trello?.lists[0]?.id ?? null,
      suggestedLabelIds: [],
      suggestedMemberIds: [],
      suggestedProjectKey: null,
      suggestedSprintId: null,
      suggestedAssigneeAccountId: null,
      suggestedLabelNames: [],
      suggestedIssueTypeName: null,
      summary: title,
    };
  }
  const activeSprint = ctx.jira?.sprints.find(s => s.state === 'active') ?? null;
  const inferredProjectKey = inferProjectKeyFromText(rawText, ctx.jira?.projects ?? []);
  return {
    title,
    description,
    type: 'task',
    suggestedListId: null,
    suggestedLabelIds: [],
    suggestedMemberIds: [],
    suggestedProjectKey: inferredProjectKey,
    suggestedSprintId: activeSprint?.id ?? null,
    suggestedAssigneeAccountId: null,
    suggestedLabelNames: [],
    suggestedIssueTypeName: 'Task',
    summary: title,
  };
};

export const aiService = {
  async extract(
    recordingId: string,
    rawText: string,
    context: ExtractContext,
  ): Promise<StructuredExtraction & { recordingId: string; rawText: string }> {
    if (env.MOCK_MODE) {
      const mock = buildMockExtraction(rawText, context);
      return { recordingId, rawText, ...mock };
    }

    const store = settingsService.getStore();
    if (!store.sttApiKey) {
      throw new AppError('STT_NOT_CONFIGURED', 'API key is required for summarization', 400);
    }

    const systemPrompt = buildSystemPrompt(context);
    let extraction = EMPTY_EXTRACTION;
    try {
      const parsed = await callLLM(systemPrompt, rawText, store.sttApiKey, store.sttProvider);
      extraction = parseExtraction(parsed, context, rawText);
    } catch {
      extraction = buildMockExtraction(rawText, context);
    }

    if (!extraction.title && !extraction.description) {
      extraction = { ...extraction, ...buildMockExtraction(rawText, context) };
    }

    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        summary: extraction.summary || extraction.title,
        status: 'SUMMARIZED',
      },
    }).catch(() => undefined);

    return { recordingId, rawText, ...extraction };
  },
};

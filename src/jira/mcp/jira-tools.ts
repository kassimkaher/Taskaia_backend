import axios, { AxiosRequestConfig } from 'axios';
import { AppError } from '../../common/types/app-error.js';
import { settingsService } from '../../settings/settings.service.js';

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  active: boolean;
}

export interface JiraLabel {
  name: string;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: string;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: 'active' | 'closed' | 'future';
  boardId: number;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description?: string;
  subtask: boolean;
}

export interface JiraIssue {
  id: string;
  key: string;
  title: string;
  description: string;
  url: string;
  status: string;
  issueType: string;
  projectKey: string;
  assignee: JiraUser | null;
  labels: string[];
  sprintId: number | null;
  sprintName: string | null;
  createdAt: string;
}

interface CreateIssueInput {
  projectKey: string;
  summary: string;
  description: string;
  issueTypeName?: string;
  assigneeAccountId?: string | null;
  labels?: string[];
  sprintId?: number | null;
}

const requireJira = () => {
  const store = settingsService.getStore();
  if (!store.jiraHost || !store.jiraEmail || !store.jiraApiToken) {
    throw new AppError(
      'JIRA_NOT_CONFIGURED',
      'Jira host, email, and API token must be configured',
      400,
    );
  }
  return store;
};

const jiraRequest = (
  store: ReturnType<typeof requireJira>,
  path: string,
  options: AxiosRequestConfig = {},
) => {
  const baseUrl = `https://${store.jiraHost.replace(/^https?:\/\//, '')}`;
  return axios({
    url: `${baseUrl}${path}`,
    auth: { username: store.jiraEmail, password: store.jiraApiToken },
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
};

const adfFromText = (text: string) => ({
  type: 'doc',
  version: 1,
  content: [
    {
      type: 'paragraph',
      content: text ? [{ type: 'text', text }] : [],
    },
  ],
});

const flattenAdf = (doc: unknown): string => {
  if (!doc || typeof doc !== 'object') return '';
  const node = doc as { type?: string; text?: string; content?: unknown[] };
  if (node.type === 'text' && typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) {
    return node.content.map(flattenAdf).join(node.type === 'paragraph' ? '' : '\n');
  }
  return '';
};

export async function getJiraProjects(): Promise<JiraProject[]> {
  const store = requireJira();
  const { data } = await jiraRequest(store, '/rest/api/3/project/search?maxResults=50', {
    method: 'GET',
  });
  const values = Array.isArray(data?.values) ? data.values : [];
  return values.map((p: any) => ({ id: p.id, key: p.key, name: p.name }));
}

export async function getJiraBoards(projectKeyOrId?: string): Promise<JiraBoard[]> {
  const store = requireJira();
  let path = '/rest/agile/1.0/board?maxResults=50';
  if (projectKeyOrId) {
    path += `&projectKeyOrId=${encodeURIComponent(projectKeyOrId)}`;
  }
  const { data } = await jiraRequest(store, path, { method: 'GET' });
  const values = Array.isArray(data?.values) ? data.values : [];
  return values.map((b: any) => ({
    id: Number(b.id),
    name: b.name,
    type: b.type || 'scrum',
  }));
}

export async function getJiraIssueTypes(projectKey: string): Promise<JiraIssueType[]> {
  const store = requireJira();
  const { data } = await jiraRequest(
    store,
    `/rest/api/3/issuetype/project?projectId=${encodeURIComponent(projectKey)}`,
    { method: 'GET' },
  ).catch(async () => {
    const fallback = await jiraRequest(store, '/rest/api/3/issuetype', { method: 'GET' });
    return fallback;
  });
  const list = Array.isArray(data) ? data : [];
  return list.map((t: any) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    subtask: Boolean(t.subtask),
  }));
}

export async function getJiraProjectUsers(projectKey: string): Promise<JiraUser[]> {
  const store = requireJira();
  const { data } = await jiraRequest(
    store,
    `/rest/api/3/user/assignable/search?project=${encodeURIComponent(projectKey)}&maxResults=50`,
    { method: 'GET' },
  );
  const list = Array.isArray(data) ? data : [];
  return list
    .filter((u: any) => u.active !== false && !u.accountType?.includes('app'))
    .map((u: any) => ({
      accountId: u.accountId,
      displayName: u.displayName || u.emailAddress || u.accountId,
      emailAddress: u.emailAddress,
      active: Boolean(u.active),
    }));
}

export async function getJiraProjectLabels(projectKey: string): Promise<JiraLabel[]> {
  const store = requireJira();
  // Jira labels are global; we surface the labels currently used in the project.
  const jql = `project = "${projectKey}" AND labels is not EMPTY`;
  const { data } = await jiraRequest(store, `/rest/api/3/search`, {
    method: 'POST',
    data: {
      jql,
      maxResults: 100,
      fields: ['labels'],
    },
  }).catch(() => ({ data: { issues: [] } }));
  const set = new Set<string>();
  for (const issue of data.issues ?? []) {
    for (const label of issue.fields?.labels ?? []) set.add(label);
  }
  return Array.from(set).sort().map(name => ({ name }));
}

export async function getJiraActiveSprints(boardId: string | number): Promise<JiraSprint[]> {
  const store = requireJira();
  if (!boardId) return [];
  const { data } = await jiraRequest(
    store,
    `/rest/agile/1.0/board/${encodeURIComponent(String(boardId))}/sprint?state=active,future`,
    { method: 'GET' },
  ).catch(() => ({ data: { values: [] } }));
  const list = Array.isArray(data?.values) ? data.values : [];
  return list.map((s: any) => ({
    id: Number(s.id),
    name: s.name,
    state: s.state,
    boardId: Number(s.originBoardId ?? boardId),
  }));
}

export async function addJiraIssue(input: CreateIssueInput) {
  const store = requireJira();

  const fields: Record<string, unknown> = {
    project: { key: input.projectKey },
    summary: input.summary,
    description: adfFromText(input.description),
    issuetype: { name: input.issueTypeName || 'Task' },
  };
  if (input.assigneeAccountId) fields.assignee = { accountId: input.assigneeAccountId };
  if (input.labels && input.labels.length > 0) fields.labels = input.labels;

  const { data } = await jiraRequest(store, '/rest/api/3/issue', {
    method: 'POST',
    data: { fields },
  });

  // Optionally move the issue into the chosen sprint (Agile API).
  if (input.sprintId) {
    await jiraRequest(store, `/rest/agile/1.0/sprint/${input.sprintId}/issue`, {
      method: 'POST',
      data: { issues: [data.key] },
    }).catch(() => undefined);
  }

  const baseUrl = `https://${store.jiraHost.replace(/^https?:\/\//, '')}`;
  return {
    issueId: data.id as string,
    issueKey: data.key as string,
    issueUrl: `${baseUrl}/browse/${data.key}`,
    projectKey: input.projectKey,
  };
}

export async function getJiraIssues(
  projectKey: string,
  sprintId?: number | null,
): Promise<JiraIssue[]> {
  const store = requireJira();
  const jqlParts: string[] = [`project = "${projectKey}"`];
  if (sprintId) jqlParts.push(`sprint = ${sprintId}`);
  const jql = jqlParts.join(' AND ') + ' ORDER BY updated DESC';

  const { data } = await jiraRequest(store, '/rest/api/3/search', {
    method: 'POST',
    data: {
      jql,
      maxResults: 50,
      fields: [
        'summary', 'description', 'status', 'issuetype',
        'assignee', 'labels', 'created', 'updated',
        'customfield_10020', // common Cloud sprint field
      ],
    },
  });

  const baseUrl = `https://${store.jiraHost.replace(/^https?:\/\//, '')}`;
  const issues = Array.isArray(data?.issues) ? data.issues : [];

  return issues.map((i: any): JiraIssue => {
    const sprintField = i.fields?.customfield_10020;
    const sprint = Array.isArray(sprintField) && sprintField.length > 0 ? sprintField[0] : null;
    const assignee = i.fields?.assignee;
    return {
      id: i.id,
      key: i.key,
      title: i.fields?.summary || '',
      description: flattenAdf(i.fields?.description),
      url: `${baseUrl}/browse/${i.key}`,
      status: i.fields?.status?.name || '',
      issueType: i.fields?.issuetype?.name || '',
      projectKey,
      assignee: assignee
        ? {
            accountId: assignee.accountId,
            displayName: assignee.displayName || assignee.emailAddress || assignee.accountId,
            emailAddress: assignee.emailAddress,
            active: Boolean(assignee.active),
          }
        : null,
      labels: Array.isArray(i.fields?.labels) ? i.fields.labels : [],
      sprintId: sprint?.id ? Number(sprint.id) : null,
      sprintName: sprint?.name ?? null,
      createdAt: i.fields?.created || new Date().toISOString(),
    };
  });
}

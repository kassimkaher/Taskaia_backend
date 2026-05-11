import { AppError } from '../common/types/app-error.js';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { settingsService } from '../settings/settings.service.js';
import {
    addJiraIssue,
    getJiraActiveSprints,
    getJiraBoards,
    getJiraIssues,
    getJiraIssueTypes,
    getJiraProjectLabels,
    getJiraProjects,
    getJiraProjectUsers,
    getJiraWorkspaceUsers,
} from './mcp/jira-tools.js';

const MOCK_PROJECTS = [
  { id: '10000', key: 'TASK', name: 'Taskaia Mobile' },
  { id: '10001', key: 'BACK', name: 'Taskaia Backend' },
  { id: '10002', key: 'OPS', name: 'Operations' },
];

const MOCK_BOARDS = [
  { id: 1, name: 'Taskaia Mobile Sprint Board', type: 'scrum' },
  { id: 2, name: 'Taskaia Kanban Board', type: 'kanban' },
  { id: 3, name: 'Operations Board', type: 'scrum' },
];

const MOCK_USERS = [
  { accountId: 'acc_alice', displayName: 'Alice Smith', emailAddress: 'alice@example.com', active: true },
  { accountId: 'acc_bob', displayName: 'Bob Jones', emailAddress: 'bob@example.com', active: true },
  { accountId: 'acc_carol', displayName: 'Carol Lee', emailAddress: 'carol@example.com', active: true },
];

const MOCK_LABELS = [
  { name: 'bug' },
  { name: 'frontend' },
  { name: 'backend' },
  { name: 'urgent' },
  { name: 'mobile' },
];

const MOCK_SPRINTS = [
  { id: 401, name: 'Sprint 12 — Voice2Board', state: 'active', boardId: 1 },
  { id: 402, name: 'Sprint 13 — Jira Onboarding', state: 'future', boardId: 1 },
];

const MOCK_ISSUE_TYPES = [
  { id: '10001', name: 'Task', description: 'A piece of work', subtask: false },
  { id: '10002', name: 'Bug', description: 'A defect', subtask: false },
  { id: '10003', name: 'Story', description: 'A user story', subtask: false },
  { id: '10004', name: 'Epic', description: 'A large body of work', subtask: false },
];

const MOCK_ISSUES = [
  {
    id: '10100', key: 'TASK-1',
    title: 'Design provider selection screen',
    description: 'First-launch picker for Trello vs Jira.',
    url: 'https://example.atlassian.net/browse/TASK-1',
    status: 'In Progress', issueType: 'Story',
    projectKey: 'TASK',
    assignee: MOCK_USERS[0],
    labels: ['frontend', 'mobile'],
    sprintId: 401, sprintName: 'Sprint 12 — Voice2Board',
    createdAt: new Date().toISOString(),
  },
  {
    id: '10101', key: 'TASK-2',
    title: 'Add Jira backend endpoints',
    description: 'Mirror the Trello service for Jira Cloud.',
    url: 'https://example.atlassian.net/browse/TASK-2',
    status: 'To Do', issueType: 'Task',
    projectKey: 'TASK',
    assignee: MOCK_USERS[1],
    labels: ['backend'],
    sprintId: 401, sprintName: 'Sprint 12 — Voice2Board',
    createdAt: new Date().toISOString(),
  },
];

const MOCK_CREATE_RESPONSE = {
  issueId: '10999',
  issueKey: 'TASK-99',
  issueUrl: 'https://example.atlassian.net/browse/TASK-99',
  projectKey: 'TASK',
};

const requireConfigured = () => {
  if (!settingsService.isJiraReady()) {
    throw new AppError('JIRA_NOT_CONFIGURED', 'Jira credentials and project key must be configured', 400);
  }
};

const requireBasicAuth = () => {
  const store = settingsService.getStore();
  if (!store.jiraHost || !store.jiraEmail || !store.jiraApiToken) {
    throw new AppError('JIRA_NOT_CONFIGURED', 'Jira host, email, and API token are required', 400);
  }
};

export const jiraService = {
  async getProjects() {
    if (env.MOCK_MODE) return MOCK_PROJECTS;
    requireBasicAuth(); // Only need basic auth, not full config
    return getJiraProjects();
  },

  async getBoards(projectKey?: string) {
    if (env.MOCK_MODE) return MOCK_BOARDS;
    requireBasicAuth(); // Only need basic auth, not full config
    return getJiraBoards(projectKey);
  },

  async getProjectUsers(projectKey?: string) {
    const key = projectKey || settingsService.getStore().jiraProjectKey;
    if (env.MOCK_MODE) return MOCK_USERS;
    requireConfigured();
    if (!key) throw new AppError('JIRA_NOT_CONFIGURED', 'Project key required', 400);
    return getJiraProjectUsers(key);
  },

  async getWorkspaceUsers(projectKeys: string[]) {
    if (env.MOCK_MODE) return MOCK_USERS;
    requireBasicAuth();
    return getJiraWorkspaceUsers(projectKeys);
  },

  async getProjectLabels(projectKey?: string) {
    const key = projectKey || settingsService.getStore().jiraProjectKey;
    if (env.MOCK_MODE) return MOCK_LABELS;
    requireConfigured();
    if (!key) throw new AppError('JIRA_NOT_CONFIGURED', 'Project key required', 400);
    return getJiraProjectLabels(key);
  },

  async getActiveSprints(boardId?: string | number) {
    const id = boardId ?? settingsService.getStore().jiraBoardId;
    if (env.MOCK_MODE) return MOCK_SPRINTS;
    requireConfigured();
    if (!id) return [];
    return getJiraActiveSprints(id);
  },

  async getIssueTypes(projectKey?: string) {
    const key = projectKey || settingsService.getStore().jiraProjectKey;
    if (env.MOCK_MODE) return MOCK_ISSUE_TYPES;
    requireConfigured();
    if (!key) throw new AppError('JIRA_NOT_CONFIGURED', 'Project key required', 400);
    return getJiraIssueTypes(key);
  },

  async createIssue(input: {
    title: string;
    description: string;
    projectKey?: string;
    issueTypeName?: string;
    assigneeAccountId?: string | null;
    labels?: string[];
    sprintId?: number | null;
    recordingId?: string;
  }) {
    if (env.MOCK_MODE) return MOCK_CREATE_RESPONSE;
    requireConfigured();
    const store = settingsService.getStore();
    const projectKey = input.projectKey || store.jiraProjectKey;
    if (!projectKey) throw new AppError('JIRA_NOT_CONFIGURED', 'Jira project key is required', 400);

    const result = await addJiraIssue({
      projectKey,
      summary: input.title,
      description: input.description,
      issueTypeName: input.issueTypeName,
      assigneeAccountId: input.assigneeAccountId ?? null,
      labels: input.labels,
      sprintId: input.sprintId ?? null,
    });

    if (input.recordingId) {
      await prisma.recording.update({
        where: { id: input.recordingId },
        data: {
          trelloCardId: result.issueKey,
          trelloCardUrl: result.issueUrl,
          status: 'COMPLETED',
        },
      }).catch(() => undefined);
    }
    return result;
  },

  async getIssues(opts: { projectKey?: string; sprintId?: number | null } = {}) {
    if (env.MOCK_MODE) {
      const filtered = opts.sprintId
        ? MOCK_ISSUES.filter(i => i.sprintId === opts.sprintId)
        : MOCK_ISSUES;
      const projectKey = opts.projectKey;
      return projectKey ? filtered.filter(i => i.projectKey === projectKey) : filtered;
    }
    requireConfigured();
    const projectKey = opts.projectKey || settingsService.getStore().jiraProjectKey;
    if (!projectKey) throw new AppError('JIRA_NOT_CONFIGURED', 'Jira project key is required', 400);
    return getJiraIssues(projectKey, opts.sprintId ?? null);
  },
};

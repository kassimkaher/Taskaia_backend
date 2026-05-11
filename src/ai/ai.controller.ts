import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { apiError, success } from '../common/utils/response.js';
import { jiraService } from '../jira/jira.service.js';
import { settingsService } from '../settings/settings.service.js';
import { trelloService } from '../trello/trello.service.js';
import { aiService, ExtractContext, ExtractProvider } from './ai.service.js';

const trelloLabelSchema = z.object({ id: z.string(), name: z.string(), color: z.string() });
const trelloMemberSchema = z.object({ id: z.string(), fullName: z.string(), username: z.string() });
const trelloListSchema = z.object({ id: z.string(), name: z.string() });

const jiraProjectSchema = z.object({ key: z.string(), name: z.string() });
const jiraUserSchema = z.object({
  accountId: z.string(),
  displayName: z.string(),
  emailAddress: z.string().optional(),
});
const jiraLabelSchema = z.object({ name: z.string() });
const jiraSprintSchema = z.object({ id: z.number(), name: z.string(), state: z.string() });
const jiraIssueTypeSchema = z.object({ id: z.string(), name: z.string() });

const extractSchema = z.object({
  recordingId: z.string().min(1),
  rawText: z.string().min(1),
  provider: z.enum(['trello', 'jira']).optional(),
  // Optional pre-fetched context. When omitted, the backend fetches it.
  trello: z.object({
    labels: z.array(trelloLabelSchema).optional(),
    members: z.array(trelloMemberSchema).optional(),
    lists: z.array(trelloListSchema).optional(),
  }).optional(),
  jira: z.object({
    projects: z.array(jiraProjectSchema).optional(),
    users: z.array(jiraUserSchema).optional(),
    labels: z.array(jiraLabelSchema).optional(),
    sprints: z.array(jiraSprintSchema).optional(),
    issueTypes: z.array(jiraIssueTypeSchema).optional(),
  }).optional(),
});

const buildContext = async (
  provider: ExtractProvider,
  payload: z.infer<typeof extractSchema>,
): Promise<ExtractContext> => {
  if (provider === 'trello') {
    const lists = payload.trello?.lists ?? (await trelloService.getLists().catch(() => []));
    const labels =
      payload.trello?.labels ??
      (await trelloService.getLabels().catch(() => []));
    const members =
      payload.trello?.members ??
      (await trelloService.getMembers().catch(() => []));
    return {
      provider: 'trello',
      trello: {
        lists,
        labels: labels.map(l => ({ id: l.id, name: l.name, color: l.color })),
        members: members.map(m => ({ id: m.id, fullName: m.fullName, username: m.username })),
      },
    };
  }

  const projects =
    payload.jira?.projects ?? (await jiraService.getProjects().catch(() => []));
  const users =
    payload.jira?.users ?? (await jiraService.getProjectUsers().catch(() => []));
  const labels =
    payload.jira?.labels ?? (await jiraService.getProjectLabels().catch(() => []));
  const sprints =
    payload.jira?.sprints ?? (await jiraService.getActiveSprints().catch(() => []));
  const issueTypes =
    payload.jira?.issueTypes ?? (await jiraService.getIssueTypes().catch(() => []));

  return {
    provider: 'jira',
    jira: {
      projects: projects.map(p => ({ key: p.key, name: p.name })),
      users: users.map(u => ({
        accountId: u.accountId,
        displayName: u.displayName,
        emailAddress: u.emailAddress,
      })),
      labels: labels.map(l => ({ name: l.name })),
      sprints: sprints.map(s => ({ id: s.id, name: s.name, state: s.state })),
      issueTypes: issueTypes.map(t => ({ id: t.id, name: t.name })),
    },
  };
};

export const aiController = {
  async extract(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = extractSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json(apiError('VALIDATION_ERROR', parsed.error.message));
      }
      const provider: ExtractProvider =
        parsed.data.provider ?? settingsService.getStore().provider;

      const context = await buildContext(provider, parsed.data);
      const data = await aiService.extract(
        parsed.data.recordingId,
        parsed.data.rawText,
        context,
      );
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  },
};

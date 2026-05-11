import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { apiError, success } from '../common/utils/response.js';
import { jiraService } from './jira.service.js';

const createIssueSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  projectKey: z.string().optional(),
  issueTypeName: z.string().optional(),
  assigneeAccountId: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
  sprintId: z.number().nullable().optional(),
  recordingId: z.string().optional(),
});

export const jiraController = {
  async createIssue(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createIssueSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json(apiError('VALIDATION_ERROR', parsed.error.message));
      }
      const data = await jiraService.createIssue(parsed.data);
      res.json(success(data, 'Task added to Jira successfully'));
    } catch (err) { next(err); }
  },

  async getIssues(req: Request, res: Response, next: NextFunction) {
    try {
      const projectKey = typeof req.query['projectKey'] === 'string' ? req.query['projectKey'] : undefined;
      const sprintRaw = req.query['sprintId'];
      const sprintId = typeof sprintRaw === 'string' && sprintRaw.length > 0
        ? Number(sprintRaw)
        : undefined;
      const issues = await jiraService.getIssues({ projectKey, sprintId });
      res.json(success({ issues, total: issues.length }));
    } catch (err) { next(err); }
  },

  async getProjects(_req: Request, res: Response, next: NextFunction) {
    try {
      const projects = await jiraService.getProjects();
      res.json(success({ projects }));
    } catch (err) { next(err); }
  },

  async getBoards(req: Request, res: Response, next: NextFunction) {
    try {
      const projectKey = typeof req.query['projectKey'] === 'string' ? req.query['projectKey'] : undefined;
      const boards = await jiraService.getBoards(projectKey);
      res.json(success({ boards }));
    } catch (err) { next(err); }
  },

  async getMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const projectKey = typeof req.query['projectKey'] === 'string' ? req.query['projectKey'] : undefined;
      const users = await jiraService.getProjectUsers(projectKey);
      res.json(success({ users }));
    } catch (err) { next(err); }
  },

  async getLabels(req: Request, res: Response, next: NextFunction) {
    try {
      const projectKey = typeof req.query['projectKey'] === 'string' ? req.query['projectKey'] : undefined;
      const labels = await jiraService.getProjectLabels(projectKey);
      res.json(success({ labels }));
    } catch (err) { next(err); }
  },

  async getSprints(req: Request, res: Response, next: NextFunction) {
    try {
      const boardId = typeof req.query['boardId'] === 'string' ? req.query['boardId'] : undefined;
      const sprints = await jiraService.getActiveSprints(boardId);
      res.json(success({ sprints }));
    } catch (err) { next(err); }
  },

  async getIssueTypes(req: Request, res: Response, next: NextFunction) {
    try {
      const projectKey = typeof req.query['projectKey'] === 'string' ? req.query['projectKey'] : undefined;
      const issueTypes = await jiraService.getIssueTypes(projectKey);
      res.json(success({ issueTypes }));
    } catch (err) { next(err); }
  },
};

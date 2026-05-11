import { Router } from 'express';
import { jiraController } from './jira.controller.js';

export const jiraRoutes = Router();

jiraRoutes.post('/issue', jiraController.createIssue);
jiraRoutes.get('/issues', jiraController.getIssues);
jiraRoutes.get('/projects', jiraController.getProjects);
jiraRoutes.get('/boards', jiraController.getBoards);
jiraRoutes.get('/members', jiraController.getMembers);
jiraRoutes.get('/labels', jiraController.getLabels);
jiraRoutes.get('/sprints', jiraController.getSprints);
jiraRoutes.get('/issue-types', jiraController.getIssueTypes);

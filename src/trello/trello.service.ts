import { prisma } from '../config/database.js';
import { settingsService } from '../settings/settings.service.js';
import { addTrelloCard, getTrelloCards, getTrelloLists, getTrelloLabels, getTrelloMembers, getTrelloCardDetail, addTrelloComment, moveTrelloCard } from './mcp/trello-tools.js';
import { AppError } from '../common/types/app-error.js';
import { env } from '../config/env.js';

const MOCK_CARDS = [
  { id: 'trello_card_001', title: 'Set up authentication module with token expiry handling', description: 'Action item from voice recording — 2026-04-24.\n\nImplement JWT-based auth with automatic token refresh.', url: 'https://trello.com/c/ABCDEFGH/1-set-up-authentication-module', shortUrl: 'https://trello.com/c/ABCDEFGH', listId: 'list_xyz789', listName: 'To-Do', boardId: 'board_abc123', createdAt: '2026-04-24T10:30:00.000Z', labels: [], members: [] },
  { id: 'trello_card_002', title: 'Design the onboarding flow for new users', description: 'Action item from voice recording — 2026-04-23.\n\nCreate a 3-step onboarding that explains the pipeline.', url: 'https://trello.com/c/BCDEFGHI/2-design-the-onboarding-flow', shortUrl: 'https://trello.com/c/BCDEFGHI', listId: 'list_xyz789', listName: 'To-Do', boardId: 'board_abc123', createdAt: '2026-04-23T14:15:00.000Z', labels: [], members: [] },
  { id: 'trello_card_003', title: 'Write unit tests for the recording pipeline', description: 'Action item from voice recording — 2026-04-22.\n\nCover STT upload, AI extraction, and Trello/Jira integrations.', url: 'https://trello.com/c/CDEFGHIJ/3-write-unit-tests', shortUrl: 'https://trello.com/c/CDEFGHIJ', listId: 'list_xyz789', listName: 'To-Do', boardId: 'board_abc123', createdAt: '2026-04-22T09:45:00.000Z', labels: [], members: [] },
  { id: 'trello_card_004', title: 'Set up CI/CD pipeline with GitHub Actions', description: 'Action item from voice recording — 2026-04-21.', url: 'https://trello.com/c/DEFGHIJK/4-set-up-ci-cd', shortUrl: 'https://trello.com/c/DEFGHIJK', listId: 'list_abc111', listName: 'In Progress', boardId: 'board_abc123', createdAt: '2026-04-21T16:20:00.000Z', labels: [], members: [] },
  { id: 'trello_card_005', title: 'Add offline recording support with queued sync', description: 'Action item from voice recording — 2026-04-20.', url: 'https://trello.com/c/EFGHIJKL/5-add-offline-recording', shortUrl: 'https://trello.com/c/EFGHIJKL', listId: 'list_xyz789', listName: 'To-Do', boardId: 'board_abc123', createdAt: '2026-04-20T11:00:00.000Z', labels: [], members: [] },
];

const MOCK_CREATE_RESPONSE = {
  cardId: 'trello_card_001',
  cardUrl: 'https://trello.com/c/ABCDEFGH/1-set-up-authentication-module',
  shortUrl: 'https://trello.com/c/ABCDEFGH',
  listName: 'To-Do',
  boardName: 'My Project Board',
};

const MOCK_LISTS = [
  { id: 'list_xyz789', name: 'To-Do' },
  { id: 'list_abc111', name: 'In Progress' },
  { id: 'list_def222', name: 'QA' },
  { id: 'list_ghi333', name: 'Done' },
];

const MOCK_LABELS = [
  { id: 'label_001', name: 'Bug', color: 'red' },
  { id: 'label_002', name: 'Feature', color: 'blue' },
  { id: 'label_003', name: 'Enhancement', color: 'green' },
  { id: 'label_004', name: 'Urgent', color: 'orange' },
];

const MOCK_MEMBERS = [
  { id: 'member_001', fullName: 'Alice Smith', username: 'asmith' },
  { id: 'member_002', fullName: 'Bob Jones', username: 'bjones' },
];

export const trelloService = {
  async createCard(
    title: string,
    description: string,
    recordingId?: string,
    labelIds?: string[],
    memberIds?: string[],
    listId?: string,
  ) {
    if (env.MOCK_MODE) return MOCK_CREATE_RESPONSE;

    const store = settingsService.getStore();
    if (!store.trelloApiKey || !store.trelloToken || !store.trelloBoardId || !store.trelloListId) {
      throw new AppError('TRELLO_NOT_CONFIGURED', 'Trello credentials and board/list must be configured', 400);
    }

    const result = await addTrelloCard({ title, description, labelIds, memberIds, listId });

    if (recordingId) {
      await prisma.recording.update({
        where: { id: recordingId },
        data: { trelloCardId: result.cardId, trelloCardUrl: result.cardUrl, status: 'COMPLETED' },
      });
    }
    return result;
  },

  async getCards(listId?: string) {
    if (env.MOCK_MODE) {
      if (listId) return MOCK_CARDS.filter(c => c.listId === listId);
      return MOCK_CARDS;
    }

    const store = settingsService.getStore();
    if (!store.trelloApiKey || !store.trelloToken || !store.trelloBoardId) {
      throw new AppError('TRELLO_NOT_CONFIGURED', 'Trello credentials and board must be configured', 400);
    }
    return getTrelloCards(listId);
  },

  async getLists() {
    if (env.MOCK_MODE) return MOCK_LISTS;

    const store = settingsService.getStore();
    if (!store.trelloApiKey || !store.trelloToken || !store.trelloBoardId) {
      throw new AppError('TRELLO_NOT_CONFIGURED', 'Trello credentials and board must be configured', 400);
    }
    return getTrelloLists();
  },

  async getLabels() {
    if (env.MOCK_MODE) return MOCK_LABELS;

    const store = settingsService.getStore();
    if (!store.trelloApiKey || !store.trelloToken || !store.trelloBoardId) {
      throw new AppError('TRELLO_NOT_CONFIGURED', 'Trello credentials and board must be configured', 400);
    }
    return getTrelloLabels();
  },

  async getMembers() {
    if (env.MOCK_MODE) return MOCK_MEMBERS;

    const store = settingsService.getStore();
    if (!store.trelloApiKey || !store.trelloToken || !store.trelloBoardId) {
      throw new AppError('TRELLO_NOT_CONFIGURED', 'Trello credentials and board must be configured', 400);
    }
    return getTrelloMembers();
  },

  async getCardDetail(cardId: string) {
    if (env.MOCK_MODE) {
      return {
        card: MOCK_CARDS[0],
        comments: [
          { id: 'c1', text: 'Looking into this now.', date: new Date().toISOString(), memberCreator: { id: 'member_001', fullName: 'Alice Smith', username: 'asmith' } },
        ],
      };
    }
    const store = settingsService.getStore();
    if (!store.trelloApiKey || !store.trelloToken) {
      throw new AppError('TRELLO_NOT_CONFIGURED', 'Trello credentials must be configured', 400);
    }
    return getTrelloCardDetail(cardId);
  },

  async addComment(cardId: string, text: string) {
    if (env.MOCK_MODE) {
      return { id: `c_${Date.now()}`, text, date: new Date().toISOString(), memberCreator: { id: 'member_001', fullName: 'Alice Smith', username: 'asmith' } };
    }
    const store = settingsService.getStore();
    if (!store.trelloApiKey || !store.trelloToken) {
      throw new AppError('TRELLO_NOT_CONFIGURED', 'Trello credentials must be configured', 400);
    }
    return addTrelloComment(cardId, text);
  },

  async moveCard(cardId: string, listId: string) {
    if (env.MOCK_MODE) return { listId, listName: 'New List' };
    const store = settingsService.getStore();
    if (!store.trelloApiKey || !store.trelloToken) {
      throw new AppError('TRELLO_NOT_CONFIGURED', 'Trello credentials must be configured', 400);
    }
    return moveTrelloCard(cardId, listId);
  },
};

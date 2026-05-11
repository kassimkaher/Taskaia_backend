import axios from 'axios';
import { AppError } from '../common/types/app-error.js';
import { env } from '../config/env.js';
import { UpdateSettingsInput } from './settings.schema.js';

export type TaskProvider = 'trello' | 'jira';

interface SettingsStore {
  sttProvider: string;
  sttApiKey: string;
  provider: TaskProvider;
  // Trello
  trelloApiKey: string;
  trelloToken: string;
  trelloBoardId: string;
  trelloListId: string;
  trelloBoardName: string;
  trelloListName: string;
  // Jira
  jiraHost: string;
  jiraEmail: string;
  jiraApiToken: string;
  jiraProjectKey: string;
  jiraBoardId: string;
  jiraProjectName: string;
  autoSend: boolean;
}

const store: SettingsStore = {
  sttProvider: env.STT_PROVIDER,
  sttApiKey: env.STT_PROVIDER === 'groq' ? env.GROQ_API_KEY : env.OPENAI_API_KEY,
  provider: env.TASK_PROVIDER,
  trelloApiKey: env.TRELLO_API_KEY,
  trelloToken: env.TRELLO_TOKEN,
  trelloBoardId: env.TRELLO_BOARD_ID,
  trelloListId: env.TRELLO_LIST_ID,
  trelloBoardName: '',
  trelloListName: '',
  jiraHost: env.JIRA_HOST,
  jiraEmail: '',
  jiraApiToken: '',
  jiraProjectKey: '',
  jiraBoardId: '',
  jiraProjectName: '',
  autoSend: false,
};

const trelloReady = () =>
  Boolean(store.trelloApiKey && store.trelloToken && store.trelloBoardId && store.trelloListId);

const jiraReady = () =>
  Boolean(store.jiraHost && store.jiraEmail && store.jiraApiToken);

export const settingsService = {
  getSettings() {
    const activeReady = store.provider === 'jira' ? jiraReady() : trelloReady();
    return {
      provider: store.provider,
      configured: {
        stt: Boolean(store.sttApiKey),
        trello: trelloReady(),
        jira: jiraReady(),
        active: activeReady,
        allReady: Boolean(store.sttApiKey && activeReady),
      },
      sttProvider: store.sttProvider,
      trelloApiKey: store.trelloApiKey || null,
      trelloToken: store.trelloToken || null,
      trelloBoardId: store.trelloBoardId || null,
      trelloBoardName: store.trelloBoardName || null,
      trelloListId: store.trelloListId || null,
      trelloListName: store.trelloListName || null,
      jiraHost: store.jiraHost || null,
      jiraEmail: store.jiraEmail || null,
      jiraApiToken: store.jiraApiToken || null,
      jiraProjectKey: store.jiraProjectKey || null,
      jiraProjectName: store.jiraProjectName || null,
      jiraBoardId: store.jiraBoardId || null,
      autoSend: store.autoSend,
    };
  },

  async saveSettings(input: UpdateSettingsInput) {
    console.log('[Settings] Saving settings:', JSON.stringify(input, null, 2));
    const next: Partial<SettingsStore> = { autoSend: input.autoSend };
    if (input.provider) next.provider = input.provider;
    if (input.trelloApiKey !== undefined) next.trelloApiKey = input.trelloApiKey;
    if (input.trelloToken !== undefined) next.trelloToken = input.trelloToken;
    if (input.trelloBoardId !== undefined) next.trelloBoardId = input.trelloBoardId;
    if (input.trelloListId !== undefined) next.trelloListId = input.trelloListId;
    if (input.jiraHost !== undefined) next.jiraHost = input.jiraHost;
    if (input.jiraEmail !== undefined) next.jiraEmail = input.jiraEmail;
    if (input.jiraApiToken !== undefined) next.jiraApiToken = input.jiraApiToken;
    if (input.jiraProjectKey !== undefined) next.jiraProjectKey = input.jiraProjectKey;
    if (input.jiraBoardId !== undefined) next.jiraBoardId = input.jiraBoardId;
    Object.assign(store, next);
    console.log('[Settings] Saved to store:', JSON.stringify(this.getSettings(), null, 2));
    return this.getSettings();
  },

  async getTrelloBoards() {
    if (env.MOCK_MODE) {
      return [
        { id: 'board_abc123', name: 'My Project Board' },
        { id: 'board_def456', name: 'Personal Tasks' },
        { id: 'board_ghi789', name: 'Design Sprint' },
      ];
    }
    if (!store.trelloApiKey || !store.trelloToken) {
      throw new AppError('TRELLO_NOT_CONFIGURED', 'Trello API key and token are required', 400);
    }
    const { data } = await axios.get('https://api.trello.com/1/members/me/boards', {
      params: { key: store.trelloApiKey, token: store.trelloToken, fields: 'id,name' },
    });
    return (data as Array<{ id: string; name: string }>).map(b => ({ id: b.id, name: b.name }));
  },

  async getTrelloLists(boardId: string) {
    if (env.MOCK_MODE) {
      return [
        { id: 'list_xyz789', name: 'To-Do' },
        { id: 'list_abc111', name: 'In Progress' },
        { id: 'list_abc222', name: 'Review' },
        { id: 'list_abc333', name: 'Done' },
      ];
    }
    if (!store.trelloApiKey || !store.trelloToken) {
      throw new AppError('TRELLO_NOT_CONFIGURED', 'Trello API key and token are required', 400);
    }
    const { data } = await axios.get(`https://api.trello.com/1/boards/${boardId}/lists`, {
      params: { key: store.trelloApiKey, token: store.trelloToken, fields: 'id,name' },
    });
    return (data as Array<{ id: string; name: string }>).map(l => ({ id: l.id, name: l.name }));
  },

  getStore: () => store,
  isTrelloReady: trelloReady,
  isJiraReady: jiraReady,
};

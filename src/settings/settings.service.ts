import axios from 'axios';
import { UpdateSettingsInput } from './settings.schema.js';
import { AppError } from '../common/types/app-error.js';
import { env } from '../config/env.js';

interface SettingsStore {
  sttProvider: string;
  sttApiKey: string;
  trelloApiKey: string;
  trelloToken: string;
  trelloBoardId: string;
  trelloListId: string;
  trelloBoardName: string;
  trelloListName: string;
  autoSend: boolean;
}

const store: SettingsStore = {
  sttProvider: env.STT_PROVIDER,
  sttApiKey: env.STT_PROVIDER === 'groq' ? env.GROQ_API_KEY : env.OPENAI_API_KEY,
  trelloApiKey: env.TRELLO_API_KEY,
  trelloToken: env.TRELLO_TOKEN,
  trelloBoardId: env.TRELLO_BOARD_ID,
  trelloListId: env.TRELLO_LIST_ID,
  trelloBoardName: '',
  trelloListName: '',
  autoSend: false,
};

export const settingsService = {
  getSettings() {
    return {
      configured: {
        stt: Boolean(store.sttApiKey),
        trello: Boolean(store.trelloApiKey && store.trelloToken && store.trelloBoardId && store.trelloListId),
        allReady: Boolean(
          store.sttApiKey &&
          store.trelloApiKey && store.trelloToken && store.trelloBoardId && store.trelloListId,
        ),
      },
      sttProvider: store.sttProvider,
      trelloBoardId: store.trelloBoardId || null,
      trelloBoardName: store.trelloBoardName || null,
      trelloListId: store.trelloListId || null,
      trelloListName: store.trelloListName || null,
      autoSend: store.autoSend,
    };
  },

  async saveSettings(input: UpdateSettingsInput) {
    Object.assign(store, {
      trelloApiKey: input.trelloApiKey,
      trelloToken: input.trelloToken,
      trelloBoardId: input.trelloBoardId,
      trelloListId: input.trelloListId,
      autoSend: input.autoSend,
    });
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
};

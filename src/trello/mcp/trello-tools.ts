import axios from 'axios';
import { settingsService } from '../../settings/settings.service.js';
import { AppError } from '../../common/types/app-error.js';

export interface TrelloCard {
  id: string; title: string; description: string;
  url: string; shortUrl: string; listId: string; listName: string;
  boardId: string; createdAt: string;
  labels: Array<{ id: string; name: string; color: string }>;
  members: Array<{ id: string; fullName: string; username: string }>;
}

interface AddCardInput {
  title: string;
  description: string;
  labelIds?: string[];
  memberIds?: string[];
  listId?: string;
}

export async function addTrelloCard(input: AddCardInput) {
  const store = settingsService.getStore();
  if (!store.trelloApiKey || !store.trelloToken || !store.trelloListId) {
    throw new AppError('TRELLO_NOT_CONFIGURED', 'Trello API key, token, and list ID are required', 400);
  }

  const targetListId = input.listId || store.trelloListId;

  const { data } = await axios.post<{ id: string; url: string; shortUrl: string }>(
    'https://api.trello.com/1/cards',
    null,
    {
      params: {
        key: store.trelloApiKey,
        token: store.trelloToken,
        name: input.title,
        desc: input.description,
        idList: targetListId,
        ...(input.labelIds && input.labelIds.length > 0 ? { idLabels: input.labelIds.join(',') } : {}),
        ...(input.memberIds && input.memberIds.length > 0 ? { idMembers: input.memberIds.join(',') } : {}),
      },
    },
  );

  return {
    cardId: data.id,
    cardUrl: data.url,
    shortUrl: data.shortUrl,
    listName: store.trelloListName || store.trelloListId,
    boardName: store.trelloBoardName || store.trelloBoardId,
  };
}

export async function getTrelloCards(listId?: string): Promise<TrelloCard[]> {
  const store = settingsService.getStore();
  if (!store.trelloApiKey || !store.trelloToken || !store.trelloBoardId) {
    throw new AppError('TRELLO_NOT_CONFIGURED', 'Trello API key, token, and board ID are required', 400);
  }

  if (listId) {
    // Fetch cards for a specific list
    const { data } = await axios.get<Array<{
      id: string; name: string; desc: string; url: string;
      shortUrl: string; idList: string; dateLastActivity: string;
      labels: Array<{ id: string; name: string; color: string }>;
      idMembers: string[];
    }>>(
      `https://api.trello.com/1/lists/${listId}/cards`,
      {
        params: {
          key: store.trelloApiKey,
          token: store.trelloToken,
          fields: 'id,name,desc,url,shortUrl,idList,dateLastActivity,labels,idMembers',
        },
      },
    );

    return data.map(c => ({
      id: c.id,
      title: c.name,
      description: c.desc || '',
      url: c.url,
      shortUrl: c.shortUrl,
      listId: c.idList,
      listName: store.trelloListName || listId,
      boardId: store.trelloBoardId,
      createdAt: c.dateLastActivity || new Date().toISOString(),
      labels: (c.labels || []).map(l => ({ id: l.id, name: l.name || '', color: l.color || '' })),
      members: (c.idMembers || []).map(mid => ({ id: mid, fullName: '', username: '' })),
    }));
  } else {
    // Fetch recent open cards from the board (limit to 50 most recently active)
    const { data: rawCards } = await axios.get<Array<{
      id: string; name: string; desc: string; url: string;
      shortUrl: string; idList: string; dateLastActivity: string;
      labels: Array<{ id: string; name: string; color: string }>;
      idMembers: string[];
    }>>(
      `https://api.trello.com/1/boards/${store.trelloBoardId}/cards/open`,
      {
        params: {
          key: store.trelloApiKey,
          token: store.trelloToken,
          fields: 'id,name,desc,url,shortUrl,idList,dateLastActivity,labels,idMembers',
        },
      },
    );

    const data = rawCards
      .sort((a, b) => new Date(b.dateLastActivity).getTime() - new Date(a.dateLastActivity).getTime())
      .slice(0, 50);

    // Fetch lists to map idList → name
    let listMap: Record<string, string> = {};
    try {
      const { data: lists } = await axios.get<Array<{ id: string; name: string }>>(
        `https://api.trello.com/1/boards/${store.trelloBoardId}/lists`,
        {
          params: {
            key: store.trelloApiKey,
            token: store.trelloToken,
            filter: 'open',
            fields: 'id,name',
          },
        },
      );
      listMap = Object.fromEntries(lists.map(l => [l.id, l.name]));
    } catch {
      // If lists fetch fails, continue with empty map
    }

    return data.map(c => ({
      id: c.id,
      title: c.name,
      description: c.desc || '',
      url: c.url,
      shortUrl: c.shortUrl,
      listId: c.idList,
      listName: listMap[c.idList] || c.idList,
      boardId: store.trelloBoardId,
      createdAt: c.dateLastActivity || new Date().toISOString(),
      labels: (c.labels || []).map(l => ({ id: l.id, name: l.name || '', color: l.color || '' })),
      members: (c.idMembers || []).map(mid => ({ id: mid, fullName: '', username: '' })),
    }));
  }
}

export async function getTrelloLists(): Promise<Array<{ id: string; name: string }>> {
  const store = settingsService.getStore();
  if (!store.trelloApiKey || !store.trelloToken || !store.trelloBoardId) {
    throw new AppError('TRELLO_NOT_CONFIGURED', 'Trello API key, token, and board ID are required', 400);
  }

  const { data } = await axios.get<Array<{ id: string; name: string }>>(
    `https://api.trello.com/1/boards/${store.trelloBoardId}/lists`,
    {
      params: {
        key: store.trelloApiKey,
        token: store.trelloToken,
        filter: 'open',
        fields: 'id,name',
      },
    },
  );

  return data.map(l => ({ id: l.id, name: l.name }));
}

export async function getTrelloLabels(): Promise<Array<{ id: string; name: string; color: string }>> {
  const store = settingsService.getStore();
  if (!store.trelloApiKey || !store.trelloToken || !store.trelloBoardId) {
    throw new AppError('TRELLO_NOT_CONFIGURED', 'Trello API key, token, and board ID are required', 400);
  }

  const { data } = await axios.get<Array<{ id: string; name: string; color: string }>>(
    `https://api.trello.com/1/boards/${store.trelloBoardId}/labels`,
    {
      params: {
        key: store.trelloApiKey,
        token: store.trelloToken,
        fields: 'id,name,color',
      },
    },
  );

  return data.map(l => ({ id: l.id, name: l.name || '', color: l.color || '' }));
}

export async function getTrelloMembers(): Promise<Array<{ id: string; fullName: string; username: string }>> {
  const store = settingsService.getStore();
  if (!store.trelloApiKey || !store.trelloToken || !store.trelloBoardId) {
    throw new AppError('TRELLO_NOT_CONFIGURED', 'Trello API key, token, and board ID are required', 400);
  }

  const { data } = await axios.get<Array<{ id: string; fullName: string; username: string }>>(
    `https://api.trello.com/1/boards/${store.trelloBoardId}/members`,
    {
      params: {
        key: store.trelloApiKey,
        token: store.trelloToken,
        fields: 'id,fullName,username',
      },
    },
  );

  return data.map(m => ({ id: m.id, fullName: m.fullName || '', username: m.username || '' }));
}

export interface TrelloComment {
  id: string;
  text: string;
  date: string;
  memberCreator: { id: string; fullName: string; username: string };
}

export async function getTrelloCardDetail(cardId: string): Promise<{ card: TrelloCard; comments: TrelloComment[] }> {
  const store = settingsService.getStore();
  if (!store.trelloApiKey || !store.trelloToken) {
    throw new AppError('TRELLO_NOT_CONFIGURED', 'Trello credentials are required', 400);
  }
  const [cardResp, actionsResp] = await Promise.all([
    axios.get(`https://api.trello.com/1/cards/${cardId}`, {
      params: {
        key: store.trelloApiKey, token: store.trelloToken,
        fields: 'id,name,desc,url,shortUrl,idList,dateLastActivity,labels,idMembers',
        members: 'true', member_fields: 'id,fullName,username',
      },
    }),
    axios.get(`https://api.trello.com/1/cards/${cardId}/actions`, {
      params: {
        key: store.trelloApiKey, token: store.trelloToken,
        filter: 'commentCard', limit: 50,
      },
    }),
  ]);
  const c = cardResp.data;
  let listName = '';
  try {
    const lr = await axios.get(`https://api.trello.com/1/lists/${c.idList}`, {
      params: { key: store.trelloApiKey, token: store.trelloToken, fields: 'name' },
    });
    listName = lr.data.name;
  } catch { /* ignore */ }
  const card: TrelloCard = {
    id: c.id, title: c.name, description: c.desc || '', url: c.url,
    shortUrl: c.shortUrl, listId: c.idList, listName,
    boardId: store.trelloBoardId, createdAt: c.dateLastActivity || new Date().toISOString(),
    labels: (c.labels || []).map((l: any) => ({ id: l.id, name: l.name || '', color: l.color || '' })),
    members: (c.members || []).map((m: any) => ({ id: m.id, fullName: m.fullName || '', username: m.username || '' })),
  };
  const comments: TrelloComment[] = (actionsResp.data as any[]).map(a => ({
    id: a.id, text: a.data.text, date: a.date,
    memberCreator: { id: a.memberCreator.id, fullName: a.memberCreator.fullName, username: a.memberCreator.username },
  }));
  return { card, comments };
}

export async function addTrelloComment(cardId: string, text: string): Promise<TrelloComment> {
  const store = settingsService.getStore();
  if (!store.trelloApiKey || !store.trelloToken) {
    throw new AppError('TRELLO_NOT_CONFIGURED', 'Trello credentials are required', 400);
  }
  const { data } = await axios.post(
    `https://api.trello.com/1/cards/${cardId}/actions/comments`, null,
    { params: { key: store.trelloApiKey, token: store.trelloToken, text } },
  );
  return {
    id: data.id, text: data.data.text, date: data.date,
    memberCreator: { id: data.memberCreator.id, fullName: data.memberCreator.fullName, username: data.memberCreator.username },
  };
}

export async function moveTrelloCard(cardId: string, listId: string): Promise<{ listId: string; listName: string }> {
  const store = settingsService.getStore();
  if (!store.trelloApiKey || !store.trelloToken) {
    throw new AppError('TRELLO_NOT_CONFIGURED', 'Trello credentials are required', 400);
  }
  await axios.put(`https://api.trello.com/1/cards/${cardId}`, null,
    { params: { key: store.trelloApiKey, token: store.trelloToken, idList: listId } },
  );
  let listName = '';
  try {
    const { data } = await axios.get(`https://api.trello.com/1/lists/${listId}`,
      { params: { key: store.trelloApiKey, token: store.trelloToken, fields: 'name' } });
    listName = data.name;
  } catch { /* ignore */ }
  return { listId, listName };
}

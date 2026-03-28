const AUTH_URL = 'https://functions.poehali.dev/329e9c4a-87bb-4df9-8d46-121037e01228';
const CHATS_URL = 'https://functions.poehali.dev/c50aec7f-cfe1-4fb3-b5fd-9094b0621f2f';
const MESSAGES_URL = 'https://functions.poehali.dev/d9f2534e-232d-40b9-9433-62231aa8b4de';

function getToken(): string {
  return localStorage.getItem('osinting_token') || '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function request(baseUrl: string, path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Auth-Token': token } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
  return data;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    register: (username: string, password: string, name: string, bio: string) =>
      request(AUTH_URL, '/register', { method: 'POST', body: JSON.stringify({ username, password, name, bio }) }),

    login: (username: string, password: string) =>
      request(AUTH_URL, '/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

    logout: () =>
      request(AUTH_URL, '/logout', { method: 'POST' }),

    me: () =>
      request(AUTH_URL, '/me'),

    searchUsers: (q: string) =>
      request(AUTH_URL, `/users?q=${encodeURIComponent(q)}`),

    getUsers: () =>
      request(AUTH_URL, '/users'),

    updateProfile: (name: string, bio: string) =>
      request(AUTH_URL, '/profile', { method: 'PUT', body: JSON.stringify({ name, bio }) }),
  },

  chats: {
    list: () =>
      request(CHATS_URL, '/chats'),

    create: (type: 'personal' | 'group', userId?: string, name?: string, participants?: string[]) =>
      request(CHATS_URL, '/chats', {
        method: 'POST',
        body: JSON.stringify({ type, userId, name, participants }),
      }),

    members: (chatId: string) =>
      request(CHATS_URL, `/chats/${chatId}/members`),

    setTyping: (chatId: string, typing: boolean) =>
      request(CHATS_URL, '/typing', { method: 'POST', body: JSON.stringify({ chatId, typing }) }),

    getTyping: (chatId: string) =>
      request(CHATS_URL, `/typing?chatId=${chatId}`),
  },

  messages: {
    list: (chatId: string, before?: string) =>
      request(MESSAGES_URL, `/messages?chatId=${chatId}${before ? `&before=${before}` : ''}`),

    poll: (chatId: string, since: string) =>
      request(MESSAGES_URL, `/messages/poll?chatId=${chatId}&since=${encodeURIComponent(since)}`),

    globalPoll: (since: string) =>
      request(MESSAGES_URL, `/messages/global-poll?since=${encodeURIComponent(since)}`),

    send: (chatId: string, type: string, text?: string, imageData?: string, voiceDuration?: number, fileName?: string) =>
      request(MESSAGES_URL, '/messages', {
        method: 'POST',
        body: JSON.stringify({ chatId, type, text, imageData, voiceDuration, fileName }),
      }),

    delete: (msgId: string) =>
      request(MESSAGES_URL, `/messages/${msgId}/delete`, { method: 'PUT' }),

    readStatus: (chatId: string) =>
      request(MESSAGES_URL, `/messages/read-status?chatId=${chatId}`),
  },
};
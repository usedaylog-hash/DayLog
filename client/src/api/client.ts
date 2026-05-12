import type { Session, Note } from '../types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  clockIn(): Promise<Session> {
    return request('/sessions/clock-in', { method: 'POST' });
  },

  clockOut(): Promise<Session> {
    return request('/sessions/clock-out', { method: 'POST' });
  },

  getCurrentSession(): Promise<Session | null> {
    return request('/sessions/current');
  },

  getSessions(): Promise<Session[]> {
    return request('/sessions');
  },

  getSession(id: number): Promise<Session> {
    return request(`/sessions/${id}`);
  },

  addNote(content: string): Promise<Note> {
    return request('/notes', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },
};

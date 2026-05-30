import client from './client';

// Auth
export const auth = {
  register: (data: { email: string; password: string; firstName?: string; lastName?: string }) =>
    client.post('/api/auth/register', data),
  login: (data: { email: string; password: string }) =>
    client.post<{ accessToken: string; user: User }>('/api/auth/login', data),
  refresh: () => client.post<{ accessToken: string }>('/api/auth/refresh'),
  logout: () => client.post('/api/auth/logout'),
};

// Events
export const events = {
  list: () => client.get<Event[]>('/api/events'),
  create: (data: { name: string; date: string; location: string; edition?: number }) =>
    client.post<Event>('/api/events', data),
  get: (id: string) => client.get<Event>(`/api/events/${id}`),
  getMyRole: (id: string) => client.get<{ role: Role }>(`/api/events/${id}/my-role`),
  update: (id: string, data: Partial<{ name: string; date: string; location: string; edition: number }>) =>
    client.patch<Event>(`/api/events/${id}`, data),
  setStatus: (id: string, status: EventStatus) =>
    client.patch<Event>(`/api/events/${id}/status`, { status }),
  delete: (id: string) => client.delete(`/api/events/${id}`),
  getPublic: (id: string) => client.get<PublicEvent>(`/api/events/${id}/public`),
  registrationOpen: (id: string) => client.get<{ open: boolean }>(`/api/events/${id}/registration-open`),
};

// Categories
export const categories = {
  list: (eventId: string) => client.get<Category[]>(`/api/events/${eventId}/categories`),
  create: (eventId: string, data: CategoryInput) =>
    client.post<Category>(`/api/events/${eventId}/categories`, data),
  update: (eventId: string, catId: string, data: Partial<CategoryInput>) =>
    client.put<Category>(`/api/events/${eventId}/categories/${catId}`, data),
  delete: (eventId: string, catId: string) =>
    client.delete(`/api/events/${eventId}/categories/${catId}`),
  reorder: (eventId: string, ids: string[]) =>
    client.post(`/api/events/${eventId}/categories/reorder`, { ids }),
  loadTemplate: (eventId: string) =>
    client.post<Category[]>(`/api/events/${eventId}/categories/load-template`),
  saveTemplate: (eventId: string) =>
    client.post<{ ok: boolean; count: number }>(`/api/events/${eventId}/categories/save-template`),
  templatePreview: (eventId: string) =>
    client.get<Array<{ name: string; plotDimensions: string; plotCount: number; categoryType: string; scored: boolean }>>(`/api/events/${eventId}/categories/template-preview`),
};

// Participants
export const participants = {
  list: (eventId: string) => client.get<ParticipantWithEntries[]>(`/api/events/${eventId}/participants`),
  create: (eventId: string, data: ParticipantInput) =>
    client.post<Participant>(`/api/events/${eventId}/participants`, data),
  update: (eventId: string, pid: string, data: Partial<ParticipantInput>) =>
    client.put<ParticipantWithEntries>(`/api/events/${eventId}/participants/${pid}`, data),
  delete: (eventId: string, pid: string) =>
    client.delete(`/api/events/${eventId}/participants/${pid}`),
  makeJudge: (eventId: string, pid: string, data: { email: string; password: string }) =>
    client.post(`/api/events/${eventId}/participants/${pid}/make-judge`, data),
  registerPublic: (eventId: string, data: PublicRegistrationInput) =>
    client.post(`/api/events/${eventId}/register-public`, data),
  search: (q: string) =>
    client.get<Array<{ firstName: string; lastName: string; city: string; dateOfBirth: string | null; email: string | null }>>(`/api/participants/search?q=${encodeURIComponent(q)}`),
};

// Entries
export const entries = {
  list: (eventId: string, catId: string) =>
    client.get<EntryWithParticipant[]>(`/api/events/${eventId}/categories/${catId}/entries`),
  drawAll: (eventId: string, catId: string) =>
    client.post<Entry[]>(`/api/events/${eventId}/categories/${catId}/draw-all`),
  setPlot: (entryId: string, plotNumber: number) =>
    client.patch<Entry>(`/api/entries/${entryId}/plot`, { plotNumber }),
  update: (entryId: string, data: EntryUpdate) =>
    client.patch<Entry>(`/api/entries/${entryId}`, data),
  closeCategory: (eventId: string, catId: string) =>
    client.post(`/api/events/${eventId}/categories/${catId}/close`),
  claim: (entryId: string) =>
    client.post<{ ok: boolean; judges: EntryJudge[] }>(`/api/entries/${entryId}/claim`),
  unclaim: (entryId: string, userId?: string) =>
    client.delete(`/api/entries/${entryId}/claim`, { params: userId ? { userId } : {} }),
  assignJudges: (eventId: string, catId: string) =>
    client.post(`/api/events/${eventId}/categories/${catId}/assign-judges`),
  saveJudgeTime: (entryId: string, data: { centiseconds: number; penalty: number }) =>
    client.post(`/api/entries/${entryId}/save-judge-time`, data),
};

// Teams
export const teams = {
  list: (eventId: string, catId: string) =>
    client.get<Team[]>(`/api/events/${eventId}/categories/${catId}/teams`),
  create: (eventId: string, catId: string, data: { name: string; memberIds?: string[] }) =>
    client.post<Team>(`/api/events/${eventId}/categories/${catId}/teams`, data),
  update: (teamId: string, data: { name?: string; memberIds?: string[] }) =>
    client.put<Team>(`/api/teams/${teamId}`, data),
  updateResult: (teamId: string, data: TeamResultUpdate) =>
    client.patch<Team>(`/api/teams/${teamId}/result`, data),
};

// Users
export const users = {
  list: (eventId: string) => client.get<EventUser[]>(`/api/events/${eventId}/users`),
  invite: (eventId: string, data: { email: string; role: Role }) =>
    client.post<EventUser>(`/api/events/${eventId}/users`, data),
  updateRole: (eventId: string, userId: string, role: Role) =>
    client.patch<EventUser>(`/api/events/${eventId}/users/${userId}`, { role }),
  remove: (eventId: string, userId: string) =>
    client.delete(`/api/events/${eventId}/users/${userId}`),
};

// Export
export const exportApi = {
  participants: (eventId: string) => `/api/events/${eventId}/export/participants`,
  results: (eventId: string) => `/api/events/${eventId}/export/results`,
  categoryResults: (eventId: string, catId: string) => `/api/events/${eventId}/categories/${catId}/export`,
  pdf: (eventId: string) => `/api/events/${eventId}/pdf`,
  sendAnnouncement: (eventId: string) => client.post(`/api/events/${eventId}/send-announcement`),
};

// Public results
export const publicApi = {
  results: (eventId: string) => client.get(`/api/events/${eventId}/results`),
};

// Competitor self-service
export const me = {
  eventStatus: (eventId: string) =>
    client.get<{
      registered: boolean;
      participant?: { firstName: string; lastName: string; entries: Array<{ category: { name: string } }> };
      profile: { firstName: string | null; lastName: string | null; email: string | null; city: string | null; dateOfBirth: string | null } | null;
    }>(`/api/events/${eventId}/me`),
};

// Types
export type EventStatus = 'SETUP' | 'REGISTRATION' | 'DRAW' | 'ACTIVE' | 'CLOSED';
export type Role = 'ADMIN' | 'REGISTRAR' | 'JUDGE' | 'COMPETITOR';
export type CategoryType = 'INDIVIDUAL' | 'TEAM';

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  systemRole: string;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  edition: number | null;
  status: EventStatus;
  createdAt: string;
}

export interface PublicEvent {
  id: string;
  name: string;
  date: string;
  location: string;
  edition: number | null;
  status: EventStatus;
}

export interface Category {
  id: string;
  eventId: string;
  name: string;
  order: number;
  plotDimensions: string;
  plotCount: number;
  scored: boolean;
  categoryType: CategoryType;
}

export interface CategoryInput {
  name: string;
  plotDimensions: string;
  plotCount: number;
  scored?: boolean;
  categoryType?: CategoryType;
}

export interface Participant {
  id: string;
  eventId: string;
  firstName: string;
  lastName: string;
  city: string;
  dateOfBirth: string | null;
  email: string | null;
  emailConsent: boolean;
  createdAt: string;
}

export interface ParticipantWithEntries extends Participant {
  entries: Array<{ id: string; categoryId: string; plotNumber: number | null; category: Category }>;
}

export interface ParticipantInput {
  firstName: string;
  lastName: string;
  city: string;
  dateOfBirth?: string;
  email?: string;
  emailConsent?: boolean;
  categoryId?: string;
}

export interface PublicRegistrationInput {
  firstName: string;
  lastName: string;
  city: string;
  dateOfBirth?: string;
  email?: string;
  emailConsent?: boolean;
  categoryId: string;
}

export interface Entry {
  id: string;
  participantId: string;
  categoryId: string;
  plotNumber: number | null;
  time1: number | null;
  time2: number | null;
  baseTime: number | null;
  penalty: number;
  penaltyNote: string | null;
  dnr: boolean;
  rank: number | null;
  totalTime?: number | null;
}

export interface EntryJudge {
  id: string;
  userId: string;
  user: { id: string; firstName: string | null; lastName: string | null };
  assignedAt: string;
  completedAt: string | null;
  centiseconds: number | null;
}

export interface EntryWithParticipant extends Entry {
  participant: Participant;
  judges: EntryJudge[];
}

export interface EntryUpdate {
  time1?: number;
  time2?: number;
  baseTime?: number | null;
  penalty?: number;
  penaltyNote?: string;
  dnr?: boolean;
}

export interface Team {
  id: string;
  categoryId: string;
  name: string;
  plotNumber: number | null;
  time1: number | null;
  time2: number | null;
  baseTime: number | null;
  penalty: number;
  penaltyNote: string | null;
  rank: number | null;
  members: Array<{ id: string; participantId: string; participant: Participant }>;
}

export interface TeamResultUpdate {
  plotNumber?: number;
  time1?: number;
  time2?: number;
  baseTime?: number | null;
  penalty?: number;
  penaltyNote?: string;
}

export interface EventUser {
  id: string;
  userId: string;
  eventId: string;
  role: Role;
  user: { id: string; email: string; firstName: string | null; lastName: string | null };
}

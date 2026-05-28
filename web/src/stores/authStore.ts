import { create } from 'zustand';
import type { User } from '../api/endpoints';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user }),
  login: (token, user) => set({ accessToken: token, user }),
  logout: () => set({ accessToken: null, user: null }),
}));

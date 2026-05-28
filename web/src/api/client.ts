import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_URL = import.meta.env.VITE_API_URL ?? '';

const client = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

client.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (!refreshing) {
        refreshing = axios
          .post<{ accessToken: string }>(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true })
          .then((r) => {
            useAuthStore.getState().setAccessToken(r.data.accessToken);
            return r.data.accessToken;
          })
          .catch(() => {
            useAuthStore.getState().logout();
            return null;
          })
          .finally(() => {
            refreshing = null;
          });
      }
      const newToken = await refreshing;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      }
    }
    return Promise.reject(error);
  }
);

export default client;

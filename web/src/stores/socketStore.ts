import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL ?? '';

interface SocketState {
  socket: Socket | null;
  connected: boolean;
  connect: (token?: string) => void;
  disconnect: () => void;
  joinEvent: (eventId: string) => void;
  leaveEvent: (eventId: string) => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,

  connect: (token?: string) => {
    if (get().socket) return;
    const socket = io(WS_URL, {
      withCredentials: true,
      auth: token ? { token } : {},
    });
    socket.on('connect', () => set({ connected: true }));
    socket.on('disconnect', () => set({ connected: false }));
    set({ socket });
  },

  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null, connected: false });
  },

  joinEvent: (eventId) => {
    get().socket?.emit('join:event', eventId);
  },

  leaveEvent: (eventId) => {
    get().socket?.emit('leave:event', eventId);
  },
}));

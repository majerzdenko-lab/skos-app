import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';

let io: Server;

export function setupSocket(server: HttpServer): void {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('join:event', (eventId: string) => {
      socket.join(`event:${eventId}`);
    });
    socket.on('leave:event', (eventId: string) => {
      socket.leave(`event:${eventId}`);
    });
  });
}

export function getIo(): Server {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

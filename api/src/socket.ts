import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';

let io: Server;

export function setupSocket(server: HttpServer): void {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Optional auth: verify token from handshake, mark socket as authenticated
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        jwt.verify(token, process.env.JWT_SECRET!);
        socket.data.authenticated = true;
      } catch {
        socket.data.authenticated = false;
      }
    } else {
      socket.data.authenticated = false;
    }
    next();
  });

  io.on('connection', (socket) => {
    socket.on('join:event', (eventId: string) => {
      socket.join(`event:${eventId}`);
      if (socket.data.authenticated) {
        socket.join(`event:${eventId}:auth`);
      }
    });
    socket.on('leave:event', (eventId: string) => {
      socket.leave(`event:${eventId}`);
      socket.leave(`event:${eventId}:auth`);
    });
  });
}

export function getIo(): Server {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

// Emit to all room members (public events: entry:updated, category:closed, event:status)
export function emitToRoom(eventId: string, event: string, data: unknown): void {
  getIo().to(`event:${eventId}`).emit(event, data);
}

// Emit only to authenticated members (sensitive: entry:claimed, entry:unclaimed)
export function emitToAuthRoom(eventId: string, event: string, data: unknown): void {
  getIo().to(`event:${eventId}:auth`).emit(event, data);
}

import { useEffect } from 'react';
import { useSocketStore } from '../stores/socketStore';

export function useEventSocket(
  eventId: string | undefined,
  handlers: {
    onEntryUpdated?: (data: { entryId: string; baseTime: number | null; penalty: number; totalTime: number | null }) => void;
    onEntryDrawn?: (data: { entryId: string; plotNumber: number }) => void;
    onEventStatus?: (data: { status: string }) => void;
    onCategoryClosed?: (data: { categoryId: string; results: unknown[] }) => void;
  }
) {
  const { socket, connect, joinEvent, leaveEvent } = useSocketStore();

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (!eventId || !socket) return;
    joinEvent(eventId);

    if (handlers.onEntryUpdated) socket.on('entry:updated', handlers.onEntryUpdated);
    if (handlers.onEntryDrawn) socket.on('entry:drawn', handlers.onEntryDrawn);
    if (handlers.onEventStatus) socket.on('event:status', handlers.onEventStatus);
    if (handlers.onCategoryClosed) socket.on('category:closed', handlers.onCategoryClosed);

    return () => {
      leaveEvent(eventId);
      socket.off('entry:updated');
      socket.off('entry:drawn');
      socket.off('event:status');
      socket.off('category:closed');
    };
  }, [eventId, socket]);
}

import { useEffect } from 'react';
import { useSocketStore } from '../stores/socketStore';

export function useEventSocket(
  eventId: string | undefined,
  handlers: {
    onEntryUpdated?: (data: { entryId: string; time1?: number | null; time2?: number | null; baseTime: number | null; penalty: number; totalTime: number | null }) => void;
    onEntryDrawn?: (data: { entryId: string; plotNumber: number }) => void;
    onEventStatus?: (data: { status: string }) => void;
    onCategoryClosed?: (data: { categoryId: string; results: unknown[] }) => void;
    onEntryClaimed?: (data: { entryId: string; judge: { id: string; firstName: string | null; lastName: string | null } }) => void;
    onEntryUnclaimed?: (data: { entryId: string; userId: string }) => void;
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
    if (handlers.onEntryClaimed) socket.on('entry:claimed', handlers.onEntryClaimed);
    if (handlers.onEntryUnclaimed) socket.on('entry:unclaimed', handlers.onEntryUnclaimed);

    return () => {
      leaveEvent(eventId);
      socket.off('entry:updated');
      socket.off('entry:drawn');
      socket.off('event:status');
      socket.off('category:closed');
      socket.off('entry:claimed');
      socket.off('entry:unclaimed');
    };
  }, [eventId, socket]);
}

import { useEffect, useRef, useState, useCallback } from 'react';

interface SSEOptions {
  url: string;
  onEvent?: (data: any) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export function useSSE({
  url,
  onEvent,
  onConnected,
  onDisconnected,
  autoReconnect = true,
  reconnectInterval = 3000,
}: SSEOptions) {
  const [connected, setConnected] = useState(false);
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);

  onEventRef.current = onEvent;
  onConnectedRef.current = onConnected;
  onDisconnectedRef.current = onDisconnected;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const token = document.cookie.match(/accessToken=([^;]+)/)?.[1] || '';
    const separator = url.includes('?') ? '&' : '?';
    const es = new EventSource(`${url}${separator}token=${token}`);

    es.onopen = () => {
      setConnected(true);
      onConnectedRef.current?.();
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastEventTime(new Date());
        onEventRef.current?.(data);
      } catch {
        // ignore parse errors for heartbeats
      }
    };

    es.onerror = () => {
      setConnected(false);
      onDisconnectedRef.current?.();
      es.close();
      eventSourceRef.current = null;
      if (autoReconnect) {
        reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
      }
    };

    eventSourceRef.current = es;
  }, [url, autoReconnect, reconnectInterval]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
  }, []);

  return { connected, lastEventTime, disconnect, reconnect: connect };
}

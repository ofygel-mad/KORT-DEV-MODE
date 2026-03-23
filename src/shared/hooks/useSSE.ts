import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/auth';



type SSEOptions = {
  onNotification?: (data: Record<string, any>) => void;
  onConnected?: () => void;
  enabled?: boolean;
};

export function useSSE({ onNotification, onConnected, enabled = true }: SSEOptions = {}) {
  const token = useAuthStore(s => s.token);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (!token || !enabled) return;
    if (esRef.current) esRef.current.close();

    const url = `/api/v1/sse/?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('connected', () => onConnected?.());
    es.addEventListener('notification', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        onNotification?.(data);
      } catch {
        // ignore malformed events
      }
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      reconnectTimer.current = setTimeout(connect, 5000);
    };
  }, [token, enabled, onNotification, onConnected]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);
}

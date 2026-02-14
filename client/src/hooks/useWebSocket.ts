import { useEffect, useRef, useCallback, useState } from 'react';
import type { ClientMessage, ServerMessage } from '../../../shared/src/protocol';

export function useWebSocket(onMessage: (msg: ServerMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      // In dev mode, connect to the server port directly
      const port = import.meta.env.DEV ? '3001' : window.location.port;
      const url = `${protocol}//${host}:${port}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data);
          onMessageRef.current(msg);
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        setConnected(false);
        // Auto-reconnect after 2 seconds
        setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, []);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send, connected };
}

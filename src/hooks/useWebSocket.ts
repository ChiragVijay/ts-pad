import { useEffect, useRef, useState } from "react";

export function useWebSocket(docId: string) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const host = window.location.host;
    const url = `ws://${host}/ws?docId=${docId}`;
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      socketRef.current = null;
    };
  }, [docId]);

  const sendMessage = (message: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  };

  return [isConnected, sendMessage] as const;
}

import { useEffect, useRef, useState } from "react";
import type { Char, RemoteInsertOp } from "server/crdt";

export type WebSocketMessage =
  | { type: "init"; payload: string }
  | { type: "update"; payload: string }
  | { type: "crdt-insert"; payload: RemoteInsertOp }
  | { type: "crdt-delete"; payload: Char };

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

    ws.onmessage = (event) => {
      try {
        const { type, payload } = JSON.parse(event.data);

        switch (type) {
          case "init":
            console.log("Initial state received:", payload);
            break;
          case "update":
            console.log("Remote update received:", payload);
            break;
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };
    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [docId]);

  const sendMessage = (message: WebSocketMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  };

  return [isConnected, sendMessage] as const;
}

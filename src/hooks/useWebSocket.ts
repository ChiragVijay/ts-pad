import { useEffect, useRef, useState } from "react";
import type { Char, CRDTSnapshot, RemoteInsertOp } from "server/crdt";

export interface CursorPosition {
  lineNumber: number;
  column: number;
}

export interface User {
  id: string;
  name: string;
  color: string;
  cursor?: CursorPosition;
}

export type WebSocketMessage =
  | {
      type: "init";
      payload: CRDTSnapshot;
      users: User[];
      language: string;
    }
  | { type: "update"; payload: string }
  | { type: "crdt-insert"; payload: RemoteInsertOp }
  | { type: "crdt-delete"; payload: Char }
  | { type: "user-join"; payload: User }
  | { type: "user-leave"; payload: { id: string } }
  | { type: "user-rename"; payload: User }
  | { type: "client-join"; payload: User }
  | { type: "client-rename"; payload: Pick<User, "id" | "name"> }
  | { type: "language-change"; payload: { language: string } }
  | { type: "client-language"; payload: { language: string } }
  | {
      type: "cursor-update";
      payload: { userId: string; cursor: CursorPosition };
    }
  | { type: "client-cursor"; payload: CursorPosition };

export function useWebSocket(
  docId: string,
  userId: string,
  username: string,
  onmessage?: (msg: WebSocketMessage) => void,
) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const onmessageRef = useRef(onmessage);
  onmessageRef.current = onmessage;

  useEffect(() => {
    const host = window.location.host;
    const url = `ws://${host}/ws?docId=${docId}&userId=${userId}&username=${encodeURIComponent(username)}`;
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => setIsConnected(true);

    ws.onclose = () => setIsConnected(false);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        onmessageRef.current?.(message);
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };
    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [docId, userId]);

  const sendMessage = (message: WebSocketMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  };

  return [isConnected, sendMessage] as const;
}

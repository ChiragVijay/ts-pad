import { useEffect, useRef, useState } from "react";
import type {
  Char,
  CRDTEngine,
  CRDTSnapshotData,
  RemoteInsertOp,
  YjsOperation,
} from "server/crdt/types";

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

export type AnySnapshot = CRDTSnapshotData;
export type InsertPayload = RemoteInsertOp | YjsOperation;
export type DeletePayload = Char | YjsOperation;

export type WebSocketMessage =
  | {
      type: "init";
      payload: AnySnapshot;
      users: User[];
      language: string;
      crdtEngine: CRDTEngine;
    }
  | { type: "crdt-insert"; payload: InsertPayload }
  | { type: "crdt-delete"; payload: DeletePayload }
  | { type: "user-join"; payload: User }
  | { type: "user-leave"; payload: { id: string } }
  | { type: "user-rename"; payload: User }
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
    const ws = new WebSocket(
      `ws://${host}/ws?docId=${docId}&userId=${userId}&username=${encodeURIComponent(username)}`,
    );
    socketRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (event) => {
      try {
        onmessageRef.current?.(JSON.parse(event.data));
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };

    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [docId, userId, username]);

  const sendMessage = (message: WebSocketMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  };

  return [isConnected, sendMessage] as const;
}

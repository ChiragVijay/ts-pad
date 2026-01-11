import { useCallback, useEffect, useRef, useState } from "react";
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

export type ConnectionState = "connecting" | "connected" | "disconnected";

export interface ServerError {
  code: string;
  message: string;
}

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
  | { type: "client-cursor"; payload: CursorPosition }
  | { type: "error"; payload: ServerError };

function getWebSocketUrl(docId: string, userId: string, username: string) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws?docId=${docId}&userId=${userId}&username=${encodeURIComponent(username)}`;
}

export function useWebSocket(
  docId: string,
  userId: string,
  username: string,
  onmessage?: (msg: WebSocketMessage) => void,
) {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [error, setError] = useState<ServerError | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onmessageRef = useRef(onmessage);
  onmessageRef.current = onmessage;

  useEffect(() => {
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      setConnectionState("connecting");

      const ws = new WebSocket(getWebSocketUrl(docId, userId, username));
      wsRef.current = ws;

      ws.onopen = () => {
        retriesRef.current = 0;
        setConnectionState("connected");
      };

      ws.onclose = (e) => {
        if (unmounted) return;
        setConnectionState("disconnected");
        if (wsRef.current) wsRef.current.close();
        wsRef.current = null;

        if (e.code === 1008) return;

        if (retriesRef.current < 5) {
          const delay = 1000 * Math.pow(2, retriesRef.current++);
          timeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data) as WebSocketMessage;
        if (msg.type === "error") setError(msg.payload);
        onmessageRef.current?.(msg);
      };
    };

    connect();

    return () => {
      unmounted = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [docId, userId, username]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { connectionState, error, sendMessage };
}

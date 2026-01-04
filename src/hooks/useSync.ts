import { useCallback, useRef, useState } from "react";
import { CRDT } from "../../server/crdt";
import {
  useWebSocket,
  type CursorPosition,
  type User,
  type WebSocketMessage,
} from "./useWebSocket";

export function useSync(
  docId: string,
  userId: string,
  username: string,
  onRemoteChange?: (type: "insert" | "delete", data: any) => void,
  onInit?: () => void,
  onLanguageChange?: (language: string) => void,
) {
  const crdt = useRef(new CRDT(userId)).current;
  const [users, setUsers] = useState<User[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastCursorSent = useRef<CursorPosition | null>(null);
  const cursorThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMessage = useCallback(
    (msg: WebSocketMessage) => {
      switch (msg.type) {
        case "init":
          crdt.applySnapshot(msg.payload);
          setUsers(msg.users);
          setIsInitialized(true);
          onLanguageChange?.(msg.language);
          onInit?.();
          break;
        case "crdt-insert":
          crdt.remoteInsert(msg.payload);
          onRemoteChange?.("insert", msg.payload);
          break;
        case "crdt-delete": {
          const visibleIndex = crdt.getVisibleIndex(msg.payload.id);
          crdt.remoteDelete(msg.payload.id);
          onRemoteChange?.("delete", { ...msg.payload, visibleIndex });
          break;
        }
        case "user-join":
          setUsers((prev) => [...prev, msg.payload]);
          break;
        case "user-leave":
          setUsers((prev) => prev.filter((u) => u.id !== msg.payload.id));
          break;
        case "user-rename":
          setUsers((prev) =>
            prev.map((u) =>
              u.id === msg.payload.id ? { ...u, name: msg.payload.name } : u,
            ),
          );
          break;
        case "cursor-update":
          setUsers((prev) =>
            prev.map((u) =>
              u.id === msg.payload.userId
                ? { ...u, cursor: msg.payload.cursor }
                : u,
            ),
          );
          break;
        case "language-change":
          onLanguageChange?.(msg.payload.language);
          break;
        default:
          break;
      }
    },
    [onRemoteChange, onInit, onLanguageChange],
  );

  const [isConnected, sendMessage] = useWebSocket(
    docId,
    userId,
    username,
    handleMessage,
  );

  const applyLocalInsert = useCallback(
    (value: string, index: number) => {
      const op = crdt.localInsert(value, index);
      sendMessage({ type: "crdt-insert", payload: op });
    },
    [sendMessage],
  );

  const applyLocalDelete = useCallback(
    (index: number) => {
      const char = crdt.localDelete(index);
      if (char) {
        sendMessage({ type: "crdt-delete", payload: char });
      }
    },
    [sendMessage],
  );

  const renameUser = useCallback(
    (newName: string) => {
      sendMessage({
        type: "client-rename",
        payload: { id: userId, name: newName },
      });
    },
    [sendMessage, userId],
  );

  const changeLanguage = useCallback(
    (language: string) => {
      sendMessage({
        type: "client-language",
        payload: { language },
      });
    },
    [sendMessage],
  );

  const updateCursor = useCallback(
    (cursor: CursorPosition) => {
      if (
        lastCursorSent.current?.lineNumber === cursor.lineNumber &&
        lastCursorSent.current?.column === cursor.column
      ) {
        return;
      }

      if (cursorThrottleRef.current) {
        return;
      }

      lastCursorSent.current = cursor;
      sendMessage({
        type: "client-cursor",
        payload: cursor,
      });

      cursorThrottleRef.current = setTimeout(() => {
        cursorThrottleRef.current = null;
      }, 50);
    },
    [sendMessage],
  );

  return {
    crdt,
    isConnected,
    isInitialized,
    users,
    applyLocalInsert,
    applyLocalDelete,
    renameUser,
    changeLanguage,
    updateCursor,
  };
}

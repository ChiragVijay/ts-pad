import { useCallback, useRef, useState } from "react";
import { CustomCRDTAdapter } from "server/crdt/custom";
import type { CRDTAdapter, CRDTEngine } from "server/crdt/types";
import { YjsCRDTAdapter } from "server/crdt/yjs";
import {
  useWebSocket,
  type CursorPosition,
  type User,
  type WebSocketMessage,
} from "./useWebSocket";

function createCRDT(siteId: string, engine: CRDTEngine): CRDTAdapter {
  return engine === "yjs"
    ? new YjsCRDTAdapter(siteId)
    : new CustomCRDTAdapter(siteId);
}

export function useSync(
  docId: string,
  userId: string,
  username: string,
  onRemoteChange?: (type: "insert" | "delete", data: any) => void,
  onInit?: () => void,
  onLanguageChange?: (language: string) => void,
) {
  const crdtRef = useRef<CRDTAdapter | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const messageBuffer = useRef<WebSocketMessage[]>([]);
  const isInitializedRef = useRef(false);
  const lastCursorSent = useRef<CursorPosition | null>(null);
  const cursorThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processMessage = useCallback(
    (msg: WebSocketMessage) => {
      switch (msg.type) {
        case "init": {
          const adapter = createCRDT(userId, msg.crdtEngine);
          adapter.applySnapshot(msg.payload);
          crdtRef.current = adapter;
          setUsers(msg.users);
          setIsInitialized(true);
          isInitializedRef.current = true;
          onLanguageChange?.(msg.language);
          onInit?.();

          const buffered = messageBuffer.current;
          messageBuffer.current = [];
          buffered.forEach((bMsg) => processMessage(bMsg));
          break;
        }
        case "crdt-insert": {
          const crdt = crdtRef.current;
          if (!crdt) return;
          const result = crdt.remoteInsert(msg.payload);
          if (result) {
            onRemoteChange?.("insert", {
              ...msg.payload,
              visibleIndex: result.visibleIndex,
              value: result.value,
            });
          }
          break;
        }
        case "crdt-delete": {
          const crdt = crdtRef.current;
          if (!crdt) return;
          const result = crdt.remoteDelete(msg.payload);
          if (result) {
            onRemoteChange?.("delete", {
              ...msg.payload,
              visibleIndex: result.visibleIndex,
            });
          }
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
      }
    },
    [userId, onRemoteChange, onInit, onLanguageChange],
  );

  const handleMessage = useCallback(
    (msg: WebSocketMessage) => {
      if (!isInitializedRef.current && msg.type !== "init") {
        messageBuffer.current.push(msg);
        return;
      }
      processMessage(msg);
    },
    [processMessage],
  );

  const [isConnected, sendMessage] = useWebSocket(
    docId,
    userId,
    username,
    handleMessage,
  );

  const applyLocalInsert = useCallback(
    (value: string, index: number) => {
      const crdt = crdtRef.current;
      if (!crdt) return;
      const result = crdt.localInsert(value, index);
      sendMessage({ type: "crdt-insert", payload: result.operation as any });
    },
    [sendMessage],
  );

  const applyLocalDelete = useCallback(
    (index: number) => {
      const crdt = crdtRef.current;
      if (!crdt) return;
      const result = crdt.localDelete(index);
      if (result) {
        sendMessage({ type: "crdt-delete", payload: result.operation as any });
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
      sendMessage({ type: "client-language", payload: { language } });
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
      if (cursorThrottleRef.current) return;

      lastCursorSent.current = cursor;
      sendMessage({ type: "client-cursor", payload: cursor });
      cursorThrottleRef.current = setTimeout(() => {
        cursorThrottleRef.current = null;
      }, 50);
    },
    [sendMessage],
  );

  return {
    crdt: crdtRef.current,
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

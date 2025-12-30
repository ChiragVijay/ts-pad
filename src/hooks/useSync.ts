// src/hooks/useSync.ts
import { useCallback, useRef } from "react";
import { CRDT } from "server/crdt";
import { useWebSocket } from "./useWebSocket";

export function useSync(docId: string) {
  const siteId = useRef(Math.random().toString(36).substring(2, 7)).current;
  const crdt = useRef(new CRDT(siteId)).current;

  const [isConnected, sendMessage] = useWebSocket(docId);

  const applyLocalInsert = useCallback(
    (value: string, index: number) => {
      const op = crdt.localInsert(value, index);
      sendMessage({ type: "crdt-insert", payload: op });
    },
    [sendMessage, crdt],
  );

  const applyLocalDelete = useCallback(
    (index: number) => {
      const id = crdt.localDelete(index);
      if (id) {
        sendMessage({ type: "crdt-delete", payload: id });
      }
    },
    [sendMessage, crdt],
  );

  return [crdt, isConnected, applyLocalInsert, applyLocalDelete] as const;
}

import type { WebSocketMessage } from "@/hooks/useWebSocket";
import type { ServerWebSocket } from "bun";
import { docManager } from "server/documentManager";

export type WebSocketData = {
  documentId: string;
  userId: string;
  username: string;
};

export const websocketHandlers = {
  open(ws: ServerWebSocket<WebSocketData>) {
    const { documentId, userId, username } = ws.data;
    ws.subscribe(documentId);

    const state = docManager.getDocumentState(documentId);
    const user = { id: userId, name: username };

    state.addUser(user);

    ws.send(
      JSON.stringify({
        type: "init",
        payload: state.crdt.getState(),
        users: state.getUserList(),
        language: state.language,
      }),
    );

    ws.publish(
      documentId,
      JSON.stringify({
        type: "user-join",
        payload: user,
      }),
    );
  },

  message(ws: ServerWebSocket<WebSocketData>, message: string) {
    const msg = JSON.parse(message) as WebSocketMessage;
    const { documentId, userId } = ws.data;
    const state = docManager.getDocumentState(documentId);

    switch (msg.type) {
      case "crdt-insert":
        state.crdt.remoteInsert(msg.payload);
        ws.publish(documentId, message);
        break;

      case "crdt-delete":
        state.crdt.remoteDelete(msg.payload.id);
        ws.publish(documentId, message);
        break;

      case "client-rename":
        state.renameUser(userId, msg.payload.name);
        const renameMsg = JSON.stringify({
          type: "user-rename",
          payload: { id: userId, name: msg.payload.name },
        });
        ws.send(renameMsg);
        ws.publish(documentId, renameMsg);
        break;

      case "client-language":
        state.setLanguage(msg.payload.language);
        ws.publish(
          documentId,
          JSON.stringify({
            type: "language-change",
            payload: { language: msg.payload.language },
          }),
        );
        break;

      default:
        break;
    }
  },

  close(ws: ServerWebSocket<WebSocketData>, code: number, message: string) {
    const { documentId, userId } = ws.data;
    const state = docManager.getDocumentState(documentId);

    state.removeUser(userId);

    ws.publish(
      documentId,
      JSON.stringify({
        type: "user-leave",
        payload: { id: userId },
      }),
    );

    ws.unsubscribe(documentId);
  },
};

import type { ServerWebSocket } from "bun";
import { docManager, DocumentLimitError } from "server/documentManager";

export type WebSocketData = {
  documentId: string;
  userId: string;
  username: string;
};

export interface WebSocketMessage {
  type: string;
  payload: any;
}

export const websocketHandlers = {
  open(ws: ServerWebSocket<WebSocketData>) {
    const { documentId, userId, username } = ws.data;

    try {
      const state = docManager.getDocumentState(documentId);
      ws.subscribe(documentId);

      const user = { id: userId, name: username };
      state.addUser(user);

      const userWithColor = state.getUser(userId)!;

      ws.send(
        JSON.stringify({
          type: "init",
          payload: state.crdt.getSnapshot(),
          users: state.getUserList(),
          language: state.language,
          crdtEngine: state.getCRDTEngine(),
        }),
      );

      ws.publish(
        documentId,
        JSON.stringify({
          type: "user-join",
          payload: userWithColor,
        }),
      );
    } catch (error) {
      if (error instanceof DocumentLimitError) {
        ws.send(
          JSON.stringify({
            type: "error",
            payload: { code: "DOCUMENT_LIMIT", message: error.message },
          }),
        );
        ws.close(1008, "Document limit reached");
      } else {
        console.error(
          `Error in WebSocket open for user ${userId} doc ${documentId}:`,
          error,
        );
        ws.close(1011, "Internal error");
      }
    }
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
        state.crdt.remoteDelete(msg.payload);
        ws.publish(documentId, message);
        break;

      case "client-rename":
        state.renameUser(userId, msg.payload.name);
        const user = state.getUser(userId);
        const renameMsg = JSON.stringify({
          type: "user-rename",
          payload: user,
        });
        ws.send(renameMsg);
        ws.publish(documentId, renameMsg);
        break;

      case "client-cursor":
        state.updateCursor(userId, msg.payload);
        ws.publish(
          documentId,
          JSON.stringify({
            type: "cursor-update",
            payload: { userId, cursor: msg.payload },
          }),
        );
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

  close(ws: ServerWebSocket<WebSocketData>, _code: number, _message: string) {
    const { documentId, userId } = ws.data;

    try {
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
    } catch {}
  },
};

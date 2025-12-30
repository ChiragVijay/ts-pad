import type { ServerWebSocket } from "bun";
import { docManager } from "server/documentManager";

export type WebSocketData = {
  documentId: string;
};

export const websocketHandlers = {
  open(ws: ServerWebSocket<WebSocketData>) {
    console.log("WebSocket connection opened.");
    console.log(`Document ID: ${ws.data.documentId}`);
    ws.subscribe(ws.data.documentId);

    const state = docManager.getDocumentState(ws.data.documentId);

    ws.send(
      JSON.stringify({
        type: "init",
        payload: state.content,
      }),
    );
    ws.send(JSON.stringify({ type: "update", payload: "Welcome to server" }));
  },

  message(ws: ServerWebSocket<WebSocketData>, message: string) {
    console.log(`Websocket message received: ${message}`);
    const { type, payload } = JSON.parse(message);

    ws.publish(ws.data.documentId, message);

    docManager.updateDocumentState(ws.data.documentId, payload);
  },

  close(ws: ServerWebSocket<WebSocketData>, code: number, message: string) {
    console.log("WebSocket connection closed coming from close handler.");
    ws.unsubscribe(ws.data.documentId);
    ws.close(code, message);
  },
};

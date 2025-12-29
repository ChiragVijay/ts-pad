import type { ServerWebSocket } from "bun";

export type WebSocketData = {
  documentId: string;
};

export const websocketHandlers = {
  open(ws: ServerWebSocket<WebSocketData>) {
    console.log("WebSocket connection opened.");
    console.log(`Document ID: ${ws.data.documentId}`);
    ws.send("Welcome to server");
  },
  message(ws: ServerWebSocket<WebSocketData>, message: string) {
    console.log(`Websocket message received: ${message}`);
    ws.send(message);
  },
  close(ws: ServerWebSocket<WebSocketData>, code: number, message: string) {
    console.log("WebSocket connection closed coming from close handler.");
    ws.close(code, message);
  },
};

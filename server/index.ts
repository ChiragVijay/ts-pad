import homepage from "../public/index.html";
import { config } from "./config";
import { websocketHandlers, type WebSocketData } from "./routes/ws";

const server = Bun.serve<WebSocketData>({
  port: config.port,
  development: config.development,

  routes: {
    "/": homepage,
    "/api/status": new Response("OK"),
  },

  fetch(req, server) {
    const url = new URL(req.url);
    const documentId = url.searchParams.get("docId");

    if (url.pathname === "/ws" && documentId) {
      if (
        server.upgrade(req, {
          data: { documentId },
        })
      ) {
        return;
      }
    }
    return new Response("Not Found", { status: 404 });
  },

  websocket: websocketHandlers,
});

console.log(`Server running at http://localhost:${server.port}`);

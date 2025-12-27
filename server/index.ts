import homepage from "../public/index.html";
import { config } from "./config";

const server = Bun.serve({
  port: config.port,
  development: config.development,

  routes: {
    "/": homepage,
    "/api/status": new Response("OK"),
  },

  fetch(req) {
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);

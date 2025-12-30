import type { Server } from "bun";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";
import { CRDT } from "../../server/crdt";
import type { WebSocketData } from "../../server/routes/ws";

const TEST_PORT = 3097;
const WS_URL = `ws://localhost:${TEST_PORT}/ws`;

let server: Server<WebSocketData>;
let clearDocuments: () => void;

function createTestServer() {
  const { CRDT } = require("../../server/crdt");

  interface User {
    id: string;
    name: string;
  }

  class DocumentState {
    crdt: InstanceType<typeof CRDT>;
    users: Map<string, User> = new Map();
    language: string = "typescript";

    constructor() {
      this.crdt = new CRDT("server");
    }

    setLanguage(language: string) {
      this.language = language;
    }
    addUser(user: User) {
      this.users.set(user.id, user);
    }
    removeUser(userId: string) {
      this.users.delete(userId);
    }
    getUserList(): User[] {
      return Array.from(this.users.values());
    }
  }

  const documents = new Map<string, DocumentState>();

  const getDocumentState = (docId: string): DocumentState => {
    let state = documents.get(docId);
    if (!state) {
      state = new DocumentState();
      documents.set(docId, state);
    }
    return state;
  };

  type WebSocketData = {
    documentId: string;
    userId: string;
    username: string;
  };

  return {
    server: Bun.serve<WebSocketData>({
      port: TEST_PORT,
      fetch(req, server) {
        const url = new URL(req.url);
        const documentId = url.searchParams.get("docId");
        const userId = url.searchParams.get("userId");
        const username = url.searchParams.get("username") || "Anonymous";

        if (url.pathname === "/ws" && documentId && userId) {
          if (server.upgrade(req, { data: { documentId, userId, username } })) {
            return;
          }
        }
        return new Response("Not Found", { status: 404 });
      },
      websocket: {
        open(ws) {
          const { documentId, userId, username } = ws.data;
          ws.subscribe(documentId);

          const state = getDocumentState(documentId);
          state.addUser({ id: userId, name: username });

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
              payload: { id: userId, name: username },
            }),
          );
        },
        message(ws, message) {
          const msg = JSON.parse(message as string);
          const { documentId } = ws.data;
          const state = getDocumentState(documentId);

          if (msg.type === "crdt-insert") {
            state.crdt.remoteInsert(msg.payload);
            ws.publish(documentId, message as string);
          } else if (msg.type === "crdt-delete") {
            state.crdt.remoteDelete(msg.payload.id);
            ws.publish(documentId, message as string);
          }
        },
        close(ws) {
          const { documentId, userId } = ws.data;
          const state = getDocumentState(documentId);
          state.removeUser(userId);
          ws.publish(
            documentId,
            JSON.stringify({ type: "user-leave", payload: { id: userId } }),
          );
          ws.unsubscribe(documentId);
        },
      },
    }),
    clearDocuments: () => documents.clear(),
  };
}

interface StressClient {
  ws: WebSocket;
  crdt: CRDT;
  userId: string;
  ready: Promise<void>;
  insert: (value: string, index: number) => void;
  delete: (index: number) => void;
  getText: () => string;
  close: () => void;
}

function createStressClient(docId: string, userId: string): StressClient {
  const ws = new WebSocket(`${WS_URL}?docId=${docId}&userId=${userId}`);
  const crdt = new CRDT(userId);

  const ready = new Promise<void>((resolve) => {
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "init") {
        crdt.setState(msg.payload);
        resolve();
      } else if (msg.type === "crdt-insert") {
        crdt.remoteInsert(msg.payload);
      } else if (msg.type === "crdt-delete") {
        crdt.remoteDelete(msg.payload.id);
      }
    };
  });

  return {
    ws,
    crdt,
    userId,
    ready,
    insert(value: string, index: number) {
      const op = crdt.localInsert(value, index);
      ws.send(JSON.stringify({ type: "crdt-insert", payload: op }));
    },
    delete(index: number) {
      const char = crdt.localDelete(index);
      if (char) {
        ws.send(
          JSON.stringify({ type: "crdt-delete", payload: { id: char.id } }),
        );
      }
    },
    getText() {
      return crdt.toString();
    },
    close() {
      ws.close();
    },
  };
}

beforeAll(() => {
  const testServer = createTestServer();
  server = testServer.server;
  clearDocuments = testServer.clearDocuments;
});

afterAll(() => {
  server.stop();
});

afterEach(() => {
  clearDocuments();
});

describe("Stress Tests", () => {
  describe("rapid operations", () => {
    test("100 rapid inserts from single client", async () => {
      const client = createStressClient("doc1", "client1");
      await client.ready;

      const count = 100;
      for (let i = 0; i < count; i++) {
        client.insert(String(i % 10), i);
      }

      await Bun.sleep(200);

      expect(client.getText().length).toBe(count);

      client.close();
    });

    test("200 rapid inserts from two clients", async () => {
      const client1 = createStressClient("doc1", "client1");
      const client2 = createStressClient("doc1", "client2");
      await Promise.all([client1.ready, client2.ready]);

      const count = 100;

      for (let i = 0; i < count; i++) {
        client1.insert("A", client1.getText().length);
        client2.insert("B", client2.getText().length);
      }

      await Bun.sleep(500);

      expect(client1.getText()).toBe(client2.getText());
      expect(client1.getText().length).toBe(count * 2);

      client1.close();
      client2.close();
    });

    test("mixed insert and delete operations", async () => {
      const client1 = createStressClient("doc1", "client1");
      const client2 = createStressClient("doc1", "client2");
      await Promise.all([client1.ready, client2.ready]);

      for (let i = 0; i < 50; i++) {
        client1.insert("X", 0);
      }

      await Bun.sleep(100);

      for (let i = 0; i < 25; i++) {
        client1.insert("Y", client1.getText().length);
        if (client2.getText().length > 0) {
          client2.delete(0);
        }
      }

      await Bun.sleep(300);

      expect(client1.getText()).toBe(client2.getText());

      client1.close();
      client2.close();
    });
  });

  describe("many clients", () => {
    test("10 simultaneous clients", async () => {
      const clientCount = 10;
      const clients: StressClient[] = [];

      for (let i = 0; i < clientCount; i++) {
        clients.push(createStressClient("doc1", `client${i}`));
      }

      await Promise.all(clients.map((c) => c.ready));

      for (const client of clients) {
        client.insert(client.userId.slice(-1), 0);
      }

      await Bun.sleep(500);

      const finalText = clients[0].getText();
      for (const client of clients) {
        expect(client.getText()).toBe(finalText);
      }
      expect(finalText.length).toBe(clientCount);

      for (const client of clients) {
        client.close();
      }
    });

    test("20 clients with rapid operations", async () => {
      const clientCount = 20;
      const opsPerClient = 10;
      const clients: StressClient[] = [];

      for (let i = 0; i < clientCount; i++) {
        clients.push(createStressClient("doc1", `client${i}`));
      }

      await Promise.all(clients.map((c) => c.ready));

      for (let op = 0; op < opsPerClient; op++) {
        for (const client of clients) {
          client.insert(String(op), client.getText().length);
        }
        await Bun.sleep(10);
      }

      await Bun.sleep(1000);

      const finalText = clients[0].getText();
      for (const client of clients) {
        expect(client.getText()).toBe(finalText);
      }
      expect(finalText.length).toBe(clientCount * opsPerClient);

      for (const client of clients) {
        client.close();
      }
    });

    test("clients joining and leaving during edits", async () => {
      const client1 = createStressClient("doc1", "client1");
      await client1.ready;

      for (let i = 0; i < 20; i++) {
        client1.insert("A", i);
      }

      await Bun.sleep(50);

      const client2 = createStressClient("doc1", "client2");
      await client2.ready;

      for (let i = 0; i < 10; i++) {
        client2.insert("B", client2.getText().length);
      }

      await Bun.sleep(50);
      client1.close();
      await Bun.sleep(50);

      const client3 = createStressClient("doc1", "client3");
      await client3.ready;

      for (let i = 0; i < 10; i++) {
        client3.insert("C", client3.getText().length);
      }

      await Bun.sleep(200);

      expect(client2.getText()).toBe(client3.getText());
      expect(client3.getText().length).toBe(40);

      client2.close();
      client3.close();
    });
  });

  describe("large documents", () => {
    test("document with 1000 characters", async () => {
      const client = createStressClient("doc1", "client1");
      await client.ready;

      const text = "a".repeat(1000);
      for (let i = 0; i < text.length; i++) {
        client.insert(text[i], i);
      }

      await Bun.sleep(300);

      expect(client.getText()).toBe(text);

      client.close();
    });

    test("two clients building large document together", async () => {
      const client1 = createStressClient("doc1", "client1");
      const client2 = createStressClient("doc1", "client2");
      await Promise.all([client1.ready, client2.ready]);

      const charsPerClient = 250;

      for (let i = 0; i < charsPerClient; i++) {
        client1.insert("A", client1.getText().length);
        client2.insert("B", client2.getText().length);
      }

      await Bun.sleep(500);

      expect(client1.getText()).toBe(client2.getText());
      expect(client1.getText().length).toBe(charsPerClient * 2);

      client1.close();
      client2.close();
    });

    test("late joiner receives large document", async () => {
      const client1 = createStressClient("doc1", "client1");
      await client1.ready;

      const docSize = 500;
      for (let i = 0; i < docSize; i++) {
        client1.insert(String.fromCharCode(65 + (i % 26)), i);
      }

      await Bun.sleep(200);

      const client2 = createStressClient("doc1", "client2");
      await client2.ready;

      expect(client2.getText().length).toBe(docSize);
      expect(client2.getText()).toBe(client1.getText());

      client1.close();
      client2.close();
    });
  });

  describe("CRDT convergence under stress", () => {
    test("all clients converge after chaotic editing", async () => {
      const clientCount = 5;
      const clients: StressClient[] = [];

      for (let i = 0; i < clientCount; i++) {
        clients.push(createStressClient("doc1", `client${i}`));
      }

      await Promise.all(clients.map((c) => c.ready));

      for (let round = 0; round < 20; round++) {
        for (const client of clients) {
          const len = client.getText().length;
          const pos = Math.floor(Math.random() * (len + 1));
          client.insert(String.fromCharCode(65 + round), pos);
        }
        await Bun.sleep(20);
      }

      await Bun.sleep(1000);

      const finalText = clients[0].getText();
      for (const client of clients) {
        expect(client.getText()).toBe(finalText);
      }

      for (const client of clients) {
        client.close();
      }
    });

    test("convergence with random inserts and deletes", async () => {
      const client1 = createStressClient("doc1", "client1");
      const client2 = createStressClient("doc1", "client2");
      await Promise.all([client1.ready, client2.ready]);

      for (let i = 0; i < 30; i++) {
        client1.insert(
          "X",
          Math.floor(Math.random() * (client1.getText().length + 1)),
        );
        client2.insert(
          "Y",
          Math.floor(Math.random() * (client2.getText().length + 1)),
        );
      }

      await Bun.sleep(200);

      for (let i = 0; i < 15; i++) {
        if (client1.getText().length > 0) {
          client1.delete(Math.floor(Math.random() * client1.getText().length));
        }
        if (client2.getText().length > 0) {
          client2.delete(Math.floor(Math.random() * client2.getText().length));
        }
      }

      await Bun.sleep(500);

      expect(client1.getText()).toBe(client2.getText());

      client1.close();
      client2.close();
    });
  });

  describe("performance benchmarks", () => {
    test("measures time for 500 sequential inserts", async () => {
      const client = createStressClient("doc1", "client1");
      await client.ready;

      const start = performance.now();

      for (let i = 0; i < 500; i++) {
        client.insert("X", i);
      }

      await Bun.sleep(500);

      const duration = performance.now() - start;

      expect(client.getText().length).toBe(500);
      expect(duration).toBeLessThan(2000);

      client.close();
    });

    test("measures broadcast latency with 5 clients", async () => {
      const clients: StressClient[] = [];

      for (let i = 0; i < 5; i++) {
        clients.push(createStressClient("doc1", `client${i}`));
      }

      await Promise.all(clients.map((c) => c.ready));

      const start = performance.now();

      for (let i = 0; i < 50; i++) {
        clients[0].insert("X", i);
      }

      await Bun.sleep(300);

      const duration = performance.now() - start;

      for (const client of clients) {
        expect(client.getText().length).toBe(50);
      }

      expect(duration).toBeLessThan(1000);

      for (const client of clients) {
        client.close();
      }
    });
  });
});

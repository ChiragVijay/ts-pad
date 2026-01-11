import type { Server } from "bun";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";
import type { WebSocketData } from "../../server/routes/ws";

let server: Server<WebSocketData>;
let wsUrl: string;

function createTestServer() {
  const { createCRDT, getCRDTEngine } = require("../../server/crdt");

  interface User {
    id: string;
    name: string;
  }

  class DocumentState {
    crdt: any;
    users: Map<string, User> = new Map();
    language: string = "typescript";

    constructor() {
      this.crdt = createCRDT("server");
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
    renameUser(userId: string, newName: string) {
      const user = this.users.get(userId);
      if (user) user.name = newName;
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

  const clearDocuments = () => documents.clear();

  type WebSocketData = {
    documentId: string;
    userId: string;
    username: string;
  };

  return {
    server: Bun.serve<WebSocketData>({
      port: 4001,
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
              payload: state.crdt.getSnapshot(),
              users: state.getUserList(),
              language: state.language,
              crdtEngine: getCRDTEngine(),
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
          const { documentId, userId } = ws.data;
          const state = getDocumentState(documentId);

          if (msg.type === "crdt-insert") {
            state.crdt.remoteInsert(msg.payload);
            ws.publish(documentId, message as string);
          } else if (msg.type === "crdt-delete") {
            state.crdt.remoteDelete(msg.payload);
            ws.publish(documentId, message as string);
          } else if (msg.type === "client-rename") {
            state.renameUser(userId, msg.payload.name);
            const renameMsg = JSON.stringify({
              type: "user-rename",
              payload: { id: userId, name: msg.payload.name },
            });
            ws.send(renameMsg);
            ws.publish(documentId, renameMsg);
          } else if (msg.type === "client-language") {
            state.setLanguage(msg.payload.language);
            ws.publish(
              documentId,
              JSON.stringify({
                type: "language-change",
                payload: { language: msg.payload.language },
              }),
            );
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
    clearDocuments,
  };
}

interface TestClient {
  ws: WebSocket;
  messages: any[];
  waitForMessage: (type: string, timeout?: number) => Promise<any>;
  send: (msg: any) => void;
  close: () => void;
}

function createClient(
  docId: string,
  userId: string,
  username = "TestUser",
): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `${wsUrl}?docId=${docId}&userId=${userId}&username=${username}`,
    );
    const messages: any[] = [];
    const waiters: Map<
      string,
      { resolve: (msg: any) => void; reject: (e: Error) => void }[]
    > = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      messages.push(msg);

      const typeWaiters = waiters.get(msg.type);
      if (typeWaiters?.length) {
        const waiter = typeWaiters.shift()!;
        waiter.resolve(msg);
      }
    };

    ws.onerror = (e) => reject(e);

    ws.onopen = () => {
      resolve({
        ws,
        messages,
        waitForMessage(type: string, timeout = 2000) {
          const existing = messages.find((m) => m.type === type);
          if (existing) {
            messages.splice(messages.indexOf(existing), 1);
            return Promise.resolve(existing);
          }

          return new Promise((res, rej) => {
            const timer = setTimeout(
              () => rej(new Error(`Timeout waiting for ${type}`)),
              timeout,
            );
            if (!waiters.has(type)) waiters.set(type, []);
            waiters.get(type)!.push({
              resolve: (msg) => {
                clearTimeout(timer);
                res(msg);
              },
              reject: rej,
            });
          });
        },
        send(msg: any) {
          ws.send(JSON.stringify(msg));
        },
        close() {
          ws.close();
        },
      });
    };
  });
}

let testServer: ReturnType<typeof createTestServer>;

beforeAll(() => {
  testServer = createTestServer();
  server = testServer.server;
  wsUrl = `ws://localhost:${server.port}/ws`;
});

afterAll(() => {
  server.stop();
});

afterEach(() => {
  testServer.clearDocuments();
});

describe("WebSocket Integration", () => {
  describe("connection", () => {
    test("receives init message on connect", async () => {
      const client = await createClient("doc1", "user1", "Alice");

      const init = await client.waitForMessage("init");

      expect(init.type).toBe("init");
      expect(init.payload).toBeDefined();
      expect(init.users).toBeArray();
      expect(init.language).toBe("typescript");

      client.close();
    });

    test("init contains connecting user", async () => {
      const client = await createClient("doc1", "user1", "Alice");

      const init = await client.waitForMessage("init");

      expect(init.users).toContainEqual({ id: "user1", name: "Alice" });

      client.close();
    });

    test("rejects connection without docId", async () => {
      const ws = new WebSocket(`${wsUrl}?userId=user1`);

      await new Promise<void>((resolve) => {
        ws.onerror = () => resolve();
        ws.onclose = () => resolve();
        setTimeout(resolve, 500);
      });

      expect(ws.readyState).not.toBe(WebSocket.OPEN);
    });

    test("rejects connection without userId", async () => {
      const ws = new WebSocket(`${wsUrl}?docId=doc1`);

      await new Promise<void>((resolve) => {
        ws.onerror = () => resolve();
        ws.onclose = () => resolve();
        setTimeout(resolve, 500);
      });

      expect(ws.readyState).not.toBe(WebSocket.OPEN);
    });
  });

  describe("user events", () => {
    test("broadcasts user-join to other clients", async () => {
      const client1 = await createClient("doc1", "user1", "Alice");
      await client1.waitForMessage("init");

      const client2 = await createClient("doc1", "user2", "Bob");

      const joinMsg = await client1.waitForMessage("user-join");
      expect(joinMsg.payload).toEqual({ id: "user2", name: "Bob" });

      client1.close();
      client2.close();
    });

    test("broadcasts user-leave on disconnect", async () => {
      const client1 = await createClient("doc1", "user1", "Alice");
      await client1.waitForMessage("init");

      const client2 = await createClient("doc1", "user2", "Bob");
      await client2.waitForMessage("init");
      await client1.waitForMessage("user-join");

      client2.close();

      const leaveMsg = await client1.waitForMessage("user-leave");
      expect(leaveMsg.payload).toEqual({ id: "user2" });

      client1.close();
    });

    test("client-rename broadcasts user-rename", async () => {
      const client1 = await createClient("doc1", "user1", "Alice");
      await client1.waitForMessage("init");

      const client2 = await createClient("doc1", "user2", "Bob");
      await client2.waitForMessage("init");

      client1.send({ type: "client-rename", payload: { name: "Alicia" } });

      const renameMsg = await client2.waitForMessage("user-rename");
      expect(renameMsg.payload).toEqual({ id: "user1", name: "Alicia" });

      const selfRename = await client1.waitForMessage("user-rename");
      expect(selfRename.payload.name).toBe("Alicia");

      client1.close();
      client2.close();
    });
  });

  describe("CRDT operations", () => {
    test("crdt-insert is broadcast to other clients", async () => {
      const { createCRDT } = require("../../server/crdt");
      const client1 = await createClient("doc1", "user1");
      await client1.waitForMessage("init");

      const client2 = await createClient("doc1", "user2");
      await client2.waitForMessage("init");

      const adapter = createCRDT("user1");
      const result = adapter.localInsert("A", 0);

      const insertOp = {
        type: "crdt-insert",
        payload: result.operation,
      };

      client1.send(insertOp);

      const received = await client2.waitForMessage("crdt-insert");
      // Use adapter to verify if we can
      const adapter2 = createCRDT("user2");
      adapter2.remoteInsert(received.payload);
      expect(adapter2.toString()).toBe("A");

      client1.close();
      client2.close();
    });

    test("crdt-delete is broadcast to other clients", async () => {
      const { createCRDT } = require("../../server/crdt");
      const client1 = await createClient("doc1", "user1");
      await client1.waitForMessage("init");

      const client2 = await createClient("doc1", "user2");
      await client2.waitForMessage("init");

      const adapter = createCRDT("user1");
      const insertResult = adapter.localInsert("A", 0);

      client1.send({
        type: "crdt-insert",
        payload: insertResult.operation,
      });
      await client2.waitForMessage("crdt-insert");

      const deleteResult = adapter.localDelete(0);
      const deleteOp = {
        type: "crdt-delete",
        payload: deleteResult!.operation,
      };
      client1.send(deleteOp);

      const received = await client2.waitForMessage("crdt-delete");

      const adapter2 = createCRDT("user2");
      adapter2.remoteInsert(insertResult.operation);
      adapter2.remoteDelete(received.payload);
      expect(adapter2.toString()).toBe("");

      client1.close();
      client2.close();
    });

    test("server persists CRDT state for new clients", async () => {
      const { createCRDT } = require("../../server/crdt");
      const client1 = await createClient("doc1", "user1");
      await client1.waitForMessage("init");

      const adapter = createCRDT("user1");
      const result = adapter.localInsert("X", 0);

      client1.send({
        type: "crdt-insert",
        payload: result.operation,
      });

      await Bun.sleep(50);
      client1.close();
      await Bun.sleep(50);

      const client2 = await createClient("doc1", "user2");
      const init = await client2.waitForMessage("init");

      const adapter2 = createCRDT("user2");
      adapter2.applySnapshot(init.payload);
      expect(adapter2.toString()).toBe("X");

      client2.close();
    });
  });

  describe("language change", () => {
    test("client-language broadcasts language-change", async () => {
      const client1 = await createClient("doc1", "user1");
      await client1.waitForMessage("init");

      const client2 = await createClient("doc1", "user2");
      await client2.waitForMessage("init");

      client1.send({
        type: "client-language",
        payload: { language: "python" },
      });

      const langMsg = await client2.waitForMessage("language-change");
      expect(langMsg.payload.language).toBe("python");

      client1.close();
      client2.close();
    });

    test("new client receives current language", async () => {
      const client1 = await createClient("doc1", "user1");
      await client1.waitForMessage("init");

      client1.send({ type: "client-language", payload: { language: "rust" } });
      await Bun.sleep(50);

      const client2 = await createClient("doc1", "user2");
      const init = await client2.waitForMessage("init");

      expect(init.language).toBe("rust");

      client1.close();
      client2.close();
    });
  });

  describe("document isolation", () => {
    test("operations in one document dont affect another", async () => {
      const { createCRDT } = require("../../server/crdt");
      const clientA1 = await createClient("docA", "userA1");
      await clientA1.waitForMessage("init");

      const clientB1 = await createClient("docB", "userB1");
      await clientB1.waitForMessage("init");

      const adapter = createCRDT("userA1");
      const result = adapter.localInsert("A", 0);

      clientA1.send({
        type: "crdt-insert",
        payload: result.operation,
      });

      await Bun.sleep(100);

      expect(
        clientB1.messages.filter((m) => m.type === "crdt-insert").length,
      ).toBe(0);

      clientA1.close();
      clientB1.close();
    });

    test("users in one document dont appear in another", async () => {
      const clientA1 = await createClient("docA", "userA1", "Alice");
      const initA = await clientA1.waitForMessage("init");

      const clientB1 = await createClient("docB", "userB1", "Bob");
      const initB = await clientB1.waitForMessage("init");

      expect(initA.users.map((u: any) => u.name)).not.toContain("Bob");
      expect(initB.users.map((u: any) => u.name)).not.toContain("Alice");

      clientA1.close();
      clientB1.close();
    });
  });
});

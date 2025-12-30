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

const TEST_PORT = 3098;
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
          const { documentId, userId } = ws.data;
          const state = getDocumentState(documentId);

          if (msg.type === "crdt-insert") {
            state.crdt.remoteInsert(msg.payload);
            ws.publish(documentId, message as string);
          } else if (msg.type === "crdt-delete") {
            state.crdt.remoteDelete(msg.payload.id);
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
    clearDocuments: () => documents.clear(),
  };
}

interface SyncClient {
  ws: WebSocket;
  crdt: CRDT;
  messages: any[];
  userId: string;
  waitForMessage: (type: string, timeout?: number) => Promise<any>;
  send: (msg: any) => void;
  close: () => void;
  insert: (value: string, index: number) => void;
  delete: (index: number) => void;
  getText: () => string;
}

function createSyncClient(docId: string, userId: string): Promise<SyncClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `${WS_URL}?docId=${docId}&userId=${userId}&username=${userId}`,
    );
    const crdt = new CRDT(userId);
    const messages: any[] = [];
    const waiters: Map<string, { resolve: (msg: any) => void }[]> = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      messages.push(msg);

      if (msg.type === "init") {
        crdt.setState(msg.payload);
      } else if (msg.type === "crdt-insert") {
        crdt.remoteInsert(msg.payload);
      } else if (msg.type === "crdt-delete") {
        crdt.remoteDelete(msg.payload.id);
      }

      const typeWaiters = waiters.get(msg.type);
      if (typeWaiters?.length) {
        typeWaiters.shift()!.resolve(msg);
      }
    };

    ws.onerror = (e) => reject(e);

    ws.onopen = () => {
      const client: SyncClient = {
        ws,
        crdt,
        messages,
        userId,
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
            });
          });
        },
        send(msg: any) {
          ws.send(JSON.stringify(msg));
        },
        close() {
          ws.close();
        },
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
      };
      resolve(client);
    };
  });
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

describe("Multi-Client Sync", () => {
  describe("basic synchronization", () => {
    test("two clients converge on same text", async () => {
      const client1 = await createSyncClient("doc1", "client1");
      await client1.waitForMessage("init");

      const client2 = await createSyncClient("doc1", "client2");
      await client2.waitForMessage("init");

      client1.insert("A", 0);
      await client2.waitForMessage("crdt-insert");

      client2.insert("B", 1);
      await client1.waitForMessage("crdt-insert");

      expect(client1.getText()).toBe(client2.getText());
      expect(client1.getText()).toBe("AB");

      client1.close();
      client2.close();
    });

    test("late joiner gets current state", async () => {
      const client1 = await createSyncClient("doc1", "client1");
      await client1.waitForMessage("init");

      client1.insert("H", 0);
      client1.insert("i", 1);

      await Bun.sleep(50);

      const client2 = await createSyncClient("doc1", "client2");
      await client2.waitForMessage("init");

      expect(client2.getText()).toBe("Hi");

      client1.close();
      client2.close();
    });

    test("delete synchronizes across clients", async () => {
      const client1 = await createSyncClient("doc1", "client1");
      await client1.waitForMessage("init");

      const client2 = await createSyncClient("doc1", "client2");
      await client2.waitForMessage("init");

      client1.insert("A", 0);
      client1.insert("B", 1);
      client1.insert("C", 2);
      await Bun.sleep(50);

      client1.delete(1);
      await client2.waitForMessage("crdt-delete");

      expect(client1.getText()).toBe("AC");
      expect(client2.getText()).toBe("AC");

      client1.close();
      client2.close();
    });
  });

  describe("concurrent editing", () => {
    test("concurrent inserts at same position converge", async () => {
      const client1 = await createSyncClient("doc1", "aaa");
      await client1.waitForMessage("init");

      const client2 = await createSyncClient("doc1", "zzz");
      await client2.waitForMessage("init");

      client1.insert("A", 0);
      client2.insert("Z", 0);

      await Bun.sleep(100);

      expect(client1.getText()).toBe(client2.getText());
    });

    test("concurrent inserts at different positions", async () => {
      const client1 = await createSyncClient("doc1", "client1");
      await client1.waitForMessage("init");

      const client2 = await createSyncClient("doc1", "client2");
      await client2.waitForMessage("init");

      client1.insert("X", 0);
      await Bun.sleep(30);

      client1.insert("A", 0);
      client2.insert("B", 1);

      await Bun.sleep(100);

      expect(client1.getText()).toBe(client2.getText());
    });

    test("rapid sequential inserts from both clients", async () => {
      const client1 = await createSyncClient("doc1", "client1");
      await client1.waitForMessage("init");

      const client2 = await createSyncClient("doc1", "client2");
      await client2.waitForMessage("init");

      for (let i = 0; i < 10; i++) {
        client1.insert(String(i), i);
      }

      await Bun.sleep(100);

      for (let i = 0; i < 10; i++) {
        client2.insert(String.fromCharCode(65 + i), client2.getText().length);
      }

      await Bun.sleep(200);

      expect(client1.getText()).toBe(client2.getText());
      expect(client1.getText().length).toBe(20);

      client1.close();
      client2.close();
    });

    test("interleaved typing converges", async () => {
      const client1 = await createSyncClient("doc1", "client1");
      await client1.waitForMessage("init");

      const client2 = await createSyncClient("doc1", "client2");
      await client2.waitForMessage("init");

      const text1 = "HELLO";
      const text2 = "WORLD";

      for (let i = 0; i < Math.max(text1.length, text2.length); i++) {
        if (i < text1.length) {
          client1.insert(text1[i], client1.getText().length);
        }
        if (i < text2.length) {
          client2.insert(text2[i], client2.getText().length);
        }
        await Bun.sleep(20);
      }

      await Bun.sleep(200);

      expect(client1.getText()).toBe(client2.getText());
      expect(client1.getText().length).toBe(10);

      client1.close();
      client2.close();
    });
  });

  describe("three or more clients", () => {
    test("three clients converge", async () => {
      const client1 = await createSyncClient("doc1", "client1");
      await client1.waitForMessage("init");

      const client2 = await createSyncClient("doc1", "client2");
      await client2.waitForMessage("init");

      const client3 = await createSyncClient("doc1", "client3");
      await client3.waitForMessage("init");

      client1.insert("1", 0);
      client2.insert("2", 0);
      client3.insert("3", 0);

      await Bun.sleep(200);

      expect(client1.getText()).toBe(client2.getText());
      expect(client2.getText()).toBe(client3.getText());
      expect(client1.getText().length).toBe(3);

      client1.close();
      client2.close();
      client3.close();
    });

    test("client leaving doesnt affect others", async () => {
      const client1 = await createSyncClient("doc1", "client1");
      await client1.waitForMessage("init");

      const client2 = await createSyncClient("doc1", "client2");
      await client2.waitForMessage("init");

      client1.insert("A", 0);
      await Bun.sleep(50);

      const client3 = await createSyncClient("doc1", "client3");
      await client3.waitForMessage("init");

      client2.close();
      await Bun.sleep(50);

      client1.insert("B", 1);
      await Bun.sleep(100);

      expect(client1.getText()).toBe("AB");
      expect(client3.getText()).toBe("AB");

      client1.close();
      client3.close();
    });
  });

  describe("delete operations", () => {
    test("concurrent deletes on same character", async () => {
      const client1 = await createSyncClient("doc1", "client1");
      await client1.waitForMessage("init");

      client1.insert("A", 0);
      await Bun.sleep(50);

      const client2 = await createSyncClient("doc1", "client2");
      await client2.waitForMessage("init");

      client1.delete(0);
      client2.delete(0);

      await Bun.sleep(100);

      expect(client1.getText()).toBe("");
      expect(client2.getText()).toBe("");

      client1.close();
      client2.close();
    });

    test("insert after delete at same position", async () => {
      const client1 = await createSyncClient("doc1", "client1");
      await client1.waitForMessage("init");

      const client2 = await createSyncClient("doc1", "client2");
      await client2.waitForMessage("init");

      client1.insert("A", 0);
      client1.insert("B", 1);
      await Bun.sleep(50);

      client1.delete(0);
      client2.insert("X", 0);

      await Bun.sleep(100);

      expect(client1.getText()).toBe(client2.getText());

      client1.close();
      client2.close();
    });
  });

  describe("reconnection scenarios", () => {
    test("client reconnects and syncs", async () => {
      const client1 = await createSyncClient("doc1", "client1");
      await client1.waitForMessage("init");

      client1.insert("A", 0);
      client1.insert("B", 1);

      await Bun.sleep(50);
      client1.close();
      await Bun.sleep(50);

      const client1Reconnected = await createSyncClient("doc1", "client1-new");
      await client1Reconnected.waitForMessage("init");

      expect(client1Reconnected.getText()).toBe("AB");

      client1Reconnected.close();
    });
  });
});

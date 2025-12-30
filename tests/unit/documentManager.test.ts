import { beforeEach, describe, expect, test } from "bun:test";
import { CRDT } from "../../server/crdt";
import type { User } from "../../server/documentManager";

class DocumentState {
  crdt: CRDT;
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
    if (user) {
      user.name = newName;
    }
  }

  getUserList(): User[] {
    return Array.from(this.users.values());
  }
}

class DocumentManager {
  private documents: Map<string, DocumentState> = new Map();

  createDocumentState(docId: string) {
    if (!this.documents.has(docId)) {
      this.documents.set(docId, new DocumentState());
    }
  }

  getDocumentState(docId: string): DocumentState {
    let state = this.documents.get(docId);
    if (!state) {
      state = new DocumentState();
      this.documents.set(docId, state);
    }
    return state;
  }
}

describe("DocumentState", () => {
  test("initializes with default values", () => {
    const state = new DocumentState();

    expect(state.language).toBe("typescript");
    expect(state.getUserList()).toEqual([]);
    expect(state.crdt.toString()).toBe("");
  });

  describe("user management", () => {
    test("adds user", () => {
      const state = new DocumentState();

      state.addUser({ id: "user1", name: "Alice" });

      const users = state.getUserList();
      expect(users.length).toBe(1);
      expect(users[0]).toEqual({ id: "user1", name: "Alice" });
    });

    test("adds multiple users", () => {
      const state = new DocumentState();

      state.addUser({ id: "user1", name: "Alice" });
      state.addUser({ id: "user2", name: "Bob" });
      state.addUser({ id: "user3", name: "Charlie" });

      expect(state.getUserList().length).toBe(3);
    });

    test("removes user", () => {
      const state = new DocumentState();
      state.addUser({ id: "user1", name: "Alice" });
      state.addUser({ id: "user2", name: "Bob" });

      state.removeUser("user1");

      const users = state.getUserList();
      expect(users.length).toBe(1);
      expect(users[0].id).toBe("user2");
    });

    test("removing non-existent user is safe", () => {
      const state = new DocumentState();
      state.addUser({ id: "user1", name: "Alice" });

      state.removeUser("nonexistent");

      expect(state.getUserList().length).toBe(1);
    });

    test("renames user", () => {
      const state = new DocumentState();
      state.addUser({ id: "user1", name: "Alice" });

      state.renameUser("user1", "Alicia");

      const users = state.getUserList();
      expect(users[0].name).toBe("Alicia");
    });

    test("renaming non-existent user is safe", () => {
      const state = new DocumentState();
      state.addUser({ id: "user1", name: "Alice" });

      state.renameUser("nonexistent", "NewName");

      expect(state.getUserList()[0].name).toBe("Alice");
    });

    test("overwrites user with same id", () => {
      const state = new DocumentState();
      state.addUser({ id: "user1", name: "Alice" });
      state.addUser({ id: "user1", name: "Alicia" });

      const users = state.getUserList();
      expect(users.length).toBe(1);
      expect(users[0].name).toBe("Alicia");
    });
  });

  describe("language", () => {
    test("sets language", () => {
      const state = new DocumentState();

      state.setLanguage("python");

      expect(state.language).toBe("python");
    });

    test("changes language", () => {
      const state = new DocumentState();
      state.setLanguage("python");
      state.setLanguage("javascript");

      expect(state.language).toBe("javascript");
    });
  });
});

describe("DocumentManager", () => {
  let manager: DocumentManager;

  beforeEach(() => {
    manager = new DocumentManager();
  });

  test("creates new document state", () => {
    manager.createDocumentState("doc1");
    const state = manager.getDocumentState("doc1");

    expect(state).toBeDefined();
    expect(state.language).toBe("typescript");
  });

  test("getDocumentState auto-creates if not exists", () => {
    const state = manager.getDocumentState("new-doc");

    expect(state).toBeDefined();
    expect(state.crdt).toBeDefined();
  });

  test("returns same instance for same docId", () => {
    const state1 = manager.getDocumentState("doc1");
    const state2 = manager.getDocumentState("doc1");

    expect(state1).toBe(state2);
  });

  test("isolates documents", () => {
    const state1 = manager.getDocumentState("doc1");
    const state2 = manager.getDocumentState("doc2");

    state1.addUser({ id: "user1", name: "Alice" });
    state1.setLanguage("python");
    state1.crdt.localInsert("A", 0);

    expect(state2.getUserList().length).toBe(0);
    expect(state2.language).toBe("typescript");
    expect(state2.crdt.toString()).toBe("");
  });

  test("createDocumentState is idempotent", () => {
    manager.createDocumentState("doc1");
    const state1 = manager.getDocumentState("doc1");
    state1.addUser({ id: "user1", name: "Alice" });

    manager.createDocumentState("doc1");
    const state2 = manager.getDocumentState("doc1");

    expect(state2.getUserList().length).toBe(1);
  });

  test("handles many documents", () => {
    const docCount = 100;

    for (let i = 0; i < docCount; i++) {
      const state = manager.getDocumentState(`doc-${i}`);
      state.addUser({ id: `user-${i}`, name: `User ${i}` });
    }

    for (let i = 0; i < docCount; i++) {
      const state = manager.getDocumentState(`doc-${i}`);
      expect(state.getUserList()[0].name).toBe(`User ${i}`);
    }
  });
});

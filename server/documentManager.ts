import { getUserColor } from "../src/utils/colors";
import { createCRDT, getCRDTEngine, type CRDTAdapter } from "./crdt";

export interface CursorPosition {
  lineNumber: number;
  column: number;
}

export interface User {
  id: string;
  name: string;
  color: string;
  cursor?: CursorPosition;
}

class DocumentState {
  crdt: CRDTAdapter;
  users: Map<string, User> = new Map();
  language: string = "typescript";

  constructor() {
    this.crdt = createCRDT("server");
  }

  setLanguage(language: string) {
    this.language = language;
  }

  addUser(user: Omit<User, "color">) {
    const color = getUserColor(user.id);
    this.users.set(user.id, { ...user, color });
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

  updateCursor(userId: string, cursor: CursorPosition) {
    const user = this.users.get(userId);
    if (user) {
      user.cursor = cursor;
    }
  }

  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  getUserList(): User[] {
    return Array.from(this.users.values());
  }

  getCRDTEngine(): "custom" | "yjs" {
    return this.crdt.engineType;
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

  getCRDTEngine(): "custom" | "yjs" {
    return getCRDTEngine();
  }
}

export const docManager = new DocumentManager();

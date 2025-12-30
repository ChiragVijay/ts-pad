import { CRDT } from "./crdt";

export interface User {
  id: string;
  name: string;
}

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

export const docManager = new DocumentManager();

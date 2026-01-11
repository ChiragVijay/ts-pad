import { getUserColor } from "../src/utils/colors";
import { config } from "./config";
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
  lastAccessedAt: number = Date.now();

  constructor() {
    this.crdt = createCRDT("server");
  }

  touch() {
    this.lastAccessedAt = Date.now();
  }

  isExpired(): boolean {
    return Date.now() - this.lastAccessedAt > config.limits.documentTTLMs;
  }

  getContentSize(): number {
    return new TextEncoder().encode(this.crdt.toString()).length;
  }

  setLanguage(language: string) {
    this.language = language;
    this.touch();
  }

  addUser(user: Omit<User, "color">) {
    const color = getUserColor(user.id);
    this.users.set(user.id, { ...user, color });
    this.touch();
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

export class DocumentLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentLimitError";
  }
}

class DocumentManager {
  private documents: Map<string, DocumentState> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startCleanupInterval();
  }

  private startCleanupInterval() {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredDocuments();
    }, config.limits.cleanupIntervalMs);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  private cleanupExpiredDocuments() {
    const now = Date.now();
    let cleaned = 0;

    for (const [docId, state] of this.documents) {
      if (state.users.size === 0 && state.isExpired()) {
        this.documents.delete(docId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(
        `[DocumentManager] Cleaned up ${cleaned} expired documents. Active: ${this.documents.size}`,
      );
    }
  }

  createDocumentState(docId: string) {
    if (!this.documents.has(docId)) {
      if (this.documents.size >= config.limits.maxDocuments) {
        throw new DocumentLimitError(
          `Maximum document limit (${config.limits.maxDocuments}) reached`,
        );
      }
      this.documents.set(docId, new DocumentState());
    }
  }

  getDocumentState(docId: string): DocumentState {
    let state = this.documents.get(docId);
    if (!state) {
      if (this.documents.size >= config.limits.maxDocuments) {
        throw new DocumentLimitError(
          `Maximum document limit (${config.limits.maxDocuments}) reached`,
        );
      }
      state = new DocumentState();
      this.documents.set(docId, state);
    }
    state.touch();
    return state;
  }

  checkDocumentSize(docId: string): boolean {
    const state = this.documents.get(docId);
    if (!state) return true;

    return state.getContentSize() <= config.limits.maxDocumentSizeBytes;
  }

  getStats() {
    return {
      documentCount: this.documents.size,
      maxDocuments: config.limits.maxDocuments,
      maxDocumentSizeBytes: config.limits.maxDocumentSizeBytes,
      documentTTLMs: config.limits.documentTTLMs,
    };
  }

  getCRDTEngine(): "custom" | "yjs" {
    return getCRDTEngine();
  }
}

export const docManager = new DocumentManager();

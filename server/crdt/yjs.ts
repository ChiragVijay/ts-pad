import * as Y from "yjs";
import type {
  CRDTAdapter,
  CRDTDeleteData,
  CRDTIdentifierData,
  CRDTInsertData,
  CRDTSnapshotData,
  LocalDeleteResult,
  LocalInsertResult,
  RemoteDeleteResult,
  RemoteInsertResult,
  YjsOperation,
  YjsSnapshot,
} from "./types";

function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(base64, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class YjsCRDTAdapter implements CRDTAdapter {
  private doc: Y.Doc;
  private text: Y.Text;
  private capturedUpdate: Uint8Array | null = null;
  readonly engineType = "yjs" as const;

  constructor(siteId: string) {
    this.doc = new Y.Doc();
    this.doc.clientID = this.generateClientID(siteId);
    this.text = this.doc.getText("content");

    this.doc.on("update", (update: Uint8Array) => {
      this.capturedUpdate = update;
    });
  }

  private generateClientID(siteId: string): number {
    let hash = 5381;
    for (let i = 0; i < siteId.length; i++) {
      hash = (hash * 33) ^ siteId.charCodeAt(i);
    }
    return hash >>> 0;
  }

  localInsert(value: string, index: number): LocalInsertResult {
    this.capturedUpdate = null;
    this.doc.transact(() => this.text.insert(index, value));

    if (!this.capturedUpdate) {
      throw new Error("No update captured after insert");
    }

    return {
      operation: {
        update: uint8ToBase64(this.capturedUpdate),
        index,
        value,
      } as YjsOperation,
      visibleIndex: index,
    };
  }

  localDelete(index: number): LocalDeleteResult | null {
    if (index < 0 || index >= this.text.length) {
      return null;
    }

    this.capturedUpdate = null;
    this.doc.transact(() => this.text.delete(index, 1));

    if (!this.capturedUpdate) {
      throw new Error("No update captured after delete");
    }

    return {
      operation: {
        update: uint8ToBase64(this.capturedUpdate),
        index,
      } as YjsOperation,
      visibleIndex: index,
    };
  }

  remoteInsert(operation: CRDTInsertData): RemoteInsertResult | null {
    const op = operation as YjsOperation;
    let appliedIndex = -1;

    const observer = (event: Y.YTextEvent) => {
      let currentPos = 0;
      for (const d of event.delta) {
        if (d.insert) {
          appliedIndex = currentPos;
          break;
        }
        if (d.retain) {
          currentPos += d.retain;
        }
      }
    };

    this.text.observe(observer);
    try {
      Y.applyUpdate(this.doc, base64ToUint8(op.update));
      const finalIndex = appliedIndex !== -1 ? appliedIndex : op.index;
      return { visibleIndex: finalIndex, value: op.value || "" };
    } catch (e) {
      console.error("Failed to apply remote insert:", e);
      return null;
    } finally {
      this.text.unobserve(observer);
    }
  }

  remoteDelete(operation: CRDTDeleteData): RemoteDeleteResult | null {
    const op = operation as YjsOperation;
    let appliedIndex = -1;

    const observer = (event: Y.YTextEvent) => {
      let currentPos = 0;
      for (const d of event.delta) {
        if (d.delete) {
          appliedIndex = currentPos;
          break;
        }
        if (d.retain) {
          currentPos += d.retain;
        }
      }
    };

    this.text.observe(observer);
    try {
      Y.applyUpdate(this.doc, base64ToUint8(op.update));
      const finalIndex = appliedIndex !== -1 ? appliedIndex : op.index;
      return { visibleIndex: finalIndex };
    } catch (e) {
      console.error("Failed to apply remote delete:", e);
      return null;
    } finally {
      this.text.unobserve(observer);
    }
  }

  getVisibleIndex(id: CRDTIdentifierData): number {
    const op = id as YjsOperation;
    return op?.index ?? -1;
  }

  toString(): string {
    return this.text.toString();
  }

  getSnapshot(): YjsSnapshot {
    return {
      update: uint8ToBase64(Y.encodeStateAsUpdate(this.doc)),
      engineType: "yjs",
    };
  }

  applySnapshot(snapshot: CRDTSnapshotData): void {
    const snap = snapshot as YjsSnapshot;
    if (snap.engineType !== "yjs") {
      throw new Error("Invalid snapshot type for Yjs adapter");
    }
    Y.applyUpdate(this.doc, base64ToUint8(snap.update));
  }
}

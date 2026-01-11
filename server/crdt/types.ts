export type CRDTEngine = "custom" | "yjs";

// --- Custom CRDT Types ---

export interface Identifier {
  siteId: string;
  counter: number;
}

export interface Char {
  id: Identifier;
  value: string;
  visible: boolean;
}

export interface RemoteInsertOp {
  char: Char;
  leftId: Identifier | null;
}

export interface CustomCRDTSnapshot {
  siteIds: string[];
  chars: [number, number, string, number][];
  counter: number;
}

// --- Yjs CRDT Types ---

/**
 * Yjs-based operation format
 * Uses binary updates encoded as base64 for efficient sync
 */
export interface YjsOperation {
  update: string; // Base64 encoded Yjs update
  index: number; // Visible index for cursor positioning
  value?: string; // The inserted character (for inserts only)
}

export interface YjsSnapshot {
  update: string; // Base64 encoded full state
  engineType: "yjs";
}

export type CRDTInsertData = RemoteInsertOp | YjsOperation;
export type CRDTDeleteData = Char | YjsOperation;
export type CRDTSnapshotData = CustomCRDTSnapshot | YjsSnapshot;
export type CRDTIdentifierData = Identifier | YjsOperation;

export interface InsertOperation {
  type: "insert";
  data: CRDTInsertData;
}

export interface DeleteOperation {
  type: "delete";
  data: CRDTDeleteData;
}

export type CRDTOperation = InsertOperation | DeleteOperation;

export interface LocalInsertResult {
  operation: CRDTInsertData;
  visibleIndex: number;
}

export interface LocalDeleteResult {
  operation: CRDTDeleteData;
  visibleIndex: number;
}

export interface RemoteInsertResult {
  visibleIndex: number;
  value: string;
}

export interface RemoteDeleteResult {
  visibleIndex: number;
}

export interface CRDTAdapter {
  /**
   * Insert a character locally at the given visible index
   * Returns the operation to broadcast to other clients
   */
  localInsert(value: string, index: number): LocalInsertResult;

  /**
   * Delete a character locally at the given visible index
   * Returns the operation to broadcast, or null if index is invalid
   */
  localDelete(index: number): LocalDeleteResult | null;

  /**
   * Apply a remote insert operation received from another client
   */
  remoteInsert(operation: CRDTInsertData): RemoteInsertResult | null;

  /**
   * Apply a remote delete operation received from another client
   */
  remoteDelete(operation: CRDTDeleteData): RemoteDeleteResult | null;

  /**
   * Get the visible index for a character identifier
   * Used for cursor positioning after remote operations
   */
  getVisibleIndex(id: CRDTIdentifierData): number;

  /**
   * Get the current visible text content
   */
  toString(): string;

  /**
   * Serialize the current state for sending to new clients
   */
  getSnapshot(): CRDTSnapshotData;

  /**
   * Apply a snapshot received from the server
   */
  applySnapshot(snapshot: CRDTSnapshotData): void;

  /**
   * Get the CRDT engine type
   */
  readonly engineType: CRDTEngine;
}

export type CRDTFactory = (siteId: string) => CRDTAdapter;

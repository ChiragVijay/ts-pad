import { config } from "../config";
import { CustomCRDTAdapter } from "./custom";
import type { CRDTAdapter, CRDTEngine } from "./types";
import { YjsCRDTAdapter } from "./yjs";

export function createCRDT(siteId: string): CRDTAdapter {
  if (config.crdtEngine === "yjs") {
    return new YjsCRDTAdapter(siteId);
  }
  return new CustomCRDTAdapter(siteId);
}

export function getCRDTEngine(): CRDTEngine {
  return config.crdtEngine;
}

export type {
  Char,
  CRDTAdapter,
  CRDTEngine,
  CustomCRDTSnapshot as CRDTSnapshot,
  Identifier,
  LocalDeleteResult,
  LocalInsertResult,
  RemoteDeleteResult,
  RemoteInsertOp,
  RemoteInsertResult,
  YjsOperation,
  YjsSnapshot,
} from "./types";

export { CustomCRDTAdapter } from "./custom";
export { YjsCRDTAdapter } from "./yjs";

export { CRDT } from "./custom";

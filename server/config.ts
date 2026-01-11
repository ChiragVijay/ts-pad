import type { CRDTEngine } from "./crdt/types";

export const config = {
  development: process.env.NODE_ENV !== "production",
  port: process.env.PORT || 3000,
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
  },
  crdtEngine: (process.env.CRDT_ENGINE || "yjs") as CRDTEngine,

  limits: {
    maxDocuments: parseInt(process.env.MAX_DOCUMENTS || "50", 10),
    maxDocumentSizeBytes: parseInt(
      process.env.MAX_DOCUMENT_SIZE || String(50 * 1024),
      10,
    ), // 50KB
    documentTTLMs: parseInt(
      process.env.DOCUMENT_TTL_MS || String(30 * 60 * 1000),
      10,
    ), // 30 minutes
    cleanupIntervalMs: parseInt(
      process.env.CLEANUP_INTERVAL_MS || String(5 * 60 * 1000),
      10,
    ), // 5 minutes
  },
};

import type { CRDTEngine } from "./crdt/types";

export const config = {
  development: process.env.NODE_ENV !== "production",
  port: process.env.PORT || 3000,
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
  },
  crdtEngine: (process.env.CRDT_ENGINE || "yjs") as CRDTEngine,
};

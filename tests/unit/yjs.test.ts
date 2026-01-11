import { beforeEach, describe, expect, test } from "bun:test";
import { YjsCRDTAdapter, type YjsSnapshot } from "../../server/crdt/yjs";

describe("YjsCRDTAdapter", () => {
  let adapter: YjsCRDTAdapter;

  beforeEach(() => {
    adapter = new YjsCRDTAdapter("test-site");
  });

  describe("localInsert", () => {
    test("inserts at beginning of empty document", () => {
      const result = adapter.localInsert("a", 0);

      expect(adapter.toString()).toBe("a");
      expect(result.visibleIndex).toBe(0);
      expect(result.operation).toBeDefined();
    });

    test("inserts multiple characters sequentially", () => {
      adapter.localInsert("h", 0);
      adapter.localInsert("e", 1);
      adapter.localInsert("l", 2);
      adapter.localInsert("l", 3);
      adapter.localInsert("o", 4);

      expect(adapter.toString()).toBe("hello");
    });

    test("inserts at beginning with existing content", () => {
      adapter.localInsert("b", 0);
      adapter.localInsert("a", 0);

      expect(adapter.toString()).toBe("ab");
    });

    test("inserts in middle", () => {
      adapter.localInsert("a", 0);
      adapter.localInsert("c", 1);
      adapter.localInsert("b", 1);

      expect(adapter.toString()).toBe("abc");
    });
  });

  describe("localDelete", () => {
    test("deletes character at index", () => {
      adapter.localInsert("a", 0);
      adapter.localInsert("b", 1);
      adapter.localInsert("c", 2);

      const result = adapter.localDelete(1);

      expect(adapter.toString()).toBe("ac");
      expect(result).not.toBeNull();
      expect(result?.visibleIndex).toBe(1);
    });

    test("returns null for invalid index", () => {
      adapter.localInsert("a", 0);

      const result = adapter.localDelete(5);
      expect(result).toBeNull();
    });

    test("deletes first character", () => {
      adapter.localInsert("a", 0);
      adapter.localInsert("b", 1);

      adapter.localDelete(0);

      expect(adapter.toString()).toBe("b");
    });

    test("deletes last character", () => {
      adapter.localInsert("a", 0);
      adapter.localInsert("b", 1);

      adapter.localDelete(1);

      expect(adapter.toString()).toBe("a");
    });
  });

  describe("remote operations", () => {
    test("remoteInsert applies operation from another client", () => {
      const adapter1 = new YjsCRDTAdapter("client1");
      const adapter2 = new YjsCRDTAdapter("client2");

      const result = adapter1.localInsert("a", 0);

      adapter2.remoteInsert(result.operation);

      expect(adapter2.toString()).toBe("a");
    });

    test("remoteDelete applies operation from another client", () => {
      const adapter1 = new YjsCRDTAdapter("client1");
      const adapter2 = new YjsCRDTAdapter("client2");

      const insertResult = adapter1.localInsert("a", 0);
      adapter2.remoteInsert(insertResult.operation);

      const deleteResult = adapter1.localDelete(0);
      adapter2.remoteDelete(deleteResult!.operation);

      expect(adapter2.toString()).toBe("");
    });
  });

  describe("snapshot serialization", () => {
    test("getSnapshot returns serializable state", () => {
      adapter.localInsert("a", 0);
      adapter.localInsert("b", 1);

      const snapshot = adapter.getSnapshot() as YjsSnapshot;

      expect(snapshot.engineType).toBe("yjs");
      expect(snapshot.update).toBeDefined();
      expect(typeof snapshot.update).toBe("string");
    });

    test("applySnapshot restores state", () => {
      adapter.localInsert("a", 0);
      adapter.localInsert("b", 1);
      const snapshot = adapter.getSnapshot();

      const newAdapter = new YjsCRDTAdapter("new-site");
      newAdapter.applySnapshot(snapshot);

      expect(newAdapter.toString()).toBe("ab");
    });

    test("snapshot is base64 encoded", () => {
      adapter.localInsert("hello", 0);
      const snapshot = adapter.getSnapshot() as YjsSnapshot;

      // Base64 should only contain valid characters
      expect(snapshot.update).toMatch(/^[A-Za-z0-9+/=]+$/);
    });
  });

  describe("conflict resolution", () => {
    test("concurrent inserts converge", () => {
      const adapter1 = new YjsCRDTAdapter("client1");
      const adapter2 = new YjsCRDTAdapter("client2");

      const op1 = adapter1.localInsert("A", 0);
      const op2 = adapter2.localInsert("B", 0);

      adapter1.remoteInsert(op2.operation);
      adapter2.remoteInsert(op1.operation);

      expect(adapter1.toString()).toBe(adapter2.toString());
      expect(adapter1.toString().length).toBe(2);
    });

    test("multiple inserts from different clients converge", () => {
      const adapter1 = new YjsCRDTAdapter("client1");
      const adapter2 = new YjsCRDTAdapter("client2");

      // Client 1 types "HI"
      const h = adapter1.localInsert("H", 0);
      const i = adapter1.localInsert("I", 1);

      // Client 2 types "YO" concurrently
      const y = adapter2.localInsert("Y", 0);
      const o = adapter2.localInsert("O", 1);

      // Sync both ways
      adapter1.remoteInsert(y.operation);
      adapter1.remoteInsert(o.operation);
      adapter2.remoteInsert(h.operation);
      adapter2.remoteInsert(i.operation);

      expect(adapter1.toString()).toBe(adapter2.toString());
      expect(adapter1.toString().length).toBe(4);
    });
  });

  describe("engineType", () => {
    test("returns yjs", () => {
      expect(adapter.engineType).toBe("yjs");
    });
  });

  describe("edge cases", () => {
    test("empty document toString", () => {
      expect(adapter.toString()).toBe("");
    });

    test("delete from empty document returns null", () => {
      expect(adapter.localDelete(0)).toBeNull();
    });

    test("large document operations", () => {
      const text = "a".repeat(1000);
      for (let i = 0; i < text.length; i++) {
        adapter.localInsert(text[i], i);
      }

      expect(adapter.toString()).toBe(text);
      expect(adapter.toString().length).toBe(1000);
    });
  });
});


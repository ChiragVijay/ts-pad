import { beforeEach, describe, expect, test } from "bun:test";
import { CRDT, type RemoteInsertOp } from "../../server/crdt";

describe("CRDT", () => {
  let crdt: CRDT;

  beforeEach(() => {
    crdt = new CRDT("test-site");
  });

  describe("localInsert", () => {
    test("inserts at beginning of empty document", () => {
      const op = crdt.localInsert("a", 0);

      expect(crdt.toString()).toBe("a");
      expect(op.char.value).toBe("a");
      expect(op.char.id.siteId).toBe("test-site");
      expect(op.char.id.counter).toBe(0);
      expect(op.leftId).toBeNull();
    });

    test("inserts multiple characters sequentially", () => {
      crdt.localInsert("h", 0);
      crdt.localInsert("e", 1);
      crdt.localInsert("l", 2);
      crdt.localInsert("l", 3);
      crdt.localInsert("o", 4);

      expect(crdt.toString()).toBe("hello");
    });

    test("inserts at beginning with existing content", () => {
      crdt.localInsert("b", 0);
      crdt.localInsert("a", 0);

      expect(crdt.toString()).toBe("ab");
    });

    test("inserts in middle", () => {
      crdt.localInsert("a", 0);
      crdt.localInsert("c", 1);
      crdt.localInsert("b", 1);

      expect(crdt.toString()).toBe("abc");
    });

    test("increments counter with each insert", () => {
      const op1 = crdt.localInsert("a", 0);
      const op2 = crdt.localInsert("b", 1);
      const op3 = crdt.localInsert("c", 2);

      expect(op1.char.id.counter).toBe(0);
      expect(op2.char.id.counter).toBe(1);
      expect(op3.char.id.counter).toBe(2);
    });

    test("returns correct leftId", () => {
      const op1 = crdt.localInsert("a", 0);
      const op2 = crdt.localInsert("b", 1);

      expect(op1.leftId).toBeNull();
      expect(op2.leftId).toEqual(op1.char.id);
    });
  });

  describe("localDelete", () => {
    test("deletes character at index", () => {
      crdt.localInsert("a", 0);
      crdt.localInsert("b", 1);
      crdt.localInsert("c", 2);

      const deleted = crdt.localDelete(1);

      expect(crdt.toString()).toBe("ac");
      expect(deleted?.value).toBe("b");
      expect(deleted?.visible).toBe(false);
    });

    test("returns null for invalid index", () => {
      crdt.localInsert("a", 0);

      const deleted = crdt.localDelete(5);
      expect(deleted).toBeNull();
    });

    test("deletes first character", () => {
      crdt.localInsert("a", 0);
      crdt.localInsert("b", 1);

      crdt.localDelete(0);

      expect(crdt.toString()).toBe("b");
    });

    test("deletes last character", () => {
      crdt.localInsert("a", 0);
      crdt.localInsert("b", 1);

      crdt.localDelete(1);

      expect(crdt.toString()).toBe("a");
    });

    test("tombstone remains in array", () => {
      crdt.localInsert("a", 0);
      crdt.localInsert("b", 1);
      crdt.localDelete(0);

      const state = crdt.getState();
      expect(state.array.length).toBe(2);
      expect(state.array[0].visible).toBe(false);
      expect(state.array[1].visible).toBe(true);
    });
  });

  describe("remoteInsert", () => {
    test("inserts remote operation", () => {
      const remoteOp: RemoteInsertOp = {
        char: {
          id: { siteId: "remote", counter: 0 },
          value: "x",
          visible: true,
        },
        leftId: null,
      };

      crdt.remoteInsert(remoteOp);

      expect(crdt.toString()).toBe("x");
    });

    test("inserts after specified leftId", () => {
      const op = crdt.localInsert("a", 0);

      const remoteOp: RemoteInsertOp = {
        char: {
          id: { siteId: "remote", counter: 0 },
          value: "b",
          visible: true,
        },
        leftId: op.char.id,
      };

      crdt.remoteInsert(remoteOp);

      expect(crdt.toString()).toBe("ab");
    });

    test("ignores operation with non-existent leftId", () => {
      crdt.localInsert("a", 0);

      const remoteOp: RemoteInsertOp = {
        char: {
          id: { siteId: "remote", counter: 0 },
          value: "b",
          visible: true,
        },
        leftId: { siteId: "nonexistent", counter: 999 },
      };

      crdt.remoteInsert(remoteOp);

      expect(crdt.toString()).toBe("a");
    });

    test("updates counter from remote operation", () => {
      const remoteOp: RemoteInsertOp = {
        char: {
          id: { siteId: "remote", counter: 100 },
          value: "x",
          visible: true,
        },
        leftId: null,
      };

      crdt.remoteInsert(remoteOp);
      const localOp = crdt.localInsert("y", 1);

      expect(localOp.char.id.counter).toBe(101);
    });
  });

  describe("remoteDelete", () => {
    test("deletes character by id", () => {
      const op = crdt.localInsert("a", 0);
      crdt.localInsert("b", 1);

      crdt.remoteDelete(op.char.id);

      expect(crdt.toString()).toBe("b");
    });

    test("ignores non-existent id", () => {
      crdt.localInsert("a", 0);

      crdt.remoteDelete({ siteId: "nonexistent", counter: 999 });

      expect(crdt.toString()).toBe("a");
    });
  });

  describe("conflict resolution", () => {
    test("concurrent inserts at same position resolve deterministically", () => {
      const crdt1 = new CRDT("client-a");
      const crdt2 = new CRDT("client-b");

      const op1 = crdt1.localInsert("A", 0);
      const op2 = crdt2.localInsert("B", 0);

      crdt1.remoteInsert(op2);
      crdt2.remoteInsert(op1);

      expect(crdt1.toString()).toBe(crdt2.toString());
    });

    test("higher counter wins position (comes first)", () => {
      const crdt1 = new CRDT("client-a");
      const crdt2 = new CRDT("client-b");

      // Build up counter in crdt1
      crdt1.localInsert("x", 0);
      crdt1.localInsert("x", 1);
      const op1 = crdt1.localInsert("A", 2); // counter = 2

      const op2 = crdt2.localInsert("B", 0); // counter = 0

      // Fresh CRDTs to test merge order
      const test1 = new CRDT("test1");
      const test2 = new CRDT("test2");

      test1.remoteInsert(op1);
      test1.remoteInsert(op2);

      test2.remoteInsert(op2);
      test2.remoteInsert(op1);

      expect(test1.toString()).toBe(test2.toString());
    });

    test("same counter, higher siteId wins", () => {
      const crdt1 = new CRDT("aaa");
      const crdt2 = new CRDT("zzz");

      const op1 = crdt1.localInsert("A", 0);
      const op2 = crdt2.localInsert("Z", 0);

      crdt1.remoteInsert(op2);
      crdt2.remoteInsert(op1);

      expect(crdt1.toString()).toBe("ZA");
      expect(crdt2.toString()).toBe("ZA");
    });

    test("interleaved typing from two clients", () => {
      const crdt1 = new CRDT("client1");
      const crdt2 = new CRDT("client2");

      const ops1: RemoteInsertOp[] = [];
      const ops2: RemoteInsertOp[] = [];

      ops1.push(crdt1.localInsert("H", 0));
      ops2.push(crdt2.localInsert("W", 0));
      ops1.push(crdt1.localInsert("i", 1));
      ops2.push(crdt2.localInsert("o", 1));

      for (const op of ops2) crdt1.remoteInsert(op);
      for (const op of ops1) crdt2.remoteInsert(op);

      expect(crdt1.toString()).toBe(crdt2.toString());
    });
  });

  describe("getVisibleIndex", () => {
    test("returns correct visible index", () => {
      const op1 = crdt.localInsert("a", 0);
      const op2 = crdt.localInsert("b", 1);
      const op3 = crdt.localInsert("c", 2);

      expect(crdt.getVisibleIndex(op1.char.id)).toBe(0);
      expect(crdt.getVisibleIndex(op2.char.id)).toBe(1);
      expect(crdt.getVisibleIndex(op3.char.id)).toBe(2);
    });

    test("accounts for deleted characters", () => {
      const op1 = crdt.localInsert("a", 0);
      crdt.localInsert("b", 1);
      const op3 = crdt.localInsert("c", 2);

      crdt.localDelete(1);

      expect(crdt.getVisibleIndex(op1.char.id)).toBe(0);
      expect(crdt.getVisibleIndex(op3.char.id)).toBe(1);
    });

    test("returns -1 for non-existent id", () => {
      crdt.localInsert("a", 0);

      expect(crdt.getVisibleIndex({ siteId: "x", counter: 99 })).toBe(-1);
    });
  });

  describe("state serialization", () => {
    test("getState returns complete state", () => {
      crdt.localInsert("a", 0);
      crdt.localInsert("b", 1);

      const state = crdt.getState();

      expect(state.array.length).toBe(2);
      expect(state.counter).toBe(2);
    });

    test("setState restores state", () => {
      crdt.localInsert("a", 0);
      crdt.localInsert("b", 1);
      const state = crdt.getState();

      const newCrdt = new CRDT("new-site");
      newCrdt.setState(state);

      expect(newCrdt.toString()).toBe("ab");
    });

    test("counter is preserved after setState", () => {
      crdt.localInsert("a", 0);
      crdt.localInsert("b", 1);
      const state = crdt.getState();

      const newCrdt = new CRDT("new-site");
      newCrdt.setState(state);
      const op = newCrdt.localInsert("c", 2);

      expect(op.char.id.counter).toBe(2);
    });
  });

  describe("edge cases", () => {
    test("empty document toString", () => {
      expect(crdt.toString()).toBe("");
    });

    test("delete from empty document", () => {
      expect(crdt.localDelete(0)).toBeNull();
    });

    test("multiple deletes on same character (idempotent)", () => {
      const op = crdt.localInsert("a", 0);

      crdt.remoteDelete(op.char.id);
      crdt.remoteDelete(op.char.id);

      expect(crdt.toString()).toBe("");
    });

    test("insert after deleted character", () => {
      crdt.localInsert("a", 0);
      crdt.localInsert("b", 1);
      crdt.localDelete(0);
      crdt.localInsert("c", 0);

      expect(crdt.toString()).toBe("cb");
    });

    test("large document operations", () => {
      const text = "a".repeat(1000);
      for (let i = 0; i < text.length; i++) {
        crdt.localInsert(text[i], i);
      }

      expect(crdt.toString()).toBe(text);
      expect(crdt.getState().array.length).toBe(1000);
    });
  });
});

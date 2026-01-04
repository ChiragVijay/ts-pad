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

export interface CRDTSnapshot {
  siteIds: string[];
  chars: [number, number, string, number][];
  counter: number;
}

export class CRDT {
  private array: Char[] = [];
  private counter: number = 0;
  private siteId: string;

  constructor(siteId: string) {
    this.siteId = siteId;
  }

  localInsert(value: string, index: number): RemoteInsertOp {
    const leftChar = this.array[index - 1];
    const char: Char = {
      id: { siteId: this.siteId, counter: this.counter++ },
      value,
      visible: true,
    };
    this.array.splice(index, 0, char);
    return { char, leftId: leftChar ? leftChar.id : null };
  }

  localDelete(index: number): Char | null {
    let visibleCount = 0;
    for (let i = 0; i < this.array.length; i++) {
      if (this.array[i].visible) {
        if (visibleCount === index) {
          this.array[i].visible = false;
          return this.array[i];
        }
        visibleCount++;
      }
    }
    return null;
  }

  remoteInsert(operation: RemoteInsertOp) {
    const { char, leftId } = operation;

    let index = -1;
    if (leftId !== null) {
      index = this.findIndexById(leftId);

      if (index === -1) return;
    }

    let insertionIndex = index + 1;

    while (
      insertionIndex < this.array.length &&
      (this.array[insertionIndex].id.counter > char.id.counter ||
        (this.array[insertionIndex].id.counter === char.id.counter &&
          this.array[insertionIndex].id.siteId > char.id.siteId))
    ) {
      insertionIndex++;
    }

    this.counter = Math.max(this.counter, char.id.counter + 1);

    this.array.splice(insertionIndex, 0, char);
  }

  remoteDelete(charId: Identifier) {
    const index = this.findIndexById(charId);
    if (index !== -1) {
      this.array[index].visible = false;
    }
  }

  private findIndexById(id: Identifier): number {
    return this.array.findIndex(
      (c) => c.id.counter === id.counter && c.id.siteId === id.siteId,
    );
  }

  getVisibleIndex(charId: Identifier): number {
    const targetIndex = this.findIndexById(charId);
    if (targetIndex === -1) return -1;

    let visibleIndex = 0;
    for (let i = 0; i < targetIndex; i++) {
      if (this.array[i].visible) {
        visibleIndex++;
      }
    }
    return visibleIndex;
  }

  toString(): string {
    return this.array
      .filter((char) => char.visible)
      .map((char) => char.value)
      .join("");
  }

  getState(): { array: Char[]; counter: number } {
    return { array: this.array, counter: this.counter };
  }

  setState(state: { array: Char[]; counter: number }) {
    this.array = state.array;
    this.counter = state.counter;
  }

  getSnapshot(): CRDTSnapshot {
    const siteIdMap = new Map<string, number>();
    const siteIds: string[] = [];

    const getSiteIndex = (id: string) => {
      if (!siteIdMap.has(id)) {
        siteIdMap.set(id, siteIds.length);
        siteIds.push(id);
      }
      return siteIdMap.get(id)!;
    };

    const chars = this.array.map(
      (c) =>
        [
          getSiteIndex(c.id.siteId),
          c.id.counter,
          c.value,
          c.visible ? 1 : 0,
        ] as [number, number, string, number],
    );

    return { siteIds, chars, counter: this.counter };
  }

  applySnapshot(snapshot: CRDTSnapshot) {
    this.counter = snapshot.counter;
    this.array = snapshot.chars.map((c) => ({
      id: { siteId: snapshot.siteIds[c[0]], counter: c[1] },
      value: c[2],
      visible: c[3] === 1,
    }));
  }
}

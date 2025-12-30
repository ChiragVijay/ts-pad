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
    const char = this.array[index];
    if (char) {
      char.visible = false;
      return char;
    }
    return null;
  }

  remoteInsert(operation: RemoteInsertOp) {
    const { char, leftId } = operation;

    let index = -1;
    if (leftId !== null) {
      index = this.array.findIndex(
        (c) => c.id.counter === leftId.counter && c.id.siteId === leftId.siteId,
      );

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
    const char = this.array.find(
      (c) => c.id.counter === charId.counter && c.id.siteId === charId.siteId,
    );
    if (char) {
      char.visible = false;
    }
  }

  toString(): string {
    return this.array
      .filter((char) => char.visible)
      .map((char) => char.value)
      .join("");
  }
}

import { type SourceFileInfo, } from "../source-file-info.ts";

/**
 * TextParserResultArray — specialized array for multiple values at the same
 * index.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/StackElement.rb
 */
export class TextParserResultArray<T,> extends Array<T> {
  /**
   * Adds a value. It only concatenates when the item is *another*
   * `TextParserResultArray` (nested repeatable loop), replicating the Ruby `<<`
   * (TextParser.rb l.69-75). "Plain" arrays (e.g. sort-criteria tuples) are
   * stored as a single element, without flattening.
   *
   * @param items Values to add.
   * @returns The new length of the array.
   */
  override push(...items: (T | T[])[]): number {
    for (const item of items) {
      if (item instanceof TextParserResultArray) {
        // Inner loop: merge with the outer array.
        super.push(...item,);
      } else {
        super.push(item as T,);
      }
    }
    return this.length;
  }
}

/**
 * StackElement — element of the TextParser stack used to track the parser
 * state while a rule is being reduced.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/StackElement.rb
 */
export class StackElement {
  /** Values collected so far, one per pattern position. */
  readonly val: unknown[];
  /** Source location of each collected value. */
  readonly sourceFileInfo: Array<SourceFileInfo | null>;
  /** Location of the first collected value, kept for fast access. */
  firstSourceFileInfo: SourceFileInfo | null;
  /** Position where the next `store` writes. */
  private position: number;
  /** Interpreter hook of the rule being reduced, or `null`. */
  readonly function: ((...args: unknown[]) => unknown) | null;
  /** Parser state attached to the element, when needed. */
  state: unknown | null;

  /**
   * Creates an empty stack element.
   *
   * @param fn Interpreter hook of the rule being reduced, or `null`.
   * @param state Parser state to attach to the element.
   */
  constructor(
    fn: ((...args: unknown[]) => unknown) | null,
    state: unknown | null = null,
  ) {
    this.val = [];
    this.sourceFileInfo = [];
    this.firstSourceFileInfo = null;
    this.position = 0;
    this.function = fn;
    this.state = state;
  }

  /**
   * Inserts the value _val_ at the position _index_.
   * When _multiValue_ is true, concatenates instead of replacing (through
   * `TextParserResultArray`).
   *
   * @param index Position that receives the value.
   * @param val Value to insert.
   * @param sourceFileInfo Location of the value.
   * @param multiValue Whether the position accumulates several values.
   * @returns The inserted value.
   * @throws Error When the position already holds a non-array value.
   */
  insert(
    index: number,
    val: unknown,
    sourceFileInfo: SourceFileInfo | null,
    multiValue: boolean,
  ): unknown {
    if (multiValue) {
      if (this.val[index]) {
        // There is already a value for this position.
        if (!Array.isArray(this.val[index],)) {
          // This should not happen.
          throw new Error(
            `${this.val[index].constructor.name} deve ser um Array`,
          );
        }
      } else {
        this.val[index] = new TextParserResultArray<unknown>();
      }
      // Only adds the value and applies the special Array concatenation.
      (this.val[index] as TextParserResultArray<unknown>).push(val,);
    } else {
      this.val[index] = val;
    }
    this.sourceFileInfo[index] = sourceFileInfo;
    // Stores the first SFI for faster access.
    if (this.firstSourceFileInfo === null) {
      this.firstSourceFileInfo = sourceFileInfo;
    }
    return val;
  }

  /**
   * Stores a collected value and advances the position to the next pattern.
   *
   * @param val Value to store.
   * @param sourceFileInfo Location of the value.
   */
  store(val: unknown, sourceFileInfo: SourceFileInfo | null = null,): void {
    this.val[this.position] = val;
    this.sourceFileInfo[this.position] = sourceFileInfo;
    this.position++;
  }

  /** Iterates over the stored values. */
  each(): IterableIterator<unknown> {
    return this.val[Symbol.iterator]();
  }

  /** Number of stored values. */
  length(): number {
    return this.val.length;
  }
}

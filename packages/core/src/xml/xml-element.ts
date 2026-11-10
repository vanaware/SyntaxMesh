/**
 * XMLElement — faithful port of `XMLElement.rb` (phase 17.1).
 *
 * Replaces the phase 12 `XMLElement` (ADR 038). The tree is the same, but the
 * **serialization** now replicates Ruby's `to_s(indent)`, including the details
 * the minimal version did not have:
 *
 *   - Attributes sorted by key (`@attributes.keys.sort`).
 *   - `<name/>` only when `selfClosing` **and** there are no children;
 *     otherwise `<name></name>`.
 *   - Line break plus indentation between non-`XMLText` children, only when
 *     there is more than one child and the buffer ends with `>`. The
 *     indentation is **one SPACE per level** (`' ' * indent`) — not two, as the
 *     plan suggests (§4.2). Ruby is the source of truth.
 *   - `escape` handles only `&` and `"`; it does **not** escape `<`/`>` (that is
 *     `XMLText#to_s`, which has its own case). The plan (§4.2, task 17.1.1.19)
 *     asked for `<`/`>` in `escape` — divergence recorded.
 *
 * Ruby bugs/oddities (categories of `cheat-sheet-ruby-ts.md` §12):
 *   - **Category B** — `escape` emits `\"` (backslash + quote) for `"`, instead
 *     of `&quot;`. That is what `tj3` writes into HTML/XML; we replicate it
 *     when `compat.keepRubyBugs` is `true` (the default). With the flag `false`
 *     we use the correct form (`&quot;`).
 *   - **Category C** — the `quotes` parameter of `escape(str, quotes = false)`
 *     is **ignored** by Ruby: quotes are escaped unconditionally. We keep the
 *     parameter for the signature.
 *   - **Category A (fixed)** — `XMLElement#<<` with an `Array` runs
 *     `arg.delete_if { |i| i.nil? }`, i.e. it **mutates the caller's array**.
 *     The effect on the tree is identical; we do not mutate the input.
 *
 * Additions required by the `XMLElementLike` contract (phase 12), documented in
 * ADR 038: the `tag` getter (alias of `name`), `toHTML()` (alias of `to_s(0)`)
 * and acceptance of `XMLElementLike` in `append` (so the signature satisfies the
 * interface without breaking callers that still pass old nodes).
 *
 * @see docs/taskjuggler/lib/taskjuggler/XMLElement.rb
 * @see docs/syntaxmesh/decisoes/038-substituicao-xml.md
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.1)
 */

import type { XMLElementLike, } from "./xml-element-like.ts";
import { compat, } from "../compat.ts";
import { eachUtf8Char, } from "../utils/utf8.ts";

/** Child accepted by `append` (Ruby: `XMLElement | String | Array | nil`). */
export type XmlChild =
  | XMLElement
  | XMLElementLike
  | string
  | null
  | undefined;

/** Argument of `append`: one child or a list of children (no nesting). */
export type XmlChildArg = XmlChild | XmlChild[];

/**
 * Result of the constructor block. Unlike `append`, Ruby flattens nested lists
 * here (`@children.flatten!`), so the type is recursive.
 */
export type XmlBlockResult = XmlChild | XmlBlockResult[] | void;

/**
 * Constructor block (Ruby `&block`, invoked as `yield(block)` — the block
 * receives itself as the argument).
 */
export type XmlBlock = (block: XmlBlock,) => XmlBlockResult;

/** Class/type name for error messages (approximates `c.class`). */
function typeName(value: unknown,): string {
  if (value === null) return "NilClass";
  if (Array.isArray(value,)) return "Array";
  if (typeof value === "object" && value.constructor?.name) {
    return String(value.constructor.name,);
  }
  return typeof value;
}

/** Short value inspection (approximates `Object#inspect` in Ruby messages). */
function inspectValue(value: unknown,): string {
  if (typeof value === "string") return `"${value}"`;
  if (value === null || value === undefined) return String(value,);
  if (typeof value === "object") {
    const keys = Object.keys(value,);
    return keys.length === 0 ?
      "{}" :
      `{${keys.slice(0, 3,).join(", ",)}${keys.length > 3 ? ", ..." : ""}}`;
  }
  return String(value,);
}

/** XML/HTML element with children — the basic node of every serialization. */
export class XMLElement implements XMLElementLike {
  /** Tag name (Ruby `@name`). `null` = a node without its own tag. */
  readonly name: string | null;
  /** Key→value attributes (Ruby `@attributes`). */
  readonly attrs: Record<string, string>;
  /** When `true`, it may be serialized as `<name/>` while empty. */
  readonly selfClosing: boolean;
  /** Children (always `XMLElement`; strings became `XMLText`). */
  readonly children: XMLElement[];

  /**
   * Ruby: `initialize(name, attributes = {}, selfClosing = false, &block)`.
   *
   * The block (when present) produces the children: a single value becomes a
   * list, lists are flattened, strings become `XMLText`, `null`s are dropped
   * and whatever remains must be an `XMLElement`.
   *
   * @param name Tag name, or `null` for a tagless node.
   * @param attrs Attributes of the element.
   * @param selfClosing Whether an empty element may collapse to `<name/>`.
   * @param block Callback that produces the children.
   * @throws Error When the name, an attribute or a child has an invalid type.
   */
  constructor(
    name: string | null,
    attrs: Record<string, string> = {},
    selfClosing = false,
    block?: XmlBlock,
  ) {
    // 17.1.1.3 — `name` must be a string or null; null carries no attributes.
    if (
      (name === null && Object.keys(attrs,).length > 0) ||
      (name !== null && typeof name !== "string")
    ) {
      throw new Error(
        `Name must be nil or a String: ${inspectValue(name,)}`,
      );
    }
    // 17.1.1.4 — attribute names and values may be neither null nor
    // non-String.
    for (const [key, value,] of Object.entries(attrs,)) {
      if (key === null || value === null || value === undefined) {
        throw new Error(
          `Attribute name (${key}) or value (${value}) may not be nil`,
        );
      }
      if (typeof value !== "string") {
        throw new Error(`Attribute value of ${key} must be a String`,);
      }
    }

    this.name = name;
    this.attrs = attrs;
    this.selfClosing = selfClosing;

    // 17.1.1.5–8 — same pipeline as Ruby for the children of the block.
    let kids: unknown[] = [];
    if (block) {
      const result: unknown = block(block,);
      kids = Array.isArray(result,) ? result.flat(Infinity,) : [result,];
    }
    const built: XMLElement[] = [];
    for (const kid of kids) {
      if (kid === null || kid === undefined) continue; // 17.1.1.7
      if (typeof kid === "string") {
        built.push(new XMLText(kid,),); // 17.1.1.6
        continue;
      }
      if (!(kid instanceof XMLElement)) {
        // 17.1.1.8
        throw new Error(
          `Element must be of type XMLElement, not ${typeName(kid,)}: ${
            inspectValue(kid,)
          }`,
        );
      }
      built.push(kid,);
    }
    this.children = built;
  }

  /** Ruby `attr_reader :name` through the interface (`XMLElementLike.tag`). */
  get tag(): string | null {
    return this.name;
  }

  /** Ruby `<<` (17.1.1.9–12). Returns `self`, as in Ruby. */
  append(arg: XmlChildArg,): this {
    if (arg instanceof XMLElement) {
      this.children.push(arg,);
    } else if (typeof arg === "string") {
      this.children.push(new XMLText(arg,),);
    } else if (Array.isArray(arg,)) {
      // Category A: Ruby would mutate `arg` while removing the nulls
      // (`delete_if`).
      const items: XMLElement[] = [];
      for (const item of arg) {
        if (item === null || item === undefined) continue;
        if (!(item instanceof XMLElement)) {
          throw new Error(
            `Element must be of type XMLElement, not ${typeName(item,)}: ${
              inspectValue(item,)
            }`,
          );
        }
        items.push(item,);
      }
      this.children.push(...items,);
    } else if (arg === null || arg === undefined) {
      // 17.1.1.11 — inserting null is ignored.
    } else {
      throw new Error(
        `Elements must be of type XMLElement not ${typeName(arg,)}`,
      );
    }
    return this;
  }

  /** Ruby `[]=` (17.1.1.13) — the value must be a String. */
  setAttr(attribute: string, value: string,): void {
    if (typeof value !== "string") {
      throw new Error(
        `Attribute value ${inspectValue(value,)} is not a String`,
      );
    }
    this.attrs[attribute] = value;
  }

  /** Ruby `[]` (17.1.1.14) — `undefined` is equivalent to `nil`. */
  getAttr(attribute: string,): string | undefined {
    return Object.prototype.hasOwnProperty.call(this.attrs, attribute,)
      ? this.attrs[attribute]
      : undefined;
  }

  /** Alias of `to_s(0)` required by `XMLElementLike` (17.1.1.15). */
  toHTML(): string {
    return this.to_s(0,);
  }

  /**
   * Ruby `to_s(indent = 0)` (17.1.1.16–18).
   *
   * @param indent Current nesting level, used for the indentation.
   * @returns The element serialized as XML.
   */
  to_s(indent = 0,): string {
    if (this.name === null) {
      // Ruby: `'<' + nil` raises TypeError. Only the subclasses that override
      // `to_s` (XMLText/XMLComment/XMLBlob) may have a null name.
      throw new TypeError("no implicit conversion of nil into String",);
    }
    let out = "<" + this.name;
    for (const attrName of Object.keys(this.attrs,).sort()) {
      out += ` ${attrName}="${this.escape(this.attrs[attrName] ?? "", true,)}"`;
    }
    if (this.children.length === 0 && this.selfClosing) {
      return out + "/>";
    }
    out += ">";
    for (const child of this.children) {
      // Ruby: only inserts a newline for multiple children and after `>`.
      if (
        this.children.length > 1 && !(child instanceof XMLText) &&
        out.endsWith(">",)
      ) {
        out += "\n" + this.indentation(indent + 1,);
      }
      out += child.to_s(indent + 1,);
    }
    if (this.children.length > 1 && out.endsWith(">",)) {
      out += "\n" + this.indentation(indent,);
    }
    return out + "</" + this.name + ">";
  }

  /**
   * Ruby `escape(str, quotes = false)` (17.1.1.19).
   *
   * Category C: Ruby ignores `quotes` and always escapes `"`. Iterates by code
   * point (`each_utf8_char`), like the rest of the port.
   *
   * @param str Text to escape.
   * @param quotes Ignored; kept for the Ruby signature.
   * @returns The escaped text.
   */
  protected escape(str: string, quotes = false,): string {
    void quotes; // Faithful signature; Ruby never uses the parameter.
    let out = "";
    for (const char of eachUtf8Char(str,)) {
      if (char === "&") out += "&amp;";
      else if (char === '"') out += compat.keepRubyBugs ? '\\"' : "&quot;";
      else out += char;
    }
    return out;
  }

  /** Ruby `indentation(indent)` (17.1.1.20) — one SPACE per level. */
  protected indentation(indent: number,): string {
    return " ".repeat(indent,);
  }
}

/** Plain text: escapes `<`, `>` and `&`, and does **not** escape `"` (17.1.2). */
export class XMLText extends XMLElement {
  private readonly textValue: string;

  /**
   * Ruby `initialize(text)` — rejects a `nil` text.
   *
   * @param text Content of the node.
   * @throws Error When `text` is `null` or `undefined`.
   */
  constructor(text: string,) {
    super(null, {},);
    // Ruby: `raise 'Text may not be nil' unless text` — but `''` is truthy in
    // Ruby and falsy in JS. We check only null/undefined to preserve that.
    if (text === null || text === undefined) {
      throw new Error("Text may not be nil",);
    }
    this.textValue = text;
  }

  /**
   * Escaped content; the indentation is handled by the parent.
   *
   * Ruby: `to_s(indent)` — the parameter is declared but ignored (the text has
   * no line breaks). We accept a call without arguments for the port's
   * convenience.
   *
   * @param _indent Ignored nesting level.
   * @returns The escaped text.
   */
  override to_s(_indent = 0,): string {
    let out = "";
    for (const char of eachUtf8Char(this.textValue,)) {
      if (char === "<") out += "&lt;";
      else if (char === ">") out += "&gt;";
      else if (char === "&") out += "&amp;";
      else out += char;
    }
    return out;
  }
}

/** `name`/`attrs` of the element plus the `text` of the `XMLText` child (17.1.3). */
export class XMLNamedText extends XMLElement {
  /**
   * Builds the named element and appends its text child.
   *
   * @param text Content inserted as the only child.
   * @param name Tag name, or `null` for a tagless node.
   * @param attrs Attributes of the element.
   */
  constructor(
    text: string,
    name: string | null,
    attrs: Record<string, string> = {},
  ) {
    super(name, attrs,);
    this.append(new XMLText(text,),);
  }
}

/** XML comment; `--` is canonicalized into `-\-` (17.1.4). */
export class XMLComment extends XMLElement {
  private readonly textValue: string;

  /**
   * Ruby `initialize(text = '')`.
   *
   * @param text Body of the comment.
   */
  constructor(text = "",) {
    super(null, {},);
    this.textValue = text;
  }

  /**
   * Ruby `to_s(indent = 0)` — the comment plus the indentation of the next
   * line.
   *
   * @param indent Current nesting level.
   * @returns The comment serialized as XML.
   */
  override to_s(indent = 0,): string {
    return `<!-- ${canonicalizeComment(this.textValue,)} -->\n${
      " ".repeat(indent,)
    }`;
  }
}

/**
 * Raw blob (already serialized XML/HTML). It does not interpret the content; it
 * only re-indents whatever comes after a `\n` (17.1.5).
 */
export class XMLBlob extends XMLElement {
  private readonly blob: string;

  /**
   * Ruby `initialize(blob = '')` — rejects a `nil` blob.
   *
   * @param blob Serialized markup kept as is.
   * @throws Error When `blob` is `null` or `undefined`.
   */
  constructor(blob = "",) {
    super(null, {},);
    if (blob === null || blob === undefined) {
      throw new Error("blob may not be nil",);
    }
    this.blob = blob;
  }

  /**
   * Ruby `to_s(indent = 0)` — re-indents the lines after each `\n`.
   *
   * @param indent Current nesting level.
   * @returns The blob with indented continuation lines.
   */
  override to_s(indent = 0,): string {
    let out = "";
    for (const char of eachUtf8Char(this.blob,)) {
      out += char === "\n" ? "\n" + " ".repeat(indent,) : char;
    }
    return out;
  }
}

/** Ruby `XMLComment#canonicalize_comment` — `--` → `-\-`. */
function canonicalizeComment(text: string,): string {
  return text.replace(/--/g, "-\\-",);
}

/**
 * Fragment without its own tag (an addition of the port, ADR 038 — 17.12).
 *
 * Ruby does **not** have a fragment: `XMLElement#to_s` with a null `@name`
 * raises `TypeError` (`'<' + nil`). Phase 12, with `SimpleXMLElement`, got the
 * consumers used to (RichText `func`/`report`, `ReportTableCell`, `to_html()` of
 * reports that return **several nodes**) grouping children into a tagless node
 * — `XMLElementLike.children`, which has no equivalent in `XMLElement`.
 * `Fragment` preserves that usage: it serializes only the children, glued
 * together (like `to_s(0)`).
 *
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.12)
 */
export class Fragment extends XMLElement {
  /**
   * Builds the fragment and appends every child.
   *
   * @param children Children of the fragment.
   */
  constructor(children: XmlChild[] = [],) {
    super(null, {},);
    for (const child of children) this.append(child,);
  }

  /**
   * Serializes only the children, without separators.
   *
   * @param _indent Ignored; the children are emitted at level 0.
   * @returns The concatenated children.
   */
  override to_s(_indent = 0,): string {
    let out = "";
    for (const child of this.children) out += child.to_s(0,);
    return out;
  }

  /**
   * Alias of `to_s()` required by the `XMLElementLike` contract.
   *
   * @returns The concatenated children.
   */
  override toHTML(): string {
    return this.to_s();
  }
}

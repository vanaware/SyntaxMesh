/**
 * `XMLElementLike` — minimal XML/HTML element interface (phase 12).
 *
 * Origin: `src/richtext/xml-like.ts` (phase 12.1), when RichText needed to
 * return a **tree** of elements instead of a string and the real `XMLElement`
 * did not exist yet. In **phase 17.12** (ADR 038) the minimal `XMLElement`
 * implementation is deleted and `XMLElement` starts fulfilling the contract —
 * the interface then **lives here**, in the XML block, and RichText imports it
 * from here.
 *
 * @see docs/syntaxmesh/decisoes/038-substituicao-xml.md
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.12.1)
 */

/** XML/HTML node interface used by RichText and by Gantt. */
export interface XMLElementLike {
  /** Tag name (e.g. `div`). `null` = fragment (no tag of its own). */
  readonly tag: string | null;
  /** Key→value attributes. */
  readonly attrs: Record<string, string>;
  /** Children: XML nodes (text is already an `XMLElement` — `XMLText`). */
  readonly children: Array<XMLElementLike | string>;
  /** Appends a child (node or text). */
  append(child: XMLElementLike | string,): void;
  /** Serializes to HTML without indentation (alias of `to_s(0)`). */
  toHTML(): string;
}

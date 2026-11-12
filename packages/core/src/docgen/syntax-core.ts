/**
 * `syntax-core.ts` — shared highlight data of the language (22.1b.6).
 *
 * Port of the **collection/classification logic** of `KateSyntax.rb` and
 * `VimSyntax.rb` — the final `.xml`/`.vim` file generators stay **cancelled**
 * (16.15, ADR 035): this module returns **data** for the LSP semantic tokens,
 * the TextMate grammar, completion and folding. The CLI does not consume it.
 *
 * Deliberate divergences (⚠️ ADAPTAÇÃO):
 * - Kate's fixed `keywords` list is written as `macro project supplement
 *   include supplement` (with a duplicate); the data API normalizes it to the
 *   Vim trio `macro/project/supplement` (task 22.1b.6.3).
 * - Kate's time regex carries a typo (`\d{1-2}`); the data rule uses the
 *   intended `\d{1,2}`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/KateSyntax.rb
 * @see docs/taskjuggler/lib/taskjuggler/VimSyntax.rb
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco H
 */

import { KeywordDocumentation, } from "./keyword-documentation.ts";
import { SyntaxReference, } from "./syntax-reference.ts";

/** `VimSyntax#normalize`: dots become underscores (region/keyword ids). */
export function normalize(str: string,): string {
  return str.replace(/\./g, "_",);
}

/** Attribute names skipped by both generators (`KateSyntax.rb:181`). */
const SKIP_ATTRIBUTES = ["resourcereport", "taskreport", "textreport",];

/** Names that stop the attribute walk (`KateSyntax.rb:184-185`). */
const STOP_NAMES = [
  "%",
  "(",
  "~",
  "include",
  "macro",
  "project",
  "supplement",
];

/** Special attributes foldable like properties (`VimSyntax.rb:109`). */
const FOLDABLE = ["task.timesheet", "project",];

/**
 * One highlight rule of the Kate `Normal` context, as data (22.1b.6.4).
 * The order of the list mirrors the order of the original `<contexts>`.
 */
export type TokenRule =
  | { kind: "regexp"; attribute: string; pattern: string }
  | {
    kind: "keywords";
    attribute: string;
    list: "keywords" | "builtin" | "types";
  }
  | {
    kind: "char";
    attribute: string;
    char: string;
    region?: { name: string; edge: "begin" | "end" };
  }
  | { kind: "string"; attribute: string; open: string; close: string }
  | {
    kind: "comment";
    attribute: string;
    open: string;
    /** `null` when the comment ends at the end of the line. */
    close: string | null;
  }
  | {
    kind: "number";
    attribute: string;
    float: boolean;
    suffixes: string[];
  };

/** One `syn region` of `VimSyntax#regions`, as data (22.1b.6.5). */
export interface Region {
  /** Region id (`tjpblk_<normalized>`). */
  name: string;
  /** Keyword tag of the start pattern (`supplement` → scoped name). */
  tag: string;
  /** Start pattern of the region (header line ending in `{`). */
  startPattern: string;
  /** End pattern of the region (a lone `}`). */
  endPattern: string;
  /** Properties and the special foldable attributes fold. */
  fold: boolean;
  /** `contains=` list, in the original order. */
  contains: string[];
  /** `contained` when the keyword has no global scope. */
  contained: boolean;
}

/** `setlocal` block of `VimSyntax#setLocal`, as data (22.1b.6.6). */
export interface IndentSettings {
  /** `softtabstop=2`. */
  softtabstop: number;
  /** `shiftwidth=2` (with `cindent`). */
  shiftwidth: number;
  /** `tabstop=2`. */
  tabstop: number;
  /** `expandtab` — spaces instead of tabs. */
  expandtab: boolean;
  /** `cinoptions=g0,t0,+0,(0,c0,C1,n-2`. */
  cinoptions: string;
  /** Option-block names, unique and sorted. */
  cinwords: string[];
  /** `cinkeys=0{,0},!^F,o,O`. */
  cinkeys: string;
}

/**
 * Shared highlight data built from the syntax reference: keyword categories,
 * token rules, option-block regions and indent settings.
 */
export class SyntaxCore {
  private reference: SyntaxReference;
  /** Keywords that declare a nestable property (`isProperty()`). */
  readonly properties: KeywordDocumentation[] = [];
  /** Every other documented keyword. */
  readonly attributes: KeywordDocumentation[] = [];
  /** Keywords with optional attributes (the `{ … }` blocks). */
  readonly optionBlocks: KeywordDocumentation[] = [];

  /**
   * Splits the reference into the three collections
   * (`KateSyntax.rb:31-37` + `VimSyntax.rb:32-41`).
   *
   * @param reference syntax reference; the default ignores old keywords,
   * exactly like the two Ruby generators.
   */
  constructor(reference: SyntaxReference = new SyntaxReference(null, true,),) {
    this.reference = reference;
    for (const keyword of this.reference.keywords.values()) {
      if (keyword.isProperty()) {
        this.properties.push(keyword,);
      } else {
        this.attributes.push(keyword,);
      }
      if (keyword.optionalAttributes.length > 0) {
        this.optionBlocks.push(keyword,);
      }
    }
  }

  /**
   * Union of the keyword names with the filters of both generators
   * (22.1b.6.2): `supplement` is ignored in properties; the report attributes
   * are skipped; the attribute walk stops at the `STOP_NAMES`.
   *
   * @returns the names in collection order, without duplicates.
   */
  keywordList(): string[] {
    const names = new Set<string>();
    for (const keyword of this.properties) {
      for (const name of keyword.names) {
        // 'supplement' entries are not real properties.
        if (name === "supplement") continue;
        names.add(name,);
      }
    }
    for (const keyword of this.attributes) {
      if (SKIP_ATTRIBUTES.includes(keyword.keyword,)) continue;
      for (const name of keyword.names) {
        if (STOP_NAMES.includes(name,)) break;
        names.add(name,);
      }
    }
    return [...names,];
  }

  /**
   * The three Kate `<list>`s as data (22.1b.6.3): `keywords` is the fixed
   * trio, `builtin` holds the property names and `types` the attribute names.
   */
  categories(): { keywords: string[]; builtin: string[]; types: string[] } {
    const builtin: string[] = [];
    for (const keyword of this.properties) {
      for (const name of keyword.names) {
        if (name === "supplement") continue;
        builtin.push(name,);
      }
    }
    const types: string[] = [];
    for (const keyword of this.attributes) {
      if (SKIP_ATTRIBUTES.includes(keyword.keyword,)) continue;
      for (const name of keyword.names) {
        if (STOP_NAMES.includes(name,)) break;
        types.push(name,);
      }
    }
    return {
      keywords: ["macro", "project", "supplement",],
      builtin,
      types,
    };
  }

  /**
   * The Kate `Normal` context as data (22.1b.6.4), in the original order:
   * date/time/duration, the three keyword lists, include, arguments, brace
   * folding, numbers, strings and comments. No XML is emitted.
   */
  tokenRules(): TokenRule[] {
    return [
      {
        kind: "regexp",
        attribute: "Date",
        pattern: "\\d{4}-\\d{2}-\\d{2}\\S*",
      },
      // ⚠️ ADAPTAÇÃO: o original tem o typo `\d{1-2}`; aqui `\d{1,2}`.
      {
        kind: "regexp",
        attribute: "Time",
        pattern: "\\d{1,2}:\\d{2}(:\\d{2}|)",
      },
      { kind: "regexp", attribute: "Duration", pattern: "\\d(min|h|d|w|m|y)", },
      { kind: "keywords", attribute: "Builtin Function", list: "builtin", },
      { kind: "keywords", attribute: "Keyword", list: "keywords", },
      { kind: "keywords", attribute: "Data Types", list: "types", },
      { kind: "regexp", attribute: "Include", pattern: "include.*$", },
      { kind: "regexp", attribute: "Arguments", pattern: "\\{.*}$", },
      {
        kind: "char",
        attribute: "Symbol",
        char: "{",
        region: { name: "Brace2", edge: "begin", },
      },
      {
        kind: "char",
        attribute: "Symbol",
        char: "}",
        region: { name: "Brace2", edge: "end", },
      },
      {
        kind: "char",
        attribute: "Symbol",
        char: "[",
        region: { name: "Brace1", edge: "begin", },
      },
      {
        kind: "char",
        attribute: "Symbol",
        char: "]",
        region: { name: "Brace1", edge: "end", },
      },
      {
        kind: "number",
        attribute: "Float",
        float: true,
        suffixes: ["f", "F",],
      },
      {
        kind: "number",
        attribute: "Decimal",
        float: false,
        suffixes: ["ULL", "LUL", "LLU", "UL", "LU", "LL", "U", "L",],
      },
      { kind: "string", attribute: "String", open: "'", close: "'", },
      { kind: "string", attribute: "String", open: '"', close: '"', },
      { kind: "string", attribute: "String", open: "-8<-", close: "->8-", },
      { kind: "comment", attribute: "Comment", open: "#", close: null, },
      { kind: "comment", attribute: "Comment", open: "//", close: null, },
      { kind: "comment", attribute: "Comment", open: "/*", close: "*/", },
    ];
  }

  /**
   * The `syn region` list of `VimSyntax#regions` as data (22.1b.6.5): one
   * region per name of every option block, with the normalized id, the
   * `supplement` tag, folding, `contains` and `contained` flags.
   */
  optionBlockRegions(): Region[] {
    const regions: Region[] = [];
    for (const keyword of this.optionBlocks) {
      const single = keyword.names.length === 1;
      for (const name of keyword.names) {
        const normalizedName = normalize(keyword.keyword,) +
          (single ? "" : `_${name}`);
        const tag = name === "supplement"
          ? keyword.keyword.replace(/\./g, " ",)
          : name;
        const contains = ["@tjpcommon", `tjp_${normalizedName}`,];
        for (const attribute of keyword.optionalAttributes) {
          const attributeTag = normalize(attribute.keyword,);
          contains.push(`tjp_${attributeTag}`,);
          if (attribute.optionalAttributes.length > 0) {
            // Option blocks may be contained as block or non-block.
            contains.push(`tjpblk_${attributeTag}`,);
          }
        }
        if (name === "supplement") contains.push("tjp_supplement",);
        regions.push({
          name: `tjpblk_${normalizedName}`,
          tag,
          startPattern: `^\\s*${tag}\\s.*{\\s*$`,
          endPattern: "^\\s*}\\s*$",
          fold: this.properties.includes(keyword,) ||
            FOLDABLE.includes(keyword.keyword,),
          contains,
          contained: !keyword.globalScope(),
        },);
      }
    }
    return regions;
  }

  /**
   * The `setlocal` block of `VimSyntax#setLocal` as data (22.1b.6.6);
   * `cinwords` are the option-block names, unique and sorted.
   */
  indentSettings(): IndentSettings {
    const cinwords = [
      ...new Set(this.optionBlocks.flatMap((keyword,) => keyword.names),),
    ].sort();
    return {
      softtabstop: 2,
      shiftwidth: 2,
      tabstop: 2,
      expandtab: true,
      cinoptions: "g0,t0,+0,(0,c0,C1,n-2",
      cinwords,
      cinkeys: "0{,0},!^F,o,O",
    };
  }
}

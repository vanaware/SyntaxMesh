/**
 * `syntax-reference.ts` — index of every documented keyword (22.1b.2).
 *
 * Faithful port of `SyntaxReference.rb` (300 lines). The constructor
 * instantiates the `ProjectFileParser`, walks **every** rule and keeps the
 * patterns carrying a `doc` in a `KeywordDocumentation`; two passes follow the
 * Ruby order: `crossReference` on all of them and then `computeInheritance` on
 * all of them.
 *
 * The reference is **expensive** (building the parser tables costs ~100 ms) and
 * does not change between calls: {@link syntaxReference} memoizes it and
 * {@link resetSyntaxReferenceCache} clears the cache (used by the tests).
 *
 * Deliberate divergence: Ruby raises when two documented patterns share the same
 * keyword. The grammar port (phase 10) declares five keywords in more than one
 * rule (`flags`, `rate`, `start`, `end`, `limits`), so here the first occurrence
 * wins and the others become a **warning** in `warnings` — `man` keeps working
 * and the divergence stays visible.
 *
 * @see docs/taskjuggler/lib/taskjuggler/SyntaxReference.rb
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco D
 */

import { ProjectFileParser, } from "../parser/project-file-parser.ts";
import type { Rule, } from "../parser/rule.ts";
import type { Pattern, } from "../parser/pattern.ts";
import type { TokenDoc, } from "../lexer/token-doc.ts";
import { TableOfContents, } from "../richtext/table-of-contents.ts";
import { TOCEntry, } from "../richtext/toc-entry.ts";
import { HTMLDocument, } from "../html/html-document.ts";
import { A, H3, } from "../html/html-elements.ts";
import { XMLElement, } from "../xml/xml-element.ts";
import { KeywordDocumentation, } from "./keyword-documentation.ts";
import type { ManualPageContext, } from "./manual-context.ts";

/**
 * Builds the keyword index from the parser rules.
 */
export class SyntaxReference {
  /** Default context of the HTML pages (`UserManual` in normal use). */
  readonly manual: ManualPageContext | null;
  /** Documented keywords, indexed by identifier (`scope.name`). */
  readonly keywords = new Map<string, KeywordDocumentation>();
  /** Build warnings (duplicate keyword, undocumented attribute). */
  readonly warnings: string[] = [];
  /** Parser used as the rule source (kept for lookups). */
  readonly parser: ProjectFileParser;

  /**
   * Walks the documented rules of the parser and builds the index.
   *
   * @param manual document used as the default context of the HTML pages.
   * @param ignoreOld omits `deprecated`/`removed` keywords.
   */
  constructor(
    manual: ManualPageContext | null = null,
    ignoreOld = false,
  ) {
    this.manual = manual;
    this.parser = new ProjectFileParser();
    this.parser.updateParserTables();

    for (const rule of this.parser.rules.values()) {
      for (const pattern of rule.patterns) {
        if (pattern.doc === null) continue;
        if (
          ignoreOld &&
          (pattern.supportLevel === "deprecated" ||
            pattern.supportLevel === "removed")
        ) {
          continue;
        }

        const keyword = pattern.keyword ?? "";
        if (this.keywords.has(keyword,)) {
          this.warnings.push(
            `Multiple patterns have the same keyword ${keyword} (rule ${rule.name}); the first one is kept.`,
          );
          continue;
        }

        const argDocs: TokenDoc[] = [];
        const syntax = pattern.to_syntax(argDocs, this.parser.rules,);
        this.keywords.set(
          keyword,
          new KeywordDocumentation(
            rule,
            pattern,
            syntax,
            argDocs,
            this.optionalAttributes(pattern, new Map(),),
          ),
        );
      }
    }

    for (const keyword of this.keywords.values()) {
      keyword.crossReference(this.keywords, this.parser.rules, this.warnings,);
    }
    for (const keyword of this.keywords.values()) {
      keyword.computeInheritance();
    }
  }

  /**
   * Keywords in alphabetical order; chains `predecessor`/`successor` for the
   * navigation bars (`SyntaxReference.rb:81-92`).
   */
  all(): string[] {
    const sorted = [...this.keywords.keys(),].sort();
    let previous: KeywordDocumentation | null = null;
    for (const name of sorted) {
      const keyword = this.keywords.get(name,)!;
      if (previous !== null) previous.successor = keyword;
      keyword.predecessor = previous;
      previous = keyword;
    }
    return sorted;
  }

  /**
   * Adds the "Syntax Reference" section (`<prefix>`) to `toc` plus one entry
   * per keyword (`<prefix>.1` … `<prefix>.N`).
   */
  tableOfContents(toc: TableOfContents, sectionPrefix: string,): void {
    const keywords = this.all();
    if (keywords.length === 0) return;
    toc.addEntry(
      new TOCEntry(sectionPrefix, "Syntax Reference", keywords[0]!,),
    );
    keywords.forEach((keyword, index,) => {
      const documentation = this.keywords.get(keyword,)!;
      toc.addEntry(
        new TOCEntry(
          `${sectionPrefix}.${index + 1}`,
          documentation.title(),
          keyword,
        ),
      );
    },);
  }

  /** Internal references per keyword (no duplicates, no empty lists). */
  internalReferences(): Record<string, string[]> {
    const references: Record<string, string[]> = {};
    for (const keyword of this.keywords.values()) {
      const unique = [...new Set(keyword.references,),];
      if (unique.length > 0) references[keyword.keyword] = unique;
    }
    return references;
  }

  /**
   * Plain-text documentation of one keyword.
   *
   * @returns `""` when the keyword does not exist.
   */
  toText(keyword: string, color = false,): string {
    const documentation = this.keywords.get(keyword,);
    return documentation === undefined ? "" : documentation.toText(color,);
  }

  /** HTML page of one keyword (or `""` when unknown). */
  generateHTMLreference(
    keyword: string,
    manual: ManualPageContext | null = this.manual,
  ): string {
    const documentation = this.keywords.get(keyword,);
    if (documentation === undefined || manual === null) return "";
    return documentation.toHTML(manual,);
  }

  /**
   * `navbar.html` (alphabetical index with per-letter anchors) and
   * `alphabet.html` (letter bar).
   *
   * Ruby also embeds a Google search in the letter bar; here the page only links
   * the letters of `navbar.html`, with no external service dependency.
   */
  generateHTMLnavbar(keywords: string[],): Record<string, string> {
    const normalized = new Map<string, string>();
    for (const keyword of keywords) {
      const documentation = this.keywords.get(keyword,);
      if (documentation !== undefined) {
        normalized.set(documentation.title(), keyword,);
      }
    }

    const navbar = new HTMLDocument();
    const navbarHead = navbar.generateHead(
      "SyntaxMesh Syntax Reference Navigator",
    );
    navbarHead.append(new XMLElement("base", { target: "display", },),);
    const navBody = new XMLElement("body", {},);
    navbar.html.append(navBody,);
    navBody.append(new A({ href: "toc.html", }, () => "Table Of Contents",),);
    navBody.append(new XMLElement("br", {}, true,),);

    let letter: string | null = null;
    const letters: string[] = [];
    for (const title of [...normalized.keys(),].sort()) {
      const first = title.slice(0, 1,);
      if (first !== letter) {
        letter = first;
        letters.push(letter,);
        const heading = new H3({},);
        const anchor = new XMLElement("a", { name: letter, },);
        anchor.append(letter.toUpperCase(),);
        heading.append(anchor,);
        navBody.append(heading,);
      }
      const keyword = normalized.get(title,)!;
      navBody.append(new A({ href: `${keyword}.html`, }, () => title,),);
      navBody.append(new XMLElement("br", {}, true,),);
    }

    const alphabet = new HTMLDocument();
    const alphabetHead = alphabet.generateHead(
      "SyntaxMesh Syntax Reference Navigator",
    );
    alphabetHead.append(
      new XMLElement("base", { target: "navigator", },),
    );
    const alphabetBody = new XMLElement("body", {},);
    alphabet.html.append(alphabetBody,);
    const heading = new H3({},);
    for (const letter of letters) {
      heading.append(
        new A(
          { href: `navbar.html#${letter}`, },
          () => letter.toUpperCase(),
        ),
      );
    }
    alphabetBody.append(heading,);

    return {
      "navbar.html": navbar.write(".",) ?? "",
      "alphabet.html": alphabet.write(".",) ?? "",
    };
  }

  // --- Helpers (SyntaxReference.rb:205-272) --------------------------------

  /**
   * Attributes of the optional `{ … }` block of the pattern, indexed by the
   * pattern that declares them; the boolean marks scenario-specific attributes.
   */
  private optionalAttributes(
    pattern: Pattern,
    stack: Map<Pattern, boolean>,
  ): Map<Pattern, boolean> {
    // Infinite recursion: the pattern is already on the stack.
    if (stack.has(pattern,)) {
      return new Map();
    }
    // A nested pattern that is already documented contributes no attributes.
    if (stack.size > 0 && pattern.doc) {
      return new Map();
    }
    stack.set(pattern, true,);

    if (pattern.get(0,)[1] === "{" && pattern.get(2,)[1] === "}") {
      return this.attributes(pattern.get(1,), false,);
    }

    for (const [type, name,] of pattern.each()) {
      if (type !== "reference") continue;
      const rule: Rule | undefined = this.parser.rules.get(name,);
      if (rule === undefined) continue;
      // Rules with several patterns do not define a single attribute set.
      if (rule.patterns.length > 1) continue;
      const inner = rule.patterns[0];
      if (inner === undefined) continue;
      const attributes = this.optionalAttributes(inner, stack,);
      if (attributes.size > 0) return attributes;
    }
    return new Map();
  }

  /**
   * Attributes of the rule referenced by `token`: every pattern whose first
   * token is a literal becomes an attribute; references to `!scenarioIdCol`
   * mark the following attributes as scenario-specific.
   */
  private attributes(
    token: [string, string,],
    scenarioSpecific: boolean,
  ): Map<Pattern, boolean> {
    if (token[0] !== "reference") {
      throw new Error(`Token ${token.join(" ",)} must reference a rule`,);
    }
    const rule = this.parser.rules.get(token[1],);
    if (rule === undefined) {
      throw new Error(`Unknown rule ${token[1]} referenced by attributes`,);
    }

    const attributes = new Map<Pattern, boolean>();
    for (const pattern of rule.patterns) {
      const first = pattern.get(0,);
      if (first[0] === "literal") {
        attributes.set(pattern, scenarioSpecific,);
      } else if (first[0] === "reference" && first[1] === "scenarioIdCol") {
        const next = pattern.tokens[1];
        if (next !== undefined) {
          for (const [key, value,] of this.attributes(next, true,)) {
            attributes.set(key, value,);
          }
        }
      } else if (first[0] === "reference") {
        if (pattern.doc === null) {
          for (
            const [key, value,] of this.attributes(first, scenarioSpecific,)
          ) {
            attributes.set(key, value,);
          }
        } else {
          attributes.set(pattern, scenarioSpecific,);
        }
      } else {
        throw new Error(`Hit unknown token ${first.join(" ",)}`,);
      }
    }
    return attributes;
  }
}

/** Memoized reference (one parser construction per process). */
let cachedReference: SyntaxReference | null = null;
/** `ignoreOld` option the memoized reference was built with. */
let cachedIgnoreOld = false;

/** Shared keyword index (memoized). */
export function syntaxReference(
  manual: ManualPageContext | null = null,
  ignoreOld = false,
): SyntaxReference {
  if (cachedReference === null || cachedIgnoreOld !== ignoreOld) {
    cachedReference = new SyntaxReference(manual, ignoreOld,);
    cachedIgnoreOld = ignoreOld;
  }
  return cachedReference;
}

/** Forgets the memoized reference (tests and asset reloading). */
export function resetSyntaxReferenceCache(): void {
  cachedReference = null;
  cachedIgnoreOld = false;
}

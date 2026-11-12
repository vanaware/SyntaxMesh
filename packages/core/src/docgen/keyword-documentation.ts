/**
 * `keyword-documentation.ts` — documentation of a keyword extracted from the
 * parser rules (22.1b.3).
 *
 * Faithful port of `KeywordDocumentation.rb` (764 lines). Each instance holds
 * the documented `Pattern`, the expanded syntax (`Pattern#to_syntax`), the
 * argument `TokenDoc`s and the set of **optional attributes** (patterns of
 * rules referenced by the `{ … }` block). Two `SyntaxReference` passes complete
 * the data: `crossReference` (names, contexts, `seeAlso`) and
 * `computeInheritance` (global/parent value inheritance).
 *
 * Outputs, both as **data** (`doc-core` does not write to disk):
 * - {@link KeywordDocumentation.toText} — the Ruby `to_s` (terminal report,
 *   with optional ANSI);
 * - {@link KeywordDocumentation.toHTML} — the manual `<keyword>.html` page.
 *
 * @see docs/taskjuggler/lib/taskjuggler/KeywordDocumentation.rb
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco E
 */

import type { Pattern, } from "../parser/pattern.ts";
import type { Rule, } from "../parser/rule.ts";
import type { TokenDoc, } from "../lexer/token-doc.ts";
import { TextFormatter, } from "../utils/text-formatter.ts";
import { RichText, } from "../richtext/rich-text.ts";
import { RichTextIntermediate, } from "../richtext/rich-text-intermediate.ts";
import { HTMLDocument, } from "../html/html-document.ts";
import {
  A,
  B,
  BODY,
  CODE,
  COL,
  COLGROUP,
  DIV,
  P,
  PRE,
  TABLE,
  TD,
  TR,
} from "../html/html-elements.ts";
import { XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { Project, } from "../model/project.ts";
import type { PropertySet, } from "../model/property-set.ts";
import { blue, bold, cyan, red, } from "./ansi.ts";
import { keywordToMarkdown, } from "./keyword-markdown.ts";
import type { ManualPageContext, } from "./manual-context.ts";

/** Width of the `to_s` label column (`KeywordDocumentation.rb:188`). */
const TAG_WIDTH = 13;
/** Largura total do texto do `to_s` (`KeywordDocumentation.rb:189`). */
const TEXT_WIDTH = 79;

/**
 * Report keywords the Ruby lists by hand in `isProperty?`
 * (`KeywordDocumentation.rb:88-90`): they do not include themselves as an
 * attribute of their own, so the automatic detection does not catch them.
 */
const REPORT_PROPERTY_KEYWORDS = new Set([
  "accountreport",
  "export",
  "nikureport",
  "resourcereport",
  "taskreport",
  "textreport",
  "timesheetreport",
  "statussheetreport",
],);

/** Contextos que apontam para um `PropertySet` (`KeywordDocumentation.rb:732-735`). */
const PROPERTY_CONTEXTS = new Set([
  "task",
  "resource",
  "account",
  "shift",
  "scenario",
  "accountreport",
  "resourcereport",
  "taskreport",
  "textreport",
],);

/**
 * Empty project used only to look up the attribute `PropertySet`s
 * (`findPropertySet`). Created once per process: the `Project` constructor
 * registers every attribute definition, which is exactly what the
 * inheritance/list queries need.
 */
let syntaxProjectCache: Project | null = null;

function syntaxProject(): Project {
  syntaxProjectCache ??= new Project("syntax", "Syntax Reference", "1.0",);
  return syntaxProjectCache;
}

/**
 * Documentation of a keyword: syntax, arguments, context, optional attributes
 * and neighbour in alphabetical order.
 */
export class KeywordDocumentation {
  /** Unique identifier (`<scope>.<name>` when ambiguous). */
  readonly keyword: string;
  /** Regularity with which the pattern was declared. */
  readonly rule: Rule;
  /** Documented pattern. */
  readonly pattern: Pattern;
  /** Expanded syntax (`Pattern#to_syntax`). */
  readonly syntax: string;
  /** Argument documentation, in pattern order. */
  readonly args: TokenDoc[];
  /** Optional attribute patterns → `true` when they are scenario-specific. */
  readonly optAttrPatterns: Map<Pattern, boolean>;

  /** Short (unscoped) names of the terminal tokens of the pattern. */
  names: string[] = [];
  /** Optional attribute documentation (filled by `crossReference`). */
  optionalAttributes: KeywordDocumentation[] = [];
  /** `true` when the value is scenario-specific. */
  scenarioSpecific = false;
  /** `true` when the value can be inherited from the global scope. */
  inheritedFromProject = false;
  /** `true` when the value can be inherited from the parent property. */
  inheritedFromParent = false;
  /** Keywords in which this one appears as an argument/attribute. */
  contexts: KeywordDocumentation[] = [];
  /** Cross references declared with `seeAlso`. */
  seeAlso: KeywordDocumentation[] = [];
  /** Previous neighbour in alphabetical order (navigation bar). */
  predecessor: KeywordDocumentation | null = null;
  /** Next neighbour in alphabetical order (navigation bar). */
  successor: KeywordDocumentation | null = null;
  /** Internal references (`[[x]]`) found in the manual text. */
  references: string[] = [];

  private propertySetCache: PropertySet | null | undefined = undefined;

  /**
   * Builds the documentation from the already resolved pattern.
   *
   * @param rule rule that declared the pattern.
   * @param pattern documented pattern (`doc`/`args` come from it).
   * @param syntax expanded syntax (`Pattern#to_syntax`).
   * @param args argument documentation, in pattern order.
   * @param optAttrPatterns optional attributes and their scenario-specificity.
   */
  constructor(
    rule: Rule,
    pattern: Pattern,
    syntax: string,
    args: TokenDoc[],
    optAttrPatterns: Map<Pattern, boolean>,
  ) {
    this.rule = rule;
    this.pattern = pattern;
    this.keyword = pattern.keyword ?? "";
    this.syntax = syntax;
    this.args = args;
    this.optAttrPatterns = optAttrPatterns;
  }

  /** Legible name: `foo.bar` becomes `foo (bar)`. */
  title(): string {
    const tokens = this.keyword.split(".",);
    return tokens.length === 1 ? this.keyword : `${tokens[0]} (${tokens[1]})`;
  }

  /** `true` when the keyword declares a nestable property (task, …). */
  isProperty(): boolean {
    if (REPORT_PROPERTY_KEYWORDS.has(this.keyword,)) return true;
    return this.optionalAttributes.includes(this,);
  }

  /** `true` when the keyword may appear outside of any context. */
  globalScope(): boolean {
    if (this.contexts.length === 0) return true;
    return this.contexts.some((context,) => context.keyword === "properties");
  }

  /** `true` when the attribute is of list type. */
  listAttribute(): boolean {
    const propertySet = this.findPropertySet();
    if (propertySet === null) return false;
    const keyword = this.keyword.includes(".",)
      ? this.keyword.split(".",)[0]!
      : this.keyword;
    return propertySet.listAttribute?.(keyword,) ?? false;
  }

  /** Sets the inheritance flags from the context `PropertySet`. */
  computeInheritance(): void {
    const propertySet = this.findPropertySet();
    if (propertySet === null) return;
    const keyword = this.keyword.includes(".",)
      ? this.keyword.split(".",)[0]!
      : this.keyword;
    this.inheritedFromProject = propertySet.inheritedFromProject?.(keyword,) ??
      false;
    this.inheritedFromParent = propertySet.inheritedFromParent?.(keyword,) ??
      false;
  }

  /**
   * Second pass: short names, contexts, optional attributes and `seeAlso`.
   *
   * `warnings` receives the same warnings the Ruby writes to `$stderr`
   * (undocumented optional attribute) so the consumer decides the destination.
   */
  crossReference(
    keywords: Map<string, KeywordDocumentation>,
    rules: Map<string, Rule>,
    warnings: string[] = [],
  ): void {
    for (const token of this.pattern.terminalTokens(rules,)) {
      if (token[0] === "{") break;
      this.names.push(token[0],);
    }

    for (const arg of this.args) {
      if (arg.pattern && this.checkReference(arg.pattern, warnings,)) {
        const kwd = keywords.get(arg.pattern.keyword ?? "",);
        if (kwd !== undefined && !kwd.contexts.includes(this,)) {
          kwd.contexts.push(this,);
        }
      }
    }

    for (const [pattern, scenarioSpecific,] of this.optAttrPatterns) {
      if (!this.checkReference(pattern, warnings,)) continue;
      const kwd = keywords.get(pattern.keyword ?? "",);
      if (kwd === undefined) {
        if (
          pattern.supportLevel !== "deprecated" &&
          pattern.supportLevel !== "removed"
        ) {
          const token = pattern.terminalTokens(rules,);
          warnings.push(
            `Keyword ${this.keyword} has undocumented optional attribute ${
              token[0]?.[0] ?? "?"
            }`,
          );
        }
        continue;
      }
      this.optionalAttributes.push(kwd,);
      if (!kwd.contexts.includes(this,)) kwd.contexts.push(this,);
      if (scenarioSpecific) kwd.scenarioSpecific = true;
    }

    for (const also of [...this.pattern.seeAlso,].sort()) {
      const kwd = keywords.get(also,);
      if (kwd === undefined) {
        // Deliberate divergence: Ruby raises here. The grammar port (phase 10)
        // declares `seeAlso` for keywords that were not documented, so the
        // warning replaces the exception — same criterion as the duplicated
        // keyword in `SyntaxReference`.
        warnings.push(
          `See also reference ${also} of ${this.pattern.keyword} is unknown`,
        );
        continue;
      }
      this.seeAlso.push(kwd,);
    }
  }

  /**
   * Plain-text documentation (the Ruby `to_s`).
   *
   * @param color paints the labels with ANSI (`--no-color` turns it off).
   */
  toText(color = false,): string {
    let str = `${blue("Keyword:", color,)}     ${bold(this.keyword, color,)}${
      this.listAttribute() ? " (List Attribute)" : ""
    }\n\n`;

    if (this.pattern.supportLevel !== "supported") {
      let message = this.supportLevelMessage();
      if (
        (this.pattern.supportLevel === "deprecated" ||
          this.pattern.supportLevel === "removed") &&
        this.seeAlso.length > 0
      ) {
        message += "\n\nPlease use " +
          this.seeAlso.map((also,) => also.keyword).join(", ",) + " instead!";
      }
      str += red(
        `Warning:     ${this.formatText(TAG_WIDTH, message, TEXT_WIDTH,)}\n`,
        color,
      );
    }

    // Removed keyword: nothing beyond the warning (Ruby l.215).
    if (this.pattern.supportLevel === "removed") return str;

    str += `${blue("Purpose:", color,)}     ${
      this.formatText(
        TAG_WIDTH,
        this.newRichText(this.pattern.doc ?? "",).to_s(),
        TEXT_WIDTH,
      )
    }\n`;

    if (this.syntax !== "[{ <attributes> }]") {
      str += `${blue("Syntax:", color,)}      ${
        this.formatText(TAG_WIDTH, this.syntax, TEXT_WIDTH,)
      }\n`;
      str += `${blue("Arguments:", color,)}   `;
      if (this.args.length === 0) {
        str += this.formatText(TAG_WIDTH, "none\n", TEXT_WIDTH,);
      } else {
        str += this.indentText(TAG_WIDTH, this.argumentsText(),);
      }
      str += "\n";
    }

    str += `${blue("Context:", color,)}     `;
    str += this.contexts.length === 0
      ? this.formatText(TAG_WIDTH, "Global scope", TEXT_WIDTH,)
      : this.formatText(
        TAG_WIDTH,
        this.contexts.map((context,) => context.keyword).join(", ",),
        TEXT_WIDTH,
      );

    str += `\n${blue("Attributes:", color,)}  `;
    if (this.optionalAttributes.length === 0) {
      str += "none\n\n";
    } else {
      const { text, showLegend, } = this.attributesText(color,);
      if (showLegend) {
        const legend =
          `\n\n${cyan("[sc]", color,)} : Attribute is scenario specific` +
          `\r${
            cyan("[ig]", color,)
          } : Value can be inherited from global setting` +
          `\r${
            cyan("[ip]", color,)
          } : Value can be inherited from parent property`;
        str += this.formatText(TAG_WIDTH, text + legend, TEXT_WIDTH,);
      } else {
        str += this.formatText(TAG_WIDTH, text, TEXT_WIDTH,);
      }
      str += "\n";
    }

    if (this.seeAlso.length > 0) {
      str += `${blue("See also:", color,)}    ${
        this.formatText(
          TAG_WIDTH,
          this.seeAlso.map((also,) => also.keyword).join(", ",),
          TEXT_WIDTH,
        )
      }\n`;
    }

    return str;
  }

  /**
   * Markdown projection of this documentation (LSP hover/help, 22.1b.3.21).
   * Delegates to {@link keywordToMarkdown}; no ANSI, no column legend.
   *
   * @returns the Markdown page, terminated by a newline.
   */
  toMarkdown(): string {
    return keywordToMarkdown(this,);
  }

  /**
   * HTML page of this keyword (`<keyword>.html`), as a string.
   *
   * @param manual document that provides the header/footer/navigation/styles.
   */
  toHTML(manual: ManualPageContext,): string {
    const html = new HTMLDocument();
    const head = html.generateHead(this.keyword, {
      description: "The SyntaxMesh User Manual",
      keywords: "syntaxmesh, project, management",
    },);
    head.append(manual.generateStyleSheet(),);

    html.html.append(
      new BODY({}, () => {
        const page: XMLElement[] = [];
        page.push(manual.generateHTMLHeader() as XMLElement,);
        page.push(this.navigationBar(manual,) as XMLElement,);

        const content: XMLElement[] = [this.keywordBox(),];
        const support = this.supportLevelBox();
        if (support !== null) content.push(...support,);
        const description = this.descriptionBox(manual,);
        if (description !== null) content.push(description,);
        const attributes = this.optionalAttributesBox();
        if (attributes !== null) content.push(attributes,);
        const example = this.exampleBox(manual,);
        if (example !== null) content.push(example,);

        page.push(
          new DIV(
            { style: "margin-left:5%; margin-right:5%", },
            () => content,
          ),
        );
        page.push(this.navigationBar(manual,) as XMLElement,);
        page.push(manual.generateHTMLFooter() as XMLElement,);
        return page;
      },),
    );

    return html.write(".",) ?? "";
  }

  // --- Texto puro -----------------------------------------------------------

  /** Plain-text purpose (the `to_s` `Purpose`, without a label). */
  purposeText(): string {
    if (this.pattern.doc === null) return "";
    return this.newRichText(this.pattern.doc,).to_s();
  }

  /**
   * Argument labels and rendered texts, in pattern order (the `Arguments:`
   * content of {@link toText}, without the terminal column layout). Shared
   * with the Markdown projection (`keyword-markdown.ts`, 22.1b.3.21).
   *
   * @returns one `{ label, text }` per argument; `label` carries the
   * `[typeSpec]` bracket when the argument is not a plain `<name>`.
   */
  argumentTexts(): Array<{ label: string; text: string }> {
    return this.args.map((arg,) => {
      const name = arg.name ?? "";
      const text = this.newRichText(
        arg.text ?? `See '${name}' for details.`,
      ).to_s();
      const typeSpec = arg.typeSpec;
      const label =
        typeSpec === null || typeSpec === undefined || typeSpec === `<${name}>`
          ? name
          : `${name} [${typeSpec.slice(1, -1,)}]`;
      return { label, text, };
    },);
  }

  /** Lines of the `Arguments:` section, already indented by the argument name. */
  private argumentsText(): string {
    let out = "";
    for (const arg of this.args) {
      const name = arg.name ?? "";
      const argText = this.newRichText(
        arg.text ?? `See '${name}' for details.`,
      ).to_s();
      const typeSpec = arg.typeSpec;
      if (
        typeSpec === null || typeSpec === undefined || `<${name}>` === typeSpec
      ) {
        const width = name.length + 2;
        out += `${name}: ${
          this.formatText(width, argText, TEXT_WIDTH - TAG_WIDTH,)
        }\n`;
      } else {
        const bracketed = `[${typeSpec.slice(1, -1,)}]`;
        const width = name.length + bracketed.length + 3;
        out += `${name} ${bracketed}: ${
          this.formatText(width, argText, TEXT_WIDTH - TAG_WIDTH,)
        }\n`;
      }
    }
    return out;
  }

  /** List of attributes with the `[sc]`/`[ig]`/`[ip]` markers. */
  private attributesText(
    color: boolean,
  ): { text: string; showLegend: boolean } {
    let text = "";
    let showLegend = false;
    for (
      const attr of [...this.optionalAttributes,].sort((a, b,) =>
        a.keyword < b.keyword ? -1 : a.keyword > b.keyword ? 1 : 0
      )
    ) {
      if (text !== "") text += ", ";
      text += attr.keyword;
      if (
        !attr.scenarioSpecific && !attr.inheritedFromProject &&
        !attr.inheritedFromParent
      ) {
        continue;
      }
      let first = true;
      showLegend = true;
      let tag = "[";
      if (attr.scenarioSpecific) {
        tag += "sc";
        first = false;
      }
      if (attr.inheritedFromProject) {
        if (!first) tag += ":";
        tag += "ig";
        first = false;
      }
      if (attr.inheritedFromParent) {
        if (!first) tag += ":";
        tag += "ip";
      }
      tag += "]";
      text += cyan(tag, color,);
    }
    return { text, showLegend, };
  }

  /** `TextFormatter.new(width, indent).format(str).slice(indent)`. */
  private formatText(indent: number, str: string, width: number,): string {
    return new TextFormatter(width, indent,).format(str,).slice(indent,);
  }

  /** `TextFormatter.new(80, width).indent(str).slice(width)`. */
  private indentText(width: number, str: string,): string {
    return new TextFormatter(80, width,).indent(str,).slice(width,);
  }

  /**
   * Text of the support-level warning (`KeywordDocumentation.rb:698-717`).
   * Shared with the Markdown projection (`keyword-markdown.ts`, 22.1b.3.21).
   */
  supportLevelMessage(): string {
    switch (this.pattern.supportLevel) {
      case "experimental":
        return "This keyword is currently in an experimental state. " +
          "The implementation is probably still incomplete and " +
          "use of this keyword may lead to wrong results. Do not " +
          "use this keyword unless you were specifically directed " +
          "by the developers to try it.";
      case "beta":
        return "This keyword has not yet been fully tested yet. You are " +
          "welcome to try it, but it may lead to wrong results. " +
          "The syntax may still change with future versions. " +
          "The developers appreciate any feedback on this keyword.";
      case "deprecated":
        return "This keyword should no longer be used. It will be removed " +
          "in future versions of this software.";
      case "removed":
        return "This keyword is no longer supported.";
      default:
        return "";
    }
  }

  // --- HTML -----------------------------------------------------------------

  /** Navigation bar of this page (predecessor/successor). */
  private navigationBar(
    manual: ManualPageContext,
  ): XMLElementLike {
    return manual.generateHTMLNavigationBar(
      this.predecessor ? this.predecessor.title() : null,
      this.predecessor ? `${this.predecessor.keyword}.html` : null,
      this.successor ? this.successor.title() : null,
      this.successor ? `${this.successor.keyword}.html` : null,
    );
  }

  /** Box with the keyword name (and the list attribute marker). */
  private keywordBox(): XMLElement {
    return new P({}, () => [
      new TABLE({ align: "center", class: "table", }, () => [
        new TR({ align: "left", }, () => [
          new TD({ class: "tag", style: "width:16%", }, () => "Keyword",),
          new TD({ class: "descr", style: "width:84%", }, () => [
            new B({}, () => this.title(),),
            this.listAttribute()
              ? new A(
                { href: "List_Attributes.html", },
                () => "List Attribute",
              )
              : "",
          ],),
        ],),
      ],),
    ],);
  }

  /** Support-level warning (or `null` when `supported`). */
  private supportLevelBox(): XMLElement[] | null {
    if (this.pattern.supportLevel === "supported") return null;
    const message = this.newRichText(
      `<fcol:red>${this.supportLevelMessage()}</fcol>`,
    );
    const replacement = this.pattern.supportLevel === "deprecated" ||
        this.pattern.supportLevel === "removed"
      ? this.useInsteadBox()
      : null;
    return [
      new P({}, () => message.to_html() as XMLElement | null,),
      ...(replacement === null ? [] : [replacement,]),
    ];
  }

  /** "Use … instead." para keywords depreciadas removidas. */
  private useInsteadBox(): XMLElement | null {
    if (this.seeAlso.length === 0) return null;
    const parts: Array<XMLElement | string> = ["Use ",];
    this.seeAlso.forEach((also, index,) => {
      if (index > 0) parts.push(", ",);
      parts.push(
        new A({ href: `${also.keyword}.html`, }, () => also.title(),),
      );
    },);
    parts.push(" instead.",);
    return new P({}, () => parts,);
  }

  /** Tabela `Purpose`/`Syntax`/`Arguments`/`Context`/`See also`. */
  private descriptionBox(
    manual: ManualPageContext,
  ): XMLElement | null {
    if (this.pattern.supportLevel === "removed") return null;
    const rows: XMLElement[] = [];
    rows.push(
      this.tableLine(
        "Purpose",
        this.newRichText(this.pattern.doc ?? "",).to_html() as
          | XMLElement
          | null,
      ),
    );
    if (this.syntax !== "[{ <attributes> }]") {
      rows.push(
        this.tableLine("Syntax", new CODE({}, () => this.syntax,),),
      );
      rows.push(...this.argumentsLine(),);
    }
    rows.push(this.contextLine(),);
    const also = this.alsoLine();
    if (also !== null) rows.push(also,);

    return new P({}, () => [
      new TABLE({ align: "center", class: "table", }, () => [
        new COLGROUP({}, () => [
          new COL({ width: "16%", },),
          new COL({ width: "24%", },),
          new COL({ width: "60%", },),
        ],),
        ...rows,
      ],),
    ],);
  }

  /** `Arguments` lines (the `rowspan` belongs to the first argument). */
  private argumentsLine(): XMLElement[] {
    if (this.syntax === "[{ <attributes> }]") return [];
    if (this.args.length === 0) {
      return [this.tableLine("Arguments", "none",),];
    }
    const rows: XMLElement[] = [];
    let count: number | null = this.args.length;
    this.args.forEach((arg, index,) => {
      const name = arg.name ?? "";
      const typeSpec = arg.typeSpec;
      let column: XMLElement | string | Array<XMLElement | string>;
      if (
        typeSpec === null || typeSpec === undefined ||
        `<${name}>` === typeSpec
      ) {
        column = name;
      } else {
        const typeName = typeSpec.slice(1, -1,);
        column = [
          `${name} [`,
          new A({ href: `The_Syntax.html#${typeName}`, }, () => typeName,),
          "]",
        ];
      }
      rows.push(
        this.tableLine(
          index === 0 ? "Arguments" : null,
          column,
          this.newRichText(arg.text ?? `See [[${name}]] for details.`,)
            .to_html() as XMLElement | null,
          count,
        ),
      );
      count = null;
    },);
    return rows;
  }

  /** `Context` row (or `Global scope` with a link to the introduction). */
  private contextLine(): XMLElement {
    const parts: Array<XMLElement | string> = [];
    for (const context of this.contexts) {
      if (
        context.pattern.supportLevel === "deprecated" ||
        context.pattern.supportLevel === "removed"
      ) {
        continue;
      }
      if (parts.length > 0) parts.push(", ",);
      parts.push(
        new A({ href: `${context.keyword}.html`, }, () => context.title(),),
      );
    }
    const description: XMLElement | string | Array<XMLElement | string> =
      parts.length === 0
        ? new A(
          { href: "Getting_Started.html#Structure_of_an_SMX_File", },
          () => "Global scope",
        )
        : parts;
    return this.tableLine("Context", description,);
  }

  /** `See also` row (omitted when there are no references). */
  private alsoLine(): XMLElement | null {
    if (this.seeAlso.length === 0) return null;
    const parts: Array<XMLElement | string> = [];
    for (const also of this.seeAlso) {
      if (
        also.pattern.supportLevel === "deprecated" ||
        also.pattern.supportLevel === "removed"
      ) {
        continue;
      }
      if (parts.length > 0) parts.push(", ",);
      parts.push(
        new A({ href: `${also.keyword}.html`, }, () => also.title(),),
      );
    }
    return this.tableLine("See also", parts,);
  }

  /** Box of optional attributes (plain list or table with markers). */
  private optionalAttributesBox(): XMLElement | null {
    if (this.pattern.supportLevel === "removed") return null;
    if (this.optionalAttributes.length === 0) return null;

    const attributes = [...this.optionalAttributes,].sort((a, b,) =>
      a.keyword < b.keyword ? -1 : a.keyword > b.keyword ? 1 : 0
    );
    const showDetails = attributes.some((attr,) =>
      attr.scenarioSpecific || attr.inheritedFromProject ||
      attr.inheritedFromParent
    );

    if (!showDetails) {
      const parts: Array<XMLElement | string> = [];
      for (const attr of attributes) {
        if (
          attr.pattern.supportLevel === "deprecated" ||
          attr.pattern.supportLevel === "removed"
        ) {
          continue;
        }
        if (parts.length > 0) parts.push(", ",);
        parts.push(
          new A({ href: `${attr.keyword}.html`, }, () => attr.title(),),
        );
      }
      return new P({}, () => [
        new TABLE(
          { align: "center", class: "table", },
          () =>
            new TR({ align: "left", }, () => [
              new TD(
                { class: "tag", style: "width:16%", },
                () => "Attributes",
              ),
              new TD({ class: "descr", style: "width:84%", }, () => parts,),
            ],),
        ),
      ],);
    }

    const rows: XMLElement[] = [];
    rows.push(
      new COLGROUP(
        {},
        () =>
          ["16", "24", "20", "20", "20",].map((width,) =>
            new COL({ width: `${width}%`, },)
          ),
      ),
    );
    rows.push(
      new TR({ align: "left", }, () => [
        new TD(
          {
            class: "tag",
            rowspan: `${attributes.length + 1}`,
          },
          () => "Attributes",
        ),
        new TD({ class: "tag", }, () => "Name",),
        new TD({ class: "tag", }, () => "Scen. spec.",),
        new TD({ class: "tag", }, () => "Inh. fm. Global",),
        new TD({ class: "tag", }, () => "Inh. fm. Parent",),
      ],),
    );
    for (const attr of attributes) {
      if (
        attr.pattern.supportLevel === "deprecated" ||
        attr.pattern.supportLevel === "removed"
      ) {
        continue;
      }
      rows.push(
        new TR({ align: "left", }, () => [
          new TD(
            { align: "left", class: "descr", },
            () => new A({ href: `${attr.keyword}.html`, }, () => attr.title(),),
          ),
          new TD(
            { align: "center", class: "descr", },
            () => attr.scenarioSpecific ? "x" : "",
          ),
          new TD(
            { align: "center", class: "descr", },
            () => attr.inheritedFromProject ? "x" : "",
          ),
          new TD(
            { align: "center", class: "descr", },
            () => attr.inheritedFromParent ? "x" : "",
          ),
        ],),
      );
    }
    return new P({}, () => [
      new TABLE({ align: "center", class: "table", }, () => rows,),
    ],);
  }

  /** `<pre class="code">` box with the annotated example of the keyword. */
  private exampleBox(
    manual: ManualPageContext,
  ): XMLElement | null {
    if (this.pattern.supportLevel === "removed") return null;
    if (!this.pattern.exampleFile) return null;
    const text = manual.exampleText(
      this.pattern.exampleFile,
      this.pattern.exampleTag,
    );
    if (text === null) return null;
    return new DIV(
      { class: "codeframe", },
      () => new PRE({ class: "code", }, () => text,),
    );
  }

  /** One `tag`/`descr` row of the description table. */
  private tableLine(
    column1: string | null,
    column2: XMLElement | string | Array<XMLElement | string> | null,
    column3: XMLElement | string | Array<XMLElement | string> | null = null,
    column1Rows: number | null = null,
  ): XMLElement {
    const columns: Array<XMLElement | string> = [];
    if (column1 !== null) {
      const attrs: Record<string, string> = { class: "tag", };
      if (column1Rows !== null) attrs.rowspan = String(column1Rows,);
      columns.push(new TD(attrs, () => column1,),);
    }
    const descrAttrs: Record<string, string> = { class: "descr", };
    if (column3 === null) descrAttrs.colspan = "2";
    columns.push(new TD(descrAttrs, () => column2,),);
    if (column3 !== null) {
      columns.push(new TD({ class: "descr", }, () => column3,),);
    }
    return new TR({ align: "left", }, () => columns,);
  }

  // --- Auxiliares -----------------------------------------------------------

  /**
   * `RichText` without function handlers, as in Ruby
   * (`RichText.new(text, [])`).
   */
  private newRichText(text: string,): RichTextIntermediate {
    const richText = new RichText(text, [],);
    const intermediate = richText.generateIntermediateFormat();
    if (intermediate === null) {
      return new RichTextIntermediate(richText,);
    }
    this.references.push(...intermediate.internalReferences(),);
    return intermediate;
  }

  /** Rewrites an undocumented reference (only warns and returns `false`). */
  private checkReference(pattern: Pattern, warnings: string[],): boolean {
    if (pattern.keyword === null) {
      warnings.push(
        `Pattern ${pattern.keyword} is undocumented but referenced by ${this.keyword}.`,
      );
      return false;
    }
    return true;
  }

  /** `PropertySet` do contexto de propriedade, ou `null`. */
  private findPropertySet(): PropertySet | null {
    if (this.propertySetCache !== undefined) return this.propertySetCache;

    let property: string | null = null;
    for (const context of this.contexts) {
      if (PROPERTY_CONTEXTS.has(context.keyword,)) {
        property = context.keyword;
        break;
      }
    }
    if (property === null) {
      this.propertySetCache = null;
      return null;
    }
    const project = syntaxProject();
    switch (property) {
      case "task":
        this.propertySetCache = project.tasks;
        break;
      case "resource":
        this.propertySetCache = project.resources;
        break;
      case "account":
        this.propertySetCache = project.accounts;
        break;
      case "shift":
        this.propertySetCache = project.shifts;
        break;
      case "scenario":
        this.propertySetCache = project.scenarios;
        break;
      default:
        this.propertySetCache = project.reports;
        break;
    }
    return this.propertySetCache;
  }
}

/** Elemento vazio reaproveitado por testes/consumidores (`<span>`). */
export const EMPTY_ELEMENT = new XMLElement("span", {},);

/**
 * `keyword-documentation.ts` — documentação de uma keyword extraída das regras
 * do parser (22.1b.3).
 *
 * Port fiel de `KeywordDocumentation.rb` (764 linhas). Cada instância guarda o
 * `Pattern` documentado, a sintaxe expandida (`Pattern#to_syntax`), os
 * `TokenDoc` dos argumentos e o conjunto de **atributos opcionais** (patterns
 * de regras referenciadas pelo bloco `{ … }`). Duas passadas do
 * `SyntaxReference` completam os dados: `crossReference` (nomes, contextos,
 * `seeAlso`) e `computeInheritance` (herança de valores globais/pai).
 *
 * Saídas, ambas como **dado** (o `doc-core` não escreve em disco):
 * - {@link KeywordDocumentation.toText} — o `to_s` do Ruby (relatório de
 *   terminal, com ANSI opcional);
 * - {@link KeywordDocumentation.toHTML} — a página `<keyword>.html` do manual.
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
import type { ManualPageContext, } from "./manual-context.ts";

/** Largura da coluna de rótulos do `to_s` (`KeywordDocumentation.rb:188`). */
const TAG_WIDTH = 13;
/** Largura total do texto do `to_s` (`KeywordDocumentation.rb:189`). */
const TEXT_WIDTH = 79;

/**
 * Keywords de relatório que o Ruby lista à mão em `isProperty?`
 * (`KeywordDocumentation.rb:88-90`): elas não se incluem como atributo de si
 * mesmas, então a detecção automática não as pega.
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
 * Projeto vazio usado só para consultar os `PropertySet` de atributos
 * (`findPropertySet`). Criado uma vez por processo: o construtor de `Project`
 * registra todas as definições de atributo, que é justamente o que as
 * consultas de herança/lista precisam.
 */
let syntaxProjectCache: Project | null = null;

function syntaxProject(): Project {
  syntaxProjectCache ??= new Project("syntax", "Syntax Reference", "1.0",);
  return syntaxProjectCache;
}

/**
 * Documentação de uma keyword: sintaxe, argumentos, contexto, atributos
 * opcionais e vizinhos na ordem alfabética.
 */
export class KeywordDocumentation {
  /** Identificador único (`<scope>.<nome>` quando ambíguo). */
  readonly keyword: string;
  /** Regularidade em que o pattern foi declarado. */
  readonly rule: Rule;
  /** Pattern documentado. */
  readonly pattern: Pattern;
  /** Sintaxe expandida (`Pattern#to_syntax`). */
  readonly syntax: string;
  /** Documentação dos argumentos, na ordem do pattern. */
  readonly args: TokenDoc[];
  /** Patterns de atributos opcionais → `true` quando são de cenário. */
  readonly optAttrPatterns: Map<Pattern, boolean>;

  /** Nomes curtos (sem escopo) dos tokens terminais do pattern. */
  names: string[] = [];
  /** Documentação dos atributos opcionais (preenchida por `crossReference`). */
  optionalAttributes: KeywordDocumentation[] = [];
  /** `true` quando o valor é específico de cenário. */
  scenarioSpecific = false;
  /** `true` quando o valor pode ser herdado do escopo global. */
  inheritedFromProject = false;
  /** `true` quando o valor pode ser herdado da propriedade-pai. */
  inheritedFromParent = false;
  /** Keywords em que esta aparece como argumento/atributo. */
  contexts: KeywordDocumentation[] = [];
  /** Referências cruzadas declaradas com `seeAlso`. */
  seeAlso: KeywordDocumentation[] = [];
  /** Vizinho anterior na ordem alfabética (barra de navegação). */
  predecessor: KeywordDocumentation | null = null;
  /** Vizinho seguinte na ordem alfabética (barra de navegação). */
  successor: KeywordDocumentation | null = null;
  /** Referências internas (`[[x]]`) encontradas no texto do manual. */
  references: string[] = [];

  private propertySetCache: PropertySet | null | undefined = undefined;

  /**
   * Monta a documentação a partir do pattern já resolvido.
   *
   * @param rule regularidade que declarou o pattern.
   * @param pattern pattern documentado (`doc`/`args` vêm dele).
   * @param syntax sintaxe expandida (`Pattern#to_syntax`).
   * @param args documentação dos argumentos, na ordem do pattern.
   * @param optAttrPatterns atributos opcionais e se são de cenário.
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

  /** Nome legível: `foo.bar` vira `foo (bar)`. */
  title(): string {
    const tokens = this.keyword.split(".",);
    return tokens.length === 1 ? this.keyword : `${tokens[0]} (${tokens[1]})`;
  }

  /** `true` quando a keyword declara uma propriedade aninhável (task, …). */
  isProperty(): boolean {
    if (REPORT_PROPERTY_KEYWORDS.has(this.keyword,)) return true;
    return this.optionalAttributes.includes(this,);
  }

  /** `true` quando a keyword pode aparecer fora de qualquer contexto. */
  globalScope(): boolean {
    if (this.contexts.length === 0) return true;
    return this.contexts.some((context,) => context.keyword === "properties");
  }

  /** `true` quando o atributo é do tipo lista. */
  listAttribute(): boolean {
    const propertySet = this.findPropertySet();
    if (propertySet === null) return false;
    const keyword = this.keyword.includes(".",)
      ? this.keyword.split(".",)[0]!
      : this.keyword;
    return propertySet.listAttribute?.(keyword,) ?? false;
  }

  /** Define as flags de herança a partir do `PropertySet` do contexto. */
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
   * Segunda passada: nomes curtos, contextos, atributos opcionais e `seeAlso`.
   *
   * `warnings` recebe os mesmos avisos que o Ruby escreve em `$stderr`
   * (atributo opcional não documentado) para o consumidor decidir o destino.
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
        // Divergência consciente: o Ruby levanta aqui. O port da gramática
        // (Fase 10) declara `seeAlso` para keywords que não foram
        // documentadas, então o aviso substitui a exceção — mesmo critério da
        // keyword duplicada em `SyntaxReference`.
        warnings.push(
          `See also reference ${also} of ${this.pattern.keyword} is unknown`,
        );
        continue;
      }
      this.seeAlso.push(kwd,);
    }
  }

  /**
   * Documentação em texto puro (o `to_s` do Ruby).
   *
   * @param color pinta os rótulos com ANSI (`--no-color` desliga).
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

    // Keyword removida: nada além do aviso (Ruby l.215).
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
   * Página HTML desta keyword (`<keyword>.html`), como string.
   *
   * @param manual documento que fornece cabeçalho/rodapé/navegação/estilos.
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

  /** Propósito em texto puro (o `Purpose` do `to_s`, sem rótulo). */
  purposeText(): string {
    if (this.pattern.doc === null) return "";
    return this.newRichText(this.pattern.doc,).to_s();
  }

  /** Linhas da seção `Arguments:` já indentadas pelo nome do argumento. */
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

  /** Lista de atributos com as marcas `[sc]`/`[ig]`/`[ip]`. */
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

  /** Texto do aviso de nível de suporte (`KeywordDocumentation.rb:698-717`). */
  private supportLevelMessage(): string {
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

  /** Barra de navegação desta página (predecessor/sucessor). */
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

  /** Caixa com o nome da keyword (e a marca de list attribute). */
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

  /** Aviso de nível de suporte (ou `null` quando `supported`). */
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

  /** Linhas de `Arguments` (o `rowspan` é do primeiro argumento). */
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

  /** Linha de `Context` (ou `Global scope` com link para a introdução). */
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

  /** Linha de `See also` (omitida quando não há referências). */
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

  /** Caixa de atributos opcionais (lista simples ou tabela com marcas). */
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

  /** Caixa `<pre class="code">` com o exemplo anotado da keyword. */
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

  /** Uma linha `tag`/`descr` da tabela de descrição. */
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

  /** `RichText` sem handlers de função, como no Ruby (`RichText.new(text, [])`). */
  private newRichText(text: string,): RichTextIntermediate {
    const richText = new RichText(text, [],);
    const intermediate = richText.generateIntermediateFormat();
    if (intermediate === null) {
      return new RichTextIntermediate(richText,);
    }
    this.references.push(...intermediate.internalReferences(),);
    return intermediate;
  }

  /** Reescreve uma referência não documentada (só avisa e devolve `false`). */
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

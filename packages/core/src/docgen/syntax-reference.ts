/**
 * `syntax-reference.ts` — índice de todas as keywords documentadas (22.1b.2).
 *
 * Port fiel de `SyntaxReference.rb` (300 linhas). O construtor instancia o
 * `ProjectFileParser`, percorre **todas** as regras e guarda os patterns com
 * `doc` numa `KeywordDocumentation`; duas passadas seguem a ordem do Ruby:
 * `crossReference` em todos e depois `computeInheritance` em todos.
 *
 * A referência é **cara** (montar as tabelas do parser custa ~100 ms) e não
 * muda entre chamadas: {@link syntaxReference} memoiza e
 * {@link resetSyntaxReferenceCache} limpa (usado nos testes).
 *
 * Divergência consciente: o Ruby levanta quando dois patterns documentados têm
 * a mesma keyword. O port da gramática (Fase 10) declara cinco keywords em mais
 * de uma regra (`flags`, `rate`, `start`, `end`, `limits`), então aqui a
 * primeira ocorrência vence e as demais viram **aviso** em `warnings` — o
 * `man` continua funcionando e a divergência fica visível.
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
 * Constrói o índice de keywords a partir das regras do parser.
 */
export class SyntaxReference {
  /** Contexto padrão das páginas HTML (`UserManual` no uso normal). */
  readonly manual: ManualPageContext | null;
  /** Keywords documentadas, indexadas pelo identificador (`scope.nome`). */
  readonly keywords = new Map<string, KeywordDocumentation>();
  /** Avisos da construção (keyword duplicada, atributo não documentado). */
  readonly warnings: string[] = [];
  /** Parser usado como fonte das regras (guardado para consultas). */
  readonly parser: ProjectFileParser;

  /**
   * Varre as regras documentadas do parser e monta o índice.
   *
   * @param manual documento usado como contexto padrão das páginas HTML.
   * @param ignoreOld omite keywords `deprecated`/`removed`.
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
   * Keywords em ordem alfabética; encadeia `predecessor`/`successor` para as
   * barras de navegação (`SyntaxReference.rb:81-92`).
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
   * Acrescenta ao `toc` a seção "Syntax Reference" (`<prefix>`) e uma entrada
   * por keyword (`<prefix>.1` … `<prefix>.N`).
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

  /** Referências internas por keyword (sem duplicatas, sem listas vazias). */
  internalReferences(): Record<string, string[]> {
    const references: Record<string, string[]> = {};
    for (const keyword of this.keywords.values()) {
      const unique = [...new Set(keyword.references,),];
      if (unique.length > 0) references[keyword.keyword] = unique;
    }
    return references;
  }

  /**
   * Documentação em texto puro de uma keyword.
   *
   * @returns `""` quando a keyword não existe.
   */
  toText(keyword: string, color = false,): string {
    const documentation = this.keywords.get(keyword,);
    return documentation === undefined ? "" : documentation.toText(color,);
  }

  /** Página HTML de uma keyword (ou `""` quando desconhecida). */
  generateHTMLreference(
    keyword: string,
    manual: ManualPageContext | null = this.manual,
  ): string {
    const documentation = this.keywords.get(keyword,);
    if (documentation === undefined || manual === null) return "";
    return documentation.toHTML(manual,);
  }

  /**
   * `navbar.html` (índice alfabético com âncoras por letra) e
   * `alphabet.html` (barra de letras).
   *
   * O Ruby ainda embute uma busca no Google na barra de letras; aqui a página
   * só linka as letras de `navbar.html`, sem depender de serviço externo.
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

  // --- Auxiliares (SyntaxReference.rb:205-272) ------------------------------

  /**
   * Atributos do bloco opcional `{ … }` do pattern, indexados pelo pattern que
   * os declara; o booleano marca atributos de cenário.
   */
  private optionalAttributes(
    pattern: Pattern,
    stack: Map<Pattern, boolean>,
  ): Map<Pattern, boolean> {
    // Recursão infinita: o pattern já está na pilha.
    if (stack.has(pattern,)) {
      return new Map();
    }
    // Pattern aninhado que já é documentado não contribui com atributos.
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
      // Regras com vários patterns não definem um conjunto único de atributos.
      if (rule.patterns.length > 1) continue;
      const inner = rule.patterns[0];
      if (inner === undefined) continue;
      const attributes = this.optionalAttributes(inner, stack,);
      if (attributes.size > 0) return attributes;
    }
    return new Map();
  }

  /**
   * Atributos da regra referenciada por `token`: cada pattern cujo primeiro
   * token é literal entra como atributo; referências a `!scenarioIdCol` marcam
   * os atributos seguintes como específicos de cenário.
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

/** Referência memoizada (uma construção de parser por processo). */
let cachedReference: SyntaxReference | null = null;
/** Opção `ignoreOld` com que a referência memoizada foi construída. */
let cachedIgnoreOld = false;

/** Índice compartilhado de keywords (memoizado). */
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

/** Esquece a referência memoizada (testes e recarga de assets). */
export function resetSyntaxReferenceCache(): void {
  cachedReference = null;
  cachedIgnoreOld = false;
}

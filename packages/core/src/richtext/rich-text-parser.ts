/**
 * RichTextParser — parser FSM do markup MediaWiki (Fase 12.6).
 *
 * Herda de {@link TextParser} (Fase 10) e injeta o {@link RichTextScanner}
 * (12.5) como fonte de tokens. As regras de sintaxe vivem em
 * `rich-text-syntax-rules.ts` (port do mixin `RichTextSyntaxRules`). O
 * `RichText` (12.18) mantém uma única instância deste parser como singleton e
 * a reutiliza via {@link RichTextParser.reuse}, espelhando o `@@parser` do Ruby.
 *
 * Port fiel de `RichText/Parser.rb` (RichTextParser, 27-86).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/Parser.rb
 * @see ADR 025 (RichText e function handlers)
 */

import { Log, } from "../log.ts";
import { type ParserToken, TextParser, } from "../parser/text-parser.ts";
import { RichTextScanner, } from "./rich-text-scanner.ts";
import type { RichTextIntermediate, } from "./rich-text-intermediate.ts";
import { registerRichTextRules, } from "./rich-text-syntax-rules.ts";

/** Tokens que o RichTextScanner pode devolver (Parser.rb l.37-48). */
const RT_TOKENS = [
  "LINEBREAK",
  "SPACE",
  "WORD",
  "BOLD",
  "ITALIC",
  "CODE",
  "BOLDITALIC",
  "PRE",
  "HREF",
  "HREFEND",
  "REF",
  "REFEND",
  "HLINE",
  "HTMLBLOB",
  "FCOLSTART",
  "FCOLEND",
  "QUERY",
  "INLINEFUNCSTART",
  "INLINEFUNCEND",
  "BLOCKFUNCSTART",
  "BLOCKFUNCEND",
  "ID",
  "STRING",
  "TITLE1",
  "TITLE2",
  "TITLE3",
  "TITLE4",
  "TITLE1END",
  "TITLE2END",
  "TITLE3END",
  "TITLE4END",
  "BULLET1",
  "BULLET2",
  "BULLET3",
  "BULLET4",
  "NUMBER1",
  "NUMBER2",
  "NUMBER3",
  "NUMBER4",
];

export class RichTextParser extends TextParser {
  /** RTI dono da árvore produzida (Ruby @richTextI). */
  richTextI: RichTextIntermediate;
  /** Contadores de seção para numeração de títulos (Ruby @sectionCounter). */
  sectionCounter: number[];
  /** Contadores para numeração de listas (Ruby @numberListCounter). */
  numberListCounter: number[];
  /** Scanner RichText corrente (estreitamento do `scanner` da base). */
  private rtScanner: RichTextScanner | null = null;

  constructor(
    rti: RichTextIntermediate,
    sectionCounter: number[] = [0, 0, 0, 0,],
    tokenSet: string[] | null = null,
  ) {
    super();
    this.richTextI = rti;
    this.variables = RT_TOKENS;
    this.limitTokenSet(tokenSet,);
    this.initRules();
    this.updateParserTables();
    this.sectionCounter = sectionCounter;
    this.numberListCounter = [0, 0, 0, 0,];
  }

  /**
   * Registra o conjunto de regras RichText. Substitui o mixin
   * `RichTextSyntaxRules` do Ruby por um módulo de funções (12.6.2).
   */
  override initRules(): void {
    registerRichTextRules(this,);
  }

  /**
   * Reutiliza o singleton para um novo RTI, resetando o estado mutável
   * (Parser.rb l.59-66). O `@stack` volta a `null` e os tokens bloqueados são
   * limpos antes de reaplicar o `tokenSet`.
   */
  reuse(
    rti: RichTextIntermediate,
    sectionCounter: number[] = [0, 0, 0, 0,],
    tokenSet: string[] | null = null,
  ): void {
    this.clearBlockedVariables();
    this.stack = null;
    this.richTextI = rti;
    this.sectionCounter = sectionCounter;
    this.limitTokenSet(tokenSet,);
  }

  /**
   * Abre o texto para leitura. Garante terminação de linha dupla como no Ruby
   * (Parser.rb l.69-74): novos `\n` extras são simplesmente ignorados pelo
   * scanner e fecham o último bloco.
   */
  open(text: string,): void {
    const scanner = new RichTextScanner(text + "\n\n", Log,);
    this.rtScanner = scanner;
    // A base delega error/warning/sourceFileInfo ao `scanner` protegido.
    this.scanner = scanner;
    scanner.open(true,);
  }

  /** Entrega o próximo token do scanner ao FSM. */
  protected override nextToken(): ParserToken {
    if (!this.rtScanner) {
      return ["endOfText", "", null,];
    }
    return this.rtScanner.nextToken() as ParserToken;
  }

  /** Devolve o token ao scanner (push-back LIFO). */
  protected override returnToken(token: ParserToken | null,): void {
    if (this.rtScanner && token) {
      this.rtScanner.returnToken(token,);
    }
  }
}

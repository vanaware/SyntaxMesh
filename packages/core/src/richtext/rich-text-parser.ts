/**
 * RichTextParser — FSM parser for the MediaWiki markup (phase 12.6).
 *
 * Extends {@link TextParser} (phase 10) and injects the {@link RichTextScanner}
 * (12.5) as the token source. The syntax rules live in
 * `rich-text-syntax-rules.ts` (port of the `RichTextSyntaxRules` mixin).
 * `RichText` (12.18) keeps a single instance of this parser as a singleton and
 * reuses it through {@link RichTextParser.reuse}, mirroring Ruby's `@@parser`.
 *
 * Faithful port of `RichText/Parser.rb` (RichTextParser, 27-86).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/Parser.rb
 * @see ADR 025 (RichText and function handlers)
 */

import { Log, } from "../log.ts";
import { type ParserToken, TextParser, } from "../parser/text-parser.ts";
import { RichTextScanner, } from "./rich-text-scanner.ts";
import type { RichTextIntermediate, } from "./rich-text-intermediate.ts";
import { registerRichTextRules, } from "./rich-text-syntax-rules.ts";

/** Tokens that RichTextScanner may return (Parser.rb l.37-48). */
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
  /** RTI owning the produced tree (Ruby @richTextI). */
  richTextI: RichTextIntermediate;
  /** Section counters for title numbering (Ruby @sectionCounter). */
  sectionCounter: number[];
  /** Counters for list numbering (Ruby @numberListCounter). */
  numberListCounter: number[];
  /** Current RichText scanner (narrowing of the base `scanner`). */
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
   * Registers the RichText rule set. Replaces Ruby's `RichTextSyntaxRules`
   * mixin with a module of functions (12.6.2).
   */
  override initRules(): void {
    registerRichTextRules(this,);
  }

  /**
   * Reuses the singleton for a new RTI, resetting the mutable state
   * (Parser.rb l.59-66). `@stack` goes back to `null` and the blocked tokens
   * are cleared before reapplying the `tokenSet`.
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
   * Opens the text for reading. Guarantees a double line terminator as in Ruby
   * (Parser.rb l.69-74): extra new `\n` are simply ignored by the scanner and
   * close the last block.
   */
  open(text: string,): void {
    const scanner = new RichTextScanner(text + "\n\n", Log,);
    this.rtScanner = scanner;
    // The base delegates error/warning/sourceFileInfo to the protected
    // `scanner`.
    this.scanner = scanner;
    scanner.open(true,);
  }

  /** Hands the next token from the scanner to the FSM. */
  protected override nextToken(): ParserToken {
    if (!this.rtScanner) {
      return ["endOfText", "", null,];
    }
    return this.rtScanner.nextToken() as ParserToken;
  }

  /** Returns the token to the scanner (push-back LIFO). */
  protected override returnToken(token: ParserToken | null,): void {
    if (this.rtScanner && token) {
      this.rtScanner.returnToken(token,);
    }
  }
}

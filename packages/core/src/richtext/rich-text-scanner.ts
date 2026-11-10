/**
 * RichTextScanner — lexer for MediaWiki markup (TaskJuggler dialect).
 *
 * Faithful port of `RichText/Scanner.rb` (TaskJuggler 3.8.4, 258 lines).
 * Specializes `TextParser::Scanner` (phase 10) for the RichText grammar.
 *
 * Supported modes (Ruby `@scannerMode`, see Scanner.rb l.20-32):
 *   - `bop`   : begin of paragraph
 *   - `bol`   : begin of line (inside a paragraph)
 *   - `inline`: inside a line (the default after any inline token)
 *   - `nowiki`: skips special tokens up to `</nowiki>`
 *   - `html`  : consumes everything up to `</html>` as HTMLBLOB
 *   - `ref`   : inside `[[ ... ]]`
 *   - `href`  : inside `[ ... ]`
 *   - `func`  : inside `<[ ... ]>` (block) or `<- ... ->` (inline)
 *
 * Controlled divergence vs Ruby:
 *   - `HTMLBLOB /(.|\n)*<\/html>/` is line-by-line here, because our
 *     `StreamHandle.scan()` works per line (same semantics as strscan on
 *     `@cf` when Ruby is also in a per-line `StringScanner` — the
 *     `(.|\n)*` never matches beyond the line buffer in the real Scanner.rb
 *     because `@cf` is recreated on every `gets`). The parser joins the
 *     fragments.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/Scanner.rb
 * @see ADR 025 (RichText and function handlers)
 */
import {
  Scanner,
  type ScannerToken,
  type TokenPattern,
  type TokenPostProcessor,
} from "../lexer/scanner.ts";
import type { LogLike, } from "../lexer/stream-handle.ts";

/** Named colors accepted by `<fcol:...>` (Scanner.rb l.155-156). */
const VALID_COLORS = [
  "black",
  "maroon",
  "green",
  "olive",
  "navy",
  "purple",
  "teal",
  "silver",
  "gray",
  "red",
  "lime",
  "yellow",
  "blue",
  "fuchsia",
  "aqua",
  "white",
];

/** Index of `quotes` (Ruby l.173): 2→ITALIC 3→BOLD 4→CODE 5→BOLDITALIC. */
const QUOTE_TYPES: Array<string | null> = [
  null,
  null,
  "ITALIC",
  "BOLD",
  "CODE",
  "BOLDITALIC",
];

/**
 * Default mode (Ruby `super(masterFile, log, tokenPatterns, :bop)`).
 * Plain strings are used here (no `:`) for consistency with the rest of
 * the TypeScript code; no external code depends on this name.
 */
const RT_MODES = {
  bop: "bop",
  bol: "bol",
  inline: "inline",
  nowiki: "nowiki",
  html: "html",
  ref: "ref",
  href: "href",
  func: "func",
} as const;

export class RichTextScanner extends Scanner {
  /** Mode before entering `:func` (Ruby `@funcLastMode`). */
  private funcLastMode: string | null = null;
  /** Mode before entering `:href` (Ruby `@hrefLastMode`). */
  private hrefLastMode: string | null = null;

  constructor(masterFile: string, log: LogLike,) {
    // Patterns are registered after `super()` because the `this.*` arrows
    // need the constructed instance (idempotent with ProjectFileScanner).
    super(masterFile, log, [], RT_MODES.bop,);

    const patterns: TokenPattern[] = [
      // :bol
      [
        "LINEBREAK",
        /\s*\n/,
        RT_MODES.bol,
        (t, m,) => this.linebreak(t, m,),
      ],
      [null, /\s+/, RT_MODES.bol, (t, m,) => this.inlineMode(t, m,),],
      // :bop
      [
        "PRE",
        / [^\n]+\n?/,
        RT_MODES.bop,
        (t, m,) => this.pre(t, m,),
      ],
      [null, /\s*\n/, RT_MODES.bop, (t, m,) => this.linebreak(t, m,),],
      // :inline
      [
        "SPACE",
        /[ \t\n]+/,
        RT_MODES.inline,
        (t, m,) => this.space(t, m,),
      ],
      // :bop and :bol (and :inline for INLINEFUNCSTART)
      [
        "INLINEFUNCSTART",
        /<-/,
        [RT_MODES.bop, RT_MODES.bol, RT_MODES.inline,],
        (t, m,) => this.functionStart(t, m,),
      ],
      [
        "BLOCKFUNCSTART",
        /<\[/,
        [RT_MODES.bop, RT_MODES.bol,],
        (t, m,) => this.functionStart(t, m,),
      ],
      [
        "TITLE",
        /={2,5}/,
        [RT_MODES.bop, RT_MODES.bol,],
        (t, m,) => this.titleStart(t, m,),
      ],
      [
        "TITLEEND",
        /={2,5}/,
        RT_MODES.inline,
        (t, m,) => this.titleEnd(t, m,),
      ],
      [
        "BULLET",
        /\*{1,4}[ \t]+/,
        [RT_MODES.bop, RT_MODES.bol,],
        (t, m,) => this.bullet(t, m,),
      ],
      [
        "NUMBER",
        /\#{1,4}[ \t]+/,
        [RT_MODES.bop, RT_MODES.bol,],
        (t, m,) => this.number(t, m,),
      ],
      [
        "HLINE",
        /----/,
        [RT_MODES.bop, RT_MODES.bol,],
        (t, m,) => this.inlineMode(t, m,),
      ],
      // :bop, :bol, :inline
      [
        null,
        /<nowiki>/,
        [RT_MODES.bop, RT_MODES.bol, RT_MODES.inline,],
        (t, m,) => this.nowikiStart(t, m,),
      ],
      [
        null,
        /<html>/,
        [RT_MODES.bop, RT_MODES.bol, RT_MODES.inline,],
        (t, m,) => this.htmlStart(t, m,),
      ],
      [
        "FCOLSTART",
        /<fcol:([a-z]+|#[0-9A-Fa-f]{3,6})>/,
        [RT_MODES.bop, RT_MODES.bol, RT_MODES.inline,],
        (t, m,) => this.fontColorStart(t, m,),
      ],
      [
        "FCOLEND",
        /<\/fcol>/,
        [RT_MODES.bop, RT_MODES.bol, RT_MODES.inline,],
        (t, m,) => this.fontColorEnd(t, m,),
      ],
      [
        "QUOTES",
        /'{2,5}/,
        [RT_MODES.bop, RT_MODES.bol, RT_MODES.inline,],
        (t, m,) => this.quotes(t, m,),
      ],
      [
        "REF",
        /\[\[/,
        [RT_MODES.bop, RT_MODES.bol, RT_MODES.inline,],
        (t, m,) => this.refStart(t, m,),
      ],
      [
        "HREF",
        /\[/,
        [RT_MODES.bop, RT_MODES.bol, RT_MODES.inline,],
        (t, m,) => this.hrefStart(t, m,),
      ],
      [
        "WORD",
        /.[^ \n\t\[<']*/,
        [RT_MODES.bop, RT_MODES.bol, RT_MODES.inline,],
        (t, m,) => this.inlineMode(t, m,),
      ],
      // :nowiki
      [
        null,
        /<\/nowiki>/,
        RT_MODES.nowiki,
        (t, m,) => this.nowikiEnd(t, m,),
      ],
      ["WORD", /(<(?!\/nowiki>)|[^ \t\n<])+/, RT_MODES.nowiki, null,],
      ["SPACE", /[ \t]+/, RT_MODES.nowiki, null,],
      ["LINEBREAK", /\s*\n/, RT_MODES.nowiki, null,],
      // :html
      // Ruby `(.|\n)*<\/html>` + `match[0..-8]`: the blob ends right before
      // `</html>` and the tag never enters the value. Line by line:
      //   (a) `</html>` with something else after the tag on the same line
      //       (nothing to cut beyond the tag itself);
      //   (b) `</html>` followed by `\n` or EOL — cuts the 7 tag chars;
      //   (c) intermediate fraction of multi-line blobs (Ruby joins the
      //       fragments into a single HTMLBLOB via a multi-line buffer; here
      //       the parser keeps each line as a fragment and the `htmlblob`
      //       join rebuilds the full value).
      [
        "HTMLBLOB",
        /.*<\/html>(?=[^\n])/,
        RT_MODES.html,
        (t, m,) => this.htmlEnd(t, m,),
      ],
      [
        "HTMLBLOB",
        /.*<\/html>/,
        RT_MODES.html,
        (t, m,) => this.htmlEnd(t, m,),
      ],
      // Ruby `/.*\n/` — the whole line, including `\n`.
      ["HTMLBLOB", /.*\n/, RT_MODES.html, null,],
      // :ref
      [
        "REFEND",
        /\]\]/,
        RT_MODES.ref,
        (t, m,) => this.refEnd(t, m,),
      ],
      [
        "WORD",
        /(<(?!-)|(\](?!\])|[^|<\]]))+/,
        RT_MODES.ref,
        null,
      ],
      [
        "QUERY",
        /<-\w+->/,
        RT_MODES.ref,
        (t, m,) => this.query(t, m,),
      ],
      ["LITERAL", /./, RT_MODES.ref, null,],
      // :href
      [
        "HREFEND",
        /\]/,
        RT_MODES.href,
        (t, m,) => this.hrefEnd(t, m,),
      ],
      ["WORD", /(<(?!-)|[^ \t\n\]<])+/, RT_MODES.href, null,],
      [
        "QUERY",
        /<-\w+->/,
        RT_MODES.href,
        (t, m,) => this.query(t, m,),
      ],
      ["SPACE", /[ \t\n]+/, RT_MODES.href, null,],
      // :func
      [
        "INLINEFUNCEND",
        /->/,
        RT_MODES.func,
        (t, m,) => this.functionEnd(t, m,),
      ],
      [
        "BLOCKFUNCEND",
        /\]>/,
        RT_MODES.func,
        (t, m,) => this.functionEnd(t, m,),
      ],
      ["ID", /[a-zA-Z_]\w*/, RT_MODES.func, null,],
      [
        "STRING",
        /"(\\"|[^"])*"/,
        RT_MODES.func,
        (t, m,) => this.dqString(t, m,),
      ],
      [
        "STRING",
        /'(\\'|[^'])*'/,
        RT_MODES.func,
        (t, m,) => this.sqString(t, m,),
      ],
      [null, /[ \t\n]+/, RT_MODES.func, null,],
      ["LITERAL", /./, RT_MODES.func, null,],
    ];

    for (const pat of patterns) {
      this.addPattern(pat[0], pat[1], pat[2]!, pat[3],);
    }
    // Re-evaluate activePatterns now that the modes exist.
    this.mode = RT_MODES.bop;
  }

  // ------------------------------------------------------------------ //
  // Post-processors (private, faithful to Scanner.rb l.107-254)        //
  // ------------------------------------------------------------------ //

  /** SPACE with `\n` moves to :bol and returns the emptied text. */
  private space(
    type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    if (match.indexOf("\n",) >= 0) {
      this.mode = RT_MODES.bol;
      match = "";
    }
    return [type, match,];
  }

  private linebreak(
    type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    this.mode = RT_MODES.bop;
    return [type, match,];
  }

  private inlineMode(
    type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    this.mode = RT_MODES.inline;
    return [type, match,];
  }

  /** `== T ==` → TITLE1..TITLE4 by length (Ruby: `.length - 1`). */
  private titleStart(
    _type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    this.mode = RT_MODES.inline;
    return [`TITLE${match.length - 1}`, match,];
  }

  private titleEnd(
    _type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    return [`TITLE${match.length - 1}END`, match,];
  }

  private bullet(
    _type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    this.mode = RT_MODES.inline;
    const stars = (match.match(/\*/g,) ?? []).length;
    return [`BULLET${stars}`, match,];
  }

  private number(
    _type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    this.mode = RT_MODES.inline;
    const hashes = (match.match(/#/g,) ?? []).length;
    return [`NUMBER${hashes}`, match,];
  }

  /** `<fcol:red>` → FCOLSTART with `red` extracted; validates the color. */
  private fontColorStart(
    _type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    this.mode = RT_MODES.inline;
    // Ruby: `match[6..-2]` strips `<fcol:` (6) and the final `>` (1).
    const colName = match.slice(6, -1,);
    if (!/#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})/.test(colName,)) {
      if (!VALID_COLORS.includes(colName,)) {
        this.error(
          "bad_color_name",
          `${colName} is not a supported color. Use one of ` +
            `${VALID_COLORS.join(", ",)} or #RGB where 'R', 'G' and 'B' ` +
            "are one or two digit hexadecimal numbers.",
        );
      }
    }
    return ["FCOLSTART", colName,];
  }

  private fontColorEnd(
    type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    return [type, match,];
  }

  /** `''`=ITALIC, `'''`=BOLD, `''''`=CODE, `'''''`=BOLDITALIC. */
  private quotes(
    _type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    this.mode = RT_MODES.inline;
    const t = QUOTE_TYPES[match.length] ?? null;
    return [t, match,];
  }

  private htmlStart(
    type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    this.mode = RT_MODES.html;
    return [type, match,];
  }

  /** Strips `</html>` (7 chars) from the end of the last HTMLBLOB. */
  private htmlEnd(
    type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    this.mode = RT_MODES.inline;
    return [type, match.slice(0, -7,),];
  }

  private nowikiStart(
    type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    this.mode = RT_MODES.nowiki;
    return [type, match,];
  }

  private nowikiEnd(
    type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    this.mode = RT_MODES.inline;
    return [type, match,];
  }

  /** `<[` or `<-`: remembers the return mode and enters `:func`. */
  private functionStart(
    type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    this.funcLastMode = (this.scannerMode === RT_MODES.bop ||
        this.scannerMode === RT_MODES.bol)
      ? RT_MODES.inline
      : this.scannerMode;
    this.mode = RT_MODES.func;
    return [type, match,];
  }

  private functionEnd(
    type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    this.mode = this.funcLastMode ?? RT_MODES.inline;
    this.funcLastMode = null;
    return [type, match,];
  }

  /** PRE strips the first space (Ruby `match[1..-1]`). */
  private pre(
    type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    return [type, match.slice(1,),];
  }

  /** dqString: strips the quotes and unescapes `\"`. */
  private dqString(
    type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    const inner = match.slice(1, -1,).replace(/\\"/g, '"',);
    return [type, inner,];
  }

  /** sqString: strips the quotes and unescapes `\'`. */
  private sqString(
    type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    const inner = match.slice(1, -1,).replace(/\\'/g, "'",);
    return [type, inner,];
  }

  /** QUERY strips `<-` and `->` (Ruby `match[2..-3]`). */
  private query(
    type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    return [type, match.slice(2, -2,),];
  }

  private hrefStart(
    type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    this.hrefLastMode = (this.scannerMode === RT_MODES.bop ||
        this.scannerMode === RT_MODES.bol)
      ? RT_MODES.inline
      : this.scannerMode;
    this.mode = RT_MODES.href;
    return [type, match,];
  }

  private hrefEnd(
    type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    this.mode = this.hrefLastMode ?? RT_MODES.inline;
    this.hrefLastMode = null;
    return [type, match,];
  }

  private refStart(
    type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    this.mode = RT_MODES.ref;
    return [type, match,];
  }

  private refEnd(
    type: string | null,
    match: string,
  ): ReturnType<TokenPostProcessor> {
    this.mode = RT_MODES.inline;
    return [type, match,];
  }
}

// Re-exports the type for the convenience of consumers (parser + tests).
export type { ScannerToken, };

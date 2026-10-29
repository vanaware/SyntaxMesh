/**
 * RichTextSyntaxRules — gramática do markup MediaWiki (Fase 12.6.2).
 *
 * Port fiel do mixin `RichTextSyntaxRules` (`RichText/SyntaxRules.rb`): cada
 * método `rule_X` vira um bloco registrado via {@link RichTextParser.newRule}.
 * As actions são funções comuns (sem arrow) cujo `this` é o parser; leem
 * `this.val` (equivalente ao `@val` do Ruby) e `this.richTextI`.
 *
 * Convenções do port:
 *   - símbolos Ruby (`:title1`) viram as strings idênticas usadas por
 *     {@link RichTextElement} (sem os dois-pontos);
 *   - `@val[i].last` em arrays é `arr[arr.length - 1]`; `nil` vira `null`;
 *   - `Array#join` (Ruby, separador `""`) vira `join("")`;
 *   - `richTextI.richText.functionHandler(name, block)` — `richText` é opaco
 *     (`unknown`) aqui; o `RichText` real (12.18) fornece o método.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/SyntaxRules.rb
 * @see ADR 025 (RichText e function handlers)
 */

import { RichTextElement, } from "./rich-text-element.ts";
import { RichTextImage, } from "./rich-text-image.ts";
import type { RichTextParser, } from "./rich-text-parser.ts";

type Action = (this: RichTextParser,) => unknown;

/** Cast de `@val[i]` (unknown) para o 3º arg do `RichTextElement`. */
function arg(
  v: unknown,
): RichTextElement | string | Array<RichTextElement | string> | null {
  return v as RichTextElement | string | Array<RichTextElement | string> | null;
}

/** Interface mínima do RichText dona deste RTI (12.18 implementa). */
interface RichTextOwner {
  functionHandler: (name: string, block: boolean,) => unknown;
}

/** Alinhamentos verticais aceitos em referências de imagem. */
const V_ALIGN = [
  "top",
  "middle",
  "bottom",
  "baseline",
  "sub",
  "super",
  "text-top",
  "text-bottom",
];

/** Extensões de imagem suportadas pela sintaxe `[[File:...]]`. */
const IMG_EXTS = ["jpg", "gif", "png", "svg",];

/** Define (ou reafirma) a regra `name` e executa `body` com ela como corrente. */
function rtRule(p: RichTextParser, name: string, body: () => void,): void {
  p.newRule(name, body,);
}

/** Último elemento de um resultado de regra (array achatado ou elemento só). */
function lastEl(val: unknown,): RichTextElement | null {
  if (Array.isArray(val,)) {
    const l = val[val.length - 1];
    return l instanceof RichTextElement ? l : null;
  }
  return val instanceof RichTextElement ? val : null;
}

/** `@val[x].last.appendSpace = false` (somente quando há um último elemento). */
function clearLastAppendSpace(val: unknown,): void {
  const el = lastEl(val,);
  if (el) el.appendSpace = false;
}

/** Registra todas as regras RichText no parser (chamado por `initRules`). */
export function registerRichTextRules(p: RichTextParser,): void {
  // ------------------------------------------------------------------
  // Entrada e blocos
  // ------------------------------------------------------------------
  rtRule(p, "richtext", () => {
    p.pattern(["!sections", ".",], function (this: RichTextParser,): unknown {
      return new RichTextElement(
        this.richTextI,
        "richtext",
        arg(this.val[0],),
      );
    },);
  },);

  rtRule(p, "sections", () => {
    p.optional();
    p.repeatable();
    p.pattern(["!section", "!blankLines",], function (
      this: RichTextParser,
    ): unknown {
      return this.val[0];
    },);
  },);

  rtRule(p, "section", () => {
    p.pattern(["!headlines",], function (this: RichTextParser,): unknown {
      return this.val[0];
    },);
    p.pattern(["$HLINE",], function (this: RichTextParser,): unknown {
      return new RichTextElement(this.richTextI, "hline", arg(this.val[0],),);
    },);
    p.pattern(["!paragraph",], function (this: RichTextParser,): unknown {
      return this.val[0];
    },);
    p.pattern(["!pre",], function (this: RichTextParser,): unknown {
      return new RichTextElement(
        this.richTextI,
        "pre",
        (this.val[0] as string[]).join("",),
      );
    },);
    p.pattern(["!bulletList1",], function (this: RichTextParser,): unknown {
      return new RichTextElement(
        this.richTextI,
        "bulletlist1",
        arg(this.val[0],),
      );
    },);
    p.pattern(["!numberList1",], function (this: RichTextParser,): unknown {
      this.numberListCounter = [0, 0, 0, 0,];
      return new RichTextElement(
        this.richTextI,
        "numberlist1",
        arg(this.val[0],),
      );
    },);
    p.pattern(["!blockFunction",], function (this: RichTextParser,): unknown {
      return this.val[0];
    },);
  },);

  rtRule(p, "headlines", () => {
    for (const name of ["title1", "title2", "title3", "title4",]) {
      p.pattern([`!${name}`,], function (this: RichTextParser,): unknown {
        return this.val[0];
      },);
    }
  },);

  rtRule(p, "pre", () => {
    p.repeatable();
    p.pattern(["$PRE",], function (this: RichTextParser,): unknown {
      return this.val[0];
    },);
  },);

  // ------------------------------------------------------------------
  // Títulos (com contadores de seção)
  // ------------------------------------------------------------------
  const title = (level: 1 | 2 | 3 | 4,): Action =>
    function (this: RichTextParser,): unknown {
      const sc = this.sectionCounter;
      const el = new RichTextElement(
        this.richTextI,
        `title${level}` as "title1",
        arg(this.val[2],),
      );
      sc[level - 1]! += 1;
      // title1 zera [1,2]; title2 zera [2]; title3 zera [3]; title4 não zera.
      if (level === 1) {
        sc[1] = 0;
        sc[2] = 0;
      } else if (level === 2) {
        sc[2] = 0;
      } else if (level === 3) {
        sc[3] = 0;
      }
      el.data = sc.slice();
      return el;
    };

  for (const level of [1, 2, 3, 4,] as const) {
    rtRule(p, `title${level}`, () => {
      p.pattern(
        [`$TITLE${level}`, "!space", "!text", `$TITLE${level}END`,],
        title(level,),
      );
    },);
  }

  // ------------------------------------------------------------------
  // Listas com marcadores (bullets)
  // ------------------------------------------------------------------
  const bulletList = (level: 1 | 2 | 3 | 4,): () => void => () => {
    if (level === 1) {
      p.optional();
    }
    p.repeatable();
    p.pattern(
      [`$BULLET${level}`, "!text",],
      function (this: RichTextParser,): unknown {
        return new RichTextElement(
          this.richTextI,
          `bulletitem${level}` as "bulletitem1",
          arg(this.val[1],),
        );
      },
    );
    if (level < 4) {
      p.pattern([`!bulletList${level + 1}`,], function (
        this: RichTextParser,
      ): unknown {
        return new RichTextElement(
          this.richTextI,
          `bulletlist${level + 1}` as "bulletlist2",
          arg(this.val[0],),
        );
      },);
    }
  };
  for (const level of [1, 2, 3, 4,] as const) {
    rtRule(p, `bulletList${level}`, bulletList(level,),);
  }

  // ------------------------------------------------------------------
  // Listas numeradas (com contadores próprios)
  // ------------------------------------------------------------------
  const numberList = (level: 1 | 2 | 3 | 4,): () => void => () => {
    p.repeatable();
    p.pattern(
      [`$NUMBER${level}`, "!text", "!blankLines",],
      function (this: RichTextParser,): unknown {
        const el = new RichTextElement(
          this.richTextI,
          `numberitem${level}` as "numberitem1",
          arg(this.val[1],),
        );
        this.numberListCounter[level - 1]! += 1;
        el.data = this.numberListCounter.slice();
        return el;
      },
    );
    if (level < 4) {
      p.pattern([`!numberList${level + 1}`,], function (
        this: RichTextParser,
      ): unknown {
        // Ruby zera os contadores internos ao descer de nível.
        if (level === 1) {
          this.numberListCounter[1] = 0;
          this.numberListCounter[2] = 0;
        } else if (level === 2) {
          this.numberListCounter[2] = 0;
        } else {
          this.numberListCounter[3] = 0;
        }
        return new RichTextElement(
          this.richTextI,
          `numberlist${level + 1}` as "numberlist2",
          arg(this.val[0],),
        );
      },);
    }
  };
  for (const level of [1, 2, 3, 4,] as const) {
    rtRule(p, `numberList${level}`, numberList(level,),);
  }

  rtRule(p, "paragraph", () => {
    p.pattern(["!text",], function (this: RichTextParser,): unknown {
      return new RichTextElement(
        this.richTextI,
        "paragraph",
        arg(this.val[0],),
      );
    },);
  },);

  // ------------------------------------------------------------------
  // Texto corrido (inline)
  // ------------------------------------------------------------------
  rtRule(p, "text", () => {
    p.pattern(["!textWithSpace",], function (this: RichTextParser,): unknown {
      clearLastAppendSpace(this.val[0],);
      return this.val[0];
    },);
  },);

  rtRule(p, "textWithSpace", () => {
    p.repeatable();
    const pass = function (this: RichTextParser,): unknown {
      return this.val[0];
    };
    p.pattern(["!plainTextWithLinks",], pass,);
    p.pattern(["!inlineFunction",], pass,);
    const wrapInline = (category: "italic" | "bold" | "code",): Action =>
      function (this: RichTextParser,): unknown {
        const el = new RichTextElement(
          this.richTextI,
          category,
          arg(this.val[2],),
        );
        clearLastAppendSpace(this.val[2],);
        el.appendSpace = this.val[4] !== null;
        return el;
      };
    p.pattern(
      ["$ITALIC", "!space", "!plainTextWithLinks", "$ITALIC", "!space",],
      wrapInline("italic",),
    );
    p.pattern(
      ["$BOLD", "!space", "!plainTextWithLinks", "$BOLD", "!space",],
      wrapInline("bold",),
    );
    p.pattern(
      ["$CODE", "!space", "!plainTextWithLinks", "$CODE", "!space",],
      wrapInline("code",),
    );
    // BOLDITALIC: bold aninhando italic (SyntaxRules.rb l.267-275).
    p.pattern(
      [
        "$BOLDITALIC",
        "!space",
        "!plainTextWithLinks",
        "$BOLDITALIC",
        "!space",
      ],
      function (this: RichTextParser,): unknown {
        const inner = new RichTextElement(
          this.richTextI,
          "italic",
          arg(this.val[2],),
        );
        const el = new RichTextElement(this.richTextI, "bold", inner,);
        clearLastAppendSpace(this.val[2],);
        el.appendSpace = this.val[4] !== null;
        return el;
      },
    );
    p.pattern(
      ["$FCOLSTART", "!space", "!plainTextWithLinks", "$FCOLEND", "!space",],
      function (this: RichTextParser,): unknown {
        const el = new RichTextElement(
          this.richTextI,
          "fontCol",
          arg(this.val[2],),
        );
        el.data = this.val[0];
        el.appendSpace = this.val[4] !== null;
        return el;
      },
    );
  },);

  // ------------------------------------------------------------------
  // Texto plano, links e referências
  // ------------------------------------------------------------------
  rtRule(p, "plainTextWithLinks", () => {
    p.pattern(["!plainText",], function (this: RichTextParser,): unknown {
      return this.val[0];
    },);
    p.pattern(
      ["$REF", "!refToken", "!moreRefToken", "$REFEND", "!space",],
      function (this: RichTextParser,): unknown {
        const v1 = (this.val[1] as string[]).join("",);
        const colon = v1.indexOf(":",);
        let protocol: string | null = null;
        let locator = "";
        if (colon >= 0) {
          protocol = v1.slice(0, colon,);
          locator = v1.slice(colon + 1,);
        }
        if (protocol === "File") {
          return makeImage(this, locator, v1, this.val[2] as string[] | null,);
        }
        const label = this.val[2] || v1;
        const el = new RichTextElement(
          this.richTextI,
          "ref",
          new RichTextElement(this.richTextI, "text", arg(label,),),
        );
        el.data = v1;
        el.appendSpace = this.val[4] !== null;
        return el;
      },
    );
    p.pattern(
      [
        "$HREF",
        "!wordWithQueries",
        "!space",
        "!plainTextWithQueries",
        "$HREFEND",
        "!space",
      ],
      function (this: RichTextParser,): unknown {
        const el = new RichTextElement(
          this.richTextI,
          "href",
          arg(this.val[3] || this.val[1],),
        );
        el.data = new RichTextElement(
          this.richTextI,
          "richtext",
          arg(this.val[1],),
        );
        el.appendSpace = this.val[5] !== null;
        return el;
      },
    );
  },);

  rtRule(p, "moreRefToken", () => {
    p.repeatable();
    p.optional();
    p.pattern(["_|", "!refToken",], function (
      this: RichTextParser,
    ): unknown {
      return (this.val[1] as string[]).join("",);
    },);
  },);

  rtRule(p, "refToken", () => {
    p.repeatable();
    p.pattern(["$WORD",], function (this: RichTextParser,): unknown {
      return this.val[0];
    },);
  },);

  rtRule(p, "wordWithQueries", () => {
    p.repeatable();
    p.pattern(["$WORD",], function (this: RichTextParser,): unknown {
      return new RichTextElement(
        this.richTextI,
        "text",
        this.val[0] as string,
      );
    },);
    p.pattern(["$QUERY",], function (this: RichTextParser,): unknown {
      const el = new RichTextElement(this.richTextI, "inlinefunc",);
      el.data = ["query", { attribute: this.val[0] as string, },];
      return el;
    },);
  },);

  rtRule(p, "plainText", () => {
    p.repeatable();
    p.optional();
    p.pattern(["!htmlBlob", "!space",], function (
      this: RichTextParser,
    ): unknown {
      const el = new RichTextElement(
        this.richTextI,
        "htmlblob",
        (this.val[0] as string[]).join("",),
      );
      el.appendSpace = this.val[1] !== null;
      return el;
    },);
    p.pattern(["$WORD", "!space",], function (this: RichTextParser,): unknown {
      const el = new RichTextElement(
        this.richTextI,
        "text",
        this.val[0] as string,
      );
      el.appendSpace = this.val[1] !== null;
      return el;
    },);
  },);

  rtRule(p, "plainTextWithQueries", () => {
    p.repeatable();
    p.optional();
    p.pattern(["!wordWithQueries", "!space",], function (
      this: RichTextParser,
    ): unknown {
      const tail = lastEl(this.val[0],);
      if (tail && this.val[1] !== null && this.val[1] !== undefined) {
        tail.appendSpace = true;
      }
      return this.val[0];
    },);
  },);

  rtRule(p, "htmlBlob", () => {
    p.repeatable();
    p.pattern(["$HTMLBLOB",], function (this: RichTextParser,): unknown {
      return this.val[0];
    },);
  },);

  // ------------------------------------------------------------------
  // Espaços e linhas em branco
  // ------------------------------------------------------------------
  rtRule(p, "space", () => {
    p.optional();
    p.repeatable();
    p.pattern(["$SPACE",], () => true,);
  },);

  rtRule(p, "blankLines", () => {
    p.optional();
    p.repeatable();
    p.pattern(["$LINEBREAK",], null,);
    p.pattern(["$SPACE",], null,);
  },);

  // ------------------------------------------------------------------
  // Funções embutidas
  // ------------------------------------------------------------------
  rtRule(p, "blockFunction", () => {
    p.pattern(
      ["$BLOCKFUNCSTART", "$ID", "!functionArguments", "$BLOCKFUNCEND",],
      function (this: RichTextParser,): unknown {
        return buildFunctionElement(this, "blockfunc", true,);
      },
    );
  },);

  rtRule(p, "inlineFunction", () => {
    p.pattern(
      [
        "$INLINEFUNCSTART",
        "$ID",
        "!functionArguments",
        "$INLINEFUNCEND",
        "!space",
      ],
      function (this: RichTextParser,): unknown {
        const el = buildFunctionElement(this, "inlinefunc", false,);
        el.appendSpace = this.val[4] !== null;
        return el;
      },
    );
  },);

  rtRule(p, "functionArguments", () => {
    p.optional();
    p.repeatable();
    p.pattern(["$ID", "_=", "$STRING",], function (
      this: RichTextParser,
    ): unknown {
      return [this.val[0], this.val[2],];
    },);
  },);
}

/** Monta um `img` a partir de uma referência `[[File:...]]` (12.6 ref branch). */
function makeImage(
  p: RichTextParser,
  locator: string,
  v1: string,
  tokens: string[] | null,
): RichTextElement {
  const el = new RichTextElement(p.richTextI, "img",);
  const dot = locator.lastIndexOf(".",);
  if (dot < 0) {
    p.error("rt_file_no_ext", `File name without extension: ${locator}`,);
  }
  const extension = locator.slice(dot + 1,).toLowerCase();
  if (!IMG_EXTS.includes(extension,)) {
    p.error("rt_file_bad_ext", `Unsupported file type: ${extension}`,);
  }
  el.data = new RichTextImage(locator,);
  if (tokens) {
    for (const token of tokens) {
      if (token.slice(0, 4,) === "alt=") {
        (el.data as RichTextImage).altText = token.slice(4,);
      } else if (V_ALIGN.includes(token,)) {
        (el.data as RichTextImage).verticalAlign = token;
      } else {
        p.error(
          "rt_bad_file_option",
          `Unknown option '${token}' for file reference ${v1}.`,
        );
      }
    }
  }
  return el;
}

/**
 * Constrói o elemento `blockfunc`/`inlinefunc` a partir de
 * `$FUNCSTART $ID !functionArguments $FUNCEND`, validando o handler.
 */
function buildFunctionElement(
  p: RichTextParser,
  category: "blockfunc" | "inlinefunc",
  isBlock: boolean,
): RichTextElement {
  const args: Record<string, string> = {};
  const raw = p.val[2] as Array<[string, string,]> | null;
  if (raw) {
    for (const arg of raw) args[arg[0]] = arg[1];
  }
  const el = new RichTextElement(p.richTextI, category,);
  const name = p.val[1] as string;
  const owner = p.richTextI.richText as RichTextOwner;
  if (!owner.functionHandler(name, isBlock,)) {
    p.error(
      category === "blockfunc" ? "bad_block_function" : "bad_inline_function",
      `Unsupported ${
        category === "blockfunc" ? "block" : "inline"
      } function ${name}`,
    );
  }
  el.data = [name, args,];
  return el;
}

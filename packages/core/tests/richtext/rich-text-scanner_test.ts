/**
 * Testes do RichTextScanner (Fase 12.5).
 *
 * Comparados contra o comportamento real do `RichText/Scanner.rb`
 * (TaskJuggler 3.8.4). Cada `it` cobre um modo / token específico.
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { Log, } from "../../src/log.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { RichTextScanner, } from "../../src/richtext/rich-text-scanner.ts";
import type { ScannerToken, } from "../../src/lexer/scanner.ts";

/** Abre _text_ como buffer e acumula todos os tokens até EOF. */
function scanAll(text: string,): ScannerToken[] {
  // Não injeta `\n` final: cada teste escolhe sua própria terminação para
  // evitar LINEBREAKs duplicados (`\s*\n` guloso engole `\n\n` de uma vez).
  const scanner = new RichTextScanner(text, Log,);
  scanner.open(true,);
  const tokens: ScannerToken[] = [];
  for (;;) {
    const t = scanner.nextToken();
    if (t[0] === "eof" || t[0] === "endOfText") break;
    tokens.push([t[0], t[1], null,],);
  }
  return tokens;
}

function types(text: string,): string[] {
  return scanAll(text,).map((t,) => t[0]);
}
function values(text: string,): unknown[] {
  return scanAll(text,).map((t,) => t[1]);
}
function pairs(text: string,): Array<[string, unknown,]> {
  return scanAll(text,).map((t,) => [t[0], t[1],]);
}

describe("RichTextScanner (Fase 12.5)", () => {
  it("título 1: == Título == → TITLE1/WORD/TITLE1END", () => {
    const toks = pairs("== Título ==\n",);
    assertEquals(toks[0], ["TITLE1", "==",],);
    assert(toks.some((t,) => t[0] === "TITLE1END"), "TITLE1END presente",);
    assert(toks.some((t,) => t[1] === "Título"), "WORD Título",);
  });

  it("título 2/3/4 → TITLE2/TITLE3/TITLE4", () => {
    assertEquals(types("=== Título ===\n",)[0], "TITLE2",);
    assertEquals(types("==== Título ====\n",)[0], "TITLE3",);
    assertEquals(types("===== Título =====\n",)[0], "TITLE4",);
  });

  it("bullet de 1-4 níveis → BULLETn", () => {
    assertEquals(types("* a\n",)[0], "BULLET1",);
    assertEquals(types("** a\n",)[0], "BULLET2",);
    assertEquals(types("*** a\n",)[0], "BULLET3",);
    assertEquals(types("**** a\n",)[0], "BULLET4",);
  });

  it("numbered de 1-4 níveis → NUMBERn", () => {
    assertEquals(types("# a\n",)[0], "NUMBER1",);
    assertEquals(types("## a\n",)[0], "NUMBER2",);
    assertEquals(types("#### a\n",)[0], "NUMBER4",);
  });

  it("itálico/negrito/mono/bolditalic (QUOTES→ITALIC/BOLD/CODE/BOLDITALIC)", () => {
    const t = (s: string,) => types(s,);
    assert(t("x ''it'' y\n",).includes("ITALIC",), "ITALIC",);
    assert(t("x '''nb''' y\n",).includes("BOLD",), "BOLD",);
    assert(t("x ''''c'''' y\n",).includes("CODE",), "CODE",);
    assert(t("x '''''bi''''' y\n",).includes("BOLDITALIC",), "BOLDITALIC",);
  });

  it("LINEBREAK separa parágrafos; SPACE dentro da linha", () => {
    // Ruby Scanner.rb: LINEBREAK só aparece em :bol/:bop. Uma quebra
    // seguida de texto vira SPACE com `\n` no valor (inline) + LINEBREAK
    // quando o scanner chega em :bol.
    const toks = pairs("a b\nc",);
    assertEquals(toks.map((t,) => t[0]), [
      "WORD",
      "SPACE",
      "WORD",
      "SPACE",
      "WORD",
    ],);
    // Ruby `space()` zera o match quando contém `\n` (linha 113 de Scanner.rb:
    // `match = ''`), apenas mudando para :bol.
    assertEquals(toks[3]![1], "",);
  });

  it("PRE: linha iniciada por espaço vira PRE sem o 1º espaço", () => {
    // Ruby `match[1..-1]` remove só o espaço líder (LF fica no match).
    const toks = pairs(" code line\nword",);
    const preTok = toks.find((t,) => t[0] === "PRE");
    assert(preTok, "tem PRE",);
    assertEquals(preTok![1], "code line\n",);
  });

  it("HLINE: ---- vira HLINE e muda para :inline", () => {
    const toks = pairs("----\n",);
    assertEquals(toks[0], ["HLINE", "----",],);
  });

  it("href: [http://exemplo.com Texto] → HREF/.../HREFEND", () => {
    const toks = pairs("[http://exemplo.com Texto]\n",);
    assertEquals(toks[0], ["HREF", "[",],);
    assert(toks.some((t,) => t[0] === "HREFEND"), "HREFEND presente",);
    assert(toks.some((t,) => t[1] === "http://exemplo.com"), "URL WORD",);
    assert(toks.some((t,) => t[1] === "Texto"), "Texto WORD",);
  });

  it("ref: [[Section]] → REF/WORD/REFEND", () => {
    const toks = pairs("[[Section]]\n",);
    assertEquals(toks[0], ["REF", "[[",],);
    assertEquals(toks[1], ["WORD", "Section",],);
    assertEquals(toks[2], ["REFEND", "]]",],);
  });

  it("fcol: <fcol:red>x</fcol> → FCOLSTART/WORD/FCOLEND", () => {
    const toks = pairs("<fcol:red>x</fcol>\n",);
    assertEquals(toks[0], ["FCOLSTART", "red",],);
    assertEquals(toks[2], ["FCOLEND", "</fcol>",],);
  });

  it("fcol com hex aceito; cor inválida registra erro (com trapSetup)", () => {
    const toks = pairs("<fcol:#ff00aa>x</fcol>\n",);
    assertEquals(toks[0], ["FCOLSTART", "#ff00aa",],);
    // Ruby: `error('bad_color_name', ...)` no scanner base. MessageHandler#error
    // só lança quando trapSetup=true (paridade Ruby, ver §MessageHandler).
    const mh = MessageHandlerInstance.instance;
    mh.reset();
    mh.trapSetup = true;
    let threw = false;
    try {
      scanAll("<fcol:notacolor>x</fcol>\n",);
    } catch {
      threw = true;
    } finally {
      mh.trapSetup = false;
    }
    assert(threw, "cor inválida deve lançar com trapSetup ativo",);
  });

  it("nowiki: <nowiki>...literal...</nowiki> não tokeniza markup", () => {
    const toks = pairs("<nowiki>'''raw''' [[x]]</nowiki>\n",);
    // Ruby: nil/nowikiStart é ignorado; os tokens internos viram WORD/SPACE.
    const joined = toks.map((t,) => String(t[1],)).join("",);
    assert(joined.includes("'''raw'''",), "conteúdo literal preservado",);
    assert(!toks.some((t,) => t[0] === "BOLD"), "sem BOLD dentro de nowiki",);
    assert(!toks.some((t,) => t[0] === "REF"), "sem REF dentro de nowiki",);
  });

  it("html: <html>...multi-line...</html> → HTMLBLOB(s)", () => {
    const toks = pairs("<html><b>x</b>\n<c>y</c></html>",);
    const blobs = toks.filter((t,) => t[0] === "HTMLBLOB");
    assert(blobs.length >= 2, "HTMLBLOB linha-a-linha",);
    assertEquals(blobs[0]![1], "<b>x</b>\n",);
    // Ruby `match[0..-8]` remove `</html>` (7 chars do fim).
    assertEquals(blobs[1]![1], "<c>y</c>",);
  });

  it("block function: <[name arg=val]> → BLOCKFUNCSTART/ID/LITERAL/ID/STRING/BLOCKFUNCEND", () => {
    const toks = pairs("<[query attribute=effort]>",);
    assertEquals(toks[0], ["BLOCKFUNCSTART", "<[",],);
    assertEquals(toks[1], ["ID", "query",],);
    assertEquals(toks[2], ["ID", "attribute",],);
    assertEquals(toks[3], ["LITERAL", "=",],);
    assertEquals(toks[4], ["ID", "effort",],);
    assert(toks.some((t,) => t[0] === "BLOCKFUNCEND"), "BLOCKFUNCEND",);
  });

  it("inline function: <-query attr=effort-> → INLINEFUNCSTART/.../INLINEFUNCEND", () => {
    const toks = pairs("x <-query attr=effort-> y",);
    // Ruby: em :bop "x" é WORD (muda para :inline), SPACE separa, depois
    // o `<-` em :inline dispara INLINEFUNCSTART.
    assertEquals(toks[0]![0], "WORD",);
    assertEquals(toks[2]![0], "INLINEFUNCSTART",);
    assert(toks.some((t,) => t[0] === "INLINEFUNCEND"), "INLINEFUNCEND",);
    assert(toks.some((t,) => t[0] === "ID" && t[1] === "query"), "ID query",);
  });

  it("QUERY dentro de href/ref: [http://x <-q->] preserva QUERY", () => {
    const toks = pairs("[http://x <-q-> Text]\n",);
    assertEquals(toks[0], ["HREF", "[",],);
    const qt = toks.find((t,) => t[0] === "QUERY");
    assert(qt, "tem QUERY",);
    assertEquals(qt![1], "q",);
  });

  it('dqString desescapa " e preserva espaços internos', () => {
    // Fonte (raw): <[f name="a b" g="c \\" d"]>
    // Ruby Scanner.rb#dqString: `match[1..-2].gsub(/\\"/, '"')`.
    const toks = pairs('<[f name="a b" g="c \\" d"]>\n',);
    const strs = toks.filter((t,) => t[0] === "STRING");
    assertEquals(strs.map((t,) => t[1]), ["a b", 'c " d',],);
  });

  it("palavra simples vira WORD e alterna modos bop/bol → inline", () => {
    // Ruby: em :inline uma `\n` isolada é SPACE, não LINEBREAK.
    const toks = pairs("hello world",);
    assertEquals(
      toks.map((t,) => t[0]),
      ["WORD", "SPACE", "WORD",],
    );
    assertEquals(values("hello world",), ["hello", " ", "world",],);
  });

  it("reutilização: duas instâncias são independentes", () => {
    const s1 = new RichTextScanner("a\n", Log,);
    const s2 = new RichTextScanner("== T ==\n", Log,);
    s1.open(true,);
    s2.open(true,);
    assertEquals(s1.nextToken()[0], "WORD",);
    assertEquals(s2.nextToken()[0], "TITLE1",);
  });
});

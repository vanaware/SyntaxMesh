/**
 * 16.12 — `UTF8String` (no-op).
 *
 * O Ruby 1.8 reimplementava iteração/largura/inversão; em JS a iteração por
 * code point já é nativa, então cada função é um delegate do runtime
 * (o ramo `RUBY_VERSION >= '1.9.0'` do arquivo original).
 *
 * @see docs/taskjuggler/lib/taskjuggler/UTF8String.rb
 * @see docs/syntaxmesh/fases/fase-16-apoio-tarefas.md (16.12)
 */

import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import {
  eachUtf8Char,
  forceUTF8Encoding,
  lengthUtf8,
  ljust,
  reverseUtf8,
} from "../../src/utils/utf8.ts";

describe("eachUtf8Char (16.12.2)", () => {
  it("itera por code point, não por byte", () => {
    assertEquals([...eachUtf8Char("a☕b",),], ["a", "☕", "b",],);
  });

  it("não produz nada para string vazia", () => {
    assertEquals([...eachUtf8Char("",),], [],);
  });
});

describe("lengthUtf8 (16.12.3)", () => {
  it("conta caracteres ASCII", () => {
    assertEquals(lengthUtf8("abc",), 3,);
  });

  it("conta string vazia como 0", () => {
    assertEquals(lengthUtf8("",), 0,);
  });

  it("conta um code point não-BMP como 1", () => {
    assertEquals(lengthUtf8("☕",), 1,);
  });

  it("conta emoji fora do BMP como 1 (e não 2 unidades UTF-16)", () => {
    assertEquals("😀".length, 2,);
    assertEquals(lengthUtf8("😀",), 1,);
  });
});

describe("reverseUtf8 (16.12.4)", () => {
  it("inverte ASCII", () => {
    assertEquals(reverseUtf8("abc",), "cba",);
  });

  it("inverte mantendo caracteres multibyte intactos", () => {
    assertEquals(reverseUtf8("a☕b",), "b☕a",);
  });

  it("não quebra um emoji fora do BMP", () => {
    assertEquals(reverseUtf8("a😀b",), "b😀a",);
  });
});

describe("ljust (16.12.5)", () => {
  it("preenche com espaço por padrão", () => {
    assertEquals(ljust("ab", 5,), "ab   ",);
  });

  it("preenche com o caractere informado", () => {
    assertEquals(ljust("ab", 5, "0",), "ab000",);
  });

  it("não trunca quando a string já é maior", () => {
    assertEquals(ljust("abcdef", 3,), "abcdef",);
  });
});

describe("forceUTF8Encoding (16.12.6)", () => {
  it("converte CRLF em LF", () => {
    assertEquals(forceUTF8Encoding("a\r\nb\r\n",), "a\nb\n",);
  });

  it("preserva LF já normalizado", () => {
    assertEquals(forceUTF8Encoding("a\nb",), "a\nb",);
  });

  it("normaliza para NFC (combining → precomposto)", () => {
    assertEquals(forceUTF8Encoding("e\u0301",), "é",);
  });
});

describe("UTF-8 com emoji (16.12.7)", () => {
  it("combina length/inverse/iterate sem corromper", () => {
    const s = "x😀☕y";
    assertEquals(lengthUtf8(s,), 4,);
    assertEquals(reverseUtf8(s,), "y☕😀x",);
    assertEquals([...eachUtf8Char(s,),], ["x", "😀", "☕", "y",],);
  });
});

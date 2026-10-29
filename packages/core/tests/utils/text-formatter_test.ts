/**
 * Testes do TextFormatter (port fiel de TextFormatter.rb — tarefa 16.6
 * antecipada para a Fase 12, dependência de RichTextElement#to_s).
 */
import { assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { TextFormatter, } from "../../src/utils/text-formatter.ts";

describe("TextFormatter — construtor", () => {
  it("usa defaults do Ruby (80 / 0 / indentation)", () => {
    const tf = new TextFormatter();
    assertEquals(tf.width, 80,);
    assertEquals(tf.indentation, 0,);
    assertEquals(tf.firstLineIndent, 0,);
  });

  it("firstLineIndent default = indentation quando omitido", () => {
    const tf = new TextFormatter(40, 4,);
    assertEquals(tf.width, 40,);
    assertEquals(tf.indentation, 4,);
    assertEquals(tf.firstLineIndent, 4,);
  });

  it("firstLineIndent explícito é preservado", () => {
    const tf = new TextFormatter(40, 4, 2,);
    assertEquals(tf.firstLineIndent, 2,);
  });
});

describe("TextFormatter#indent", () => {
  it("indenta a primeira linha com firstLineIndent e as demais com indentation", () => {
    const tf = new TextFormatter(80, 2, 4,);
    assertEquals(tf.indent("ab\ncd",), "    ab\n  cd\n",);
  });

  it("sempre termina com newline", () => {
    const tf = new TextFormatter();
    assertEquals(tf.indent("abc",), "abc\n",);
  });

  it("string vazia produz só newline", () => {
    const tf = new TextFormatter();
    assertEquals(tf.indent("",), "\n",);
  });

  it("clipa caracteres além da width (indent incluído)", () => {
    const tf = new TextFormatter(5, 2,);
    // 2 de indent + 3 caracteres.
    assertEquals(tf.indent("abcdefg",), "  abc\n",);
  });

  it("quebras consecutivas não geram trailing whitespace", () => {
    const tf = new TextFormatter(80, 3,);
    assertEquals(tf.indent("a\n\nb",), "   a\n\n   b\n",);
  });

  it("conta code points UTF-8 (emoji = 1 caractere)", () => {
    const tf = new TextFormatter(80, 0,);
    assertEquals(tf.indent("a😀b",), "a😀b\n",);
  });
});

describe("TextFormatter#format", () => {
  it("termina com newline", () => {
    const tf = new TextFormatter();
    assertEquals(tf.format("abc",), "abc\n",);
  });

  it("colapsa espaços múltiplos entre palavras", () => {
    const tf = new TextFormatter(80,);
    assertEquals(tf.format("ab   cd  ef",), "ab cd ef\n",);
  });

  it("ignora espaços e quebras no início do parágrafo", () => {
    const tf = new TextFormatter(80,);
    assertEquals(tf.format("  \n ab",), "ab\n",);
  });

  it("quebra palavras além da width, indentando continuação", () => {
    const tf = new TextFormatter(10, 2,);
    // Expectativa conferida contra o Ruby real (TextFormatter.rb).
    assertEquals(tf.format("aaa bbb ccc ddd",), "  aaa bbb\n  ccc ddd\n",);
  });

  it("\\r força nova linha sem novo parágrafo", () => {
    const tf = new TextFormatter(80, 0,);
    assertEquals(tf.format("aa bb\rcc dd",), "aa bb\ncc dd\n",);
  });

  it("linha em branco separa parágrafos", () => {
    const tf = new TextFormatter(80, 0,);
    assertEquals(tf.format("aa\n\nbb",), "aa\n\nbb\n",);
  });
});

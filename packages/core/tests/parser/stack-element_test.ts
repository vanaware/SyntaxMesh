import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import {
  StackElement,
  TextParserResultArray,
} from "../../src/parser/stack-element.ts";
import { SourceFileInfo, } from "../../src/source-file-info.ts";

const sfi = new SourceFileInfo("test.tjp", 1, 1,);
const sfi2 = new SourceFileInfo("test.tjp", 2, 1,);

describe("TextParserResultArray", () => {
  it("push de valor simples adiciona um elemento", () => {
    const arr = new TextParserResultArray<string>();
    arr.push("a",);
    assertEquals([...arr,], ["a",],);
  });

  it("push de array concatena em vez de aninhar", () => {
    const arr = new TextParserResultArray<string>();
    arr.push(["a", "b",],);
    assertEquals([...arr,], ["a", "b",],);
  });

  it("push misto (valores e arrays) achata tudo", () => {
    const arr = new TextParserResultArray<string>();
    arr.push("x", ["y", "z",], "w",);
    assertEquals([...arr,], ["x", "y", "z", "w",],);
  });

  it("retorna o comprimento total após concatenação", () => {
    const arr = new TextParserResultArray<number>();
    const len = arr.push([1, 2, 3,],);
    assertEquals(len, 3,);
  });
});

describe("StackElement", () => {
  it("constructor inicia vazio com position 0", () => {
    const fn = () => "x";
    const el = new StackElement(fn, null,);
    assertEquals(el.function, fn,);
    assertEquals(el.state, null,);
    assertEquals(el.val.length, 0,);
    assertEquals(el.sourceFileInfo.length, 0,);
    assertEquals(el.firstSourceFileInfo, null,);
  });

  it("constructor aceita function null", () => {
    const el = new StackElement(null, null,);
    assertEquals(el.function, null,);
  });

  it("store guarda valor e sourceFileInfo na posição atual", () => {
    const el = new StackElement(null, null,);
    el.store("um", sfi,);
    el.store("dois", sfi2,);
    assertEquals(el.val, ["um", "dois",],);
    assertEquals(el.sourceFileInfo, [sfi, sfi2,],);
  });

  it("store avança a posição a cada chamada", () => {
    const el = new StackElement(null, null,);
    el.store(1,);
    el.store(2,);
    el.store(3,);
    assertEquals(el.length(), 3,);
    assertEquals([...el.each(),], [1, 2, 3,],);
  });

  it("insert sem multiValue substitui o valor no índice", () => {
    const el = new StackElement(null, null,);
    el.insert(0, "a", sfi, false,);
    el.insert(0, "b", sfi2, false,);
    assertEquals(el.val[0], "b",);
    assertEquals(el.sourceFileInfo[0], sfi2,);
  });

  it("insert retorna o valor inserido (contrato Ruby)", () => {
    const el = new StackElement(null, null,);
    assertEquals(el.insert(0, "ret", sfi, false,), "ret",);
  });

  it("insert com multiValue cria TextParserResultArray e concatena", () => {
    const el = new StackElement(null, null,);
    el.insert(1, "x", sfi, true,);
    el.insert(1, "y", sfi, true,);
    assertEquals(el.val[1] instanceof TextParserResultArray, true,);
    assertEquals([...(el.val[1] as TextParserResultArray<string>),], [
      "x",
      "y",
    ],);
  });

  it("insert com multiValue e array achata o array", () => {
    const el = new StackElement(null, null,);
    el.insert(0, ["a", "b",], sfi, true,);
    assertEquals([...(el.val[0] as TextParserResultArray<string>),], [
      "a",
      "b",
    ],);
  });

  it("firstSourceFileInfo é o primeiro sfi não nulo inserido", () => {
    const el = new StackElement(null, null,);
    el.insert(2, "z", sfi, false,);
    el.insert(0, "a", sfi2, false,);
    assertEquals(el.firstSourceFileInfo, sfi,);
  });

  it("each itera os valores armazenados", () => {
    const el = new StackElement(null, null,);
    el.store(10,);
    el.store(20,);
    const collected: unknown[] = [];
    for (const v of el.each()) collected.push(v,);
    assertEquals(collected, [10, 20,],);
  });

  it("length retorna número de valores", () => {
    const el = new StackElement(null, null,);
    assertEquals(el.length(), 0,);
    el.store("a",);
    assertEquals(el.length(), 1,);
  });
});

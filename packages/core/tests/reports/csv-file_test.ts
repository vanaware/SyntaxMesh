/**
 * Testes de CSVFile (Fase 14.1).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.1)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { CSVFile, } from "../../src/reports/csv-file.ts";

describe("CSVFile (14.1)", () => {
  describe("constructor", () => {
    it("aceita separador e quote padrão", () => {
      const csv = new CSVFile([[1, 2,], [3, 4,],],);
      assertEquals(csv.data, [[1, 2,], [3, 4,],],);
    });
    it("rejeita separador '.'", () => {
      assertThrows(() => new CSVFile([], ".",));
    });
    it("rejeita separador '\\''", () => {
      assertThrows(() => new CSVFile([], '"',));
    });
    it("rejeita quote '.'", () => {
      assertThrows(() => new CSVFile([], ";", ".",));
    });
  });

  describe("to_s (serialização)", () => {
    it("números simples sem aspas", () => {
      const csv = new CSVFile([[1, 2,], [3, 4,],], ";",);
      assertEquals(csv.to_s(), "1;2\n3;4\n",);
    });
    it("strings são sempre citadas", () => {
      const csv = new CSVFile([["a", "b",],], ";",);
      assertEquals(csv.to_s(), '"a";"b"\n',);
    });
    it("campo com separador fica entre aspas", () => {
      const csv = new CSVFile([["a;b",],], ";",);
      assertEquals(csv.to_s(), '"a;b"\n',);
    });
    it("campo com aspas é escapado (dobrado)", () => {
      const csv = new CSVFile([['a"b',],], ";",);
      assertEquals(csv.to_s(), '"a""b"\n',);
    });
    it("campo com newline fica entre aspas", () => {
      const csv = new CSVFile([["a\nb",],], ";",);
      assertEquals(csv.to_s(), '"a\nb"\n',);
    });
    it("nil vira campo vazio", () => {
      const csv = new CSVFile([[null, 1,],], ";",);
      assertEquals(csv.to_s(), ";1\n",);
    });
  });

  describe("parse", () => {
    it("string mista → tipos nativos", () => {
      const parsed = new CSVFile().parse('"a";"b"\n1;2',);
      assertEquals(parsed, [["a", "b",], [1, 2,],],);
    });
    it("quoted com separador interno", () => {
      const parsed = new CSVFile().parse('"a;b";2',);
      assertEquals(parsed, [["a;b", 2,],],);
    });
    it("escaped quotes", () => {
      const parsed = new CSVFile().parse('"a""b"',);
      assertEquals(parsed, [['a"b',],],);
    });
    it("campo vazio não-citado vira null", () => {
      const parsed = new CSVFile().parse(";1",);
      assertEquals(parsed, [[null, 1,],],);
    });
    it("detectSeparator escolhe o mais frequente", () => {
      // sem separador definido (""), detecta ":" (o mais frequente de \t ; :).
      const parsed = new CSVFile(null, "",).parse("a:b\n1:2",);
      assertEquals(parsed, [["a", "b",], [1, 2,],],);
    });
    it("lança em quoted não terminado", () => {
      assertThrows(() => new CSVFile().parse('"abc',));
    });
  });

  describe("strToNative", () => {
    it("inteiro", () => assertEquals(CSVFile.strToNative("42",), 42,));
    it("inteiro com sinal", () =>
      assertEquals(CSVFile.strToNative("-7",), -7,));
    it("float", () => assertEquals(CSVFile.strToNative("3.14",), 3.14,));
    it("exponencial", () => assertEquals(CSVFile.strToNative("1e3",), 1000,));
    it("null", () => assertEquals(CSVFile.strToNative(null,), null,));
    it("string comum", () => assertEquals(CSVFile.strToNative("abc",), "abc",));
  });

  describe("read/write browser (ADR 027)", () => {
    it("write('.') é no-op", () => {
      const csv = new CSVFile([[1,],], ";",);
      csv.write(".",); // não lança
      assert(true,);
    });
    it("write(nome) é no-op (warning)", () => {
      const csv = new CSVFile([[1,],], ";",);
      csv.write("out.csv",); // apenas warning
      assert(true,);
    });
    it("read lança NotYetImplementedError", () => {
      assertThrows(() => new CSVFile().read("in.csv",));
    });
  });
});

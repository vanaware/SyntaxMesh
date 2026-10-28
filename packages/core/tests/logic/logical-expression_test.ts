/**
 * Testes BDD de `LogicalExpression` (Fase 11.4).
 *
 * @see docs/taskjuggler/lib/taskjuggler/LogicalExpression.rb
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import { LogicalOperation, } from "../../src/logic/logical-operation.ts";
import { Query, } from "../../src/query/query.ts";
import { SourceFileInfo, } from "../../src/source-file-info.ts";
import { TjError, } from "../../src/model/errors.ts";

const q = (): Query => new Query();

describe("LogicalExpression", () => {
  describe("estrutura (11.4.1-3)", () => {
    it("guarda operation e sourceFileInfo", () => {
      const op = new LogicalOperation(true,);
      const sfi = new SourceFileInfo("a.tjp", 3, 1,);
      const expr = new LogicalExpression(op, sfi,);
      assertEquals(expr.operation, op,);
      assertEquals(expr.sourceFileInfo, sfi,);
      assertEquals(expr.query, null,);
    });
    it("sourceFileInfo opcional é null por padrão", () => {
      const expr = new LogicalExpression(new LogicalOperation(true,),);
      assertEquals(expr.sourceFileInfo, null,);
    });
  });

  describe("eval normaliza resultado (11.4.4-7, 11.4.10-11)", () => {
    it("true → true", () => {
      assertEquals(
        new LogicalExpression(new LogicalOperation(true,),).eval(q(),),
        true,
      );
    });
    it("false → false", () => {
      assertEquals(
        new LogicalExpression(new LogicalOperation(false,),).eval(q(),),
        false,
      );
    });
    it("string vazia → false", () => {
      assertEquals(
        new LogicalExpression(new LogicalOperation("",),).eval(q(),),
        false,
      );
    });
    it("string não vazia → true", () => {
      assertEquals(
        new LogicalExpression(new LogicalOperation("hello",),).eval(q(),),
        true,
      );
    });
    it("number não-zero → true", () => {
      assertEquals(
        new LogicalExpression(new LogicalOperation(5,),).eval(q(),),
        true,
      );
    });
    it("number zero → false", () => {
      assertEquals(
        new LogicalExpression(new LogicalOperation(0,),).eval(q(),),
        false,
      );
    });
    it("avalia operação binária", () => {
      assertEquals(
        new LogicalExpression(
          new LogicalOperation(5, ">", 3,),
        ).eval(q(),),
        true,
      );
    });
    it("fixa this.query durante eval", () => {
      const expr = new LogicalExpression(new LogicalOperation(true,),);
      const query = q();
      expr.eval(query,);
      assertEquals(expr.query, query,);
    });
  });

  describe("to_s (11.4.8)", () => {
    it("delega para operation sem sourceFileInfo", () => {
      const expr = new LogicalExpression(new LogicalOperation(5, ">", 3,),);
      assertEquals(expr.to_s(), "(5 > 3)",);
    });
    it("prefixa sourceFileInfo.to_s()", () => {
      const sfi = new SourceFileInfo("a.tjp", 7, 1,);
      const expr = new LogicalExpression(
        new LogicalOperation(5, ">", 3,),
        sfi,
      );
      assertEquals(expr.to_s(), "a.tjp:7: (5 > 3)",);
    });
  });

  describe("error (11.4.9)", () => {
    it("lança TjError com to_s + mensagem", () => {
      const expr = new LogicalExpression(new LogicalOperation(1, "?", 2,),);
      assertThrows(
        () => expr.error("boom",),
        TjError,
        "boom",
      );
    });
  });
});

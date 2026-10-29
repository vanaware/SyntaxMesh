/**
 * Testes de `RichTextFunctionExample` (Fase 12.12).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/FunctionExample.rb
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { RichTextFunctionExample, } from "../../src/richtext/handlers/function-example.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";

describe("RichTextFunctionExample (12.12)", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("function = example, blockFunction = true", () => {
    const h = new RichTextFunctionExample();
    assertEquals(h.function, "example",);
    assertEquals(h.blockFunction, true,);
  });

  it("to_s e to_tagged não suportados", () => {
    const h = new RichTextFunctionExample();
    assertEquals(h.to_s({},), "",);
    assertEquals(h.to_tagged({},), null,);
  });

  it("lança quando o argumento 'file' está ausente", () => {
    const h = new RichTextFunctionExample((file,) => `${file}:corpo`);
    assertThrows(() => h.to_html({ tag: "t", },), Error,);
  });

  it("to_html monta div.codeframe > pre.code com o texto do loader", () => {
    const loader = (file: string, tag: string | null,) =>
      `# ${file}/${tag ?? "ALL"}\ntask foo is 1d`;
    const h = new RichTextFunctionExample(loader,);
    const el = h.to_html({ file: "Allocation", tag: "2", },)!;
    const html = el.toHTML();
    assert(html.includes('<div class="codeframe">',), html,);
    assert(html.includes('<pre class="code">',), html,);
    assert(html.includes("Allocation/2",), html,);
    assert(html.includes("task foo is 1d",), html,);
  });

  it("sem loader registra example_unavailable e devolve moldura vazia", () => {
    const h = new RichTextFunctionExample();
    const el = h.to_html({ file: "Allocation", },)!;
    assert(el.toHTML().includes("codeframe",),);
    const msg = MessageHandlerInstance.instance.messages.find(
      (m,) => m.id === "example_unavailable",
    );
    assert(msg !== undefined,);
  });
});

/**
 * Testes do wrapper Vento (Fase 23, 23.1.4): interpolação, condicionais,
 * laços, variáveis locais, pipes, autoescape desligado e erros localizados.
 *
 * O caminho síncrono do wrapper é comparado byte-a-byte com `env.runString()`
 * do próprio Vento (fonte de verdade da engine).
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import vento from "vento";
import {
  lineColumnOf,
  renderTemplate,
  TemplateEngine,
} from "../../src/lexer/template-engine.ts";

const env = vento({ autoescape: false, },);

describe("template-engine — render síncrono (23.1.4)", () => {
  it("interpola expressões {{ }}", () => {
    const out = renderTemplate("task {{ id }} { effort {{ esforco }} }", {
      id: "t1",
      esforco: "5d",
    },);
    assert(out.ok,);
    assertEquals(out.content, "task t1 { effort 5d }",);
  });

  it("{{ if }} / {{ else if }} / {{ else }}", () => {
    const body = "{{ if a }}A{{ else if b }}B{{ else }}C{{ /if }}";
    const render = (data: Record<string, unknown>,) =>
      renderTemplate(body, data,) as { ok: true; content: string };
    assertEquals(render({ a: true, },).content, "A",);
    assertEquals(render({ b: true, },).content, "B",);
    assertEquals(render({},).content, "C",);
  });

  it("{{ for }} sobre lista, sobre número e com chave", () => {
    const list = renderTemplate(
      "{{ for t of tarefas }}[{{ t }}]{{ /for }}",
      { tarefas: ["a", "b",], },
    ) as { ok: true; content: string };
    assertEquals(list.content, "[a][b]",);

    // Vento itera 1..n sobre um número (não 0..n-1).
    const numeric = renderTemplate(
      "{{ for i of 3 }}{{ i }}{{ /for }}",
    ) as { ok: true; content: string };
    assertEquals(numeric.content, "123",);

    const keyed = renderTemplate(
      "{{ for k, v of obj }}{{ k }}={{ v }};{{ /for }}",
      { obj: { x: 1, y: 2, }, },
    ) as { ok: true; content: string };
    assertEquals(keyed.content, "x=1;y=2;",);
  });

  it("{{ set }} acumula variáveis locais", () => {
    const out = renderTemplate(
      "{{ set total = 0 }}{{ for t of ts }}{{ set total = total + t }}{{ /for }}" +
        "total {{ total }}",
      { ts: [1, 2, 3,], },
    ) as { ok: true; content: string };
    assertEquals(out.content, "total 6",);
  });

  it("pipes: toUpperCase, JSON.stringify e escape explícito", () => {
    const upper = renderTemplate("{{ nome |> toUpperCase }}", {
      nome: "design",
    },) as { ok: true; content: string };
    assertEquals(upper.content, "DESIGN",);

    const json = renderTemplate("{{ lista |> JSON.stringify }}", {
      lista: ["a", "b",],
    },) as { ok: true; content: string };
    assertEquals(json.content, '["a","b"]',);

    const escaped = renderTemplate("{{ nome |> escape }}", {
      nome: "<a&b>",
    },) as { ok: true; content: string };
    assertEquals(escaped.content, "&lt;a&amp;b&gt;",);
  });

  it("sem autoescape: < > & passam intactos", () => {
    const out = renderTemplate("# {{ txt }}", {
      txt: '<b>&"aspas"</b>',
    },) as { ok: true; content: string };
    assertEquals(out.content, '# <b>&"aspas"</b>',);
  });

  it("resultado é byte-idêntico ao env.runString() do Vento", async () => {
    const body = 'task {{ id }} "{{ nome }}" {\n  effort {{ esforco }}\n' +
      "  {{ if extra }}allocate {{ extra }}{{ /if }}\n" +
      "  {{ for r of recursos }}allocate {{ r }}\n  {{ /for }}\n}";
    const data = {
      id: "t1",
      nome: "Design",
      esforco: "5d",
      extra: "res1",
      recursos: ["r1", "r2",],
    };
    const sync = renderTemplate(body, data,) as { ok: true; content: string };
    const async = await env.runString(body, data,);
    assertEquals(sync.content, async.content,);
  });

  it("erro de sintaxe volta como falha localizada, sem throw", () => {
    const out = renderTemplate('task {{ id } "x"', {},);
    assert(!out.ok,);
    assertEquals(out.kind, "syntax",);
    assert(out.message.length > 0,);
    assert(out.line >= 1,);
  });

  it("tag que exige await (include) é recusada como async_tag", () => {
    const out = renderTemplate('{{ include "./x" }}', {},);
    assert(!out.ok,);
    assertEquals(out.kind, "async",);
  });

  it("erro de runtime devolve posição no corpo", () => {
    const out = renderTemplate("ok\n{{ inexistente.metodo() }}", {},);
    assert(!out.ok,);
    assertEquals(out.kind, "runtime",);
    assertEquals(out.line, 2,);
  });

  it("lineColumnOf mapeia offset para linha/coluna 1-based", () => {
    const body = "ab\ncd\nef";
    assertEquals(lineColumnOf(body, 0,), [1, 1,],);
    assertEquals(lineColumnOf(body, 1,), [1, 2,],);
    assertEquals(lineColumnOf(body, 3,), [2, 1,],);
    assertEquals(lineColumnOf(body, 7,), [3, 2,],);
    assertEquals(lineColumnOf(body, 999,), [3, 3,],);
  });

  it("cache de compilação reaproveita o mesmo corpo", () => {
    const engine = new TemplateEngine();
    const first = engine.render("{{ 1 + 1 }}",);
    const second = engine.render("{{ 1 + 1 }}",);
    assertEquals((first as { content: string }).content, "2",);
    assertEquals((second as { content: string }).content, "2",);
    engine.clearCache();
    assertEquals(
      (engine.render("{{ 1 + 1 }}",) as { content: string }).content,
      "2",
    );
  });
});

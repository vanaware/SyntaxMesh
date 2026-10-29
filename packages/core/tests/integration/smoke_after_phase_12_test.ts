/**
 * 12.20.7 — Smoke test pós-Fase 12.
 *
 * Liga o subsistema RichText (Fase 12) ao motor de Queries (Fase 11) e ao
 * parser de arquivos `.tjp` (Fase 10), exercitando o fluxo ponta-a-ponta:
 *
 *  1. `RichText` → `RichTextIntermediate` → `to_s`/`to_tagged`/`to_html`
 *     (round-trip de markup, sem stub).
 *  2. `RTFQuery` (handler `[[query:…]]`) resolve uma `Query` real da Fase 11
 *     contra o modelo e produz saída text + HTML.
 *  3. `ProjectFileParser.newRichText` devolve um `RichTextIntermediate` **real**
 *     (a fábrica substituiu o stub da Fase 10).
 *
 * @see docs/syntaxmesh/fases/fase-12-richtext-tarefas.md (12.20.7, 12.20.10)
 */

import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { RichText, } from "../../src/richtext/rich-text.ts";
import { RichTextIntermediate, } from "../../src/richtext/rich-text-intermediate.ts";
import { RTFQuery, } from "../../src/richtext/handlers/rtf-query.ts";
import { Query, } from "../../src/query/query.ts";
import { ProjectFileParser, } from "../../src/parser/project-file-parser.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";

describe("Smoke test after Phase 12 (RichText end-to-end)", () => {
  it("RichText converte markup em RTI e serializa para os 3 formatos", () => {
    const rt = new RichText("== Título ==\n\nisto é '''negrito'''.\n\n",);
    const rti = rt.generateIntermediateFormat();
    assert(rti !== null, "RTI deve ser produzido",);
    assert(rti!.to_s().includes("Título",), rti!.to_s(),);
    assert(rti!.to_tagged().includes("<b>",), rti!.to_tagged(),);
    const html = rti!.to_html();
    assert(html !== null,);
    assert(html!.toHTML().includes("<b>negrito</b>",), html!.toHTML(),);
  });

  it("RTFQuery integra RichText com a Query da Fase 11", () => {
    const project = createTestProject(1,);
    project.set("name", "Projeto Dourado",);
    const handler = new RTFQuery(project, null,);
    handler.setQuery(new Query({ project, },),);
    // to_s despacha Query.process() (Fase 11) e devolve o valor resolvido.
    const out = handler.to_s({ attribute: "name", },);
    assertEquals(out, "Projeto Dourado",);
    // to_html produz a árvore de elementos do RichText (XMLElementLike).
    const el = handler.to_html({ attribute: "name", },);
    assert(el !== null,);
    assert(el!.toHTML().includes("Projeto Dourado",), el!.toHTML(),);
  });

  it("ProjectFileParser.newRichText cria RichText real (não stub)", () => {
    const parser = new ProjectFileParser();
    const rti = parser.newRichText("texto '''forte''' aqui", null,);
    assert(rti instanceof RichTextIntermediate,);
    assertEquals(rti.to_s(), "texto forte aqui",);
    // sectionNumbers desligado no caminho do parser (parity ProjectFileParser.rb).
    assertEquals(rti.sectionNumbers, false,);
  });
});

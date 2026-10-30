/**
 * 13.13.6 — Smoke test pós-Fase 13.
 *
 * Liga o subsistema Markdown (Fase 13) ao RichText (Fase 12) e às Queries
 * (Fase 11), exercitando o fluxo ponta-a-ponta sem stubs:
 *
 *  1. `MarkdownFactory` → `RichTextIntermediate` → `to_s`/`to_tagged`/`to_markdown`
 *     (unificação de AST: Markdown e RichText compartilham o mesmo RTI).
 *  2. `richTextToMarkdown` migra markup RichText para Markdown.
 *  3. Fase 12 (`RichText`) continua funcionando (regressão).
 *  4. Barrel `mod.ts` exporta a API pública (13.13.5).
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown-tarefas.md (13.13.6)
 */

import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import * as markdown from "../../src/markdown/mod.ts";
import { RichText, } from "../../src/richtext/rich-text.ts";

describe("Smoke test after Phase 13 (Markdown end-to-end)", () => {
  it("MarkdownFactory produz RTI e serializa para os formatos", () => {
    const factory = new markdown.MarkdownFactory(null,);
    const rti = factory.create("# Título\n\nisto é **negrito**.\n",);
    assert(rti.tree !== null, "RTI deve ter árvore",);
    assertEquals(rti.tree!.category, "richtext",);
    assert(rti.to_s().includes("negrito",), rti.to_s(),);
    assert(rti.to_tagged().includes("<b>",), rti.to_tagged(),);
    assert(rti.to_markdown().includes("**negrito**",), rti.to_markdown(),);
  });

  it("richTextToMarkdown migra RichText → Markdown", () => {
    const md = markdown.richTextToMarkdown("== Título ==\n\n'''forte'''",);
    assert(md.includes("# Título",), md,);
    assert(md.includes("**forte**",), md,);
  });

  it("Fase 12 (RichText) permanece funcional — regressão", () => {
    const rt = new RichText("== Título ==\n\n'''negrito'''",);
    const rti = rt.generateIntermediateFormat();
    assert(rti !== null,);
    assert(rti!.to_tagged().includes("<b>",), rti!.to_tagged(),);
  });

  it("mod.ts exporta a API pública (13.13.5)", () => {
    assert(typeof markdown.MarkdownFactory === "function",);
    assert(typeof markdown.parseMdast === "function",);
    assert(typeof markdown.richTextToMarkdown === "function",);
    assert(typeof markdown.sanitizeHtml === "function",);
    assert(typeof markdown.resolveImageRef === "function",);
  });
});

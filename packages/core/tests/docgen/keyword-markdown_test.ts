/**
 * Testes da projeção Markdown do doc-core (22.1b.3.21, 【novo — LSP-only】).
 *
 * O `toMarkdown`/`keywordToMarkdown` entrega o mesmo conteúdo do `toText`
 * para o canal de hover/help do LSP: título `### keyword`, rótulos em negrito,
 * cerca ```tjp para a sintaxe, **sem ANSI** e **sem a legenda** das tags de
 * atributo. Não há contraparte Ruby — a estrutura espelha o `toText`.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco E
 */
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import { before, describe, it, } from "@std/testing/bdd";
import {
  KeywordDocumentation,
  keywordToMarkdown,
  SyntaxReference,
} from "../../src/docgen/mod.ts";
import { Pattern, } from "../../src/parser/pattern.ts";

describe("KeywordDocumentation.toMarkdown (22.1b.3.21)", () => {
  // A construção é cara (tabelas do parser + cross-reference); uma por suite.
  let reference: SyntaxReference;
  before(() => {
    reference = new SyntaxReference();
  },);

  it("keyword: título, purpose e cerca tjp, sem ANSI", () => {
    const md = reference.keywords.get("project",)!.toMarkdown();
    assert(md.startsWith("### project\n",),);
    assertStringIncludes(md, "**Purpose:** ",);
    assertStringIncludes(md, "```tjp\n",);
    assertStringIncludes(md, "\n```",);
    assert(!md.includes("\x1b[",), "ANSI proibido no Markdown",);
    assert(md.endsWith("\n",),);
  });

  it("arguments: um item por argumento, com o rótulo do typeSpec", () => {
    const doc = reference.keywords.get("duration",)!;
    const md = doc.toMarkdown();
    assertStringIncludes(md, "**Arguments:**\n\n",);
    for (const { label, text, } of doc.argumentTexts()) {
      assertStringIncludes(md, `- **${label}:** ${text}`,);
    }
    // `duration` tem 7 argumentos (value + 6 unidades).
    assertEquals(doc.args.length, 7,);
  });

  it("context: lista de contextos ou Global scope", () => {
    const duration = reference.keywords.get("duration",)!.toMarkdown();
    assertStringIncludes(duration, "**Context:** task, supplement.task",);
    const project = reference.keywords.get("project",)!.toMarkdown();
    assertStringIncludes(project, "**Context:** Global scope",);
  });

  it("seeAlso: aviso de deprecated com Please use e seção See also", () => {
    // `disabled` é deprecated e aponta para `active` na gramática portada.
    const md = reference.keywords.get("disabled",)!.toMarkdown();
    assertStringIncludes(md, "**Warning:** ",);
    assertStringIncludes(md, "Please use active instead!",);
    assertStringIncludes(md, "**See also:** active",);
    // Deprecated continua mostrando o conteúdo (só `removed` para no aviso).
    assertStringIncludes(md, "**Purpose:** ",);
  });

  it("removed: só o título e o aviso, sem conteúdo", () => {
    // Nenhum keyword removed na gramática portada — padrão sintético.
    const pattern = new Pattern([],);
    pattern.keyword = "gone";
    pattern.doc = "No longer available.";
    pattern.setSupportLevel("removed",);
    const doc = new KeywordDocumentation(
      reference.keywords.get("task",)!.rule,
      pattern,
      "gone <id>",
      [],
      new Map(),
    );
    doc.seeAlso.push(reference.keywords.get("task",)!,);
    assertEquals(
      doc.toMarkdown(),
      "### gone\n\n**Warning:** This keyword is no longer supported.\n\n" +
        "Please use task instead!\n",
    );
  });

  it("attributes: lista ordenada com tags, sem a legenda de colunas", () => {
    const md = reference.keywords.get("task",)!.toMarkdown();
    const line = md.split("\n",).find((l,) => l.startsWith("**Attributes:**",));
    assert(line !== undefined,);
    assert(!line.endsWith("none",), "task tem atributos opcionais",);
    // A legenda do terminal não entra no Markdown.
    assert(!md.includes("Attribute is scenario specific",),);
    assert(!md.includes("Value can be inherited",),);
    // Ordenação por keyword (mesma cópia ordenada do toText).
    const list = line.slice("**Attributes:** ".length,).split(", ",);
    const names = list.map((item,) => item.replace(/\[.*\]$/, "",));
    assertEquals(names, [...names,].sort(),);
  });

  it("keywordToMarkdown do barril equivale ao método", () => {
    const doc = reference.keywords.get("scenario",)!;
    assertEquals(keywordToMarkdown(doc,), doc.toMarkdown(),);
  });
});

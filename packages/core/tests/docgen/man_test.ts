/**
 * Testes da fachada `man` do `doc-core` (22.1b.7 / 24.9.1–24.9.3).
 *
 * O `generateMan` reproduz o `tj3man` sem imprimir nem gravar: devolve o
 * conteúdo textual (`text`), o recorte colável (`smx`) ou o mapa de arquivos
 * do manual (`html`), mais as mensagens da resolução de keywords. Quem
 * escreve no terminal ou no disco é a CLI.
 *
 * @see docs/taskjuggler/lib/taskjuggler/apps/Tj3Man.rb
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco G
 */
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import { beforeEach, describe, it, } from "@std/testing/bdd";
import {
  generateMan,
  MANUAL_STYLESHEET_NAME,
  resetSyntaxReferenceCache,
} from "../../src/docgen/mod.ts";

/** Nomes de arquivo devolvidos no formato `html`. */
function fileNames(output: ReturnType<typeof generateMan>,): string[] {
  return output.files.map((file,) => file.name);
}

describe("generateMan — formato text (24.9.2)", () => {
  // `ignoreOld` escolhe a referência memoizada; limpa para não herdar a
  // variante construída por outro teste.
  beforeEach(resetSyntaxReferenceCache,);

  it("imprime a página `to_s` da keyword pedida", () => {
    const output = generateMan({ format: "text", keywords: ["task",], },);
    assertEquals(output.format, "text",);
    assertEquals(output.files, [],);
    assertStringIncludes(output.content, "Keyword: ",);
    assertStringIncludes(output.content, "task",);
    assertStringIncludes(output.content, "Context:",);
    assertEquals(output.messages, [],);
  });

  it("resolve prefixo que casa uma única keyword", () => {
    const output = generateMan({ format: "text", keywords: ["milesto",], },);
    assertStringIncludes(output.content, "Keyword: ",);
    assertStringIncludes(output.content, "milestone",);
    assertEquals(output.messages, [],);
  });

  it("sem keyword lista todas as keywords documentadas", () => {
    const output = generateMan({ format: "text", },);
    const lines = output.content.trimEnd().split("\n",);
    assert(lines.length > 100,);
    assert(lines.includes("task",),);
    assert(lines.includes("resource",),);
    // Ordem alfabética como em `SyntaxReference#all`.
    assertEquals(lines, [...lines,].sort(),);
  });

  it("keyword desconhecida vira erro `man_no_matches` sem conteúdo", () => {
    const output = generateMan({ format: "text", keywords: ["nosuch",], },);
    assertEquals(output.content, "",);
    assertEquals(output.messages.length, 1,);
    assertEquals(output.messages[0]!.level, "error",);
    assertEquals(output.messages[0]!.id, "man_no_matches",);
    assertStringIncludes(output.messages[0]!.text, "nosuch",);
  });

  it("prefixo ambíguo vira aviso `man_multi_match` com candidatos", () => {
    const output = generateMan({ format: "text", keywords: ["acc",], },);
    assertEquals(output.content, "",);
    assertEquals(output.messages.length, 1,);
    assertEquals(output.messages[0]!.level, "warning",);
    assertEquals(output.messages[0]!.id, "man_multi_match",);
    assertStringIncludes(output.messages[0]!.text, "account",);
  });

  it("mistura acerto e erro e ainda entrega o que resolveu", () => {
    const output = generateMan({
      format: "text",
      keywords: ["task", "nosuch",],
    },);
    assertStringIncludes(output.content, "Keyword: ",);
    assertEquals(output.messages.map((m,) => m.id), ["man_no_matches",],);
  });

  it("`--no-color` é o default; `color` liga as sequências ANSI", () => {
    const plain = generateMan({ format: "text", keywords: ["task",], },);
    const colored = generateMan({
      format: "text",
      keywords: ["task",],
      color: true,
    },);
    assert(!plain.content.includes("\x1b[",),);
    assert(colored.content.includes("\x1b[",),);
  });
});

describe("generateMan — formato smx (24.9.1)", () => {
  beforeEach(resetSyntaxReferenceCache,);

  it("devolve o exemplo anotado do corpus com o cabeçalho da keyword", () => {
    const output = generateMan({ format: "smx", keywords: ["task",], },);
    assertEquals(output.format, "smx",);
    assertStringIncludes(output.content, "# task:",);
    // O exemplo vem do corpus (`EXAMPLE_CORPUS`), em comentários `#`.
    assertStringIncludes(output.content, "#",);
    assert(!output.content.includes("Keyword: ",),);
  });

  it("sem exemplo no corpus cai no esqueleto da sintaxe", () => {
    const output = generateMan({ format: "smx", keywords: ["limits",], },);
    const [first,] = output.content.split("\n",);
    assertStringIncludes(first!, "# limits:",);
  });

  it("sem keyword devolve a folha de referência completa", () => {
    const output = generateMan({ format: "smx", },);
    assertStringIncludes(output.content, "# SyntaxMesh keyword cheat sheet",);
    const blocks = output.content.split("\n\n",);
    assert(blocks.length > 100,);
  });

  it("keyword desconhecida não lança e não produz bloco", () => {
    const output = generateMan({ format: "smx", keywords: ["nosuch",], },);
    assertEquals(output.content, "",);
    assertEquals(output.messages[0]!.id, "man_no_matches",);
  });
});

describe("generateMan — formato html (24.9.3)", () => {
  beforeEach(resetSyntaxReferenceCache,);

  it("gera o manual completo com índice, capítulos e CSS", () => {
    const output = generateMan({ format: "html", },);
    assertEquals(output.format, "html",);
    assertEquals(output.content, "",);
    const names = fileNames(output,);
    for (
      const expected of ["index.html", "toc.html", MANUAL_STYLESHEET_NAME,]
    ) {
      assert(names.includes(expected,), `faltou ${expected}`,);
    }
    assert(names.length > 100,);
    assertEquals(new Set(names,).size, names.length,);
  });

  it("com keyword gera só a página pedida e o CSS", () => {
    const output = generateMan({ format: "html", keywords: ["task",], },);
    const names = fileNames(output,);
    assertEquals(names, ["task.html", MANUAL_STYLESHEET_NAME,],);
    const page = output.files[0]!.contents;
    assertStringIncludes(page, "task",);
  });

  it("keyword desconhecida não devolve arquivo nenhum", () => {
    const output = generateMan({ format: "html", keywords: ["nosuch",], },);
    assertEquals(output.files, [],);
    assertEquals(output.messages[0]!.id, "man_no_matches",);
  });
});

describe("generateMan — páginas e mensagens", () => {
  it("toda página do manual tem o CSS referenciado por caminho relativo", () => {
    // GitHub Pages (subpasta) e `file://` exigem caminho relativo.
    const output = generateMan({ format: "html", keywords: ["task",], },);
    assertStringIncludes(output.files[0]!.contents, MANUAL_STYLESHEET_NAME,);
    assert(!output.files[0]!.contents.includes('href="/css/',),);
  });

  it("o formato default é text", () => {
    const output = generateMan({},);
    assertEquals(output.format, "text",);
  });
});

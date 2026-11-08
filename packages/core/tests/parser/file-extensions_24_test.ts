/**
 * Extensões de arquivo do SyntaxMesh (tarefa 24.2.36).
 *
 * Decisão 2026-11-07 (plano §1.6): `.smx` é a extensão nativa para projeto e
 * arquivos de inclusão, com `.tjp`/`.tji` preservados por compatibilidade
 * (regra zero). As três validações herdadas — mestre, `include` e as folhas em
 * `sheet-receiver.ts` — compartilham a mesma fonte (`file-extensions.ts` /
 * `sheet-extensions.ts`).
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.2.36)
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import {
  formatExtensionList,
  INCLUDE_FILE_EXTENSIONS,
  isIncludeFileName,
  isProjectFileName,
  PROJECT_FILE_EXTENSIONS,
} from "../../src/parser/file-extensions.ts";
import { ProjectFileParser, } from "../../src/parser/project-file-parser.ts";
import { Project, } from "../../src/model/project.ts";

/** Cabeçalho mínimo; o corpo varia por caso. */
const HEADER = 'project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {\n';

/** Abre `file` como mestre lendo o conteúdo do loader injetado. */
function openMaster(
  parser: ProjectFileParser,
  file: string,
  content: string,
): void {
  parser.setFileLoader((name,) => (name === file ? content : ""));
  parser.open(file, true,);
}

/** Zera o MessageHandler (mensagens e contador de erros). */
function resetHandler(): void {
  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;
}

/** Mensagens registradas, já como `id: texto`. */
function messages(): string[] {
  return MessageHandlerInstance.instance.messages.map((message,) =>
    `${message.id}: ${(message as unknown as { message?: string }).message}`
  );
}

describe("file-extensions — predicados (24.2.36)", () => {
  it("aceita .tjp e .smx como arquivo de projeto", () => {
    assert(isProjectFileName("proj.tjp",),);
    assert(isProjectFileName("proj.smx",),);
    assertEquals(isProjectFileName("proj.tji",), false,);
    assertEquals(isProjectFileName("proj.txt",), false,);
  });

  it("aceita .tji e .smx como arquivo de inclusão", () => {
    assert(isIncludeFileName("common.tji",),);
    assert(isIncludeFileName("common.smx",),);
    assertEquals(isIncludeFileName("common.tjp",), false,);
  });

  it("formata a lista de extensões com 'ou'", () => {
    assertEquals(
      formatExtensionList(PROJECT_FILE_EXTENSIONS,),
      "'\u002etjp' or '\u002esmx'",
    );
    assertEquals(
      formatExtensionList(INCLUDE_FILE_EXTENSIONS,),
      "'\u002etji' or '\u002esmx'",
    );
  });
});

describe("arquivo mestre (24.2.36)", () => {
  it("parseia um projeto a partir de proj.smx", () => {
    resetHandler();
    const parser = new ProjectFileParser();
    openMaster(parser, "proj.smx", `${HEADER}}\n`,);

    const project = parser.parse("project",) as Project;

    assert(project instanceof Project,);
    assertEquals(project.id, "prj",);
    assertEquals(messages(), [],);
  });

  it("continua aceitando proj.tjp", () => {
    resetHandler();
    const parser = new ProjectFileParser();
    openMaster(parser, "proj.tjp", `${HEADER}}\n`,);

    assert(parser.parse("project",) instanceof Project,);
    assertEquals(messages(), [],);
  });

  it("rejeita extensão fora da lista, citando .tjp e .smx", () => {
    resetHandler();
    const parser = new ProjectFileParser();
    openMaster(parser, "proj.tji", `${HEADER}}\n`,);

    const registered = messages();
    assert(
      registered.some((entry,) => entry.startsWith("illegal_extension:",)),
      JSON.stringify(registered,),
    );
    assert(
      registered.some((entry,) => entry.includes("'.tjp' or '.smx'",)),
      JSON.stringify(registered,),
    );
  });
});

describe("arquivos de inclusão (24.2.36)", () => {
  it("aceita include de common.smx", () => {
    resetHandler();
    const parser = new ProjectFileParser();
    openMaster(
      parser,
      "proj.smx",
      `${HEADER}  include "common.smx"\n}\n`,
    );

    assert(parser.parse("project",) instanceof Project,);
    assertEquals(messages(), [],);
  });

  it("continua aceitando include de common.tji", () => {
    resetHandler();
    const parser = new ProjectFileParser();
    openMaster(
      parser,
      "proj.smx",
      `${HEADER}  include "common.tji"\n}\n`,
    );

    assert(parser.parse("project",) instanceof Project,);
    assertEquals(messages(), [],);
  });

  it("rejeita include com extensão não listada", () => {
    resetHandler();
    const parser = new ProjectFileParser();
    openMaster(
      parser,
      "proj.smx",
      `${HEADER}  include "common.txt"\n}\n`,
    );

    parser.parse("project",);
    const registered = messages();
    assert(
      registered.some((entry,) => entry.startsWith("bad_include_suffix:",)),
      JSON.stringify(registered,),
    );
    assert(
      registered.some((entry,) => entry.includes("'.tji' or '.smx'",)),
      JSON.stringify(registered,),
    );
  });
});

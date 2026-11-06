/**
 * Testes da declaração `template` (Fase 23, subfase 23.2).
 *
 * Cobre: corpo `[ ]` de uma e de várias linhas, lista de parâmetros `( )`
 * (vazia, omitida e preenchida), corpo preservado como texto cru, nome
 * inválido, colisões do namespace unificado macro/template, i18n das três
 * variantes e definição vinda de `include`.
 *
 * A expansão (Fase 1 + render Vento) só entra na subfase 23.3 — aqui o
 * contrato é apenas o registro no scanner, sem interpretar o corpo.
 *
 * @see docs/syntaxmesh/fases/fase-23-template.md §4.1, §4.5, §5
 * @see docs/syntaxmesh/fases/fase-23-template-tarefas.md §23.2
 */
import { assert, assertEquals, } from "@std/assert";
import { afterEach, describe, it, } from "@std/testing/bdd";
import { FileStreamHandle, } from "../../src/lexer/stream-handle.ts";
import { Template, } from "../../src/lexer/macro-table.ts";
import { ProjectFileParser, } from "../../src/parser/mod.ts";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";

/** Templates registrados no scanner do parser. */
function templatesOf(parser: ProjectFileParser,): Template[] {
  return parser.scannerRef!.macroTable.templates();
}

const HEADER = PROJECT_HEADER;

describe("template — corpo e parâmetros (23.2.1/23.2.4/23.2.5)", () => {
  it("registra template de linha única com lista de parâmetros", () => {
    const { parser, messageIds, threw, } = parseProject(
      HEADER +
        "{\n" +
        '  template CARD [ task t1 "x" ] (id, nome, esforco)\n' +
        "}\n",
    );
    assertEquals(threw, null,);
    assertEquals(messageIds, [],);
    const templates = templatesOf(parser,);
    assertEquals(templates.length, 1,);
    const card = templates[0]!;
    assertEquals(card.name, "CARD",);
    assertEquals(card.params, ["id", "nome", "esforco",],);
    assertEquals(card.body.trim(), 'task t1 "x"',);
  });

  it("coleta corpo multi-linha e fecha no '] ( params )' da última linha", () => {
    const { parser, messageIds, } = parseProject(
      HEADER +
        "{\n" +
        "  template CARD [\n" +
        '    task {{ id }} "{{ nome }}" {\n' +
        "      effort {{ esforco }}\n" +
        "    }\n" +
        "  ] (id, nome, esforco)\n" +
        "}\n",
    );
    assertEquals(messageIds, [],);
    const card = templatesOf(parser,)[0]!;
    assertEquals(card.params, ["id", "nome", "esforco",],);
    assert(card.body.includes("{{ id }}",), `corpo: ${card.body}`,);
    assert(card.body.includes("effort {{ esforco }}",), `corpo: ${card.body}`,);
    // Nenhum delimitador sobra no corpo.
    assert(!card.body.includes("[",), `corpo: ${card.body}`,);
    assert(!card.body.includes("]",), `corpo: ${card.body}`,);
  });

  it("aceita lista de parâmetros vazia '()'", () => {
    const { parser, messageIds, } = parseProject(
      HEADER + "{\n" + "  template HEADER [ # vazio ] ()\n" + "}\n",
    );
    assertEquals(messageIds, [],);
    const header = templatesOf(parser,)[0]!;
    assertEquals(header.name, "HEADER",);
    assertEquals(header.params, [],);
    assertEquals(header.body.trim(), "# vazio",);
  });

  it("aceita omissão completa dos parâmetros", () => {
    const { parser, messageIds, } = parseProject(
      HEADER + "{\n" + '  template SOLO [ task t1 "solo" ]\n' + "}\n",
    );
    assertEquals(messageIds, [],);
    const solo = templatesOf(parser,)[0]!;
    assertEquals(solo.params, [],);
    assertEquals(solo.body.trim(), 'task t1 "solo"',);
  });

  it("aceita corpo de várias linhas sem parênteses", () => {
    const { parser, messageIds, } = parseProject(
      HEADER +
        "{\n" +
        "  template MULTI [\n" +
        '    task t1 "a"\n' +
        '    task t2 "b"\n' +
        "  ]\n" +
        "}\n",
    );
    assertEquals(messageIds, [],);
    const multi = templatesOf(parser,)[0]!;
    assertEquals(multi.params, [],);
    assert(multi.body.includes('task t2 "b"',), `corpo: ${multi.body}`,);
  });
});

describe("template — corpo é texto cru (23.2.6)", () => {
  it("preserva {{ }} e ${...} literais no registro", () => {
    const { parser, messageIds, } = parseProject(
      HEADER +
        "{\n" +
        '  template RAW [ task {{ id }} "${NOME}" ] (id)\n' +
        "}\n",
    );
    assertEquals(messageIds, [],);
    const raw = templatesOf(parser,)[0]!;
    assert(raw.body.includes("{{ id }}",), `corpo: ${raw.body}`,);
    assert(raw.body.includes("${NOME}",), `corpo: ${raw.body}`,);
  });
});

describe("template — validação do nome (23.2.7)", () => {
  it("nome com minúscula inicial registra template_bad_name", () => {
    const { parser, messageIds, } = parseProject(
      HEADER + "{\n" + '  template card [ task t1 "x" ]\n' + "}\n",
    );
    assert(
      messageIds.includes("template_bad_name",),
      "mensagens: " + JSON.stringify(messageIds,),
    );
    assertEquals(templatesOf(parser,).length, 0,);
  });
});

describe("template — namespace unificado (23.1.8 aplicado à definição)", () => {
  it("template duplicado registra template_redefined", () => {
    const { messageIds, } = parseProject(
      HEADER +
        "{\n" +
        '  template CARD [ task t1 "a" ]\n' +
        '  template CARD [ task t2 "b" ]\n' +
        "}\n",
    );
    assert(
      messageIds.includes("template_redefined",),
      "mensagens: " + JSON.stringify(messageIds,),
    );
  });

  it("macro declarada depois de template com o mesmo nome é erro", () => {
    const { messageIds, } = parseProject(
      HEADER +
        "{\n" +
        '  template CARD [ task t1 "a" ]\n' +
        '  macro CARD [ task t2 "b" ]\n' +
        "}\n",
    );
    assert(
      messageIds.includes("name_redefined",),
      "mensagens: " + JSON.stringify(messageIds,),
    );
  });

  it("macro+macro continua sendo o warning marco_redefinition do Ruby", () => {
    const { messageIds, } = parseProject(
      HEADER +
        "{\n" +
        "  macro GREET [ hello ]\n" +
        "  macro GREET [ hi ]\n" +
        "}\n",
    );
    assert(
      messageIds.includes("marco_redefinition",),
      "mensagens: " + JSON.stringify(messageIds,),
    );
  });
});

describe("template — i18n en/pt-BR/es (23.2.2/23.2.9)", () => {
  it("keyword canônica 'template' em en", () => {
    const { parser, messageIds, } = parseProject(
      HEADER + "{\n" + '  template CARD [ task t1 "x" ]\n' + "}\n",
    );
    assertEquals(messageIds, [],);
    assertEquals(templatesOf(parser,)[0]!.name, "CARD",);
  });

  it("sinônimo 'modelo' em pt-BR", () => {
    const { parser, messageIds, } = parseProject(
      'language "pt-BR"\n' +
        HEADER +
        "{\n" +
        '  modelo CARD [ task t1 "x" ] (id)\n' +
        "}\n",
    );
    assertEquals(messageIds, [],);
    assertEquals(templatesOf(parser,)[0]!.name, "CARD",);
  });

  it("sinônimo 'plantilla' em es", () => {
    const { parser, messageIds, } = parseProject(
      'language "es"\n' +
        HEADER +
        "{\n" +
        '  plantilla CARD [ task t1 "x" ] (id)\n' +
        "}\n",
    );
    assertEquals(messageIds, [],);
    assertEquals(templatesOf(parser,)[0]!.name, "CARD",);
  });
});

describe("template — include (23.2.8)", () => {
  const originalLoader = FileStreamHandle.fileLoader;

  afterEach(() => {
    FileStreamHandle.fileLoader = originalLoader;
  },);

  it("template definido em .tji fica registrado no master", () => {
    FileStreamHandle.fileLoader = (name,) => {
      if (name.endsWith("cards.tji",)) {
        return 'template CARD [ task t1 "x" ] (id)\n';
      }
      return "";
    };
    const { parser, messageIds, } = parseProject(
      HEADER + "{\n" + '  include "cards.tji"\n' + "}\n",
    );
    assertEquals(messageIds, [],);
    const card = templatesOf(parser,)[0];
    assert(card, "template do include deve estar registrado",);
    assertEquals(card!.name, "CARD",);
    assertEquals(card!.params, ["id",],);
  });
});

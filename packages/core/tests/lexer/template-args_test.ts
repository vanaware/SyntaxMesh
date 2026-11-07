/**
 * Argumentos nomeados de template — integração com o scanner (Fase 23, 23.4).
 *
 * A leitura/tipagem isolada vive em `template-arguments.ts` (ver
 * `template-arguments_test.ts`). Aqui o que importa é o **efeito no stream**:
 * o valor tipado chega ao contexto do Vento e o texto renderizado é rescanado
 * como TJP normal.
 *
 * @see docs/syntaxmesh/fases/fase-23-template.md §4.2, §4.5, §5
 * @see docs/syntaxmesh/fases/fase-23-template-tarefas.md §23.4
 */
import { assert, assertEquals, } from "@std/assert";
import { afterEach, beforeEach, describe, it, } from "@std/testing/bdd";
import { FileStreamHandle, } from "../../src/lexer/stream-handle.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { ProjectFileParser, } from "../../src/parser/mod.ts";
import type { ProjectFileScanner, } from "../../src/lexer/project-file-scanner.ts";
import type { Project, } from "../../src/model/project.ts";
import {
  type ParseOutcome,
  parseProject,
  PROJECT_HEADER,
} from "../parser/parse-helper.ts";

const HEADER = PROJECT_HEADER;

/** Parse sem exigir sucesso (testes de erro). */
function parse(body: string,): ParseOutcome {
  return parseProject(HEADER + body,);
}

/** Parse configurando o scanner antes da expansão (23.4.6). */
function parseConfiguring(
  body: string,
  configure: (scanner: ProjectFileScanner,) => void,
): ParseOutcome {
  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;
  const parser = new ProjectFileParser();
  parser.open(HEADER + body, true, true,);
  configure(parser.scannerRef!,);
  let result: unknown = null;
  let threw: Error | null = null;
  try {
    result = parser.parse("project",);
  } catch (e) {
    threw = e as Error;
  }
  const messages = MessageHandlerInstance.instance.messages.map((m,) => ({
    id: m.id,
    text: (m as unknown as { message?: string }).message ?? "",
  }));
  return {
    parser,
    result,
    threw,
    messageIds: messages.map((m,) => m.id),
    messages,
  };
}

/** Parse de um caso válido, devolvendo o Project. */
function projectOf(body: string,): Project {
  const out = parse(body,);
  assertEquals(
    out.messageIds,
    [],
    `msgs=${out.messages.map((m,) => `${m.id}:${m.text}`).join(" | ",)}`,
  );
  assert(out.result instanceof Object && out.result !== false,);
  return out.result as Project;
}

/** Nome do resource renderizado por uma chamada de template. */
function renderedName(body: string, id: string,): unknown {
  const p = projectOf(body,);
  const res = p.resource(id,);
  assert(res, `resource '${id}' deveria existir`,);
  return res.name;
}

/** Mensagem (id + texto + linha) com o id indicado. */
function messageFor(out: ParseOutcome, id: string,) {
  return MessageHandlerInstance.instance.messages.find((m,) => m.id === id);
}

beforeEach(() => {
  MessageHandlerInstance.instance.reset();
},);

afterEach(() => {
  FileStreamHandle.fileLoader = null;
},);

describe("template args — valores tipados (23.4.2)", () => {
  it("número chega ao contexto como number", () => {
    assertEquals(
      renderedName(
        "{\n" +
          '  template TYPED [ resource {{ id }} "{{ typeof n }}" ] (id, n)\n' +
          "}\n" +
          '${TYPED id="r1" n=120}\n',
        "r1",
      ),
      "number",
    );
  });

  it("string com espaços chega como string", () => {
    assertEquals(
      renderedName(
        "{\n" +
          '  template TYPED [ resource {{ id }} "{{ typeof s }}" ] (id, s)\n' +
          "}\n" +
          '${TYPED id="r1" s="texto livre"}\n',
        "r1",
      ),
      "string",
    );
  });

  it("booleano chega como boolean", () => {
    assertEquals(
      renderedName(
        "{\n" +
          '  template TYPED [ resource {{ id }} "{{ typeof b }}" ] (id, b)\n' +
          "}\n" +
          '${TYPED id="r1" b=true}\n',
        "r1",
      ),
      "boolean",
    );
  });
});

describe("template args — referência nativa (23.4.3)", () => {
  it("`!id` é preservado como texto nativo", () => {
    assertEquals(
      renderedName(
        "{\n" +
          '  template REF [ resource {{ id }} "{{ ref }}" ] (id, ref)\n' +
          "}\n" +
          '${REF id="r1" ref=!t1}\n',
        "r1",
      ),
      "!t1",
    );
  });
});

describe("template args — listas e objetos (23.4.4)", () => {
  it("lista `[a, b, c]` vira array no contexto", () => {
    assertEquals(
      renderedName(
        "{\n" +
          '  template LIST [ resource {{ id }} "{{ tags.length }}-{{ tags[1] }}" ] (id, tags)\n' +
          "}\n" +
          '${LIST id="r1" tags=["a", "b", "c"]}\n',
        "r1",
      ),
      "3-b",
    );
  });

  it("vírgula dentro de string não divide a lista", () => {
    assertEquals(
      renderedName(
        "{\n" +
          '  template LIST [ resource {{ id }} "{{ tags.length }}|{{ tags[0] }}" ] (id, tags)\n' +
          "}\n" +
          '${LIST id="r1" tags=["a,b", "c"]}\n',
        "r1",
      ),
      "2|a,b",
    );
  });

  it("objeto literal `{ k: v }` vira objeto no contexto", () => {
    assertEquals(
      renderedName(
        "{\n" +
          '  template OBJ [ resource {{ id }} "{{ meta.k }}" ] (id, meta)\n' +
          "}\n" +
          '${OBJ id="r1" meta={ k: "v" }}\n',
        "r1",
      ),
      "v",
    );
  });
});

describe("template args — aritmética (23.4.5)", () => {
  it("expressão numérica literal é avaliada", () => {
    assertEquals(
      renderedName(
        "{\n" +
          '  template CALC [ resource {{ id }} "{{ n }}" ] (id, n)\n' +
          "}\n" +
          '${CALC id="r1" n=1 + 2}\n',
        "r1",
      ),
      "3",
    );
  });

  it("aritmética referencia argumentos já lidos", () => {
    assertEquals(
      renderedName(
        "{\n" +
          '  template CALC [ resource {{ id }} "{{ factor }}" ] (id, base, factor)\n' +
          "}\n" +
          '${CALC id="r1" base=40 factor=base * 2}\n',
        "r1",
      ),
      "80",
    );
  });
});

describe("template args — expressão lógica (23.4.6)", () => {
  const BODY = "{\n" +
    '  template COND [ resource {{ id }} "{{ flag }}" ] (id, flag)\n' +
    "}\n" +
    '${COND id="r1" flag=isMilestone(!t1)}\n';

  it("sem motor injetado a expressão permanece texto", () => {
    assertEquals(renderedName(BODY, "r1",), "isMilestone(!t1)",);
  });

  it("com o motor da Fase 11 injetado o valor é avaliado", () => {
    const out = parseConfiguring(BODY, (scanner,) => {
      scanner.setExpressionEvaluator((text,) => ({
        ok: true,
        value: text === "isMilestone(!t1)",
      }));
    },);
    assertEquals(out.messageIds, [],);
    const p = out.result as Project;
    assertEquals(p.resource("r1",)!.name, "true",);
  });
});

describe("template args — validação (23.4.7/23.4.8)", () => {
  it("parâmetro obrigatório faltante aponta para a chamada", () => {
    const out = parse(
      "{\n" +
        '  template TSK [ task {{ id }} "t" { effort {{ esforco }} } ] (id, esforco)\n' +
        "}\n" +
        '${TSK id="t1"}\n',
    );
    const msg = messageFor(out, "template_missing_param",);
    assert(msg, `ids: ${out.messageIds.join(",",)}`,);
    assertEquals(
      (msg as unknown as { message: string }).message,
      "template 'TSK': parâmetro 'esforco' não fornecido",
    );
    assertEquals(msg.sourceFileInfo?.lineNo, 5,);
  });

  it("argumento não declarado é recusado", () => {
    const out = parse(
      "{\n" +
        '  template TSK [ task {{ id }} "t" { effort {{ esforco }} } ] (id, esforco)\n' +
        "}\n" +
        '${TSK id="t1" esforcoo=5}\n',
    );
    const msg = messageFor(out, "template_unknown_param",);
    assert(msg, `ids: ${out.messageIds.join(",",)}`,);
    assertEquals(
      (msg as unknown as { message: string }).message,
      "template 'TSK': parâmetro 'esforcoo' não declarado",
    );
  });
});

describe("template args — chamada opcional (23.4.9)", () => {
  it("`${?NOME k=v}` com template inexistente é vazio silencioso", () => {
    const out = parse(
      "{\n" + '  template NOPE [ task x "x" ]\n' + "}\n" +
        '${?MISSING id="r1" nome="X"}\n' +
        'resource r2 "Dois"\n',
    );
    assertEquals(out.messageIds, [],);
    const p = out.result as Project;
    assert(p.resource("r2",), "o resto do arquivo segue normal",);
  });

  it("`${?NOME}` (sem args) com nome inexistente também é silencioso", () => {
    const out = parse('${?MISSING}\nresource r2 "Dois"\n',);
    assertEquals(out.messageIds, [],);
    assert((out.result as Project).resource("r2",),);
  });

  it("`${?NOME k=v}` com template existente expande normalmente", () => {
    assertEquals(
      renderedName(
        "{\n" +
          '  template PERSON [ resource {{ id }} "{{ nome }}" ] (id, nome)\n' +
          "}\n" +
          '${?PERSON id="r1" nome="Opcional"}\n',
        "r1",
      ),
      "Opcional",
    );
  });
});

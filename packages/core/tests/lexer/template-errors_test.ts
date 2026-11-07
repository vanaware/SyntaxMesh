/**
 * Fase 23 (23.7.9) — matriz de erros do §5, table-driven.
 *
 * Cada linha da tabela do plano (`fase-23-template.md` §5) vira um caso desta
 * suíte, com o id, o texto exato da mensagem e a exigência de que a mensagem
 * carregue o `SourceFileInfo` do `.tjp` **original** (nunca do corpo
 * renderizado). Nada lança: o `MessageHandler` é o driver.
 *
 * O último caso usa o fixture `tests/fixtures/templates/errors.tjp` para
 * ancorar a mesma tabela em um arquivo de projeto completo (prova de que os
 * erros sobrevivem ao caminho master file + projeto).
 *
 * @see docs/syntaxmesh/fases/fase-23-template.md §5
 * @see docs/syntaxmesh/fases/fase-23-template-tarefas.md (23.5.6, 23.7.9)
 */
import { assert, assertEquals, } from "@std/assert";
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import type { Message, } from "../../src/message.ts";
import { parseProject, PROJECT_HEADER, } from "../parser/parse-helper.ts";
import { loadTemplateFixture, } from "../golden/template-expansion-snapshot.ts";

/** Caso da tabela §5: fonte inline + id + texto esperado. */
interface ErrorCase {
  /** Linha da tabela §5 (`fase-23-template.md`). */
  situation: string;
  /** Texto TJP somado ao cabeçalho mínimo de projeto. */
  body: string;
  /** Id registrado no MessageHandler. */
  id: string;
  /** Texto exato da mensagem, quando o §5 fixa a redação. */
  text?: string;
}

const CASES: ErrorCase[] = [
  {
    situation: "parâmetro não fornecido",
    body:
      'template CARD [ task {{ id }} "x" { effort {{ esforco }} } ] (id, esforco)\n' +
      '${CARD id="t1"}\n',
    id: "template_missing_param",
    text: "template 'CARD': parâmetro 'esforco' não fornecido",
  },
  {
    situation: "parâmetro não declarado",
    body: 'template CARD [ task {{ id }} "x" ] (id)\n' +
      '${CARD id="t1" esforcoo=5}\n',
    id: "template_unknown_param",
    text: "template 'CARD': parâmetro 'esforcoo' não declarado",
  },
  {
    situation: "colisão de nomes (macro → template)",
    // `macro` e `template` só são aceitos fora do bloco `{ }` do projeto.
    body: 'macro CARD [ task t0 "x" ]\ntemplate CARD [ task t1 "y" ]\n',
    id: "template_redefined",
    text: "'CARD' já definido como macro; não pode ser redefinido como " +
      "template",
  },
  {
    situation: "nome com minúscula inicial",
    body: 'template card [ task t1 "y" ]\n',
    id: "template_bad_name",
    text: "nome de template deve começar com letra maiúscula: 'card'",
  },
  {
    situation: "recursão detectada",
    body: 'template CARD [ ${CARD id="x"} ] (id)\n${CARD id="a"}\n',
    id: "template_recursion",
    text: "recursão detectada: CARD → CARD",
  },
  {
    situation: "template chamado mas não definido",
    body: '${CARD id="t1" nome="x"}\n',
    id: "template_not_defined",
    text: "'CARD' não definido",
  },
  {
    situation: "sintaxe Vento inválida",
    body: "template CARD [ {{ if }} oops {{ /for }} ]\n${CARD}\n",
    id: "template_syntax_error",
    text: "template 'CARD': erro de sintaxe",
  },
  {
    situation: "execução Vento inválida (extensão do port)",
    // Função indefinida: compila e falha no render → `template_render_error`.
    body: "template CARD [ {{ funcaoInexistente() }} ]\n${CARD}\n",
    id: "template_render_error",
    text: "template 'CARD': erro de execução",
  },
];

/** Primeira mensagem com o id indicado. */
function messageFor(id: string,): Message | undefined {
  return MessageHandlerInstance.instance.messages.find((m,) => m.id === id);
}

beforeEach(() => {
  MessageHandlerInstance.instance.reset();
},);

describe("23.7.9 — matriz de erros do §5 (table-driven)", () => {
  for (const c of CASES) {
    it(`${c.situation} → ${c.id}`, () => {
      const out = parseProject(PROJECT_HEADER + c.body,);
      assert(
        out.messageIds.includes(c.id,),
        `esperado ${c.id}, ids: ${out.messageIds.join(",",)}`,
      );
      const msg = messageFor(c.id,);
      assert(msg, "mensagem não registrada",);
      assertEquals(msg.type, "error",);
      if (c.text !== undefined) {
        assert(
          msg.message.startsWith(c.text,),
          `mensagem: ${msg.message}`,
        );
      }
      // §5: sempre o SourceFileInfo do `.tjp` original, com linha válida.
      assert(msg.sourceFileInfo, "mensagem precisa do SourceFileInfo",);
      assert(
        typeof msg.sourceFileInfo.lineNo === "number" &&
          msg.sourceFileInfo.lineNo > 0,
        `lineNo inválido: ${msg.sourceFileInfo.lineNo}`,
      );
      assert(typeof msg.sourceFileInfo.columnNo === "number",);
      // Erros de template nunca lançam.
      assertEquals(out.threw, null,);
    });
  }

  it("a matriz inteira cobre as oito linhas do §5 (sete do plano + render)", () => {
    assertEquals(CASES.length, 8,);
    // Ids distintos: nenhuma linha "cola" na linha vizinha.
    assertEquals(
      new Set(CASES.map((c,) => c.id),).size,
      CASES.length,
    );
  });
});

describe("23.7.9 — fixture errors.tjp ancora a tabela num projeto completo", () => {
  it("o primeiro erro do fixture é o parâmetro faltante do §5", () => {
    const out = parseProject(loadTemplateFixture("errors",),);
    assertEquals(out.messageIds, ["template_missing_param",],);
    assertEquals(
      out.messages.map((m,) => `${m.id}:${m.text}`),
      [
        "template_missing_param:template 'CARD': parâmetro 'esforco' não " +
        "fornecido",
      ],
    );
  });
});

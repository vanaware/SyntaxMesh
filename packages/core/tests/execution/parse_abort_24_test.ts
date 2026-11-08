/**
 * Fase 24 (24.7) — achados do golden CLI vs `tj3`: aborto do parse e mensagens.
 *
 * O Ruby inteiro (`tj3`) trata **todo** `MessageHandler#error` como `exit 1`
 * quando `trapSetup` está desligado (`MessageHandler.rb` l.289-298). O port
 * acumula mensagens para o envelope, mas há dois laços do scanner que só
 * terminavam porque o processo morria:
 *
 * 1. `no_token_match` — nenhum padrão casa e o cursor não avança;
 * 2. `include_recursion` — o mesmo arquivo é empilhado de novo.
 *
 * Sem o aborto o scanner gira até o limite do heap (~4 GB) em vez de sair com
 * `1` e a mensagem do `tj3`. Estes testes travam o comportamento: **uma**
 * mensagem, `exitCode` 1 e término imediato.
 *
 * @see docs/taskjuggler/lib/taskjuggler/MessageHandler.rb l.289-298
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.7)
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { execute, } from "../../src/execution/execute.ts";
import type { ExecutionRequest, } from "../../src/execution/types.ts";
// Efeito colateral: registra as fábricas de conteúdo dos relatórios.
import "../../src/reports/mod.ts";

/** Arquivo em memória do request. */
function file(path: string, content: string,) {
  return { path, content, };
}

/** Executa um projeto de um único arquivo. */
function run(entry: string, content: string,) {
  return execute({ files: [file(entry, content,),], },);
}

/** Ids das mensagens do envelope, na ordem. */
function ids(result: { messages: Array<{ id: string }> },): string[] {
  return result.messages.map((m,) => m.id);
}

describe("24.7 — aborto do parse nos erros que o tj3 mata com exit 1", () => {
  it("`no_token_match` registra um erro e termina", async () => {
    // Conteúdo fiel ao fixture `Syntax/Errors/no_token_match1.tjp` (inclusive
    // os 4 espaços da última linha, sem `\n` final): o `-8<-` sobra no modo
    // de declaração de tarefa e nenhum padrão casa.
    const result = await run(
      "bad.smx",
      [
        'project test "Test" "1.0" 2009-08-25 +2m ',
        "",
        "# MARK: error 5 no_token_match",
        "task t -8<-",
        "    ",
      ].join("\n",),
    );

    assertEquals(ids(result,), ["no_token_match",],);
    assertEquals(result.exitCode, 1,);
    assertEquals(result.ok, false,);
    assertEquals(
      result.messages[0]!.text,
      "Unexpected characters found: '    ...'",
    );
  });

  it("`include_recursion` aborta em vez de reabrir o mesmo arquivo", async () => {
    const dir = "Syntax/Errors/";
    const request: ExecutionRequest = {
      entry: `${dir}include_recursion.smx`,
      files: [
        file(
          `${dir}include_recursion.smx`,
          'project prj "T" 2026-01-01 - 2026-02-01\n' +
            'include "include_recursion.tji"\n',
        ),
        file(
          `${dir}include_recursion.tji`,
          'include "include_recursion.tji"\n',
        ),
      ],
    };

    const result = await execute(request,);

    assertEquals(ids(result,), ["include_recursion",],);
    assertEquals(result.exitCode, 1,);
    assertEquals(result.ok, false,);
    assertEquals(
      result.messages[0]!.text,
      `Recursive inclusion of ${dir}include_recursion.tji detected`,
    );
  });

  it("`no_reduce` preserva o texto `Expecting` do Ruby", async () => {
    // `selfcontained` exige `yes`/`no`: fechar o bloco entrega o token `}` e o
    // FSM reduz num estado `noReduce` (TextParser.rb l.340-345).
    const result = await run(
      "bad.smx",
      [
        'project prj "T" "1.0" 2026-01-01 - 2026-02-01',
        'taskreport r "R" {',
        "  formats html",
        "  selfcontained",
        "}",
        "",
      ].join("\n",),
    );

    assertEquals(ids(result,), ["no_reduce",],);
    assert(
      result.messages[0]!.text.includes("Expecting one of ",),
      `mensagem sem "Expecting": ${result.messages[0]!.text}`,
    );
    assert(
      result.messages[0]!.text.includes("'yes', 'no'",),
      `mensagem sem a lista esperada: ${result.messages[0]!.text}`,
    );
  });
});

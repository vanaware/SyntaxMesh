/**
 * Fase 23 (23.7.3) — cerca de regressão do caminho de macro (Fase 10).
 *
 * `template` estende o mesmo ponto de expansão `${...}` do scanner
 * (plano §7.2). O risco desta fase é justamente esse: um ramo novo no
 * `expandMacro` alterar o comportamento herdado do Ruby. Esta suíte fixa, de
 * forma explícita e num só arquivo, os oito itens da auditoria 23.1b
 * (`fase-23-template-tarefas.md`), todos com oracle em
 * `docs/taskjuggler/lib/taskjuggler/TextParser/MacroTable.rb` e
 * `.../parser/scanner.rb` (l.450–464).
 *
 * Regra zero (ADR 011): se algum caso aqui falhar, a correção é da
 * implementação contra o Ruby — nunca do teste.
 *
 * @see docs/syntaxmesh/fases/fase-23-template-tarefas.md (23.1b, 23.7.3)
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { Log, } from "../../src/log.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { ProjectFileScanner, } from "../../src/lexer/project-file-scanner.ts";
import { Macro, } from "../../src/lexer/macro-table.ts";
import type { ScannerToken, } from "../../src/lexer/scanner.ts";

/** Escaneia e registra as definições `[ nome valor ]` como o `rule_macro`. */
function scan(text: string,): ScannerToken[] {
  MessageHandlerInstance.instance.messages.length = 0;
  const scanner = new ProjectFileScanner(text, Log,);
  scanner.open(true,);
  const out: ScannerToken[] = [];
  for (;;) {
    const t = scanner.nextToken();
    if (t[0] === "eof" || t[0] === "endOfText") break;
    if (t[0] === "MACRO") {
      const body = String(t[1],).trim();
      const space = body.indexOf(" ",);
      const name = space < 0 ? body : body.slice(0, space,);
      let value = space < 0 ? "" : body.slice(space + 1,);
      if (value.startsWith('"',) && value.endsWith('"',)) {
        value = value.slice(1, -1,);
      }
      scanner.addMacro(
        new Macro(name, value, t[2] ?? scanner.sourceFileInfo(),),
      );
      continue;
    }
    out.push([t[0], t[1], null,],);
  }
  return out;
}

/** Texto dos tokens produzidos (descarta o tipo). */
function texts(text: string,): unknown[] {
  return scan(text,).map((t,) => t[1]);
}

/** IDs das mensagens registradas pelo scanner. */
function messageIds(): string[] {
  return MessageHandlerInstance.instance.messages.map((m,) => m.id);
}

describe("23.7.3 — cerca de regressão macro (caminho congelado)", () => {
  it("1. `${1}`/`${2}`: argumentos posicionais substituídos em ordem", () => {
    // MacroTable.rb#resolve — `${n}` vira o n-ésimo argumento da chamada.
    // O texto expandido reentra no scanner e vira tokens comuns (o `!` que
    // sobra vira LITERAL, como no Ruby).
    assertEquals(
      scan('[ greet "Hello ${1} and ${2}!" ]\n${greet "Alice" "Bob"}\n',)
        .map((t,) => t[1]),
      ["Hello", "Alice", "and", "Bob", "!",],
    );
    assertEquals(messageIds(), [],);
  });

  it("2. `${?OPT}` de macro inexistente é vazio silencioso", () => {
    // Scanner#expandMacro: texto vazio → `return` antes de qualquer erro.
    assertEquals(texts("task ${?naoExiste}\n",), ["task",],);
    assertEquals(messageIds(), [],);
  });

  it("3. `${?OPT}` de macro definida expande normalmente", () => {
    // MacroTable.rb#resolve l.66-69: o `?` só afeta a ausência.
    assertEquals(texts('[ m "valor" ]\ntask ${?m}\n',), ["task", "valor",],);
    assertEquals(messageIds(), [],);
  });

  it("4. `$${` desescapa para `${` no resolve e reentra no scanner", () => {
    // MacroTable.rb#resolve (l.64): `gsub!('$${', '${')`. O Ruby injeta o
    // texto resolvido **sem** re-escapar (Scanner.rb#injectMacro l.92-100),
    // então o `${...}` resultante volta ao padrão de chamada.
    assertEquals(
      texts('[ inner "X" ]\n[ m "$${inner}" ]\ntask ${m}\n',),
      ["task", "X",],
    );
    // E com o nome indefinido o erro é o mesmo de uma chamada explícita —
    // não há exceção de escape neste caminho.
    assertEquals(texts('[ m "$${naoExpandir}" ]\ntask ${m}\n',), ["task",],);
    assert(
      messageIds().includes("undefined_macro",),
      `esperado undefined_macro, obtido ${messageIds().join(",",)}`,
    );
  });

  it("5. macro não definida: id e mensagem do Ruby", () => {
    assertEquals(texts("task ${fantasma}\n",), ["task",],);
    assertEquals(messageIds(), ["undefined_macro",],);
    assertEquals(
      MessageHandlerInstance.instance.messages[0]!.message,
      "Undefined macro 'fantasma' called",
    );
  });

  it("6. corpo de macro com `]` no fim da linha vira token MACRO", () => {
    // Padrão `/\[.*\]\n/` do :tjp — o `]` final pertence ao corpo, não ao
    // delimitador. O token carrega o corpo cru, com espaços (o parser apará).
    const scanner = new ProjectFileScanner("[ m some text ]\n", Log,);
    scanner.open(true,);
    const token = scanner.nextToken();
    assertEquals(token[0], "MACRO",);
    assertEquals(token[1], " m some text ",);
  });

  it("7. macro dentro de macro expande em cascata", () => {
    // `injectMacro` reentra no stream: o texto injetado passa pelo mesmo
    // padrão que o originou.
    assertEquals(
      texts('[ inner "B" ]\n[ outer "A${inner}C" ]\ntask ${outer}\n',),
      ["task", "ABC",],
    );
    assertEquals(messageIds(), [],);
  });

  it("8. valor vazio não gera erro nem token", () => {
    // `text === ""` → `return` silencioso (l.418-419 da porta).
    assertEquals(texts('[ m "" ]\ntask ${m} fim\n',), ["task", "fim",],);
    assertEquals(messageIds(), [],);
  });

  it("namespace: `${TEMPLATE}` sem argumentos continua no caminho de macro", () => {
    // Extensão SyntaxMesh (23.1.9): `resolve` é macro-only; o scanner só passa
    // para o ramo de template na chamada com argumentos nomeados.
    MessageHandlerInstance.instance.messages.length = 0;
    const scanner = new ProjectFileScanner("${CARD}\n", Log,);
    scanner.open(true,);
    scanner.nextToken();
    assertEquals(scanner.macroTable.template("CARD",), null,);
    assert(
      messageIds().includes("undefined_macro",),
      `esperado undefined_macro, obtido ${messageIds().join(",",)}`,
    );
  });
});

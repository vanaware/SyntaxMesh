/**
 * C3.2 — `note`/`journalentry` em resource e account, e `supplement account`.
 *
 * Cobre as tarefas atômicas C3.2.1 (note em recurso), C3.2.2 (note +
 * journalentry em conta) e C3.2.3 (supplement account com journalentry e
 * semântica de "uma única vez" para atributos singleton).
 *
 * Nota: `note` depende de RichText (Fase 12). `newRichText` lança
 * `NotYetImplementedError`, o que comprova que a gramática alcançou a action
 * de `note` (falha apenas na dependência futura, não no parse).
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { Account, } from "../../src/model/account.ts";
import { Resource, } from "../../src/model/resource.ts";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";

describe("C3.2.1 note/journalentry em resource", () => {
  it("resource aceita journalentry anexado ao recurso", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + 'resource r "Bob" {\n' +
        'journalentry 2026-02-01 "Reunião"\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const r = parser.project!.resource("r",) as Resource;
    const entries = parser.project!.journal.entriesFor(r,);
    assertEquals(entries.length, 1,);
    assertEquals(entries[0]!.headline, "Reunião",);
  });

  it("resource aceita nota (gramática alcança action de note)", () => {
    const { threw, } = parseProject(
      PROJECT_HEADER + 'resource r "Bob" {\nnote "Observação"\n}\n',
    );
    // RichText é Fase 12: a action de `note` lança NotYetImplementedError,
    // provando que `note` é aceito na gramática de resource.
    assertEquals(threw?.name, "NotYetImplementedError",);
  });
});

describe("C3.2.2 note/journalentry em account", () => {
  it("account aceita journalentry anexado à conta", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + 'account a "Custo" {\n' +
        'journalentry 2026-02-01 "Fatura recebida"\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const a = parser.project!.account("a",) as Account;
    const entries = parser.project!.journal.entriesFor(a,);
    assertEquals(entries.length, 1,);
    assertEquals(entries[0]!.headline, "Fatura recebida",);
  });

  it("account aceita nota (gramática alcança action de note)", () => {
    const { threw, } = parseProject(
      PROJECT_HEADER + 'account a "Custo" {\nnote "Observação"\n}\n',
    );
    assertEquals(threw?.name, "NotYetImplementedError",);
  });
});

describe("C3.2.3 supplement account", () => {
  it("supplement account aceita journalentry", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + 'account a "Custo" {\n}\n' +
        "supplement account a {\n" +
        'journalentry 2026-03-01 "Estorno"\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const a = parser.project!.account("a",) as Account;
    const entries = parser.project!.journal.entriesFor(a,);
    assertEquals(entries.length, 1,);
    assertEquals(entries[0]!.headline, "Estorno",);
  });

  it("singleton definido duas vezes emite aviso attr_overwrite (ok + dup)", () => {
    // `aggregate` é um Symbol singleton (não-list): a segunda definição
    // dispara AttributeOverwrite, convertido em aviso "attr_overwrite".
    const { messageIds, threw, result, } = parseProject(
      PROJECT_HEADER +
        'account a "Custo" {\naggregate tasks\naggregate tasks\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    assert(
      messageIds.includes("attr_overwrite",),
      `esperado attr_overwrite, obtido ${messageIds.join(",",)}`,
    );
  });

  it("singleton definido uma vez não emite attr_overwrite", () => {
    const { messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + 'account a "Custo" {\naggregate tasks\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    assertEquals(
      messageIds.includes("attr_overwrite",),
      false,
      `não esperado attr_overwrite: ${messageIds.join(",",)}`,
    );
  });
});

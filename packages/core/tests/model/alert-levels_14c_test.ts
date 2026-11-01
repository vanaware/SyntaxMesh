/**
 * 14C.0.7 — Alert levels mínimos (módulo + ligação ao parser).
 *
 * Fiéis ao Ruby: `rule_alertLevel` devolve o ÍNDICE numérico na lista do
 * projeto (`indexById`), e a diretiva `alertlevels` substitui os defaults.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import {
  alertLevelIds,
  alertLevelIndexById,
  alertLevelIndexByName,
  DEFAULT_ALERT_LEVELS,
  defaultAlertLevels,
} from "../../src/model/alert-levels.ts";
import { type JournalEntry, } from "../../src/model/journal.ts";
import { Task, } from "../../src/model/task.ts";
import { parseProject, PROJECT_HEADER, } from "../parser/parse-helper.ts";
import type { AlertLevelDefinition, } from "../../src/model/alert-levels.ts";

describe("alert-levels módulo (14C.0.7)", () => {
  it("defaults ruby: green/amarelo/red com índices 0-2", () => {
    const levels = defaultAlertLevels();
    assertEquals(levels.map((l,) => l.id), ["green", "yellow", "red",],);
    assertEquals(alertLevelIndexById(levels, "red",), 2,);
    assertEquals(alertLevelIndexByName(levels, "Green",), 0,);
    assertEquals(alertLevelIndexById(levels, "azul",), null,);
    assertEquals(alertLevelIds(levels,), ["green", "yellow", "red",],);
  });

  it("defaultAlertLevels devolve cópia profunda (lista mutável)", () => {
    const a = defaultAlertLevels();
    a[0]!.id = "mutado";
    assertEquals(DEFAULT_ALERT_LEVELS[0]!.id, "green",);
  });
});

describe("alert-levels no parser (14C.0.7)", () => {
  it("alert em journalentry grava o índice numérico do nível", () => {
    const { parser, threw, messageIds, result, } = parseProject(
      PROJECT_HEADER + 'task t "T" {\n' +
        'journalentry 2026-02-01 "E" {\n  alert red\n  }\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false,);
    const t = parser.project!.task("t",) as Task;
    const entries = parser.project!.journal.entriesFor(t,) as JournalEntry[];
    assertEquals(entries[0]!.alertLevel, 2,);
  });

  it("alertlevels substitui a lista e o índice segue a nova ordem", () => {
    const { parser, threw, messageIds, result, } = parseProject(
      'project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {\n' +
        '  alertlevels low "Low" "#2AA46C", high "High" "#F99836"\n}\n' +
        'task t "T" {\njournalentry 2026-02-01 "E" {\n  alert high\n  }\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `msgs=${messageIds.join(",",)}`,);
    const levels = parser.project!.get(
      "alertLevels",
    ) as AlertLevelDefinition[];
    assertEquals(levels.map((l,) => l.id), ["low", "high",],);
    const t = parser.project!.task("t",) as Task;
    const entries = parser.project!.journal.entriesFor(t,) as JournalEntry[];
    assertEquals(entries[0]!.alertLevel, 1,);
  });

  it("nível inexistente gera erro bad_alert", () => {
    const { messageIds, } = parseProject(
      PROJECT_HEADER + 'task t "T" {\n' +
        'journalentry 2026-02-01 "E" {\n  alert roxo\n  }\n}\n',
    );
    assert(messageIds.includes("bad_alert",), messageIds.join(",",),);
  });
});

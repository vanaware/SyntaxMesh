/**
 * 18.16.8 — Smoke test pós-Fase 18 (time/status sheets).
 *
 * Fecha a fase provando três pontos:
 *  1. **Barrel público** — os 12 nomes exigidos por 18.16.7 são exportados por
 *     `@vanaware/syntaxmesh` (`mod.ts` → `src/mod.ts`): `TimeSheet`,
 *     `TimeSheetRecord`, `TimeSheets`, `SheetHandlerBase`, `SheetSender`,
 *     `SheetReceiver`, `TimeSheetSender`, `TimeSheetReceiver`,
 *     `TimeSheetSummary`, `StatusSheetSender`, `StatusSheetReceiver` e o tipo
 *     `FileStore` (ADR 037).
 *  2. **Folha de ponto real** — cria uma `TimeSheet` do `dev`, adiciona um
 *     `TimeSheetRecord` com o total de slots do período e verifica que
 *     `check()` não emite nada (total ±1, status preenchido).
 *  3. **Fase 17 intacta** — `XMLElement` do serializer real continua
 *     serializando (o smoke da F17 importa daqui em diante).
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.16.8)
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import {
  SheetHandlerBase,
  SheetReceiver,
  SheetSender,
  StatusSheetReceiver,
  StatusSheetSender,
  TimeSheet,
  TimeSheetReceiver,
  TimeSheetRecord,
  TimeSheets,
  TimeSheetSender,
  TimeSheetSummary,
} from "../../mod.ts";
import type { FileStore, } from "../../mod.ts";
import { JournalEntry, } from "../../src/model/journal.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { XMLElement, } from "../../src/xml/xml-element.ts";
import {
  buildFixture,
  intervalOf,
  messageIdsOf,
  type TsFixture,
} from "../timesheet/fixture.ts";

describe("Smoke test after Fase 18 (time/status sheets)", () => {
  it("o barrel público exporta as classes da fase", () => {
    const exports: unknown[] = [
      TimeSheet,
      TimeSheetRecord,
      TimeSheets,
      SheetHandlerBase,
      SheetSender,
      SheetReceiver,
      TimeSheetSender,
      TimeSheetReceiver,
      TimeSheetSummary,
      StatusSheetSender,
      StatusSheetReceiver,
    ];
    for (const exported of exports) {
      assertEquals(typeof exported, "function",);
    }
    // `FileStore` é contrato injetável (type-only, ADR 037): basta o tipo.
    const store: FileStore | null = null;
    assertEquals(store, null,);
  });

  it("cria TimeSheet, adiciona 1 record e check() passa", () => {
    const f: TsFixture = buildFixture();
    const sheet = new TimeSheet(f.dev, intervalOf("2026-01-01", 28,), 0,);
    const record = new TimeSheetRecord(sheet, f.effortTask,);
    // Janeiro/2026 tem 160 slots líquidos para o `dev` (8h × 20 dias úteis).
    record.work = 160;
    record.remaining = 0;
    record.status = new JournalEntry(
      f.project.journal,
      TjTime.fromString("2026-01-31",),
      "Progresso normal",
      f.effortTask,
    );

    assertEquals(sheet.records.length, 1,);
    // Total ±1: sem mensagens, sem erro.
    assertEquals(messageIdsOf(() => sheet.check()), [],);
  });

  it("o serializer da Fase 17 segue funcionando", () => {
    const div = new XMLElement("div",);
    div.append("ok",);
    assertEquals(div.to_s(), "<div>ok</div>",);
    assert(div.toHTML().includes("<div>ok</div>",), div.toHTML(),);
  });
});

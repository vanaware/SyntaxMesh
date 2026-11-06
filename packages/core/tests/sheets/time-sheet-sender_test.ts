/**
 * Testes de `TimeSheetSender` (tarefa 18.8).
 *
 * A classe só fixa configuração; os testes verificam os valores do Ruby e o
 * comportamento dos dois trechos que os usam (filtro de assinatura e assunto).
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.8)
 */
import { assertEquals, assertStringIncludes, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type { SheetType, } from "../../src/sheets/sheet-handler-base.ts";
import { sprintf, } from "../../src/sheets/sheet-handler-base.ts";
import {
  TIME_SHEET_INTRO_TEXT,
  TimeSheetSender,
} from "../../src/sheets/time-sheet-sender.ts";

/** Expõe os membros protegidos que os testes precisam observar. */
class TestTimeSheetSender extends TimeSheetSender {
  get type(): SheetType {
    return this.sheetType;
  }

  get hide(): string {
    return this.hideResource;
  }

  get template(): string {
    return this.templateDir;
  }

  get signature(): string {
    return this.signatureFile;
  }

  get filter(): RegExp {
    return this.signatureFilter;
  }

  get subject(): string {
    return this.mailSubject;
  }

  get intro(): string {
    return this.introText;
  }
}

describe("TimeSheetSender", () => {
  it("constructor defaults", () => {
    const sender = new TestTimeSheetSender("tj3ts_sender",);
    assertEquals(sender.appName, "tj3ts_sender",);
    assertEquals(sender.type, "time",);
    assertEquals(sender.hide, "0",);
    assertEquals(sender.template, "TimeSheetTemplates",);
    assertEquals(sender.signature, "TimeSheetTemplates/acceptable_intervals",);
    assertEquals(sender.logFile, "timesheets.log",);
    assertEquals(sender.intervalDuration, "1w",);
    assertEquals(sender.force, false,);
    assertEquals(sender.project, null,);
  });

  it("signatureFilter extrai o intervalo do cabeçalho", () => {
    const sender = new TestTimeSheetSender("tj3ts_sender",);
    const header =
      "timesheet dev 2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000 {";
    const match = sender.filter.exec(header,);
    assertEquals(
      match?.[1],
      "2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000",
    );
    // Não confunde status sheet com time sheet.
    assertEquals(
      sender.filter.exec(
        "statussheet dev 2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000",
      ),
      null,
    );
  });

  it("mailSubject usa a data do período", () => {
    const sender = new TestTimeSheetSender("tj3ts_sender",);
    assertEquals(
      sprintf(sender.subject, "2026-05-18",),
      "Your weekly time sheet template for 2026-05-18",
    );
  });

  it("introText explica como preencher a folha", () => {
    const sender = new TestTimeSheetSender("tj3ts_sender",);
    assertEquals(sender.intro, TIME_SHEET_INTRO_TEXT,);
    assertStringIncludes(sender.intro, "weekly report template",);
    assertStringIncludes(sender.intro, "No quote marks are allowed.",);
  });
});

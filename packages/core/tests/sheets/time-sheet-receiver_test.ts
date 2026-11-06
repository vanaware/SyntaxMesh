/**
 * Testes de `TimeSheetReceiver` (tarefa 18.9).
 *
 * Só configuração: os diretórios do Ruby, o assunto da confirmação e as duas
 * expressões regulares que o `SheetReceiver` (18.7) usa.
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.9)
 */
import { assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type { SheetReceiverType, } from "../../src/sheets/sheet-handler-base.ts";
import { TimeSheetReceiver, } from "../../src/sheets/time-sheet-receiver.ts";

/** Expõe os membros protegidos que os testes precisam observar. */
class TestTimeSheetReceiver extends TimeSheetReceiver {
  get type(): SheetReceiverType {
    return this.sheetType;
  }

  get option(): string {
    return this.tj3clientOption;
  }

  get dirs(): {
    sheet: string;
    template: string;
    mails: string;
    failed: string;
  } {
    return {
      sheet: this.sheetDir,
      template: this.templateDir,
      mails: this.failedMailsDir,
      failed: this.failedSheetsDir,
    };
  }

  get signature(): string {
    return this.signatureFile;
  }

  get subject(): string {
    return this.emailSubject;
  }

  get header(): RegExp {
    return this.sheetHeader;
  }

  get filter(): RegExp {
    return this.signatureFilter;
  }
}

describe("TimeSheetReceiver", () => {
  it("constructor defaults", () => {
    const receiver = new TestTimeSheetReceiver("tj3ts_receiver",);
    assertEquals(receiver.appName, "tj3ts_receiver",);
    assertEquals(receiver.type, "time",);
    assertEquals(receiver.option, "check-ts",);
    assertEquals(receiver.dirs.sheet, "TimeSheets",);
    assertEquals(receiver.dirs.template, "TimeSheetTemplates",);
    assertEquals(receiver.dirs.mails, "TimeSheets/FailedMails",);
    assertEquals(receiver.dirs.failed, "TimeSheets/FailedSheets",);
    assertEquals(
      receiver.signature,
      "TimeSheetTemplates/acceptable_intervals",
    );
    assertEquals(receiver.logFile, "timesheets.log",);
    assertEquals(receiver.subject, "Report from %s for %s",);
  });

  it("sheetHeader captura recurso e fim do período", () => {
    const receiver = new TestTimeSheetReceiver("tj3ts_receiver",);
    const sheet = "timesheet dev 2026-05-11-00:00-+0000 - " +
      "2026-05-18-00:00-+0000 {\n}\n";
    const match = receiver.header.exec(sheet,);
    assertEquals(match?.[1], "dev",);
    assertEquals(match?.[2], "2026-05-18",);
    // Uma folha de status não é um time sheet.
    assertEquals(
      receiver.header.exec(
        "statussheet dev 2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000",
      ),
      null,
    );
  });

  it("signatureFilter casa com o intervalo completo", () => {
    const receiver = new TestTimeSheetReceiver("tj3ts_receiver",);
    const match = receiver.filter.exec(
      "timesheet dev 2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000 {",
    );
    assertEquals(
      match?.[1],
      "2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000",
    );
  });
});

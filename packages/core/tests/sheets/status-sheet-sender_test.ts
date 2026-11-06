/**
 * Testes de `StatusSheetSender`/`StatusSheetReceiver` (tarefa 18.10).
 *
 * O ponto sensível é o `defaulterList`: a lista de quem não entregou o time
 * sheet do período anterior, que o Ruby monta no construtor varrendo
 * `TimeSheets/<data>`. Como o `FileStore` é assíncrono (ADR 037), a varredura
 * acontece no início de `sendTemplates`.
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.10)
 */
import { assertEquals, assertStringIncludes, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type { FileStore, } from "../../src/interfaces/file-store.ts";
import type { SheetType, } from "../../src/sheets/sheet-handler-base.ts";
import { StatusSheetReceiver, } from "../../src/sheets/status-sheet-receiver.ts";
import {
  DEFAULTERS_WARNING_HEADER,
  STATUS_SHEET_INTRO_TEXT,
  StatusSheetSender,
} from "../../src/sheets/status-sheet-sender.ts";
import { fakeOpfs, } from "../helpers/fake-opfs.ts";

/** Expõe o que os testes precisam observar/acionar. */
class TestStatusSheetSender extends StatusSheetSender {
  get type(): SheetType {
    return this.sheetType;
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

  runAddDefaulterWarning() {
    return this.addDefaulterWarning();
  }
}

/** Sender com `date` fixa e store injetado. */
function makeSender(
  store: FileStore,
  date = "2026-05-18",
): TestStatusSheetSender {
  const sender = new TestStatusSheetSender("tj3ts_sender",);
  sender.date = date;
  sender.setFileStore(store,);
  return sender;
}

describe("StatusSheetSender", () => {
  it("constructor defaults", () => {
    const sender = new TestStatusSheetSender("tj3ts_sender",);
    assertEquals(sender.appName, "tj3ts_sender",);
    assertEquals(sender.type, "status",);
    assertEquals(sender.hideResource, "0",);
    assertEquals(sender.template, "StatusSheetTemplates",);
    assertEquals(sender.timeSheetDir, "TimeSheets",);
    assertEquals(
      sender.signature,
      "StatusSheetTemplates/acceptable_intervals",
    );
    assertEquals(sender.logFile, "statussheets.log",);
    assertEquals(sender.subject, "Your weekly status report template for %s",);
    // O aviso de inadimplentes só entra quando há inadimplentes.
    assertEquals(sender.intro, STATUS_SHEET_INTRO_TEXT,);
    assertStringIncludes(sender.intro, "weekly status report template",);
  });

  it("signatureFilter extrai o intervalo do cabeçalho de status", () => {
    const sender = new TestStatusSheetSender("tj3ts_sender",);
    const match = sender.filter.exec(
      "statussheet dev 2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000 {",
    );
    assertEquals(
      match?.[1],
      "2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000",
    );
    assertEquals(
      sender.filter.exec(
        "timesheet dev 2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000",
      ),
      null,
    );
  });

  it("defaulterList vazio sem pastas de time sheet", async () => {
    const sender = makeSender(fakeOpfs(),);
    assertEquals(await sender.defaulterList(), [],);
  });

  it("defaulterList vazio sem missing-reports", async () => {
    const store = fakeOpfs({
      "TimeSheets/2026-05-11/dev_2026-05-11.tji": "sheet",
    },);
    assertEquals(await makeSender(store,).defaulterList(), [],);
  });

  it("defaulterList com missing-reports ignora quem já enviou", async () => {
    const store = fakeOpfs({
      "TimeSheets/2026-05-11/missing-reports": "alice\ndev\n",
      "TimeSheets/2026-05-11/dev_2026-05-11.tji": "sheet",
    },);

    assertEquals(await makeSender(store,).defaulterList(), ["alice",],);
  });

  it("defaulterList usa a última pasta anterior ao fim do período", async () => {
    const store = fakeOpfs({
      "TimeSheets/2026-05-11/missing-reports": "alice\n",
      "TimeSheets/2026-05-25/missing-reports": "bob\n",
    },);

    // 2026-05-18: a pasta de 25/05 é posterior ao período → fica a de 11/05.
    assertEquals(await makeSender(store,).defaulterList(), ["alice",],);
    // Período anterior a todas as pastas → ninguém devendo.
    assertEquals(
      await makeSender(store, "2026-05-04",).defaulterList(),
      [],
    );
  });

  it("addDefaulterWarning anexa o aviso ao introText", async () => {
    const store = fakeOpfs({
      "TimeSheets/2026-05-11/missing-reports": "alice\n",
    },);
    const sender = makeSender(store,);

    await sender.runAddDefaulterWarning();

    assertStringIncludes(sender.intro, DEFAULTERS_WARNING_HEADER,);
    assertStringIncludes(sender.intro, "W A R N I N G",);
    assertStringIncludes(sender.intro, "alice\n",);
  });

  it("addDefaulterWarning não mexe no introText sem inadimplentes", async () => {
    const sender = makeSender(fakeOpfs(),);
    await sender.runAddDefaulterWarning();
    assertEquals(sender.intro, STATUS_SHEET_INTRO_TEXT,);
  });
});

/** Receiver mínimo: expõe a configuração protegida (do `SheetReceiver`). */
class TestStatusSheetReceiver extends StatusSheetReceiver {
  get header(): RegExp {
    return this.sheetHeader;
  }

  get config(): {
    sheetDir: string;
    templateDir: string;
    failedMailsDir: string;
    failedSheetsDir: string;
    signatureFile: string;
    emailSubject: string;
    tj3clientOption: string;
    signatureFilter: RegExp;
  } {
    return {
      sheetDir: this.sheetDir,
      templateDir: this.templateDir,
      failedMailsDir: this.failedMailsDir,
      failedSheetsDir: this.failedSheetsDir,
      signatureFile: this.signatureFile,
      emailSubject: this.emailSubject,
      tj3clientOption: this.tj3clientOption,
      signatureFilter: this.signatureFilter,
    };
  }
}

describe("StatusSheetReceiver", () => {
  it("constructor defaults", () => {
    const receiver = new TestStatusSheetReceiver("tj3ss_receiver",);
    const config = receiver.config;
    assertEquals(receiver.appName, "tj3ss_receiver",);
    assertEquals(config.tj3clientOption, "check-ss",);
    assertEquals(config.sheetDir, "StatusSheets",);
    assertEquals(config.templateDir, "StatusSheetTemplates",);
    assertEquals(config.failedMailsDir, "StatusSheets/FailedMails",);
    assertEquals(config.failedSheetsDir, "StatusSheets/FailedSheets",);
    assertEquals(
      config.signatureFile,
      "StatusSheetTemplates/acceptable_intervals",
    );
    assertEquals(receiver.logFile, "statussheets.log",);
    assertEquals(config.emailSubject, "Status report from %s for %s",);
  });

  it("sheetHeader captura recurso e fim do período", () => {
    const receiver = new TestStatusSheetReceiver("tj3ss_receiver",);
    const match = receiver.header.exec(
      "statussheet dev 2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000 {\n}\n",
    );
    assertEquals(match?.[1], "dev",);
    assertEquals(match?.[2], "2026-05-18",);
  });

  it("signatureFilter casou com o intervalo completo", () => {
    const receiver = new TestStatusSheetReceiver("tj3ss_receiver",);
    const match = receiver.config.signatureFilter.exec(
      "statussheet dev 2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000 {",
    );
    assertEquals(
      match?.[1],
      "2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000",
    );
  });
});

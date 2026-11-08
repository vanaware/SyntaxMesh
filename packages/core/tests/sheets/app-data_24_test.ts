/**
 * Fase 24 (24.2.32) — apps de sheet rodando sobre **dados**.
 *
 * Prova que o caminho do `execute` não depende de disco: os arquivos entram em
 * `SheetAppData.files`, o app roda contra um `MemoryFileStore` semeado e o
 * resultado sai como valor (`files`, `emails`, `attachments`, `log`). A
 * interface `FileStore` (ADR 037) segue valendo para quem chama passo a passo.
 */
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import type { Project, } from "../../src/model/project.ts";
import { ProjectFileParser, } from "../../src/parser/project-file-parser.ts";
import { runSheetAppData, } from "../../src/sheets/app-data.ts";
import {
  SHEET_APP_EXIT_ERROR,
  SHEET_APP_EXIT_OK,
  type SheetAppConfig,
} from "../../src/sheets/apps/app-base.ts";
import { TsReceiverApp, } from "../../src/sheets/apps/ts-receiver-app.ts";
import { TsSenderApp, } from "../../src/sheets/apps/ts-sender-app.ts";
import { TsSummaryApp, } from "../../src/sheets/apps/ts-summary-app.ts";
import { RESOURCE_LIST_FILE, } from "../../src/sheets/sheet-receiver.ts";

const DATE = "2026-05-18";
const TEMPLATE_DIR = "TimeSheetTemplates";
const SHEET_DIR = "TimeSheets";
const SIGNATURE = "2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000";

const CONFIG: SheetAppConfig = {
  _global: { senderEmail: "pm@example.com", smtpServer: "localhost", },
};

const RESOURCES_JSON = JSON.stringify(
  [
    {
      id: "alice",
      name: "Alice",
      email: "alice@example.com",
      effort: 3,
      freeWork: 2,
    },
    {
      id: "dev",
      name: "Developer",
      email: "dev@example.com",
      effort: 0,
      freeWork: 5,
    },
  ],
  null,
  2,
);

/** Projeto de time sheet: dois recursos, um deles com trabalho no período. */
const TJP = `project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {
  timezone "UTC"
  now 2026-05-11
  workinghours mon - fri 9:00 - 17:00
  scenario plan "Plan" {
  }
  trackingscenario plan
}
resource dev "Developer" {
  email "dev@example.com"
}
resource alice "Alice" {
  email "alice@example.com"
}
task t1 "Effort Task" {
  effort 10d
  allocate dev
}
task t2 "Duration Task" {
  start 2026-05-12
  duration 3d
  allocate alice
}
`;

/** Folha entregue por `dev`: válida para o período. */
const SHEET = `timesheet dev 2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000 {
  task t1 {
    work 5d
    remaining 5d
    status green "Worked on t1"
  }
}
# -------->8-------->8--------
`;

/**
 * Template do recurso — a forma legada (`.tji`) que o sender TaskJuggler
 * gerava. A resolução nativa-antes-do-legado prova a compatibilidade (24.2.36).
 */
function templateFor(id: string,): string {
  return `timesheet ${id} 2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000 {
  task t1 {
    work 0d
  }
}
`;
}

function makeProject(): Project {
  const parser = new ProjectFileParser();
  parser.open(TJP, true, true,);
  const project = parser.parse("project",) as Project;
  project.schedule();
  return project;
}

/** Dados que o sender deixou no disco — agora como arquivos do request. */
function summaryFiles() {
  return [
    {
      path: `${TEMPLATE_DIR}/${DATE}/${RESOURCE_LIST_FILE}`,
      content: RESOURCES_JSON,
    },
    {
      path: `${TEMPLATE_DIR}/${DATE}/dev_${DATE}.tji`,
      content: templateFor("dev",),
    },
    {
      path: `${TEMPLATE_DIR}/${DATE}/alice_${DATE}.tji`,
      content: templateFor("alice",),
    },
    {
      path: `${TEMPLATE_DIR}/acceptable_intervals`,
      content: `${SIGNATURE}\n`,
    },
    { path: `${SHEET_DIR}/${DATE}/dev_${DATE}.tji`, content: SHEET, },
  ];
}

describe("runSheetAppData — sender sem disco (24.2.32)", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("gera templates e emails como dados, sem FileStore injetado pelo chamador", async () => {
    const app = new TsSenderApp({
      endDate: DATE,
      dryRun: true,
      config: CONFIG,
    },);

    const result = await runSheetAppData(app, makeProject(),);

    assertEquals(result.exitCode, SHEET_APP_EXIT_OK,);
    assertEquals(
      result.emails.map((mail,) => mail.to),
      ["alice@example.com", "dev@example.com",],
    );
    // A saída do app vira `files`: o store efêmero guarda o que foi gerado.
    const paths = result.files.map((file,) => file.path);
    assert(
      paths.includes(`${TEMPLATE_DIR}/${DATE}/dev_${DATE}.smx`,),
      JSON.stringify(paths,),
    );
    assert(paths.includes(`${TEMPLATE_DIR}/${DATE}/${RESOURCE_LIST_FILE}`,),);
    assert(paths.includes(`${TEMPLATE_DIR}/acceptable_intervals`,),);
  });

  it("os anexos saem materializados em {name, contents}", async () => {
    const app = new TsSenderApp({
      endDate: DATE,
      dryRun: true,
      config: CONFIG,
    },);

    const { attachments, } = await runSheetAppData(app, makeProject(),);

    assertEquals(
      attachments.map((attachment,) => attachment.name),
      [`alice_${DATE}.smx`, `dev_${DATE}.smx`,],
    );
    assertStringIncludes(attachments[1]!.contents, "timesheet dev",);
  });

  it("a saída é dado puro: structuredClone passa e nada de instâncias", async () => {
    const app = new TsSenderApp({
      endDate: DATE,
      dryRun: true,
      config: CONFIG,
    },);

    const result = await runSheetAppData(app, makeProject(),);
    const clone = structuredClone({
      exitCode: result.exitCode,
      files: result.files,
      attachments: result.attachments,
      log: result.log,
    },);

    assertEquals(clone.files.length, result.files.length,);
    assertEquals(
      JSON.parse(JSON.stringify(result.files,),).length,
      result.files.length,
    );
  });
});

describe("runSheetAppData — leituras vêm do request (24.2.32)", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("o summary lê templates, assinatura e folha dos dados", async () => {
    const app = new TsSummaryApp({
      endDate: DATE,
      dryRun: true,
      config: CONFIG,
      sheetRecipients: ["lead@example.com",],
      digestRecipients: ["boss@example.com",],
    },);

    const result = await runSheetAppData(app, makeProject(), {
      files: summaryFiles(),
    },);

    assertEquals(result.exitCode, SHEET_APP_EXIT_OK,);
    assert(result.emails.some((mail,) => mail.to === "lead@example.com"),);
    const digest = result.emails.find((mail,) =>
      mail.to === "boss@example.com"
    );
    assert(digest !== undefined,);
    assertStringIncludes(digest!.text, "have not yet submitted",);
  });

  it("sem o dado da folha, o summary não inventa arquivo", async () => {
    const app = new TsSummaryApp({
      endDate: DATE,
      dryRun: true,
      config: CONFIG,
      sheetRecipients: ["lead@example.com",],
      digestRecipients: ["boss@example.com",],
    },);

    const files = summaryFiles().filter((file,) =>
      !file.path.startsWith(`${SHEET_DIR}/`,)
    );
    const result = await runSheetAppData(app, makeProject(), { files, },);

    // `dev` consta como pendente — nada é lido de disco para "completar".
    const digest = result.emails.find((mail,) =>
      mail.to === "boss@example.com"
    );
    assert(digest !== undefined,);
    assertStringIncludes(digest!.text, "have not yet submitted",);
    assertStringIncludes(digest!.text, "Developer",);
    // O único artefato criado é o registro de pendências do próprio app —
    // nenhuma folha aparece "do nada" a partir de disco.
    const created = result.files
      .map((file,) => file.path)
      .filter((path,) => !files.some((file,) => file.path === path));
    assertEquals(created, [`${SHEET_DIR}/${DATE}/missing-reports`,],);
  });
});

describe("runSheetAppData — falhas e log (24.2.32)", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("receiver sem mensagem falha antes de tocar o store", async () => {
    const app = new TsReceiverApp({
      endDate: DATE,
      dryRun: true,
      config: CONFIG,
    },);

    const result = await runSheetAppData(app, makeProject(),);

    assertEquals(result.exitCode, SHEET_APP_EXIT_ERROR,);
    assertEquals(result.emails.length, 0,);
    assertEquals(result.files.length, 0,);
    assert(
      MessageHandlerInstance.instance.messages.some((message,) =>
        message.message.includes("No email text provided on the input",)
      ),
      // `message.sourceFileInfo` tem ciclos (projeto) — não dá para serializar.
      MessageHandlerInstance.instance.messages.map((message,) =>
        message.message
      )
        .join(" | ",),
    );
  });

  it("o log em memória acompanha o resultado", async () => {
    const app = new TsSenderApp({
      endDate: DATE,
      dryRun: true,
      config: CONFIG,
    },);

    const result = await runSheetAppData(app, makeProject(),);

    assert(result.log.length > 0,);
    assert(
      result.log.every((entry,) => typeof entry.timestamp === "string"),
    );
  });
});

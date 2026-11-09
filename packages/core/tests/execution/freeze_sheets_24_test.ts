/**
 * Fase 24 (24.9.4/24.9.5 + 24.10.1–24.10.3) — freeze e apps de sheet no
 * envelope.
 *
 * `TaskJuggler.freeze` devolve os dois artefatos do `tj3 --freeze` (include de
 * header + export dos bookings) como **dado**; a seção `results.freeze` os
 * repassa e a CLI é quem grava (24.9.5). Os cinco apps de sheet rodam sobre o
 * `MemoryFileStore` efêmero e saem em `results.sheet` (emails completos,
 * anexos, resumo e arquivos criados) — sem SMTP e sem disco (ADR 036/037).
 *
 * @see docs/taskjuggler/lib/taskjuggler/TaskJuggler.rb:freeze
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3
 */
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { execute, } from "../../src/execution/execute.ts";
import { type ExecutionRequest, } from "../../src/execution/types.ts";
import { parseEmailMessage, } from "../../src/sheets/email-message.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { TaskJuggler, } from "../../src/taskjuggler.ts";
import type { SheetAppConfig, } from "../../src/sheets/apps/app-base.ts";
// Efeito colateral: registra as fábricas de conteúdo dos relatórios.
import "../../src/reports/mod.ts";

/** Projeto com `trackingscenario` e trabalho alocado em `dev`. */
const PROJECT = `project prj "Freeze" "1.0" 2026-01-01 - 2026-12-31 {
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
task t1 "Effort Task" {
  effort 5d
  allocate dev
}
taskreport first "Tarefas" {
  formats csv
}
`;

/** Mesmo projeto sem `trackingscenario` — pré-requisito do freeze. */
const NO_TRACKING = PROJECT.replace("  trackingscenario plan\n", "",);

const DATE = "2026-05-18";
const CONFIG: SheetAppConfig = {
  _global: { senderEmail: "pm@example.com", smtpServer: "localhost", },
};

/** Lista de recursos que o sender deixaria no disco (agora dado do request). */
const RESOURCES_JSON = JSON.stringify(
  [{
    id: "dev",
    name: "Developer",
    email: "dev@example.com",
    effort: 0,
    freeWork: 5,
  },],
  null,
  2,
);

/** Fechamento de leitura do `ts summary` (24.10.3). */
function summarySeed() {
  return [
    {
      path: `TimeSheetTemplates/${DATE}/resources.json`,
      content: RESOURCES_JSON,
    },
    {
      path: `TimeSheetTemplates/${DATE}/dev_${DATE}.tji`,
      content:
        `timesheet dev 2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000 {\n  task t1 {\n    work 0d\n  }\n}\n`,
    },
  ];
}

function request(overrides: Partial<ExecutionRequest> = {},): ExecutionRequest {
  return {
    files: [{ path: "proj.tjp", content: PROJECT, },],
    ...overrides,
  };
}

describe("TaskJuggler.freeze — header + bookings (24.9.4)", () => {
  let tj: TaskJuggler;

  beforeEach(async () => {
    MessageHandlerInstance.instance.reset();
    tj = new TaskJuggler();
    const ok = await tj.parse(["proj.tjp",], () => PROJECT,);
    assert(ok, "parse falhou",);
    assert(tj.schedule(), "schedule falhou",);
    MessageHandlerInstance.instance.reset();
  },);

  it("gera os dois artefatos derivados do master", () => {
    const frozen = tj.freeze(DATE, false,);

    assert(frozen !== null,);
    assertEquals(
      frozen!.files.map((file,) => file.fileName),
      ["proj-header.tji", "proj-bookings.tji",],
    );
    // O header entra como include do master: `now` cheio, com offset.
    assertEquals(frozen!.files[0]!.contents, `now ${DATE}-00:00-+0000\n`,);
    assertStringIncludes(
      frozen!.files[1]!.contents,
      "supplement resource dev {",
    );
    assertStringIncludes(frozen!.files[1]!.contents, "booking t1 ",);
  });

  it("--freeze-by-task agrupa por tarefa em vez de recurso", () => {
    const frozen = tj.freeze(DATE, true,);

    assert(frozen !== null,);
    const bookings = frozen!.files[1]!.contents;
    assertStringIncludes(bookings, "supplement task t1 {",);
    assertStringIncludes(bookings, "booking dev ",);
    assert(!bookings.includes("supplement resource",), bookings,);
  });

  it("a data de corte limita os bookings exportados", () => {
    // 5 dias de 8h a partir de 2026-01-01; cortando em 01-03 sobram dois.
    const frozen = tj.freeze("2026-01-03", false,);

    assert(frozen !== null,);
    const bookings = frozen!.files[1]!.contents;
    assertStringIncludes(bookings, "2026-01-01 + 8h",);
    assertStringIncludes(bookings, "2026-01-02 + 8h",);
    assert(!bookings.includes("2026-01-05",), bookings,);
  });

  it("o relatório sintético não fica no projeto", () => {
    const before = tj.project!.reports.toArray().length;
    tj.freeze(DATE, false,);

    assertEquals(tj.project!.reports.toArray().length, before,);
    assert(
      !tj.project!.reports.toArray().some((item,) => item.id === "_bookings_"),
    );
  });

  it("data inválida vira tj3_ivld_freeze_date e null", () => {
    const frozen = tj.freeze("ontem", false,);

    assertEquals(frozen, null,);
    assert(
      MessageHandlerInstance.instance.messages.some((message,) =>
        message.id === "tj3_ivld_freeze_date"
      ),
    );
  });

  it("sem trackingscenario devolve null com o critical do Ruby", async () => {
    const other = new TaskJuggler();
    const ok = await other.parse(["proj.tjp",], () => NO_TRACKING,);
    assert(ok,);
    assert(other.schedule(),);
    MessageHandlerInstance.instance.reset();

    assertEquals(other.freeze(DATE, false,), null,);
    assert(
      MessageHandlerInstance.instance.messages.some((message,) =>
        message.id === "no_tracking_scen"
      ),
      JSON.stringify(
        MessageHandlerInstance.instance.messages.map((message,) => message.id),
      ),
    );
  });
});

describe("execute — seção freeze (24.9.4)", () => {
  it("devolve os artefatos e segue para os relatórios", async () => {
    MessageHandlerInstance.instance.reset();
    const result = await execute(request({ freeze: { date: DATE, }, },),);

    assertEquals(result.exitCode, 0,);
    assertEquals(result.results.freeze!.files.length, 2,);
    assertStringIncludes(
      result.results.freeze!.files[0]!.contents,
      "now 2026-05-18-00:00",
    );
    // Ruby: depois do freeze o pipeline normal continua.
    assert(result.results.reports !== undefined,);
  });

  it("--no-reports para no freeze", async () => {
    MessageHandlerInstance.instance.reset();
    const result = await execute(request({
      freeze: { date: DATE, },
      noReports: true,
    },),);

    assertEquals(result.exitCode, 0,);
    assertEquals(result.results.freeze!.files.length, 2,);
    assertEquals(result.results.reports, undefined,);
  });

  it("data inválida falha o comando com a mensagem do core", async () => {
    MessageHandlerInstance.instance.reset();
    const result = await execute(request({ freeze: { date: "ontem", }, },),);

    assertEquals(result.exitCode, 1,);
    assertEquals(result.results.freeze, undefined,);
    assert(
      result.messages.some((message,) => message.id === "tj3_ivld_freeze_date"),
    );
  });
});

describe("execute — apps de sheet como dados (24.10.1–24.10.3)", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("ts-send devolve emails completos e os templates criados", async () => {
    const result = await execute(request({
      app: "ts-send",
      appOptions: { endDate: DATE, dryRun: true, config: CONFIG, },
    },),);

    assertEquals(result.exitCode, 0,);
    const sheet = result.results.sheet!;
    assertEquals(sheet.app, "ts-send",);
    assertEquals(sheet.exitCode, 0,);
    assert(sheet.emails !== undefined && sheet.emails.length > 0,);
    // `text` é o RFC 822 integral: cabeçalhos + corpo.
    assertStringIncludes(sheet.emailText!, "Subject:",);
    assertStringIncludes(sheet.emailText!, "X-TaskJuggler:",);
    // …e volta a abrir: corpo e anexo decodificados (24.10.1).
    const parsed = parseEmailMessage(sheet.emailText!,);
    assertStringIncludes(parsed.content, "weekly report template",);
    assertEquals(parsed.attachments.map((part,) => part.fileName), [
      `dev_${DATE}.smx`,
    ],);
    assertEquals(
      parsed.attachments[0]!.content,
      sheet.attachments![0]!.contents,
    );
    // Só o que nasceu de fato entra em `files` (delta contra a semente).
    assert(
      sheet.files!.some((file,) => file.name.endsWith(".smx",)),
      JSON.stringify(sheet.files!.map((file,) => file.name),),
    );
  });

  it("ts-summary devolve o resumo em summaryText", async () => {
    const result = await execute(request({
      app: "ts-summary",
      appOptions: {
        endDate: DATE,
        dryRun: true,
        config: CONFIG,
        files: summarySeed(),
        digestRecipients: ["boss@example.com",],
      },
    },),);

    assertEquals(result.exitCode, 0,);
    const sheet = result.results.sheet!;
    assertStringIncludes(sheet.summaryText!, "To: boss@example.com",);
    // O resumo também aparece na lista completa de mensagens.
    assert(
      sheet.emails!.some((mail,) => mail.to === "boss@example.com"),
      JSON.stringify(sheet.emails!.map((mail,) => mail.to),),
    );
  });

  it("receiver sem mensagem crua falha sem inventar arquivo", async () => {
    const result = await execute(request({
      app: "ts-receive",
      appOptions: { endDate: DATE, dryRun: true, config: CONFIG, },
    },),);

    assertEquals(result.exitCode, 1,);
    assertEquals(result.results.sheet!.exitCode, 1,);
    assertEquals(result.results.sheet!.emails, undefined,);
    assert(
      result.messages.some((message,) =>
        message.text.includes("No email text provided on the input",)
      ),
      JSON.stringify(result.messages.map((message,) => message.text),),
    );
  });
});

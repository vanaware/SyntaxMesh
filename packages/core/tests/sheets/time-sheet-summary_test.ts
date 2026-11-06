/**
 * Testes de `TimeSheetSummary` (tarefa 18.11).
 *
 * O Ruby compilava o resumo chamando `tj3client check-ts` por subprocesso e
 * mandava tudo por SMTP. Aqui a validação roda in-process sobre o `Project` e
 * cada email vira um `.eml` na `outbox/` (ADR 036/037), então os testes leem o
 * que "saiu" com o parser MIME de `email-message.ts`.
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.11)
 */
import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { beforeEach, describe, it, } from "@std/testing/bdd";
import type { FileStore, } from "../../src/interfaces/file-store.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { TjRuntimeError, } from "../../src/model/errors.ts";
import type { Project, } from "../../src/model/project.ts";
import { ProjectFileParser, } from "../../src/parser/project-file-parser.ts";
import {
  type ParsedEmailMessage,
  parseEmailMessage,
} from "../../src/sheets/email-message.ts";
import { RESOURCE_LIST_FILE, } from "../../src/sheets/sheet-receiver.ts";
import {
  DEFAULTER_HEADER,
  REMINDER_TEXT,
  RESOURCE_INTRO,
  TimeSheetSummary,
} from "../../src/sheets/time-sheet-summary.ts";
import { fakeOpfs, } from "../helpers/fake-opfs.ts";

/** Relógio fixo: o nome do `.eml` da outbox depende dele. */
const FIXED_NOW = new Date(2026, 4, 18, 10, 0, 0,);
const DATE = "2026-05-18";
const TEMPLATE_DIR = "TimeSheetTemplates";
const SHEET_DIR = "TimeSheets";
/** Assinatura (intervalo) aceita — a mesma que o sender registra. */
const SIGNATURE = "2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000";

/** Lista de recursos como o `SheetSender` grava (18.6). */
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

/** Template do recurso — é o `.tji` que o sender gera e envia (18.6). */
function templateFor(id: string,): string {
  return `timesheet ${id} 2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000 {
  task t1 {
    work 0d
  }
}
`;
}

/** Folha entregue por `dev`: válida para o período. */
const SHEET = `timesheet dev 2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000 {
  task t1 {
    work 5d
    remaining 5d
    status green "Worked on t1"
  }
}
`;

/** Folha sintaticamente válida, mas incompleta: `t1` sem `remaining`. */
const BAD_SHEET =
  `timesheet dev 2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000 {
  task t1 {
    work 5d
  }
}
`;

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
`;

/** Parse + schedule do projeto de teste. */
function makeProject(): Project {
  const parser = new ProjectFileParser();
  parser.open(TJP, true, true,);
  const project = parser.parse("project",) as Project;
  project.schedule();
  return project;
}

/** Store com a lista de recursos e os dois templates do período. */
function makeStore(extra: Record<string, string> = {},): FileStore & {
  files: Map<string, string>;
  dirs: Set<string>;
} {
  return fakeOpfs({
    [`${TEMPLATE_DIR}/${DATE}/${RESOURCE_LIST_FILE}`]: RESOURCES_JSON,
    [`${TEMPLATE_DIR}/${DATE}/dev_${DATE}.tji`]: templateFor("dev",),
    [`${TEMPLATE_DIR}/${DATE}/alice_${DATE}.tji`]: templateFor("alice",),
    [`${TEMPLATE_DIR}/acceptable_intervals`]: `${SIGNATURE}\n`,
    ...extra,
  },);
}

/** Summary pronto: relógio fixo e `senderEmail` válido.
 *
 * O `date` é definido pelo app (18.18), nunca pelo construtor — daí o
 * `makeSummary` abaixo.
 */
class TestSummary extends TimeSheetSummary {
  constructor() {
    super("tj3ts_summary",);
    this.senderEmail = "pm@example.com";
    this.smtpServer = "localhost";
    this.clock = () => FIXED_NOW;
  }

  get dirs(): { templates: string; sheets: string } {
    return { templates: this.templateDir, sheets: this.sheetDir, };
  }

  runGetResourceJournal(sheetFile: string,) {
    return this.getResourceJournal(sheetFile,);
  }

  runSendReminder(id: string, name: string, email: string,) {
    return this.sendReminder(id, name, email,);
  }
}

/** Summary ligado a um store (e, por padrão, ao projeto agendado). */
function makeSummary(
  store: FileStore,
  project: Project = makeProject(),
): TestSummary {
  const summary = new TestSummary();
  summary.date = DATE;
  summary.setFileStore(store,);
  summary.setProject(project,);
  return summary;
}

/** Emails escritos na `outbox/`, já parseados. */
function outbox(
  store: { files: Map<string, string> },
): Map<string, ParsedEmailMessage> {
  const result = new Map<string, ParsedEmailMessage>();
  for (const [path, raw,] of store.files) {
    if (path.startsWith("outbox/",)) result.set(path, parseEmailMessage(raw,),);
  }
  return result;
}

/** Emails da outbox endereçados a `to`. */
function emailsTo(
  store: { files: Map<string, string> },
  to: string,
): ParsedEmailMessage[] {
  return [...outbox(store,).entries(),]
    .filter(([path,],) => path.includes(`/${to}_`,))
    .map(([, mail,],) => mail);
}

describe("TimeSheetSummary", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("constructor aplica os defaults do Ruby", () => {
    const summary = new TestSummary();
    assertEquals(summary.appName, "tj3ts_summary",);
    assertEquals(summary.date, null,);
    assertEquals(summary.sheetRecipients, [],);
    assertEquals(summary.digestRecipients, [],);
    assertEquals(summary.hideResource, "0",);
    assertEquals(summary.dirs.templates, "TimeSheetTemplates",);
    assertEquals(summary.dirs.sheets, "TimeSheets",);
    assertEquals(summary.logFile, "timesheets.log",);
    assertEquals(summary.resourceIntro, RESOURCE_INTRO,);
    assertEquals(summary.resourceSheetSubject, "Weekly report %s",);
    assertEquals(summary.summarySubject, "Weekly staff reports %s",);
    assertEquals(
      summary.reminderSubject,
      "Your time sheet for the period ending %s is overdue!",
    );
    assertEquals(summary.reminderText, REMINDER_TEXT,);
    assertStringIncludes(summary.reminderText, "deadline",);
    assertEquals(summary.defaulterHeader, DEFAULTER_HEADER,);
    assertStringIncludes(summary.defaulterHeader, "%d person(s)",);
  });

  it("sendSummary sem folhas registra todos como inadimplentes", async () => {
    const store = makeStore();
    const summary = makeSummary(store,);

    await summary.sendSummary();

    const missing = await store.read(`${SHEET_DIR}/${DATE}/missing-reports`,);
    assertEquals(missing, "alice\ndev\n",);
    // Sem folhas entregues a única coisa que sai são as duas cobranças.
    const mails = [...outbox(store,).values(),];
    assertEquals(mails.length, 2,);
    for (const mail of mails) {
      assertStringIncludes(mail.subject, "is overdue!",);
    }
  });

  it("sendSummary com folha monta o resumo e envia aos digestRecipients", async () => {
    const store = makeStore({
      [`${SHEET_DIR}/${DATE}/dev_${DATE}.tji`]: SHEET,
    },);
    const summary = makeSummary(store,);
    summary.digestRecipients = ["boss@example.com",];

    await summary.sendSummary();

    const mails = emailsTo(store, "boss@example.com",);
    assertEquals(mails.length, 1,);
    const mail = mails[0];
    assert(mail !== undefined,);
    assertEquals(mail.subject, `Weekly staff reports ${DATE}`,);
    // A seção do recurso entra com o título RichText e o conteúdo da folha.
    assertStringIncludes(mail.content, "Weekly Report from Developer",);
    assertStringIncludes(mail.content, "work 5d",);
    // E a lista de inadimplentes abre o resumo.
    assertStringIncludes(mail.content, "The following 1 person(s)",);
    assertStringIncludes(mail.content, "Alice",);
  });

  it("sendSummary envia a folha individual aos sheetRecipients", async () => {
    const store = makeStore({
      [`${SHEET_DIR}/${DATE}/dev_${DATE}.tji`]: SHEET,
    },);
    const summary = makeSummary(store,);
    summary.sheetRecipients = ["lead@example.com",];

    await summary.sendSummary();

    const mails = emailsTo(store, "lead@example.com",);
    assertEquals(mails.length, 1,);
    const mail = mails[0];
    assert(mail !== undefined,);
    assertEquals(mail.subject, `Weekly report ${DATE}`,);
    // O remetente é o próprio recurso (Ruby passa "Nome <email>"); o parser
    // normaliza o endereço e mantém o nome só no cabeçalho.
    assertEquals(mail.from, "dev@example.com",);
    assertStringIncludes(mail.headers["from"] ?? "", "Developer",);
    assertStringIncludes(mail.content, "work 5d",);
  });

  it("sendSummary só lista em missing-reports quem não entregou", async () => {
    const store = makeStore({
      [`${SHEET_DIR}/${DATE}/dev_${DATE}.tji`]: SHEET,
    },);
    const summary = makeSummary(store,);

    await summary.sendSummary();

    const missing = await store.read(`${SHEET_DIR}/${DATE}/missing-reports`,);
    assertEquals(missing, "alice\n",);
  });

  it("sendSummary respeita a restrição a resourceIds", async () => {
    const store = makeStore();
    const summary = makeSummary(store,);

    await summary.sendSummary(["dev",],);

    const missing = await store.read(`${SHEET_DIR}/${DATE}/missing-reports`,);
    assertEquals(missing, "dev\n",);
  });

  it("sendSummary ignora quem não tem template no período", async () => {
    // Lista com um terceiro recurso que nunca recebeu template.
    const resources = JSON.parse(RESOURCES_JSON,) as unknown[];
    resources.push({
      id: "ghost",
      name: "Ghost",
      email: "ghost@example.com",
      effort: 0,
      freeWork: 0,
    },);
    const store = makeStore({
      [`${TEMPLATE_DIR}/${DATE}/${RESOURCE_LIST_FILE}`]: JSON.stringify(
        resources,
      ),
    },);
    const summary = makeSummary(store,);

    await summary.sendSummary();

    const missing = await store.read(`${SHEET_DIR}/${DATE}/missing-reports`,);
    assertEquals(missing, "alice\ndev\n",);
    assertEquals(missing.includes("ghost",), false,);
  });

  it("sendSummary cobra cada inadimplente com o template anexado", async () => {
    const store = makeStore();
    const summary = makeSummary(store,);

    await summary.sendSummary();

    const mails = emailsTo(store, "alice@example.com",);
    assertEquals(mails.length, 1,);
    const mail = mails[0];
    assert(mail !== undefined,);
    assertEquals(
      mail.subject,
      `Your time sheet for the period ending ${DATE} is overdue!`,
    );
    assertStringIncludes(mail.content, "Hello Alice!",);
    assertStringIncludes(
      mail.content,
      "deadline for your time sheet submission has passed",
    );
    // O anexo é o template do período, como o Ruby passava a `sendEmail`.
    assertEquals(mail.attachments.length, 1,);
    assertEquals(mail.attachments[0]?.fileName, `alice_${DATE}.tji`,);
    assertStringIncludes(
      mail.attachments[0]?.content ?? "",
      "timesheet alice",
    );
  });

  it("sendSummary sem reminderText não cobra ninguém", async () => {
    const store = makeStore();
    const summary = makeSummary(store,);
    summary.reminderText = "";

    await summary.sendSummary();

    assertEquals(outbox(store,).size, 0,);
    // A lista de inadimplentes continua sendo gravada.
    const missing = await store.read(`${SHEET_DIR}/${DATE}/missing-reports`,);
    assertEquals(missing, "alice\ndev\n",);
  });

  it("getResourceJournal devolve a folha em <nowiki>", async () => {
    const store = makeStore({
      [`${SHEET_DIR}/${DATE}/dev_${DATE}.tji`]: SHEET,
    },);
    const summary = makeSummary(store,);

    const journal = await summary.runGetResourceJournal(
      `${SHEET_DIR}/${DATE}/dev_${DATE}.tji`,
    );

    assertEquals(journal.startsWith("<nowiki>",), true,);
    assertEquals(journal.endsWith("</nowiki>",), true,);
    assertStringIncludes(journal, "timesheet dev",);
    assertEquals(MessageHandlerInstance.instance.errors, 0,);
  });

  it("getResourceJournal rejeita folha com erros", async () => {
    const store = makeStore({
      [`${SHEET_DIR}/${DATE}/dev_${DATE}.tji`]: BAD_SHEET,
    },);
    const summary = makeSummary(store,);

    await assertRejects(
      () =>
        summary.runGetResourceJournal(`${SHEET_DIR}/${DATE}/dev_${DATE}.tji`,),
      TjRuntimeError,
      "summary sheets",
    );
  });

  it("getResourceJournal sem arquivo levanta erro fatal", async () => {
    const store = makeStore();
    const summary = makeSummary(store,);

    await assertRejects(
      () => summary.runGetResourceJournal(`${SHEET_DIR}/${DATE}/nobody.tji`,),
      TjRuntimeError,
      "Cannot summarize sheet",
    );
  });

  it("sendReminder anexa o template e usa o assunto de cobrança", async () => {
    const store = makeStore();
    const summary = makeSummary(store,);

    await summary.runSendReminder("alice", "Alice", "alice@example.com",);

    const mails = emailsTo(store, "alice@example.com",);
    assertEquals(mails.length, 1,);
    const mail = mails[0];
    assert(mail !== undefined,);
    assertEquals(
      mail.subject,
      `Your time sheet for the period ending ${DATE} is overdue!`,
    );
    assertStringIncludes(mail.content, "Hello Alice!",);
    assertEquals(mail.attachments[0]?.fileName, `alice_${DATE}.tji`,);
  });

  it("sendReminder sem template levanta erro", async () => {
    const store = makeStore();
    const summary = makeSummary(store,);

    await assertRejects(
      () => summary.runSendReminder("ghost", "Ghost", "ghost@example.com",),
      TjRuntimeError,
      "not found",
    );
  });
});

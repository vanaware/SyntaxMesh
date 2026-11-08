/**
 * Testes de `SheetSender` (tarefa 18.6).
 *
 * O Ruby chamava `tj3client` por subprocesso para gerar os relatórios; aqui o
 * mesmo pipeline roda in-process (`ProjectFileParser.parseReportList` +
 * `Project#generateReport`) sobre um `fakeOpfs()` (ADR 036/037).
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.6)
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
  type SheetResourceInfo,
  type SheetType,
  sprintf,
} from "../../src/sheets/sheet-handler-base.ts";
import {
  localDate,
  RESOURCE_LIST_REPORT_ID,
  SheetSender,
} from "../../src/sheets/sheet-sender.ts";
import { fakeOpfs, } from "../helpers/fake-opfs.ts";

/** Data local fixa (10h evita virada de dia em qualquer fuso). */
const FIXED_NOW = new Date(2026, 4, 18, 10, 0, 0,);
/** `YYYY-MM-DD` do relógio acima, sempre em hora local. */
const DATE = "2026-05-18";

const TEMPLATE_DIR = "TimeSheetTemplates";

/** Projeto mínimo: dois recursos com email, um deles com trabalho no período. */
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

/** Projeto com `responsible` explícito — necessário para o status sheet. */
const STATUS_TJP = `project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {
  timezone "UTC"
  now 2026-05-11
  workinghours mon - fri 9:00 - 17:00
  scenario plan "Plan" {
  }
  trackingscenario plan
}
resource alice "Alice" {
  email "alice@example.com"
}
task t2 "Duration Task" {
  start 2026-05-12
  duration 3d
  allocate alice
  responsible alice
}
`;

/** Parse + schedule do projeto de status sheet. */
function makeStatusProject(): Project {
  const parser = new ProjectFileParser();
  parser.open(STATUS_TJP, true, true,);
  const project = parser.parse("project",) as Project;
  project.schedule();
  return project;
}

/** Parse + schedule do projeto de teste. */
function makeProject(): Project {
  const parser = new ProjectFileParser();
  parser.open(TJP, true, true,);
  const project = parser.parse("project",) as Project;
  project.schedule();
  return project;
}

/** Sender concreto mínimo, com os helpers protegidos expostos aos testes. */
class TestSender extends SheetSender {
  constructor(type: SheetType = "time",) {
    super("tj3ts_sender", type,);
    this.hideResource = "0";
    this.templateDir = TEMPLATE_DIR;
    this.signatureFile = `${TEMPLATE_DIR}/acceptable_intervals`;
    this.signatureFilter =
      /^[ ]*timesheet\s[a-zA-Z_][a-zA-Z0-9_]*\s([0-9:\-+]*\s-\s[0-9:\-+]*)/u;
    this.introText = "Please fill out your report.\n\n";
    this.mailSubject = "Your weekly time sheet template for %s";
  }

  runCreateDirectories() {
    return this.createDirectories();
  }

  runGenResourceList(ids: string[],) {
    return this.genResourceList(ids,);
  }

  runGenTemplates(resources: SheetResourceInfo[],) {
    return this.genTemplates(resources,);
  }

  runSendReportTemplates(resources: SheetResourceInfo[],) {
    return this.sendReportTemplates(resources,);
  }

  runEnableSignature(templateFile: string,) {
    return this.enableSignatureForReporting(templateFile,);
  }

  runGenerateReport(id: string, reportDef: string,) {
    return this.generateReport(id, reportDef,);
  }

  get templateDirectory(): string {
    return this.templateDir;
  }

  setSignatureFilter(filter: RegExp,): void {
    this.signatureFilter = filter;
  }

  /** Injeta o relógio **antes** de qualquer uso (fixa `date` e `timeStamp`). */
  setClock(clock: () => Date,): void {
    this.clock = clock;
    this.date = localDate(clock(),);
    this.timeStamp = clock();
  }
}

/** Sender pronto para uso: relógio fixo, store em memória e projeto agendado. */
function makeSender(
  store: FileStore = fakeOpfs(),
  project: Project = makeProject(),
  type: SheetType = "time",
): TestSender {
  const sender = new TestSender(type,);
  sender.setClock(() => FIXED_NOW);
  sender.senderEmail = "pm@example.com";
  sender.setFileStore(store,);
  sender.setProject(project,);
  // Sem `outbox/`: os testes observam o retorno de `sendEmail` no log.
  sender.dryRun = true;
  return sender;
}

/** Conteúdo do único email enviado, do log em memória. */
function emailLogMessages(sender: TestSender,): string[] {
  return sender.logEntries
    .filter((entry,) => entry.message.startsWith("Show email",))
    .map((entry,) => entry.message);
}

describe("SheetSender", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("constructor aplica os defaults do Ruby", () => {
    const sender = new SheetSender("tj3ts_sender", "time",);
    assertEquals(sender.appName, "tj3ts_sender",);
    assertEquals(sender.date, localDate(new Date(),),);
    assert(/^\d{4}-\d{2}-\d{2}$/u.test(sender.date,),);
    assertEquals(sender.intervalDuration, "1w",);
    assertEquals(sender.force, false,);
    assertEquals(sender.project, null,);
    assertEquals(sender.dryRun, false,);
  });

  it("setProject guarda o projeto alvo", () => {
    const sender = new SheetSender("tj3ts_sender", "status",);
    const project = makeProject();
    sender.setProject(project,);
    assert(sender.project === project,);
  });

  it("createDirectories cria <templateDir>/<date>", async () => {
    const store = fakeOpfs();
    const sender = makeSender(store,);
    await sender.runCreateDirectories();
    assertEquals(store.dirs.has(`${TEMPLATE_DIR}/${DATE}`,), true,);
    assertEquals(sender.templateDirectory, `${TEMPLATE_DIR}/${DATE}`,);
  });

  it("createDirectories é idempotente (não empilha datas)", async () => {
    const store = fakeOpfs({ [`${TEMPLATE_DIR}/${DATE}/`]: "", },);
    const sender = makeSender(store,);
    await sender.runCreateDirectories();
    await sender.runCreateDirectories();
    assertEquals(sender.templateDirectory, `${TEMPLATE_DIR}/${DATE}`,);
  });

  it("genResourceList monta a lista com 2 recursos", async () => {
    const sender = makeSender();
    await sender.runCreateDirectories();
    const list = await sender.runGenResourceList([],);
    assertEquals(list.map((r,) => r.id), ["alice", "dev",],);
    const dev = list.find((r,) => r.id === "dev")!;
    assertEquals(dev.name, "Developer",);
    assertEquals(dev.email, "dev@example.com",);
    // `t1` só começa depois do período; `dev` fica livre a semana toda.
    assertEquals(dev.effort, 0,);
    assertEquals(dev.freeWork, 5,);
    const alice = list.find((r,) => r.id === "alice")!;
    assertEquals(alice.effort, 3,);
  });

  it("genResourceList filtra pelos IDs pedidos", async () => {
    const sender = makeSender();
    await sender.runCreateDirectories();
    const list = await sender.runGenResourceList(["dev",],);
    assertEquals(list.map((r,) => r.id), ["dev",],);
  });

  it("genResourceList sem recurso algum lança erro", async () => {
    const sender = makeSender();
    await sender.runCreateDirectories();
    await assertRejects(
      () => sender.runGenResourceList(["ninguem",],),
      TjRuntimeError,
      "genResourceList: list is empty",
    );
  });

  it("genResourceList exige email válido", async () => {
    const parser = new ProjectFileParser();
    parser.open(
      `project prj "T" "1.0" 2026-01-01 - 2026-12-31 {
  timezone "UTC"
  now 2026-05-11
  workinghours mon - fri 9:00 - 17:00
}
resource ghost "Ghost" {
}
`,
      true,
      true,
    );
    const project = parser.parse("project",) as Project;
    project.schedule();
    const sender = makeSender(fakeOpfs(), project,);
    await sender.runCreateDirectories();
    await assertRejects(
      () => sender.runGenResourceList([],),
      TjRuntimeError,
      "Resource 'ghost' must have a valid email address",
    );
  });

  it("genResourceList ignora recurso de férias no período inteiro", async () => {
    const parser = new ProjectFileParser();
    parser.open(
      `project prj "T" "1.0" 2026-01-01 - 2026-12-31 {
  timezone "UTC"
  now 2026-05-11
  workinghours mon - fri 9:00 - 17:00
}
resource dev "Developer" {
  email "dev@example.com"
}
resource away "Away" {
  email "away@example.com"
  leaves annual 2026-05-11 - 2026-05-18
}
`,
      true,
      true,
    );
    const project = parser.parse("project",) as Project;
    project.schedule();
    const sender = makeSender(fakeOpfs(), project,);
    await sender.runCreateDirectories();
    const list = await sender.runGenResourceList([],);
    assertEquals(list.map((r,) => r.id), ["dev",],);
  });

  it("genResourceList salva resources.json via FileStore", async () => {
    const store = fakeOpfs();
    const sender = makeSender(store,);
    await sender.runCreateDirectories();
    await sender.runGenResourceList([],);
    const raw = await store.read(`${TEMPLATE_DIR}/${DATE}/resources.json`,);
    const parsed = JSON.parse(raw,) as SheetResourceInfo[];
    assertEquals(parsed.length, 2,);
    assertEquals(parsed[1]?.id, "dev",);
  });

  it("genResourceList aplica o hideresource na definição do relatório", async () => {
    const store = fakeOpfs();
    const sender = makeSender(store,);
    sender.hideResource = '~(plan.id = "dev")';
    await sender.runCreateDirectories();
    await sender.runGenResourceList([],);
    const raw = await store.read(`${TEMPLATE_DIR}/${DATE}/resources.json`,);
    const parsed = JSON.parse(raw,) as SheetResourceInfo[];
    // `hideresource` esconde os que casam com a expressão: manter só `dev`.
    assertEquals(parsed.map((r,) => r.id), ["dev",],);
  });

  it("generateReport devolve a saída TJP do relatório", async () => {
    const sender = makeSender();
    await sender.runCreateDirectories();
    const output = await sender.runGenerateReport(
      "tpl_probe",
      `timesheetreport tpl_probe "TimeSheetTemplates/probe" {
  hideresource ~(plan.id = "dev")
  period %{2026-05-18 - 1w} +1w
  sorttasks id.up
}
`,
    );
    assertStringIncludes(output, "timesheet dev ",);
    assertStringIncludes(output, "# -------->8-------->8--------",);
  });

  it("generateReport reaplica a mesma definição sem colidir", async () => {
    const sender = makeSender();
    await sender.runCreateDirectories();
    const def = `timesheetreport tpl_twice "TimeSheetTemplates/twice" {
  hideresource ~(plan.id = "dev")
  period %{2026-05-18 - 1w} +1w
}
`;
    await sender.runGenerateReport("tpl_twice", def,);
    const second = await sender.runGenerateReport("tpl_twice", def,);
    assertStringIncludes(second, "timesheet dev ",);
  });

  it("generateReport sem projeto lança erro", async () => {
    const sender = new TestSender("time",);
    sender.senderEmail = "pm@example.com";
    sender.setFileStore(fakeOpfs(),);
    await assertRejects(
      () => sender.runGenerateReport("x", "textreport x '.' {}",),
      TjRuntimeError,
      "no project attached",
    );
  });

  it("genTemplates escreve um .smx por recurso", async () => {
    const store = fakeOpfs();
    const sender = makeSender(store,);
    await sender.runCreateDirectories();
    const list = await sender.runGenResourceList([],);
    await sender.runGenTemplates(list,);
    for (const id of ["alice", "dev",]) {
      const content = await store.read(
        `${TEMPLATE_DIR}/${DATE}/${id}_${DATE}.smx`,
      );
      assertStringIncludes(content, `timesheet ${id} `,);
      assertStringIncludes(content, "# -------->8-------->8--------",);
    }
  });

  it("genTemplates usa statussheetreport para o tipo status", async () => {
    const store = fakeOpfs();
    const sender = makeSender(store, makeStatusProject(), "status",);
    sender.setSignatureFilter(
      /^[ ]*statussheet\s[a-zA-Z_][a-zA-Z0-9_]*\s([0-9:\-+]*\s-\s[0-9:\-+]*)/u,
    );
    await sender.runCreateDirectories();
    const list = await sender.runGenResourceList([],);
    await sender.runGenTemplates(list,);
    const content = await store.read(
      `${TEMPLATE_DIR}/${DATE}/alice_${DATE}.smx`,
    );
    assertStringIncludes(content, "statussheet alice ",);
  });

  it("genTemplates exige FileStore", async () => {
    const sender = makeSender();
    await sender.runCreateDirectories();
    sender.setFileStore(null as unknown as FileStore,);
    await assertRejects(
      () => sender.runGenTemplates([],),
      TjRuntimeError,
      "no FileStore configured",
    );
  });

  it("sendTemplates percorre o pipeline inteiro e envia emails", async () => {
    const store = fakeOpfs();
    const sender = makeSender(store,);
    await sender.sendTemplates([],);

    // Diretórios e artefatos.
    assertEquals(store.dirs.has(`${TEMPLATE_DIR}/${DATE}`,), true,);
    assert(await store.exists(`${TEMPLATE_DIR}/${DATE}/resources.json`,),);
    assert(await store.exists(`${TEMPLATE_DIR}/acceptable_intervals`,),);

    // Dois emails (um por recurso), no log em memória (ADR 036).
    const mails = emailLogMessages(sender,);
    assertEquals(mails.length, 2,);
    assertStringIncludes(mails.join("\n",), "Your weekly time sheet template",);
  });

  it("sendTemplates escreve a mensagem em outbox sem dryRun", async () => {
    const store = fakeOpfs();
    const sender = makeSender(store,);
    sender.dryRun = false;
    await sender.sendTemplates([],);
    const names = await store.list("outbox",);
    assertEquals(names.length, 2,);
    assert(names.some((n,) => n.includes("dev@example.com",)),);
  });

  it("sendReportTemplates anexa o .smx lido do FileStore", async () => {
    const store = fakeOpfs();
    const sender = makeSender(store,);
    await sender.runCreateDirectories();
    const list = await sender.runGenResourceList([],);
    await sender.runGenTemplates(list,);

    const sent: string[] = [];
    const original = sender.sendEmail.bind(sender,);
    sender.sendEmail = async (to, _subject, _message, attachment,) => {
      sent.push(`${to}|${String(attachment,)}`,);
      return await original(to, _subject, _message, attachment,);
    };
    await sender.runSendReportTemplates(list,);
    assertEquals(sent.length, 2,);
    assertEquals(
      sent[0],
      `alice@example.com|${TEMPLATE_DIR}/${DATE}/alice_${DATE}.smx`,
    );
  });

  it("genTemplates reaproveita template legado .tji sem gerar .smx", async () => {
    // Compatibilidade em trânsito (24.2.36): pasta gerada pelo TaskJuggler.
    const store = fakeOpfs({
      [`${TEMPLATE_DIR}/${DATE}/alice_${DATE}.tji`]: "timesheet alice " +
        "2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000 {\n}\n",
    },);
    const sender = makeSender(store,);
    await sender.runCreateDirectories();

    await sender.runGenTemplates([
      {
        id: "alice",
        name: "Alice",
        email: "alice@example.com",
        effort: 0,
        freeWork: 0,
      },
    ],);

    assertEquals(
      store.files.has(`${TEMPLATE_DIR}/${DATE}/alice_${DATE}.smx`,),
      false,
    );
    assert(
      sender.logEntries.some((entry,) =>
        entry.message.includes("Skipping already existing",) &&
        entry.message.endsWith(".tji.",)
      ),
      JSON.stringify(sender.logEntries.map((entry,) => entry.message),),
    );
  });

  it("sendReportTemplates pula template antigo", async () => {
    // Template pré-existente, muito anterior ao `timeStamp` do sender.
    const seed = {
      [`${TEMPLATE_DIR}/${DATE}/dev_${DATE}.tji`]: "timesheet dev " +
        "2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000 {\n}\n",
    };
    const sender = makeSender(fakeOpfs(seed,),);
    await sender.runCreateDirectories();
    await sender.runSendReportTemplates([
      {
        id: "dev",
        name: "Developer",
        email: "dev@example.com",
        effort: 0,
        freeWork: 5,
      },
    ],);
    assertEquals(emailLogMessages(sender,).length, 0,);
    assert(
      sender.logEntries.some((e,) => e.message.startsWith("Old template",)),
    );
  });

  it("sendReportTemplates reporta template ausente", async () => {
    const sender = makeSender();
    await sender.runCreateDirectories();
    await assertRejects(
      () =>
        sender.runSendReportTemplates([
          {
            id: "ghost",
            name: "Ghost",
            email: "ghost@example.com",
            effort: 0,
            freeWork: 0,
          },
        ],),
      TjRuntimeError,
      "sendReportTemplates: time sheet",
    );
  });

  it("enableSignatureForReporting registra a assinatura", async () => {
    const store = fakeOpfs();
    const sender = makeSender(store,);
    await sender.runCreateDirectories();
    const list = await sender.runGenResourceList([],);
    await sender.runGenTemplates(list,);
    const raw = await store.read(`${TEMPLATE_DIR}/acceptable_intervals`,);
    assertEquals(
      raw,
      "2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000\n",
    );
  });

  it("enableSignatureForReporting não duplica assinatura existente", async () => {
    const store = fakeOpfs({
      [`${TEMPLATE_DIR}/acceptable_intervals`]:
        "2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000\n",
    },);
    const sender = makeSender(store,);
    await sender.runCreateDirectories();
    const list = await sender.runGenResourceList([],);
    await sender.runGenTemplates(list,);
    const raw = await store.read(`${TEMPLATE_DIR}/acceptable_intervals`,);
    assertEquals(
      raw,
      "2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000\n",
    );
    assert(
      sender.logEntries.some((e,) => e.message.startsWith("Signature 2026",)),
    );
  });

  it("enableSignatureForReporting falha sem assinatura no template", async () => {
    const store = fakeOpfs({ "broken.tji": "no signature here\n", },);
    const sender = makeSender(store,);
    await assertRejects(
      () => sender.runEnableSignature("broken.tji",),
      TjRuntimeError,
      "Cannot find signature in file broken.tji",
    );
  });

  it("sprintf substitui %s pela data", () => {
    assertEquals(
      sprintf("Your weekly time sheet template for %s", DATE,),
      "Your weekly time sheet template for 2026-05-18",
    );
  });

  it("RESOURCE_LIST_REPORT_ID mantém o id do Ruby", () => {
    assertEquals(RESOURCE_LIST_REPORT_ID, "rl_21497214",);
  });

  it("sendTemplates exige FileStore", async () => {
    const sender = new TestSender("time",);
    sender.senderEmail = "pm@example.com";
    sender.setProject(makeProject(),);
    await assertRejects(
      () => sender.sendTemplates([],),
      TjRuntimeError,
      "no FileStore configured",
    );
  });
});

describe("SheetSender#templateAttributes (18.19.4)", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("repassa o snippet ao Project#generateReport", async () => {
    const project = makeProject();
    const calls: unknown[][] = [];
    const original = project.generateReport as unknown as (
      ...args: unknown[]
    ) => void;
    project.generateReport = (...args: unknown[]): void => {
      calls.push(args,);
      original.apply(project, args,);
    };

    const sender = makeSender(fakeOpfs(), project,);
    sender.templateAttributes = "hideresource 0";
    await sender.runCreateDirectories();
    const list = await sender.runGenResourceList([],);
    await sender.runGenTemplates(list,);

    const templates = calls.filter((args,) =>
      String(args[0],).startsWith("sheet_template_",)
    );
    assertEquals(templates.length, 2,);
    // O 4º argumento é o `dynamicAttributes` de `Project#generateReport`.
    assertEquals(templates[0]![3], "hideresource 0",);
  });

  it("o snippet muda o template gerado", async () => {
    const store = fakeOpfs();
    const sender = makeSender(store,);
    // O `reportDef` esconde todos os outros recursos; o snippet os devolve.
    sender.templateAttributes = "hideresource 0";
    await sender.runCreateDirectories();
    const list = await sender.runGenResourceList([],);
    await sender.runGenTemplates(list,);
    const withSnippet = await store.read(
      `${TEMPLATE_DIR}/${DATE}/dev_${DATE}.smx`,
    );
    assertStringIncludes(withSnippet, "timesheet dev ",);
    assertStringIncludes(withSnippet, "timesheet alice ",);

    // Sem o snippet, o template só tem o próprio recurso.
    const plainStore = fakeOpfs();
    const plain = makeSender(plainStore,);
    await plain.runCreateDirectories();
    await plain.runGenTemplates(await plain.runGenResourceList([],),);
    const plainTemplate = await plainStore.read(
      `${TEMPLATE_DIR}/${DATE}/dev_${DATE}.smx`,
    );
    assertStringIncludes(plainTemplate, "timesheet dev ",);
    assertEquals(plainTemplate.includes("timesheet alice ",), false,);
  });
});

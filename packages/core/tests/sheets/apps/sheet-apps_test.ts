/**
 * Testes dos cinco apps de sheet (tarefas 18.18.3 a 18.18.7).
 *
 * O Ruby (cron + SMTP + `tj3client`) vira, aqui, um núcleo de funções: o
 * projeto chega pronto pelo contexto, o `FileStore` é injetado (ADR 037) e
 * cada email sai como `EmailMessage` em `sentMessages` (ADR 036). O que se
 * testa é justamente essa troca de transporte.
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.18)
 */
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import { beforeEach, describe, it, } from "@std/testing/bdd";
import type { FileStore, } from "../../../src/interfaces/file-store.ts";
import { MessageHandlerInstance, } from "../../../src/message-handler.ts";
import type { Project, } from "../../../src/model/project.ts";
import { ProjectFileParser, } from "../../../src/parser/project-file-parser.ts";
import {
  parseEndDate,
  SHEET_APP_EXIT_ERROR,
  SHEET_APP_EXIT_OK,
  type SheetAppConfig,
} from "../../../src/sheets/apps/app-base.ts";
import { SsReceiverApp, } from "../../../src/sheets/apps/ss-receiver-app.ts";
import { SsSenderApp, } from "../../../src/sheets/apps/ss-sender-app.ts";
import { TsReceiverApp, } from "../../../src/sheets/apps/ts-receiver-app.ts";
import { TsSenderApp, } from "../../../src/sheets/apps/ts-sender-app.ts";
import { TsSummaryApp, } from "../../../src/sheets/apps/ts-summary-app.ts";
import {
  formatEmailMessage,
  toBase64,
} from "../../../src/sheets/email-message.ts";
import {
  RESOURCE_LIST_FILE,
  SHEET_EXTENSION,
} from "../../../src/sheets/sheet-receiver.ts";
import { fakeOpfs, } from "../../helpers/fake-opfs.ts";

const DATE = "2026-05-18";
const TEMPLATE_DIR = "TimeSheetTemplates";
const SHEET_DIR = "TimeSheets";
const STATUS_TEMPLATE_DIR = "StatusSheetTemplates";
const STATUS_SHEET_DIR = "StatusSheets";
/** Assinatura (intervalo) aceita — a mesma que o sender registra. */
const SIGNATURE = "2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000";

/** Configuração mínima: `senderEmail` é obrigatório para compor o `From`. */
const CONFIG: SheetAppConfig = {
  _global: { senderEmail: "pm@example.com", smtpServer: "localhost", },
};

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

/** Projeto de status sheet: só quem tem `responsible` entra no template. */
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

/** Folha de status entregue por `alice`. */
const STATUS_SHEET =
  `statussheet alice 2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000 {
  task t2 {
    status green "No prazo"
  }
}
# -------->8-------->8--------
`;

/** Parse + schedule de um projeto de teste. */
function makeProject(tjp: string = TJP,): Project {
  const parser = new ProjectFileParser();
  parser.open(tjp, true, true,);
  const project = parser.parse("project",) as Project;
  project.schedule();
  return project;
}

/** Store com os artefatos que um sender deixaria antes do receiver rodar. */
function receiverStore(dir: string,): FileStore & {
  files: Map<string, string>;
  dirs: Set<string>;
} {
  return fakeOpfs({
    [`${dir}/${DATE}/${RESOURCE_LIST_FILE}`]: RESOURCES_JSON,
    [`${dir}/acceptable_intervals`]: `${SIGNATURE}\n`,
  },);
}

/** Template do recurso — é o `.tji` que o sender gera e envia (18.6). */
function templateFor(id: string,): string {
  return `timesheet ${id} 2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000 {
  task t1 {
    work 0d
  }
}
`;
}

/** Store do resumo: lista, templates, assinatura e a folha do `dev`. */
function summaryStore(): FileStore & {
  files: Map<string, string>;
  dirs: Set<string>;
} {
  return fakeOpfs({
    [`${TEMPLATE_DIR}/${DATE}/${RESOURCE_LIST_FILE}`]: RESOURCES_JSON,
    [`${TEMPLATE_DIR}/${DATE}/dev_${DATE}.tji`]: templateFor("dev",),
    [`${TEMPLATE_DIR}/${DATE}/alice_${DATE}.tji`]: templateFor("alice",),
    [`${TEMPLATE_DIR}/acceptable_intervals`]: `${SIGNATURE}\n`,
    // `dev` entregou; `alice` não.
    [`${SHEET_DIR}/${DATE}/dev_${DATE}.tji`]: SHEET,
  },);
}

/** Mensagem completa (RFC 822), como o MTA entregaria ao receiver. */
function makeMail(
  sheet: string,
  options: { asAttachment?: boolean } = {},
): string {
  const asAttachment = options.asAttachment ?? false;
  const raw = formatEmailMessage({
    to: "ts@example.com",
    from: "Dev <dev@example.com>",
    subject: "Re: your sheet",
    date: "Mon, 18 May 2026 10:00:00 GMT",
    text: asAttachment ? "Segue anexa minha folha.\n" : sheet,
    html: null,
    attachmentName: asAttachment ? "dev_2026-05-18.tji" : null,
    attachment: asAttachment ? sheet : null,
    attachmentBase64: asAttachment ? toBase64(sheet,) : null,
    inReplyTo: null,
    appName: "tj3ts_sender",
  },);
  return raw.replace(
    "MIME-Version: 1.0",
    "Message-ID: <abc.123@example.com>\r\nMIME-Version: 1.0",
  );
}

describe("TsSenderApp", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("manda um email por recurso com o .smx em base64", async () => {
    const store = fakeOpfs();
    const app = new TsSenderApp({
      endDate: DATE,
      dryRun: true,
      config: CONFIG,
    },);

    assertEquals(
      await app.run({ project: makeProject(), fileStore: store, },),
      SHEET_APP_EXIT_OK,
    );

    assertEquals(app.messages.length, 2,);
    assertEquals(
      app.messages.map((mail,) => mail.to),
      ["alice@example.com", "dev@example.com",],
    );
    const dev = app.messages[1]!;
    assertEquals(dev.subject, `Your weekly time sheet template for ${DATE}`,);
    assertEquals(dev.from, "pm@example.com",);
    assertEquals(dev.attachmentName, `dev_${DATE}.smx`,);
    assert(dev.attachment !== null,);
    assertStringIncludes(dev.attachment, "timesheet dev",);
    assert(dev.attachmentBase64 !== null,);
    assertEquals(dev.attachmentBase64, toBase64(dev.attachment,),);
    // O template foi mesmo gravado no FileStore (ADR 037).
    assertEquals(
      store.files.has(`${TEMPLATE_DIR}/${DATE}/dev_${DATE}.smx`,),
      true,
    );
  });

  it("-r/--resource restringe o envio ao recurso pedido", async () => {
    const app = new TsSenderApp({
      endDate: DATE,
      dryRun: true,
      config: CONFIG,
      resources: ["dev",],
    },);

    await app.run({ project: makeProject(), fileStore: fakeOpfs(), },);

    assertEquals(app.messages.map((mail,) => mail.to), ["dev@example.com",],);
  });

  it("-f/--force reenvia template que já está no disco", async () => {
    const store = fakeOpfs();
    const first = new TsSenderApp({
      endDate: DATE,
      dryRun: true,
      config: CONFIG,
    },);
    await first.run({ project: makeProject(), fileStore: store, },);
    assertEquals(first.messages.length, 2,);

    // Sem `force`, o template existente não é reenviado (Ruby l.188-193).
    const second = new TsSenderApp({
      endDate: DATE,
      dryRun: true,
      config: CONFIG,
    },);
    const project = makeProject();
    await second.run({ project, fileStore: store, },);
    assertEquals(second.messages.length, 0,);

    const forced = new TsSenderApp({
      endDate: DATE,
      dryRun: true,
      config: CONFIG,
      force: true,
    },);
    await forced.run({ project, fileStore: store, },);
    assertEquals(forced.messages.length, 2,);
  });

  it("o corpo é a introdução + o template, em texto puro", async () => {
    const app = new TsSenderApp({
      endDate: DATE,
      dryRun: true,
      config: CONFIG,
      resources: ["dev",],
    },);

    await app.run({ project: makeProject(), fileStore: fakeOpfs(), },);

    const mail = app.messages[0]!;
    // O Ruby chama `sendEmail` aqui (SheetSender.rb l.197): o corpo é texto.
    assertEquals(mail.html, null,);
    assertStringIncludes(mail.text, "Please find enclosed your weekly report",);
    assertStringIncludes(mail.text, "Hello Developer!",);
    assertStringIncludes(mail.text, "timesheet dev",);
  });
});

describe("TsReceiverApp", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("aceita a folha no corpo do email e responde ao recurso", async () => {
    const store = receiverStore(TEMPLATE_DIR,);
    const app = new TsReceiverApp({ dryRun: true, config: CONFIG, },);

    assertEquals(
      await app.run({
        project: makeProject(),
        fileStore: store,
        rawEmail: makeMail(SHEET,),
      },),
      SHEET_APP_EXIT_OK,
    );

    // A folha foi arquivada no diretório do período.
    assertEquals(
      store.files.get(`${SHEET_DIR}/${DATE}/dev_${DATE}.smx`,),
      SHEET,
    );
    // Uma confirmação saiu, para o endereço cadastrado do recurso.
    assertEquals(app.messages.length, 1,);
    assertEquals(app.messages[0]!.to, "dev@example.com",);
    assertStringIncludes(
      app.messages[0]!.text,
      "Report from Developer for the period ending",
    );
  });

  it("aceita a folha anexada como .tji e arquiva como .smx", async () => {
    const store = receiverStore(TEMPLATE_DIR,);
    const app = new TsReceiverApp({ dryRun: true, config: CONFIG, },);

    assertEquals(
      await app.run({
        project: makeProject(),
        fileStore: store,
        rawEmail: makeMail(SHEET, { asAttachment: true, },),
      },),
      SHEET_APP_EXIT_OK,
    );

    assertEquals(
      store.files.get(`${SHEET_DIR}/${DATE}/dev_${DATE}.smx`,),
      SHEET,
    );
  });

  it("sem texto de email devolve 1 e não arquiva nada", async () => {
    const store = receiverStore(TEMPLATE_DIR,);
    const app = new TsReceiverApp({ dryRun: true, config: CONFIG, },);

    assertEquals(
      await app.run({ project: makeProject(), fileStore: store, },),
      SHEET_APP_EXIT_ERROR,
    );
    assertEquals(
      store.files.has(`${SHEET_DIR}/${DATE}/dev_${DATE}.smx`,),
      false,
    );
  });
});

describe("TsSummaryApp", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("manda uma folha por recurso e um resumo consolidado", async () => {
    const store = summaryStore();
    const app = new TsSummaryApp({
      endDate: DATE,
      dryRun: true,
      config: CONFIG,
      sheetRecipients: ["lead@example.com",],
      digestRecipients: ["boss@example.com",],
    },);

    assertEquals(
      await app.run({ project: makeProject(), fileStore: store, },),
      SHEET_APP_EXIT_OK,
    );

    // `alice` estava com template mas não entregou: só o `dev` gera folha.
    const toLead = app.messages.filter((mail,) =>
      mail.to === "lead@example.com"
    );
    assertEquals(toLead.length, 1,);
    assertEquals(
      toLead[0]!.subject,
      `Weekly report ${DATE}`,
    );
    // O corpo da folha individual é o diário do recurso (a própria folha).
    assertStringIncludes(toLead[0]!.text, "timesheet dev",);

    const toBoss = app.messages.filter((mail,) =>
      mail.to === "boss@example.com"
    );
    assertEquals(toBoss.length, 1,);
    assertEquals(toBoss[0]!.subject, `Weekly staff reports ${DATE}`,);
  });

  it("as folhas saem em RichText (text + htmlMailBody)", async () => {
    const store = summaryStore();
    const app = new TsSummaryApp({
      endDate: DATE,
      dryRun: true,
      config: CONFIG,
      sheetRecipients: ["lead@example.com",],
      digestRecipients: ["boss@example.com",],
    },);

    await app.run({ project: makeProject(), fileStore: store, },);

    const digest = app.messages.find((mail,) =>
      mail.to === "boss@example.com"
    )!;
    // `sendRichTextEmail` (SheetHandlerBase l.148-166) gera as duas partes.
    assertStringIncludes(digest.text, "have not yet submitted",);
    assertStringIncludes(digest.text, "timesheet dev",);
    assert(digest.html !== null,);
    assertStringIncludes(digest.html, "<!DOCTYPE html",);
    assertStringIncludes(digest.html, "have not yet submitted",);
  });

  it("usa a data do app, e não a do construtor do summary", async () => {
    const store = summaryStore();
    const app = new TsSummaryApp({
      endDate: "2026-05-25",
      dryRun: true,
      config: CONFIG,
      sheetRecipients: ["lead@example.com",],
    },);

    // Sem folhas no período novo: o summary cobra os inadimplentes.
    await app.run({ project: makeProject(), fileStore: store, },);

    assertEquals(app.handler.date, "2026-05-25",);
    assertEquals(app.messages.length, 0,);
  });
});

describe("SsSenderApp / SsReceiverApp", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("SsSenderApp usa o default de quarta-feira e manda o template", async () => {
    const store = fakeOpfs();
    // 2026-05-18 é segunda; a próxima quarta é 2026-05-20.
    assertEquals(parseEndDate(3, new Date(2026, 4, 11,),), "2026-05-13",);
    const app = new SsSenderApp({ dryRun: true, config: CONFIG, },);
    app.setEndDate(DATE,);

    assertEquals(
      await app.run({
        project: makeProject(STATUS_TJP,),
        fileStore: store,
      },),
      SHEET_APP_EXIT_OK,
    );

    assertEquals(app.messages.length, 1,);
    assertEquals(app.messages[0]!.to, "alice@example.com",);
    assertEquals(
      app.messages[0]!.attachmentName,
      `alice_${DATE}.smx`,
    );
    assertStringIncludes(
      app.messages[0]!.attachment ?? "",
      "statussheet alice",
    );
    assertEquals(
      store.files.has(`${STATUS_TEMPLATE_DIR}/${DATE}/alice_${DATE}.smx`,),
      true,
    );
  });

  it("SsReceiverApp aceita a folha de status devolvida", async () => {
    const store = receiverStore(STATUS_TEMPLATE_DIR,);
    const app = new SsReceiverApp({ dryRun: true, config: CONFIG, },);

    assertEquals(
      await app.run({
        project: makeProject(STATUS_TJP,),
        fileStore: store,
        rawEmail: makeMail(STATUS_SHEET,),
      },),
      SHEET_APP_EXIT_OK,
    );

    assertEquals(
      store.files.get(`${STATUS_SHEET_DIR}/${DATE}/alice_${DATE}.smx`,),
      STATUS_SHEET,
    );
    assertEquals(app.messages.length, 1,);
    assertEquals(app.messages[0]!.to, "alice@example.com",);
  });

  it("o anexo sai com a extensão nativa .smx nos dois tipos", async () => {
    // Decisão 2026-11-07 (24.2.36): o SyntaxMesh gera `.smx`; a leitura
    // continua aceitando o `.tji` legado.
    assertEquals(SHEET_EXTENSION, ".smx",);
    const app = new SsSenderApp({
      endDate: DATE,
      dryRun: true,
      config: CONFIG,
    },);
    await app.run({
      project: makeProject(STATUS_TJP,),
      fileStore: fakeOpfs(),
    },);
    assert(app.messages[0]!.attachmentName?.endsWith(SHEET_EXTENSION,),);
  });
});

/**
 * Testes de `SheetReceiver` (tarefa 18.7).
 *
 * O Ruby lia a mensagem do `$stdin` (gem `mail`) e validava a folha chamando
 * `tj3client check-ts` por subprocesso. Aqui a mensagem chega como `string`,
 * é lida pelo parser MIME de `email-message.ts` e a folha é aplicada ao
 * projeto in-process (ADR 036/037) sobre um `fakeOpfs()`.
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.7)
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
  formatEmailMessage,
  parseEmailMessage,
  toBase64,
} from "../../src/sheets/email-message.ts";
import type { SheetReceiverType, } from "../../src/sheets/sheet-handler-base.ts";
import {
  emailDigest,
  RESOURCE_LIST_FILE,
  SheetReceiver,
} from "../../src/sheets/sheet-receiver.ts";
import { fakeOpfs, } from "../helpers/fake-opfs.ts";

/** Relógio fixo: o nome do `.eml` da outbox depende dele. */
const FIXED_NOW = new Date(2026, 4, 18, 10, 0, 0,);
const DATE = "2026-05-18";
const TEMPLATE_DIR = "TimeSheetTemplates";
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

/** Folha válida: `dev` tem 5 dias úteis no período (freework). */
const SHEET = `timesheet dev 2026-05-11-00:00-+0000 - 2026-05-18-00:00-+0000 {
  task t1 {
    work 5d
    remaining 5d
    status green "Worked on t1" {
      summary -8<-
      Did stuff.
      ->8-
    }
  }
}
# -------->8-------->8--------
`;

/** Folha sintaticamente válida, mas incompleta: `t1` sem `remaining`/status. */
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

/** Store já com os artefatos que o sender deixaria (`resources.json`, assinatura). */
function makeStore(): FileStore & {
  files: Map<string, string>;
  dirs: Set<string>;
} {
  return fakeOpfs({
    [`${TEMPLATE_DIR}/${DATE}/${RESOURCE_LIST_FILE}`]: RESOURCES_JSON,
    [`${TEMPLATE_DIR}/acceptable_intervals`]: `${SIGNATURE}\n`,
  },);
}

/** Receiver "cru": sem configuração, para observar os defaults da base. */
class BareReceiver extends SheetReceiver {
  /** Estado inicial dos campos de configuração (todos protegidos). */
  get defaults(): {
    sheetDir: string;
    failedMailsDir: string;
    failedSheetsDir: string;
    signatureFile: string;
    emailSubject: string;
    sheetWasAttached: boolean;
    sheet: string | null;
    date: string | null;
    resourceId: string | null;
    submitter: string | null;
    messageId: string | null;
  } {
    return {
      sheetDir: this.sheetDir,
      failedMailsDir: this.failedMailsDir,
      failedSheetsDir: this.failedSheetsDir,
      signatureFile: this.signatureFile,
      emailSubject: this.emailSubject,
      sheetWasAttached: this.sheetWasAttached,
      sheet: this.sheet,
      date: this.date,
      resourceId: this.resourceId,
      submitter: this.submitter,
      messageId: this.messageId,
    };
  }
}

/** Receiver concreto mínimo: expõe os helpers protegidos aos testes. */
class TestReceiver extends SheetReceiver {
  constructor(type: SheetReceiverType = "time",) {
    super("tj3ts_receiver", type,);
    const sheetDir = type === "time" ? "TimeSheets" : "StatusSheets";
    const templateDir = type === "time"
      ? "TimeSheetTemplates"
      : "StatusSheetTemplates";
    this.tj3clientOption = type === "time" ? "check-ts" : "check-ss";
    this.sheetDir = sheetDir;
    this.templateDir = templateDir;
    this.failedMailsDir = `${sheetDir}/FailedMails`;
    this.failedSheetsDir = `${sheetDir}/FailedSheets`;
    this.signatureFile = `${templateDir}/acceptable_intervals`;
    this.emailSubject = "Report from %s for %s";
    this.sheetHeader =
      /^[ ]*timesheet\s([a-zA-Z_][a-zA-Z0-9_]*)\s[0-9\-:+]*\s-\s([0-9]*-[0-9]*-[0-9]*)/mu;
    this.signatureFilter =
      /^[ ]*timesheet\s[a-zA-Z_][a-zA-Z0-9_]*\s([0-9:\-+]*\s-\s[0-9:\-+]*)/mu;
  }

  get type(): SheetReceiverType {
    return this.sheetType;
  }

  get attached(): boolean {
    return this.sheetWasAttached;
  }

  get sheetText(): string | null {
    return this.sheet;
  }

  get address(): string | null {
    return this.submitter;
  }

  get directories(): { sheetDir: string; mails: string; sheets: string } {
    return {
      sheetDir: this.sheetDir,
      mails: this.failedMailsDir,
      sheets: this.failedSheetsDir,
    };
  }

  /** Estado que `processSheet` normalmente preenche, para os testes diretos. */
  prepare(resourceId: string, date: string, submitter: string,): void {
    this.resourceId = resourceId;
    this.date = date;
    this.submitter = submitter;
  }

  runCreateDirectories() {
    return this.createDirectories();
  }

  runCheckSignature(sheet: string,) {
    return this.checkSignature(sheet,);
  }

  runCheckSheet(sheet: string,) {
    return this.checkSheet(sheet,);
  }

  runFileSheet(sheet: string,) {
    return this.fileSheet(sheet,);
  }

  runGetResourceList() {
    return this.getResourceList();
  }

  runGetResourceEmail(id?: string,) {
    return this.getResourceEmail(id,);
  }

  runGetResourceName(id?: string,) {
    return this.getResourceName(id,);
  }
}

/** Receiver pronto: relógio fixo, store com templates e projeto agendado. */
function makeReceiver(
  store: FileStore = makeStore(),
  project: Project = makeProject(),
  type: SheetReceiverType = "time",
): TestReceiver {
  const receiver = new TestReceiver(type,);
  receiver.senderEmail = "pm@example.com";
  receiver.smtpServer = "localhost";
  receiver.clock = () => FIXED_NOW;
  receiver.setFileStore(store,);
  receiver.setProject(project,);
  return receiver;
}

/** Mensagem completa (RFC 822) com `Message-ID` — a gem `mail` do Ruby idem. */
function makeMail(
  options: {
    text?: string;
    attachment?: string | null;
    attachmentName?: string;
    from?: string;
    messageId?: string;
  } = {},
): string {
  const attachment = options.attachment ?? null;
  const raw = formatEmailMessage({
    to: "ts@example.com",
    from: options.from ?? "Dev <dev@example.com>",
    subject: "Re: your time sheet",
    date: "Mon, 18 May 2026 10:00:00 GMT",
    text: options.text ?? "",
    html: null,
    attachmentName: attachment === null
      ? null
      : options.attachmentName ?? "dev_2026-05-18.tji",
    attachment,
    attachmentBase64: attachment === null ? null : toBase64(attachment,),
    inReplyTo: null,
    appName: "tj3ts_sender",
  },);
  const messageId = options.messageId ?? "<abc.123@example.com>";
  return raw.replace(
    "MIME-Version: 1.0",
    `Message-ID: ${messageId}\r\nMIME-Version: 1.0`,
  );
}

/** Arquivos da outbox (as respostas que "saíram"). */
function outboxFiles(store: {
  files: Map<string, string>;
},): Map<string, string> {
  const result = new Map<string, string>();
  for (const [path, content,] of store.files) {
    if (path.startsWith("outbox/",)) result.set(path, content,);
  }
  return result;
}

describe("SheetReceiver", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("constructor aplica os defaults do Ruby", () => {
    const receiver = new BareReceiver("tj3ts_receiver", "time",);
    assertEquals(receiver.appName, "tj3ts_receiver",);
    assertEquals(receiver.project, null,);
    assertEquals(receiver.dryRun, false,);
    const defaults = receiver.defaults;
    assertEquals(defaults.sheetDir, "",);
    assertEquals(defaults.failedMailsDir, "",);
    assertEquals(defaults.failedSheetsDir, "",);
    assertEquals(defaults.signatureFile, "",);
    assertEquals(defaults.emailSubject, "",);
    assertEquals(defaults.sheetWasAttached, true,);
    assertEquals(defaults.sheet, null,);
    assertEquals(defaults.date, null,);
    assertEquals(defaults.resourceId, null,);
    assertEquals(defaults.submitter, null,);
    assertEquals(defaults.messageId, null,);
  });

  it("subclasses definem o tipo e os diretórios", () => {
    const time = new TestReceiver("time",);
    assertEquals(time.type, "time",);
    assertEquals(time.directories.sheetDir, "TimeSheets",);
    const status = new TestReceiver("status",);
    assertEquals(status.type, "status",);
    assertEquals(status.directories.sheetDir, "StatusSheets",);
  });

  it("setProject guarda o projeto alvo", () => {
    const receiver = new SheetReceiver("tj3ts_receiver", "status",);
    const project = makeProject();
    receiver.setProject(project,);
    assert(receiver.project === project,);
  });

  it("createDirectories cria as três pastas", async () => {
    const store = makeStore();
    const receiver = makeReceiver(store,);
    await receiver.runCreateDirectories();
    assertEquals(store.dirs.has("TimeSheets",), true,);
    assertEquals(store.dirs.has("TimeSheets/FailedMails",), true,);
    assertEquals(store.dirs.has("TimeSheets/FailedSheets",), true,);
  });

  it("createDirectories é idempotente", async () => {
    const store = makeStore();
    const receiver = makeReceiver(store,);
    await receiver.runCreateDirectories();
    await receiver.runCreateDirectories();
    assertEquals(store.dirs.has("TimeSheets/FailedSheets",), true,);
  });

  it("processEmail com anexo aceita e arquiva a folha", async () => {
    const store = makeStore();
    const receiver = makeReceiver(store,);

    const accepted = await receiver.processEmail(
      makeMail({ attachment: SHEET, text: "Segue minha folha.\n", },),
    );

    assertEquals(accepted, true,);
    assertEquals(receiver.attached, true,);
    assertEquals(receiver.address, "dev@example.com",);
    assertEquals(
      store.files.get("TimeSheets/2026-05-18/dev_2026-05-18.tji",),
      SHEET,
    );
    assertEquals(
      store.files.get("TimeSheets/2026-05-18/all.tji",),
      "include 'dev_2026-05-18.tji' { }\n",
    );
    assertEquals(
      store.files.get("TimeSheets/all.tji",),
      "\ninclude '2026-05-18/all.tji' { }",
    );
    // A mensagem só fica em FailedMails enquanto não é aceita.
    assertEquals(
      [...store.files.keys(),].some((path,) =>
        path.startsWith("TimeSheets/FailedMails/",)
      ),
      false,
    );
    // Confirmação enviada à pessoa certa.
    assertEquals(outboxFiles(store,).size, 1,);
  });

  it("processEmail com a folha no corpo", async () => {
    const store = makeStore();
    const receiver = makeReceiver(store,);

    const accepted = await receiver.processEmail(
      makeMail({ text: SHEET, },),
    );

    assertEquals(accepted, true,);
    assertEquals(receiver.attached, false,);
    assertEquals(
      store.files.get("TimeSheets/2026-05-18/dev_2026-05-18.tji",),
      SHEET,
    );
  });

  it("processEmail sem sheet lança erro claro", async () => {
    const store = makeStore();
    const receiver = makeReceiver(store,);

    await assertRejects(
      () => receiver.processEmail(makeMail({ text: "Bom dia!\n", },),),
      TjRuntimeError,
      "No time sheet found in email",
    );
    // A mensagem crua fica guardada para reprocessar.
    assertEquals(
      [...store.files.keys(),].filter((path,) =>
        path.startsWith("TimeSheets/FailedMails/",)
      ).length,
      1,
    );
  });

  it("processEmail ignora anexos que não são .tji", async () => {
    const store = makeStore();
    const receiver = makeReceiver(store,);

    const accepted = await receiver.processEmail(
      makeMail({
        attachment: SHEET,
        attachmentName: "dev_2026-05-18.txt",
        text: SHEET,
      },),
    );

    assertEquals(accepted, true,);
    assertEquals(receiver.attached, false,);
  });

  it("processEmail tenta o corpo quando o anexo .tji é inválido", async () => {
    const store = makeStore();
    const receiver = makeReceiver(store,);

    const accepted = await receiver.processEmail(
      makeMail({ attachment: "não é uma folha\n", text: SHEET, },),
    );

    assertEquals(accepted, true,);
    assertEquals(receiver.attached, false,);
  });

  it("processEmail responde ao endereço cadastrado, não ao From", async () => {
    const store = makeStore();
    const receiver = makeReceiver(store,);

    await receiver.processEmail(
      makeMail({
        attachment: SHEET,
        from: "Alguém <outro@example.com>",
      },),
    );

    assertEquals(receiver.address, "dev@example.com",);
    assertEquals(
      [...outboxFiles(store,).keys(),],
      ["outbox/dev@example.com_2026-05-18.eml",],
    );
  });

  it("processEmail com folha de recurso desconhecido devolve a folha no email", async () => {
    const store = makeStore();
    const receiver = makeReceiver(store,);
    const ghost = SHEET.replace("timesheet dev ", "timesheet ghost ",);

    await assertRejects(
      () => receiver.processEmail(makeMail({ text: ghost, },),),
      TjRuntimeError,
      "Resource ID 'ghost' not found in list",
    );

    // O corpo vai em base64: decodificar prova o round-trip do parser (18.7).
    const reply = parseEmailMessage(
      [...outboxFiles(store,).values(),][0] ?? "",
    );
    assertStringIncludes(reply.subject, "Your time sheet submission failed!",);
    assertStringIncludes(
      reply.content,
      "Resource ID 'ghost' not found in list",
    );
    // Veio no corpo: a folha volta junto para o usuário poder reenviar.
    assertStringIncludes(reply.content, "timesheet ghost",);
  });

  it("checkSignature aceita intervalo registrado", async () => {
    const receiver = makeReceiver();
    await receiver.runCheckSignature(SHEET,);
    assertEquals(MessageHandlerInstance.instance.errors, 0,);
  });

  it("checkSignature rejeita intervalo não registrado", async () => {
    const store = fakeOpfs({
      [`${TEMPLATE_DIR}/acceptable_intervals`]: "2020-01-01 - 2020-01-08\n",
    },);
    const receiver = makeReceiver(store,);

    await assertRejects(
      () => receiver.runCheckSignature(SHEET,),
      TjRuntimeError,
      "was not accepted!",
    );
  });

  it("checkSignature falha quando o arquivo de assinaturas não existe", async () => {
    const store = fakeOpfs();
    const receiver = makeReceiver(store,);

    await assertRejects(
      () => receiver.runCheckSignature(SHEET,),
      TjRuntimeError,
      "does not exist yet.",
    );
  });

  it("checkSignature sem cabeçalho é falha fatal", async () => {
    const receiver = makeReceiver();
    await assertRejects(
      () => receiver.runCheckSignature("bom dia\n",),
      TjRuntimeError,
      "No timesheet header found",
    );
  });

  it("checkSheet aceita a folha e apaga a cópia de depuração", async () => {
    const store = makeStore();
    const receiver = makeReceiver(store,);
    await receiver.runCreateDirectories();
    receiver.prepare("dev", DATE, "dev@example.com",);

    assertEquals(await receiver.runCheckSheet(SHEET,), true,);
    assertEquals(MessageHandlerInstance.instance.errors, 0,);
    assertEquals(
      store.files.has("TimeSheets/FailedSheets/dev-2026-05-18.tji",),
      false,
    );
  });

  it("checkSheet rejeita folha com erros e guarda a cópia", async () => {
    const store = makeStore();
    const receiver = makeReceiver(store,);
    await receiver.runCreateDirectories();
    receiver.prepare("dev", DATE, "dev@example.com",);

    await assertRejects(
      () => receiver.runCheckSheet(BAD_SHEET,),
      TjRuntimeError,
      "ts_no_remaining",
    );
    assertEquals(
      store.files.get("TimeSheets/FailedSheets/dev-2026-05-18.tji",),
      BAD_SHEET,
    );
  });

  it("checkSheet exige projeto", async () => {
    const store = makeStore();
    const receiver = makeReceiver(store,);
    await receiver.runCreateDirectories();
    receiver.prepare("dev", DATE, "dev@example.com",);
    receiver.project = null;

    await assertRejects(
      () => receiver.runCheckSheet(SHEET,),
      TjRuntimeError,
      "no project attached",
    );
  });

  it("fileSheet grava via fileStore e envia a confirmação", async () => {
    const store = makeStore();
    const receiver = makeReceiver(store,);
    await receiver.runCreateDirectories();
    receiver.prepare("dev", DATE, "dev@example.com",);

    await receiver.runFileSheet(SHEET,);

    assertEquals(
      store.files.get("TimeSheets/2026-05-18/dev_2026-05-18.tji",),
      SHEET,
    );
    assertEquals(
      store.files.get("TimeSheets/2026-05-18/all.tji",),
      "include 'dev_2026-05-18.tji' { }\n",
    );
    assertEquals(
      store.files.get("TimeSheets/all.tji",),
      "\ninclude '2026-05-18/all.tji' { }",
    );
    const reply = parseEmailMessage(
      [...outboxFiles(store,).values(),][0] ?? "",
    );
    assertStringIncludes(
      reply.subject,
      "Report from Developer for 2026-05-18",
    );
    // O RichText reescreve `== Título ==` como linha de título (sem os `=`).
    assertStringIncludes(
      reply.content,
      "Report from Developer for the period ending 2026-05-18",
    );
  });

  it("processEmail devolve a folha aceita na confirmação", async () => {
    const store = makeStore();
    const receiver = makeReceiver(store,);

    await receiver.processEmail(makeMail({ attachment: SHEET, },),);

    const reply = parseEmailMessage(
      [...outboxFiles(store,).values(),][0] ?? "",
    );
    assertStringIncludes(
      reply.subject,
      "Report from Developer for 2026-05-18",
    );
    // A folha entra como texto literal (`<nowiki>`), sem virar markup.
    assertStringIncludes(reply.content, "timesheet dev 2026-05-11",);
  });

  it("fileSheet não repete a pasta no all.tji do topo", async () => {
    const store = makeStore();
    const receiver = makeReceiver(store,);
    await receiver.runCreateDirectories();
    receiver.prepare("dev", DATE, "dev@example.com",);
    await receiver.runFileSheet(SHEET,);
    receiver.prepare("alice", DATE, "alice@example.com",);
    await receiver.runFileSheet(SHEET.replace("dev ", "alice ",),);

    assertEquals(
      store.files.get("TimeSheets/2026-05-18/all.tji",),
      "include 'alice_2026-05-18.tji' { }\n" +
        "include 'dev_2026-05-18.tji' { }\n",
    );
    // Ordem alfabética das folhas — e a pasta entra uma única vez no topo.
    assertEquals(
      store.files.get("TimeSheets/all.tji",),
      "\ninclude '2026-05-18/all.tji' { }",
    );
  });

  it("getResourceList lê resources.json", async () => {
    const receiver = makeReceiver();
    receiver.prepare("dev", DATE, "dev@example.com",);

    const list = await receiver.runGetResourceList();
    assertEquals(list.length, 2,);
    assertEquals(list.map((item,) => item.id), ["alice", "dev",],);
  });

  it("getResourceEmail e getResourceName consultam a lista", async () => {
    const receiver = makeReceiver();
    receiver.prepare("dev", DATE, "dev@example.com",);

    assertEquals(await receiver.runGetResourceEmail(), "dev@example.com",);
    assertEquals(await receiver.runGetResourceName(), "Developer",);
    assertEquals(await receiver.runGetResourceName("alice",), "Alice",);
  });

  it("getResourceEmail rejeita recurso fora da lista", async () => {
    const receiver = makeReceiver();
    receiver.prepare("ghost", DATE, "dev@example.com",);

    await assertRejects(
      () => receiver.runGetResourceEmail(),
      TjRuntimeError,
      "Resource ID 'ghost' not found in list",
    );
  });

  it("getResourceList falha sem a data do período", async () => {
    const receiver = makeReceiver();
    await assertRejects(
      () => receiver.runGetResourceList(),
      TjRuntimeError,
      "@date not set",
    );
  });

  it("processEmail exige FileStore", async () => {
    const receiver = new TestReceiver("time",);
    receiver.senderEmail = "pm@example.com";
    receiver.smtpServer = "localhost";

    await assertRejects(
      () => receiver.processEmail(makeMail({ attachment: SHEET, },),),
      TjRuntimeError,
      "no FileStore configured",
    );
  });
});

describe("emailDigest", () => {
  it("gera 32 caracteres hexadecimais determinísticos", () => {
    const digest = emailDigest("<abc.123@example.com>",);
    assertEquals(digest.length, 32,);
    assert(/^[0-9a-f]{32}$/u.test(digest,),);
    assertEquals(digest, emailDigest("<abc.123@example.com>",),);
    assert(digest !== emailDigest("<outra@example.com>",),);
  });
});

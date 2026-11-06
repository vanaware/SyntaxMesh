/**
 * Testes de `SheetHandlerBase` (tarefa 18.5).
 *
 * Cobrem o que é observável sem SMTP: `cutOut`, validação de configuração,
 * no-op do SCM, roteamento de mensagens e a entrega da mensagem em
 * `outbox/*.eml` via `FileStore` (ADR 036/037).
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.5)
 */
import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { TjRuntimeError, } from "../../src/model/errors.ts";
import { RichText, } from "../../src/richtext/rich-text.ts";
import {
  fromBase64,
  toBase64,
  wrapBase64,
} from "../../src/sheets/email-message.ts";
import {
  OUTBOX_DIR,
  SheetHandlerBase,
  sprintf,
} from "../../src/sheets/sheet-handler-base.ts";
import { fakeOpfs, } from "../helpers/fake-opfs.ts";

/** Relógio fixo: `Date` e o nome do `.eml` ficam determinísticos. */
const FIXED_NOW = new Date("2026-05-18T10:00:00Z",);

/** Handler com `senderEmail` e relógio fixos — base dos testes de email. */
function makeHandler(appName = "tj3ts_sender",): SheetHandlerBase {
  const handler = new SheetHandlerBase(appName,);
  handler.senderEmail = "pm@example.com";
  handler.clock = () => FIXED_NOW;
  return handler;
}

/** Corpo de email com a seção marcada, como o receiver a recebe. */
const QUOTED_BODY = [
  "Please fill out your report.",
  "",
  "> # --------8<--------8<--------",
  "> timesheet dev 2026-05-11 - 2026-05-18 {",
  ">   work 50%",
  "> }",
  ">",
  "> # -------->8-------->8--------",
  "",
  "Thanks",
].join("\n",) + "\n";

const UNQUOTED_BODY = [
  "Please fill out your report.",
  "",
  "# --------8<--------8<--------",
  "timesheet dev 2026-05-11 - 2026-05-18 {",
  "  work 50%",
  "}",
  "# -------->8-------->8--------",
  "",
  "Thanks",
].join("\n",) + "\n";

/** Seção esperada do corpo sem quotes (não há linha vazia antes do fim). */
const CUT_OUT_PLAIN = [
  "# --------8<--------8<--------",
  "timesheet dev 2026-05-11 - 2026-05-18 {",
  "  work 50%",
  "}",
  "# -------->8-------->8--------",
  "",
].join("\n",);

/** Seção esperada do corpo citado: a linha `>` vira linha vazia. */
const CUT_OUT_QUOTED = [
  "# --------8<--------8<--------",
  "timesheet dev 2026-05-11 - 2026-05-18 {",
  "  work 50%",
  "}",
  "",
  "# -------->8-------->8--------",
  "",
].join("\n",);

describe("SheetHandlerBase", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("constructor aplica os defaults do Ruby", () => {
    const handler = new SheetHandlerBase("tj3ts_receiver",);
    assertEquals(handler.appName, "tj3ts_receiver",);
    assertEquals(handler.emailDeliveryMethod, "smtp",);
    assertEquals(handler.smtpServer, null,);
    assertEquals(handler.senderEmail, null,);
    assertEquals(handler.workingDir, null,);
    assertEquals(handler.scmCommand, null,);
    assertEquals(handler.projectId, "prj",);
    assertEquals(handler.outputLevel, 2,);
    assertEquals(handler.logLevel, 3,);
    assertEquals(handler.dryRun, false,);
    assertEquals(handler.logFile, "timesheets.log",);
    assertEquals(handler.emailFailure, false,);
    assertEquals(handler.getFileStore(), null,);
  });

  it("setFileStore/getFileStore guardam o store injetado", () => {
    const handler = new SheetHandlerBase("test",);
    const store = fakeOpfs();
    handler.setFileStore(store,);
    assert(handler.getFileStore() === store,);
  });

  it("setFileStore pode ser trocado (último vence)", () => {
    const handler = new SheetHandlerBase("test",);
    const first = fakeOpfs();
    const second = fakeOpfs({ "a.txt": "a", },);
    handler.setFileStore(first,);
    handler.setFileStore(second,);
    assert(handler.getFileStore() === second,);
  });

  it("cutOut extrai a seção entre os marcadores", () => {
    const handler = new SheetHandlerBase("test",);
    assertEquals(handler.cutOut(UNQUOTED_BODY,), CUT_OUT_PLAIN,);
  });

  it("cutOut sem marcadores devolve o texto original", () => {
    const handler = new SheetHandlerBase("test",);
    const text = "Just a body\nwith two lines\n";
    assertEquals(handler.cutOut(text,), text,);
  });

  it("cutOut remove os prefixos de quote", () => {
    const handler = new SheetHandlerBase("test",);
    const out = handler.cutOut(QUOTED_BODY,);
    assertEquals(out, CUT_OUT_QUOTED,);
  });

  it("cutOut normaliza a linha vazia citada como '>'", () => {
    const handler = new SheetHandlerBase("test",);
    const out = handler.cutOut(QUOTED_BODY,);
    assertStringIncludes(out, "}\n\n# -------->8-------->8--------",);
    // Nenhuma linha conserva o prefixo de quote (os marcadores têm `>`
    // próprios, então a checagem é por início de linha).
    assert(!out.split("\n",).some((line,) => line.startsWith("> ",)),);
  });

  it("setWorkingDir valida smtp sem servidor (aviso, não erro)", async () => {
    const handler = makeHandler();
    await handler.setWorkingDir();
    const messages = MessageHandlerInstance.instance.messages;
    assertEquals(MessageHandlerInstance.instance.errors, 0,);
    assert(
      messages.some((m,) =>
        m.type === "warning" && m.message.includes("smtpServer",)
      ),
    );
  });

  it("setWorkingDir aceita sendmail sem checagens de SMTP", async () => {
    const handler = makeHandler();
    handler.emailDeliveryMethod = "sendmail";
    await handler.setWorkingDir();
    const messages = MessageHandlerInstance.instance.messages;
    assertEquals(MessageHandlerInstance.instance.errors, 0,);
    assertEquals(messages.length, 0,);
  });

  it("setWorkingDir exige senderEmail", async () => {
    const handler = new SheetHandlerBase("test",);
    await assertRejects(() => handler.setWorkingDir(), TjRuntimeError,);
    assertEquals(MessageHandlerInstance.instance.errors, 1,);
  });

  it("setWorkingDir cria o diretório de trabalho via FileStore", async () => {
    const handler = makeHandler();
    const store = fakeOpfs();
    handler.setFileStore(store,);
    handler.workingDir = "work/sheets";
    await handler.setWorkingDir();
    assert(await store.exists("work/sheets",),);
  });

  it("addToScm é no-op sem scmCommand", () => {
    const handler = makeHandler();
    const store = fakeOpfs();
    handler.setFileStore(store,);
    handler.addToScm("2026-05-18", "TimeSheets/dev.tji",);
    assertEquals(MessageHandlerInstance.instance.messages.length, 0,);
    assertEquals(handler.logEntries.length, 0,);
    assertEquals(store.files.size, 0,);
  });

  it("addToScm avisa quando há scmCommand (subprocesso inexistente)", () => {
    const handler = makeHandler();
    handler.scmCommand = "git add %f";
    handler.addToScm("2026-05-18", "TimeSheets/dev.tji",);
    const messages = MessageHandlerInstance.instance.messages;
    assertEquals(messages.length, 1,);
    const message = messages[0];
    assert(message !== undefined,);
    assertEquals(message.type, "warning",);
    assertStringIncludes(message.message, "scm_not_supported_in_browser",);
    assertStringIncludes(message.message, "TimeSheets/dev.tji",);
  });

  it("info registra mensagem de info quando outputLevel >= 3", () => {
    const handler = makeHandler();
    handler.outputLevel = 3;
    handler.info("Adding report from Dev",);
    const messages = MessageHandlerInstance.instance.messages;
    assertEquals(messages.length, 1,);
    const message = messages[0];
    assert(message !== undefined,);
    assertEquals(message.type, "info",);
    assertEquals(message.id, "sheet_info",);
    assertEquals(message.message, "Adding report from Dev",);
  });

  it("info é silencioso com outputLevel 2 (default)", () => {
    const handler = makeHandler();
    handler.info("Adding report from Dev",);
    assertEquals(MessageHandlerInstance.instance.messages.length, 0,);
    assertEquals(handler.logEntries.length, 1,);
  });

  it("error registra e levanta TjRuntimeError", () => {
    const handler = makeHandler();
    assertThrows(() => handler.error("boom",), TjRuntimeError,);
    assertEquals(MessageHandlerInstance.instance.errors, 1,);
    assertEquals(handler.logEntries.at(-1,)?.type, "ERROR",);
  });

  it("log fica em memória e nunca toca o FileStore", () => {
    const handler = makeHandler();
    const store = fakeOpfs();
    handler.setFileStore(store,);
    handler.log("INFO", "hello",);
    assertEquals(handler.logEntries.length, 1,);
    const entry = handler.logEntries[0];
    assert(entry !== undefined,);
    assertEquals(entry.timestamp, FIXED_NOW.toISOString(),);
    assertEquals(entry.type, "INFO",);
    assertEquals(store.files.size, 0,);
    assertEquals(MessageHandlerInstance.instance.messages.length, 0,);
  });

  it("sendRichTextEmail em dryRun devolve a mensagem sem gravar", async () => {
    const handler = makeHandler();
    const store = fakeOpfs();
    handler.setFileStore(store,);
    handler.dryRun = true;
    const email = await handler.sendRichTextEmail(
      "dev@example.com",
      "Weekly report",
      "== Report ==\n\nAll good.",
    );
    assertEquals(email.to, "dev@example.com",);
    assertEquals(email.from, "pm@example.com",);
    assertEquals(email.subject, "Weekly report",);
    assert(email.html !== null,);
    assertStringIncludes(email.text, "Report",);
    assertEquals(store.files.size, 0,);
    assert(
      handler.logEntries.some((e,) => e.message.includes("Show email",)),
    );
  });

  it("sendRichTextEmail grava outbox/<to>_<date>.eml", async () => {
    const handler = makeHandler();
    const store = fakeOpfs();
    handler.setFileStore(store,);
    const tji = "timesheet dev 2026-05-11 - 2026-05-18 {\n  work 50%\n}\n";
    const email = await handler.sendRichTextEmail(
      "dev@example.com",
      "Weekly report",
      "== Report ==\n\nAll good.",
      { name: "dev_2026-05-18.tji", content: tji, },
    );
    const path = `${OUTBOX_DIR}/dev@example.com_2026-05-18.eml`;
    assert(await store.exists(path,),);
    assertEquals(await store.read(path,), email.raw,);
    assertEquals(email.attachment, tji,);
    assertEquals(fromBase64(email.attachmentBase64 ?? "",), tji,);
  });

  it("sendRichTextEmail sem FileStore avisa no_filestore uma vez", async () => {
    const handler = makeHandler();
    const first = await handler.sendEmail("a@b.com", "One", "Body",);
    const second = await handler.sendEmail("a@b.com", "Two", "Body",);
    assertEquals(first.subject, "One",);
    assertEquals(second.subject, "Two",);
    const warnings = MessageHandlerInstance.instance.messages.filter((m,) =>
      m.type === "warning" && m.message.includes("no_filestore",)
    );
    assertEquals(warnings.length, 1,);
  });

  it("sendEmail devolve texto puro e sem parte HTML", async () => {
    const handler = makeHandler();
    const email = await handler.sendEmail(
      "a@b.com",
      "Hi",
      "Plain body",
      null,
      "other@x.com",
      "<prev@x.com>",
    );
    assertEquals(email.text, "Plain body",);
    assertEquals(email.html, null,);
    assertEquals(email.from, "other@x.com",);
    assertEquals(email.inReplyTo, "<prev@x.com>",);
    assertEquals(email.attachment, null,);
    assertStringIncludes(email.raw, "To: a@b.com",);
    assertStringIncludes(email.raw, "In-Reply-To: <prev@x.com>",);
  });

  it("sendEmail anexa um arquivo lido do FileStore", async () => {
    const handler = makeHandler();
    const store = fakeOpfs({ "TimeSheets/dev_2026-05-18.tji": "sheet", },);
    handler.setFileStore(store,);
    const email = await handler.sendEmail(
      "a@b.com",
      "Hi",
      "Body",
      "TimeSheets/dev_2026-05-18.tji",
    );
    assertEquals(email.attachmentName, "dev_2026-05-18.tji",);
    assertEquals(email.attachment, "sheet",);
  });

  it("htmlMailBody embute a folha de estilo no documento", () => {
    const handler = makeHandler();
    const richText = new RichText("== Title ==\n\nText",)
      .generateIntermediateFormat();
    assert(richText !== null,);
    const html = handler.htmlMailBody(richText,);
    assertStringIncludes(html, "<!DOCTYPE html>",);
    assertStringIncludes(html, '<style type="text/css">',);
    assertStringIncludes(html, "font-family",);
    assertStringIncludes(html, "<body>",);
    assert(!html.includes("tjreport.css",),);
  });
});

describe("email-message", () => {
  it("toBase64 cobre os três casos de padding", () => {
    assertEquals(toBase64("",), "",);
    assertEquals(toBase64("a",), "YQ==",);
    assertEquals(toBase64("ab",), "YWI=",);
    assertEquals(toBase64("abc",), "YWJj",);
  });

  it("fromBase64 desfaz toBase64 com caracteres não-ASCII", () => {
    const text = "ação — relatório\n";
    assertEquals(fromBase64(toBase64(text,),), text,);
  });

  it("fromBase64 ignora quebras de linha", () => {
    assertEquals(fromBase64("YWJj\nZGVm",), "abcdef",);
  });

  it("wrapBase64 quebra em linhas de 76 colunas", () => {
    const lines = wrapBase64("A".repeat(160,),).split("\n",);
    assertEquals(lines.map((l,) => l.length), [76, 76, 8,],);
  });
});

describe("sprintf", () => {
  it("consome %s em ordem e ignora sobras", () => {
    assertEquals(sprintf("%s-%s", "a", "b", "c",), "a-b",);
  });

  it("verbo sem valor vira string vazia", () => {
    assertEquals(sprintf("[%s]",), "[]",);
  });

  it("aceita %d e converte números", () => {
    assertEquals(
      sprintf("The following %d person(s) have not yet submitted", 3,),
      "The following 3 person(s) have not yet submitted",
    );
  });
});

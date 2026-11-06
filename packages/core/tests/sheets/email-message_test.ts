/**
 * Testes do parser de email (`email-message.ts`) usado pelo `SheetReceiver`.
 *
 * O Ruby delega ao gem `mail`; aqui o texto RFC 822/MIME é lido à mão, então o
 * contrato precisa de testes próprios: round-trip com `formatEmailMessage`,
 * multipart aninhado, base64, quoted-printable e nomes de anexo.
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.7)
 */
import { assertEquals, assertStringIncludes, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import {
  decodeTransferEncoding,
  extractAddress,
  formatEmailMessage,
  fromQuotedPrintable,
  parseEmailHeaders,
  parseEmailMessage,
  parseHeaderParams,
  toBase64,
} from "../../src/sheets/email-message.ts";

/** Mensagem mínima para o round-trip (sem anexo, sem HTML). */
function makeRaw(
  overrides: { text?: string; attachment?: string | null } = {},
): string {
  const attachment = overrides.attachment ?? null;
  return formatEmailMessage({
    to: "ts@example.com",
    from: "Dev <dev@example.com>",
    subject: "Re: sua folha",
    date: "Mon, 18 May 2026 10:00:00 GMT",
    text: overrides.text ?? "Olá!\n",
    html: null,
    attachmentName: attachment === null ? null : "dev.tji",
    attachment,
    attachmentBase64: attachment === null ? null : toBase64(attachment,),
    inReplyTo: null,
    appName: "tj3ts_sender",
  },);
}

describe("parseEmailMessage", () => {
  it("faz o round-trip de uma mensagem sem anexo", () => {
    const mail = parseEmailMessage(makeRaw({ text: "Segue a folha.\n", },),);
    assertEquals(mail.from, "dev@example.com",);
    assertEquals(mail.to, "ts@example.com",);
    assertEquals(mail.subject, "Re: sua folha",);
    assertEquals(mail.content, "Segue a folha.\n",);
    assertEquals(mail.contentType, "multipart/mixed",);
    assertEquals(mail.attachments, [],);
    assertEquals(mail.messageId, null,);
  });

  it("faz o round-trip de uma mensagem com anexo", () => {
    const sheet = "timesheet dev 2026-05-18 {\n}\n";
    const mail = parseEmailMessage(makeRaw({ attachment: sheet, },),);
    assertEquals(mail.attachments.length, 1,);
    assertEquals(mail.attachments[0]!.fileName, "dev.tji",);
    assertEquals(mail.attachments[0]!.content, sheet,);
    // O corpo continua sendo o `text/plain`, não o anexo.
    assertEquals(mail.content, "Olá!\n",);
  });

  it("lê o Message-ID quando presente", () => {
    const raw = makeRaw().replace(
      "MIME-Version: 1.0",
      "Message-ID: <abc@example.com>\r\nMIME-Version: 1.0",
    );
    assertEquals(parseEmailMessage(raw,).messageId, "<abc@example.com>",);
  });

  it("prefere o text/plain em multipart/alternative", () => {
    const raw = [
      "From: dev@example.com",
      "Subject: teste",
      'Content-Type: multipart/alternative; boundary="b1"',
      "",
      "--b1",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      "texto puro",
      "--b1",
      "Content-Type: text/html; charset=UTF-8",
      "",
      "<p>html</p>",
      "--b1--",
      "",
    ].join("\r\n",);
    const mail = parseEmailMessage(raw,);
    assertEquals(mail.content, "texto puro",);
    assertEquals(mail.attachments, [],);
  });

  it("mensagem sem Content-Type é só texto", () => {
    const mail = parseEmailMessage("From: dev@example.com\r\n\r\ncorpo\n",);
    assertEquals(mail.from, "dev@example.com",);
    assertEquals(mail.content, "corpo\n",);
    assertEquals(mail.attachments, [],);
  });

  it("decodifica quoted-printable no corpo", () => {
    const raw = [
      "From: dev@example.com",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "Ol=C3=A1, mundo!",
      "",
    ].join("\r\n",);
    // O `\r\n` final do corpo vira `\n` e é preservado.
    assertEquals(parseEmailMessage(raw,).content, "Olá, mundo!\n",);
  });

  it("junta linhas de cabeçalho dobradas", () => {
    const raw = [
      "From: dev@example.com",
      "Subject: uma linha",
      " muito longa",
      "Content-Type: text/plain",
      "",
      "corpo",
    ].join("\r\n",);
    assertEquals(parseEmailMessage(raw,).subject, "uma linha muito longa",);
  });
});

describe("parseEmailHeaders", () => {
  it("normaliza as chaves para minúsculas", () => {
    const headers = parseEmailHeaders(
      "From: a@b.c\nMessage-ID: <x@y>\nContent-Type: text/plain",
    );
    assertEquals(headers["from"], "a@b.c",);
    assertEquals(headers["message-id"], "<x@y>",);
    assertEquals(headers["content-type"], "text/plain",);
  });

  it("ignora linhas sem ':'", () => {
    const headers = parseEmailHeaders("From: a@b.c\nlixo\nTo: c@d.e",);
    assertEquals(Object.keys(headers,), ["from", "to",],);
  });
});

describe("parseHeaderParams", () => {
  it("separa tipo e parâmetros, removendo as aspas", () => {
    const parsed = parseHeaderParams(
      'multipart/mixed; boundary="abc"; charset=UTF-8',
    );
    assertEquals(parsed.type, "multipart/mixed",);
    assertEquals(parsed.params["boundary"], "abc",);
    assertEquals(parsed.params["charset"], "UTF-8",);
  });

  it("devolve tipo vazio sem valor", () => {
    assertEquals(parseHeaderParams(undefined,), { type: "", params: {}, },);
  });
});

describe("fromQuotedPrintable", () => {
  it("decodifica bytes e soft breaks", () => {
    assertEquals(fromQuotedPrintable("Ol=C3=A1",), "Olá",);
    assertEquals(fromQuotedPrintable("linha =\nquebrada",), "linha quebrada",);
  });
});

describe("decodeTransferEncoding", () => {
  it("não mexe no texto sem codificação conhecida", () => {
    assertEquals(decodeTransferEncoding("texto", undefined,), "texto",);
    assertEquals(decodeTransferEncoding("texto", "7bit",), "texto",);
  });

  it("aplica base64", () => {
    assertEquals(decodeTransferEncoding(toBase64("ação",), "base64",), "ação",);
  });
});

describe("extractAddress", () => {
  it("extrai o endereço entre <>", () => {
    assertEquals(extractAddress("Dev <dev@example.com>",), "dev@example.com",);
    assertEquals(extractAddress("dev@example.com",), "dev@example.com",);
    assertEquals(extractAddress("  dev@example.com  ",), "dev@example.com",);
  });
});

describe("formatEmailMessage", () => {
  it("usa CRLF e um único boundary", () => {
    const raw = makeRaw();
    assertStringIncludes(raw, "\r\n",);
    assertStringIncludes(raw, "Content-Type: multipart/mixed; boundary=",);
  });
});

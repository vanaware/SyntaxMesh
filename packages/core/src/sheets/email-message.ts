/**
 * `EmailMessage` — a mensagem de email como **dado**, não como socket (ADR 036).
 *
 * O TaskJuggler original monta um objeto `Mail` e chama `deliver` (SMTP ou
 * `sendmail`). O browser não abre portas de email, então o core monta a
 * mensagem e a **devolve**: a UI (Fase 20) oferece download/copiar, a CLI
 * (Fase 24) imprime em stdout. A serialização MIME é a mesma nos dois caminhos
 * e serve de entrada para o receiver, que reprocessa o texto.
 *
 * @see docs/taskjuggler/lib/taskjuggler/SheetHandlerBase.rb (sendEmail)
 * @see docs/syntaxmesh/decisoes/036-sheets-sem-smtp.md
 */

import { AppConfig, } from "../app-config.ts";

/** Anexo já materializado em memória (nome exibido + conteúdo claro). */
export interface EmailAttachment {
  /** Nome do arquivo, como aparece no cliente de email. */
  name: string;
  /** Conteúdo em claro (a codificação base64 é feita na serialização). */
  content: string;
}

/**
 * Formas aceitas por `sendEmail`/`sendRichTextEmail`:
 * - `string` — caminho lido do `FileStore` injetado (fidelidade ao Ruby, que
 *   recebia o nome de um arquivo em disco);
 * - {@link EmailAttachment} — conteúdo já em memória (usado pelos apps, que
 *   geram o `.smx` sem tocar disco).
 */
export type EmailAttachmentInput = string | EmailAttachment | null;

/** Mensagem pronta para ser entregue ao usuário (baixar, imprimir, enviar). */
export interface EmailMessage {
  /** Destinatário (cabeçalho `To`). */
  to: string;
  /** Remetente (cabeçalho `From`). */
  from: string;
  subject: string;
  /** Data em formato RFC 2822 (`Date`). */
  date: string;
  /** Corpo `text/plain`, já decodificado. */
  text: string;
  /** Corpo `text/html`, ou `null` em `sendEmail`. */
  html: string | null;
  /** Nome do anexo, ou `null` quando não há anexo. */
  attachmentName: string | null;
  /** Conteúdo do anexo em claro — o que o app consome. */
  attachment: string | null;
  /** O mesmo conteúdo em base64 RFC 2045 (76 colunas), ou `null`. */
  attachmentBase64: string | null;
  /** Id da mensagem respondida, ou `null`. */
  inReplyTo: string | null;
  /** Valor de `X-TaskJuggler` — o app que originou a mensagem. */
  appName: string;
  /** Texto RFC 822 completo: é isto que o receiver consome. */
  raw: string;
}

/**
 * Separador das partes MIME. O alfabeto base64 não contém `-`, então o
 * boundary nunca colide com um corpo codificado.
 */
export const MAIL_BOUNDARY = "----=_SyntaxMesh_Mail_Part";

const B64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const B64_LOOKUP = new Map<string, number>(
  [...B64_ALPHABET,].map((char, index,) => [char, index,] as const),
);

/**
 * Codifica texto UTF-8 em base64.
 *
 * Feito à mão (e não com `btoa`) porque `btoa` só aceita *binary strings*: um
 * acento em `ação` estouraria `InvalidCharacterError`.
 */
export function toBase64(text: string,): string {
  const bytes = new TextEncoder().encode(text,);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    out += B64_ALPHABET.charAt(b0 >> 2,);
    out += B64_ALPHABET.charAt(((b0 & 0x03) << 4) | (b1 >> 4),);
    out += i + 1 < bytes.length
      ? B64_ALPHABET.charAt(((b1 & 0x0f) << 2) | (b2 >> 6),)
      : "=";
    out += i + 2 < bytes.length ? B64_ALPHABET.charAt(b2 & 0x3f,) : "=";
  }
  return out;
}

/** Decodifica base64 (ignorando quebras de linha e espaços) para texto UTF-8. */
export function fromBase64(encoded: string,): string {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of encoded.replace(/\s+/gu, "",)) {
    if (char === "=") break;
    const value = B64_LOOKUP.get(char,);
    if (value === undefined) {
      throw new Error(`Invalid base64 character '${char}'`,);
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff,);
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes,),);
}

/** Quebra base64 em linhas de `width` colunas (RFC 2045 exige ≤ 76). */
export function wrapBase64(encoded: string, width = 76,): string {
  const lines: string[] = [];
  for (let i = 0; i < encoded.length; i += width) {
    lines.push(encoded.slice(i, i + width,),);
  }
  return lines.join("\n",);
}

/** Data RFC 2822 a partir de um `Date` (sempre em UTC: saída determinística). */
export function rfc2822Date(date: Date,): string {
  return date.toUTCString();
}

/** `YYYY-MM-DD` (UTC) — usado no nome dos arquivos de `outbox/`. */
export function isoDate(date: Date,): string {
  const pad = (value: number,): string => String(value,).padStart(2, "0",);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1,)}-${
    pad(date.getUTCDate(),)
  }`;
}

/** Basename de um caminho no estilo POSIX (o `FileStore` fala `/`). */
export function baseName(path: string,): string {
  const idx = path.lastIndexOf("/",);
  return idx < 0 ? path : path.slice(idx + 1,);
}

// ---------------------------------------------------------------------------
// Leitura (lado do receiver — 18.7)
// ---------------------------------------------------------------------------

/** Cabeçalhos com as chaves em minúsculas (`content-type`, `message-id`, …). */
export type EmailHeaders = Record<string, string>;

/** Parte de uma mensagem MIME já decodificada. */
export interface EmailPart {
  /** Tipo MIME (`text/plain`, `application/octet-stream`, …); `""` se ausente. */
  contentType: string;
  /** Nome do arquivo quando a parte é um anexo; `null` no corpo. */
  fileName: string | null;
  /** Conteúdo em claro (base64 e quoted-printable já resolvidos). */
  content: string;
}

/**
 * Mensagem recebida, pronta para o `SheetReceiver` (18.7).
 *
 * Equivale ao `Mail` do Ruby (`SheetReceiver.rb` l.89): `text` é o corpo
 * `text/plain` decodificado e `attachments` são as partes com nome de arquivo.
 */
export interface ParsedEmailMessage extends EmailPart {
  /** Endereço do remetente, sem o nome de exibição. */
  from: string;
  /** Endereço do destinatário (`To`). */
  to: string;
  subject: string;
  /** Valor de `Message-ID` (com os `<>`), ou `null`. */
  messageId: string | null;
  headers: EmailHeaders;
  attachments: EmailPart[];
}

/** Normaliza CRLF/CR em LF (o parser trabalha só com `\n`). */
function normalizeEol(text: string,): string {
  return text.replace(/\r\n/gu, "\n",).replace(/\r/gu, "\n",);
}

/** Separa o bloco de cabeçalhos do corpo na primeira linha vazia. */
function splitHeaderBlock(raw: string,): { headerText: string; body: string } {
  const idx = raw.indexOf("\n\n",);
  if (idx < 0) return { headerText: raw, body: "", };
  return { headerText: raw.slice(0, idx,), body: raw.slice(idx + 2,), };
}

/**
 * Lê o bloco de cabeçalhos em um mapa.
 *
 * Linhas de continuação (começando com espaço ou tab) são unidas à anterior
 * (RFC 5322 §2.2.3). Em cabeçalhos repetidos vence o primeiro: as duplicatas
 * relevantes para os sheets (`Message-ID`, `From`) são únicas.
 */
export function parseEmailHeaders(headerText: string,): EmailHeaders {
  const headers: EmailHeaders = {};
  const unfolded = headerText.replace(/\n[ \t]+/gu, " ",);
  for (const line of unfolded.split("\n",)) {
    if (line.trim() === "") continue;
    const idx = line.indexOf(":",);
    if (idx < 0) continue;
    const name = line.slice(0, idx,).trim().toLowerCase();
    const value = line.slice(idx + 1,).trim();
    if (headers[name] === undefined) headers[name] = value;
  }
  return headers;
}

/**
 * Decompõe `type/subtype; a=1; b="2"` em tipo e parâmetros.
 *
 * Divergência: separar por `;` sem respeitar aspas quebra nomes de arquivo que
 * contenham ponto e vírgula. Os sheets usam nomes gerados (`<res>_<data>.smx`).
 */
export function parseHeaderParams(
  value: string | undefined,
): { type: string; params: Record<string, string> } {
  const params: Record<string, string> = {};
  if (value === undefined || value.trim() === "") {
    return { type: "", params, };
  }
  const segments = value.split(";",);
  const type = (segments.shift() ?? "").trim().toLowerCase();
  for (const segment of segments) {
    const idx = segment.indexOf("=",);
    if (idx < 0) continue;
    const key = segment.slice(0, idx,).trim().toLowerCase();
    let param = segment.slice(idx + 1,).trim();
    if (param.length >= 2 && param.startsWith('"',) && param.endsWith('"',)) {
      param = param.slice(1, -1,);
    }
    params[key] = param;
  }
  return { type, params, };
}

/** Decodifica `quoted-printable` (RFC 2045 §6.7), inclusive soft breaks. */
export function fromQuotedPrintable(encoded: string,): string {
  const text = encoded.replace(/=\r?\n/gu, "",);
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i,);
    const hex = text.slice(i + 1, i + 3,);
    if (char === "=" && /^[0-9A-Fa-f]{2}$/u.test(hex,)) {
      bytes.push(Number.parseInt(hex, 16,),);
      i += 2;
      continue;
    }
    for (const byte of new TextEncoder().encode(char,)) bytes.push(byte,);
  }
  return new TextDecoder().decode(new Uint8Array(bytes,),);
}

/** Aplica o `Content-Transfer-Encoding` de uma parte. */
export function decodeTransferEncoding(
  body: string,
  encoding: string | undefined,
): string {
  switch ((encoding ?? "").trim().toLowerCase()) {
    case "base64":
      return fromBase64(body,);
    case "quoted-printable":
      return fromQuotedPrintable(body,);
    default:
      return body;
  }
}

/**
 * Divide um corpo `multipart/*` nas partes delimitadas por `--boundary`.
 *
 * Preâmbulo e epílogo (fora dos delimitadores) são descartados, como no
 * `Mail` do Ruby.
 */
function splitMultipart(body: string, boundary: string,): string[] {
  const delimiter = `--${boundary}`;
  const parts: string[] = [];
  let current: string[] | null = null;
  for (const line of body.split("\n",)) {
    if (line === `${delimiter}--`) {
      if (current !== null) parts.push(current.join("\n",),);
      return parts.filter((part,) => part.trim() !== "");
    }
    if (line === delimiter) {
      if (current !== null) parts.push(current.join("\n",),);
      current = [];
      continue;
    }
    if (current !== null) current.push(line,);
  }
  if (current !== null) parts.push(current.join("\n",),);
  return parts.filter((part,) => part.trim() !== "");
}

/** Parte crua (cabeçalhos + corpo) → cabeçalhos, parte decodificada e filhas. */
function parsePart(raw: string,): {
  headers: EmailHeaders;
  part: EmailPart;
  children: EmailPart[];
} {
  const { headerText, body, } = splitHeaderBlock(raw,);
  const headers = parseEmailHeaders(headerText,);
  const contentType = parseHeaderParams(headers["content-type"],);
  const disposition = parseHeaderParams(
    headers["content-disposition"],
  );
  const fileName = disposition.params["filename"] ??
    contentType.params["name"] ?? null;

  if (contentType.type.startsWith("multipart/",)) {
    const boundary = contentType.params["boundary"];
    if (boundary !== undefined && boundary !== "") {
      const children: EmailPart[] = [];
      for (const chunk of splitMultipart(body, boundary,)) {
        const nested = parsePart(chunk,);
        children.push(nested.part, ...nested.children,);
      }
      return {
        headers,
        part: { contentType: contentType.type, fileName, content: "", },
        children,
      };
    }
  }

  return {
    headers,
    part: {
      contentType: contentType.type,
      fileName,
      content: decodeTransferEncoding(
        body,
        headers["content-transfer-encoding"],
      ),
    },
    children: [],
  };
}

/** Endereço de um cabeçalho: `Alice <a@b.c>` → `a@b.c`. */
export function extractAddress(value: string,): string {
  const match = /<([^>]+)>/u.exec(value,);
  if (match !== null && match[1] !== undefined) return match[1].trim();
  return value.trim();
}

/**
 * Lê uma mensagem RFC 822/MIME completa — o inverso de
 * {@link formatEmailMessage}.
 *
 * O Ruby delega ao gem `mail`, indisponível no Deno; este parser cobre o que os
 * sheets usam: `multipart/mixed` (e aninhados), `base64` e `quoted-printable`,
 * `Content-Disposition`/`name` para o nome do anexo e o `text/plain` do corpo.
 * HTML é ignorado — o receiver só precisa do texto. O tipo do documento é
 * `text/plain` quando o cabeçalho não traz `Content-Type`.
 */
export function parseEmailMessage(raw: string,): ParsedEmailMessage {
  const root = parsePart(normalizeEol(raw,),);
  const leaves = root.children.length > 0 ? root.children : [root.part,];

  const attachments = leaves.filter((part,) => part.fileName !== null);
  const bodyPart = leaves.find((part,) =>
    part.fileName === null &&
    (part.contentType === "text/plain" || part.contentType === "")
  ) ??
    leaves.find((part,) =>
      part.fileName === null && part.contentType.startsWith("text/",)
    );

  return {
    contentType: root.part.contentType,
    fileName: root.part.fileName,
    content: bodyPart?.content ?? "",
    from: extractAddress(root.headers["from"] ?? "",),
    to: extractAddress(root.headers["to"] ?? "",),
    subject: root.headers["subject"] ?? "",
    messageId: root.headers["message-id"] ?? null,
    headers: root.headers,
    attachments,
  };
}

/**
 * Serializa a mensagem em texto RFC 822 (multipart/mixed).
 *
 * O Ruby delega ao `Mail#to_s`; aqui o formato é explícito porque é contrato
 * público — o receiver do próprio SyntaxMesh (e a CLI) reprocessam este texto.
 * Duas divergências deliberadas: as quebras de linha são `\r\n` (RFC 5322) e os
 * cabeçalhos carregam UTF-8 cru (RFC 6532) em vez de encoded-words.
 */
export function formatEmailMessage(
  message: Omit<EmailMessage, "raw">,
): string {
  const eol = "\r\n";
  const headers: string[] = [
    `From: ${message.from}`,
    `To: ${message.to}`,
    `Subject: ${message.subject}`,
    `Date: ${message.date}`,
    "MIME-Version: 1.0",
    `User-Agent: ${AppConfig.softwareName}/${AppConfig.version}`,
    `X-TaskJuggler: ${message.appName}`,
  ];
  if (message.inReplyTo !== null) {
    headers.push(`In-Reply-To: ${message.inReplyTo}`,);
  }
  headers.push(`Content-Type: multipart/mixed; boundary="${MAIL_BOUNDARY}"`,);

  const parts: string[] = [];
  parts.push(
    `--${MAIL_BOUNDARY}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(toBase64(message.text,),),
  );
  if (message.html !== null) {
    parts.push(
      `--${MAIL_BOUNDARY}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(toBase64(message.html,),),
    );
  }
  if (message.attachmentName !== null && message.attachmentBase64 !== null) {
    parts.push(
      `--${MAIL_BOUNDARY}`,
      `Content-Type: application/octet-stream; name="${message.attachmentName}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${message.attachmentName}"`,
      "",
      wrapBase64(message.attachmentBase64,),
    );
  }
  parts.push(`--${MAIL_BOUNDARY}--`,);

  return [headers.join(eol,), "", ...parts,].join(eol,);
}

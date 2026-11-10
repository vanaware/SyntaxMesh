/**
 * `EmailMessage` — an email message as **data**, not as a socket (ADR 036).
 *
 * Upstream TaskJuggler builds a `Mail` object and calls `deliver` (SMTP or
 * `sendmail`). The browser cannot open email ports, so the core builds the
 * message and **returns** it: the UI (Phase 20) offers download/copy, the CLI
 * (Phase 24) prints to stdout. The MIME serialisation is the same on both paths
 * and serves as input to the receiver, which re-reads the text.
 *
 * @see docs/taskjuggler/lib/taskjuggler/SheetHandlerBase.rb (sendEmail)
 * @see docs/syntaxmesh/decisoes/036-sheets-sem-smtp.md
 */

import { AppConfig, } from "../app-config.ts";

/** Attachment already materialised in memory (display name + clear content). */
export interface EmailAttachment {
  /** File name, as shown by the email client. */
  name: string;
  /** Clear content (base64 encoding happens during serialisation). */
  content: string;
}

/**
 * Forms accepted by `sendEmail`/`sendRichTextEmail`:
 * - `string` — path read from the injected `FileStore` (faithful to Ruby, which
 *   received the name of a file on disk);
 * - {@link EmailAttachment} — content already in memory (used by the apps, which
 *   generate the `.smx` without touching disk).
 */
export type EmailAttachmentInput = string | EmailAttachment | null;

/** Message ready to be handed to the user (download, print, send). */
export interface EmailMessage {
  /** Recipient (`To` header). */
  to: string;
  /** Sender (`From` header). */
  from: string;
  /** Subject (`Subject` header). */
  subject: string;
  /** Date in RFC 2822 format (`Date`). */
  date: string;
  /** `text/plain` body, already decoded. */
  text: string;
  /** `text/html` body, or `null` in `sendEmail`. */
  html: string | null;
  /** Attachment name, or `null` when there is no attachment. */
  attachmentName: string | null;
  /** Clear attachment content — what the app consumes. */
  attachment: string | null;
  /** Same content in RFC 2045 base64 (76 columns), or `null`. */
  attachmentBase64: string | null;
  /** Id of the message being replied to, or `null`. */
  inReplyTo: string | null;
  /** Value of `X-TaskJuggler` — the app that originated the message. */
  appName: string;
  /** Full RFC 822 text: this is what the receiver consumes. */
  raw: string;
}

/**
 * Separator of the MIME parts. The base64 alphabet has no `-`, so the boundary
 * never collides with an encoded body.
 */
export const MAIL_BOUNDARY = "----=_SyntaxMesh_Mail_Part";

const B64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const B64_LOOKUP = new Map<string, number>(
  [...B64_ALPHABET,].map((char, index,) => [char, index,] as const),
);

/**
 * Encodes UTF-8 text as base64.
 *
 * Hand-rolled (rather than `btoa`) because `btoa` only accepts *binary
 * strings*: an accented character in `ação` would raise
 * `InvalidCharacterError`.
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

/**
 * Decodes base64 (ignoring line breaks and spaces) into UTF-8 text.
 *
 * @param encoded Base64 text.
 * @returns The decoded string.
 */
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

/**
 * Wraps base64 into lines of `width` columns (RFC 2045 requires ≤ 76).
 *
 * @param encoded Base64 text.
 * @param width Maximum line width.
 * @returns The wrapped text.
 */
export function wrapBase64(encoded: string, width = 76,): string {
  const lines: string[] = [];
  for (let i = 0; i < encoded.length; i += width) {
    lines.push(encoded.slice(i, i + width,),);
  }
  return lines.join("\n",);
}

/**
 * RFC 2822 date from a `Date` (always UTC: deterministic output).
 *
 * @param date Date to format.
 * @returns The RFC 2822 representation.
 */
export function rfc2822Date(date: Date,): string {
  return date.toUTCString();
}

/**
 * `YYYY-MM-DD` (UTC) — used in the `outbox/` file names.
 *
 * @param date Date to format.
 * @returns The ISO date string.
 */
export function isoDate(date: Date,): string {
  const pad = (value: number,): string => String(value,).padStart(2, "0",);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1,)}-${
    pad(date.getUTCDate(),)
  }`;
}

/**
 * Basename of a POSIX-style path (the `FileStore` speaks `/`).
 *
 * @param path Full path.
 * @returns The last path segment.
 */
export function baseName(path: string,): string {
  const idx = path.lastIndexOf("/",);
  return idx < 0 ? path : path.slice(idx + 1,);
}

// ---------------------------------------------------------------------------
// Reading (receiver side — 18.7)
// ---------------------------------------------------------------------------

/** Headers with lowercase keys (`content-type`, `message-id`, ...). */
export type EmailHeaders = Record<string, string>;

/** Part of a MIME message, already decoded. */
export interface EmailPart {
  /** MIME type (`text/plain`, `application/octet-stream`, ...); `""` when absent. */
  contentType: string;
  /** File name when the part is an attachment; `null` for the body. */
  fileName: string | null;
  /** Clear content (base64 and quoted-printable already resolved). */
  content: string;
}

/**
 * Message that has been received, ready for the `SheetReceiver` (18.7).
 *
 * Equivalent to Ruby's `Mail` (`SheetReceiver.rb` l.89): `text` is the decoded
 * `text/plain` body and `attachments` are the parts with a file name.
 */
export interface ParsedEmailMessage extends EmailPart {
  /** Sender address, without the display name. */
  from: string;
  /** Recipient address (`To`). */
  to: string;
  /** Value of the `Subject` header. */
  subject: string;
  /** Value of `Message-ID` (including the `<>`), or `null`. */
  messageId: string | null;
  /** Every header of the top-level message, keyed in lowercase. */
  headers: EmailHeaders;
  /** Parts that carry a file name. */
  attachments: EmailPart[];
}

/**
 * Normalises CRLF/CR into LF (the parser only works with `\n`).
 *
 * @param text Raw message text.
 * @returns The normalised text.
 */
function normalizeEol(text: string,): string {
  return text.replace(/\r\n/gu, "\n",).replace(/\r/gu, "\n",);
}

/**
 * Separates the header block from the body at the first empty line.
 *
 * @param raw Message text with normalised line endings.
 * @returns The header text and the body.
 */
function splitHeaderBlock(raw: string,): { headerText: string; body: string } {
  const idx = raw.indexOf("\n\n",);
  if (idx < 0) return { headerText: raw, body: "", };
  return { headerText: raw.slice(0, idx,), body: raw.slice(idx + 2,), };
}

/**
 * Reads the header block into a map.
 *
 * Continuation lines (starting with a space or tab) are joined to the previous
 * one (RFC 5322 §2.2.3). For repeated headers the first one wins: the duplicates
 * relevant to the sheets (`Message-ID`, `From`) are unique.
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
 * Splits `type/subtype; a=1; b="2"` into type and parameters.
 *
 * Divergence: splitting on `;` without honouring quotes breaks file names that
 * contain a semicolon. The sheets use generated names (`<res>_<date>.smx`).
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

/**
 * Decodes `quoted-printable` (RFC 2045 §6.7), including soft breaks.
 *
 * @param encoded Quoted-printable text.
 * @returns The decoded string.
 */
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

/**
 * Applies the `Content-Transfer-Encoding` of a part.
 *
 * @param body Raw body of the part.
 * @param encoding Value of the `Content-Transfer-Encoding` header.
 * @returns The decoded body.
 */
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
 * Splits a `multipart/*` body into the parts delimited by `--boundary`.
 *
 * Preamble and epilogue (outside the delimiters) are discarded, as in Ruby's
 * `Mail`.
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

/** Raw part (headers + body) → headers, decoded part and children. */
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

/**
 * Address of a header: `Alice <a@b.c>` → `a@b.c`.
 *
 * @param value Raw header value.
 * @returns The bare address.
 */
export function extractAddress(value: string,): string {
  const match = /<([^>]+)>/u.exec(value,);
  if (match !== null && match[1] !== undefined) return match[1].trim();
  return value.trim();
}

/**
 * Reads a complete RFC 822/MIME message — the inverse of
 * {@link formatEmailMessage}.
 *
 * Ruby delegates to the `mail` gem, unavailable on Deno; this parser covers what
 * the sheets use: `multipart/mixed` (and nested), `base64` and
 * `quoted-printable`, `Content-Disposition`/`name` for the attachment name and
 * the `text/plain` body. HTML is ignored — the receiver only needs the text. The
 * document type is `text/plain` when the header carries no `Content-Type`.
 *
 * @param raw Full RFC 822/MIME text.
 * @returns The parsed message.
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
 * Serialises the message into RFC 822 text (multipart/mixed).
 *
 * Ruby delegates to `Mail#to_s`; here the format is explicit because it is a
 * public contract — SyntaxMesh's own receiver (and the CLI) re-read this text.
 * Two deliberate divergences: line breaks are `\r\n` (RFC 5322) and the headers
 * carry raw UTF-8 (RFC 6532) instead of encoded-words.
 *
 * @param message Message without its `raw` field yet.
 * @returns The serialised RFC 822 text.
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

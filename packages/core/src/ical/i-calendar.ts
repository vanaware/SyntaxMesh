/**
 * ICalendar — port de `ICalendar.rb` (Fase 17.5), o gerador RFC 5545.
 *
 * Estrutura idêntica ao Ruby: o documento guarda três listas (todos, events,
 * journals), serializa o envelope `BEGIN:VCALENDAR` / `PRODID` / `VERSION:2.0`,
 * concatena os componentes na ordem todos → events → journals e **dobra** o
 * resultado por `foldLines`, convertendo as quebras para CRLF.
 *
 * Fidelidades conferidas contra o Ruby:
 *   - `@uid = "#{AppConfig.packageName}-#{uid}"` — o prefixo vem do pacote.
 *   - `@creationDate = @lastModified = TjTime.new.utc` — **uma única** instância
 *     compartilhada pelos dois campos (não são duas chamadas de `now()`). O
 *     `.utc` do Ruby é redundante aqui (o `dateTime` já formata em UTC) e não é
 *     replicado — ver a nota em `component.ts` sobre o `TjTime.utc()` do port.
 *   - `dateTime` formata em UTC com `%Y%m%dT%H%M%SZ`.
 *   - `foldLines` conta **octetos** (bytes UTF-8), não caracteres, e tem o
 *     comportamento original de reiniciar a contagem em 0 na quebra sem
 *     somar os bytes do caractere que causou a quebra (Categoria C: replicado
 *     porque é assim que o `tj3` grava os arquivos reais).
 *   - O `END:VCALENDAR` do Ruby termina com `"\n"`, que `foldLines` converte
 *     em `"\r\n"` — a última linha do arquivo é CRLF.
 *
 * Divergência de organização: `foldLines` é `private` no Ruby e aqui é uma
 * função de módulo exportada, para poder ser testada diretamente (17.5.4.3-8).
 * `ICalendar#to_s` continua sendo o único chamador interno.
 *
 * @see docs/taskjuggler/lib/taskjuggler/ICalendar.rb
 * @see docs/syntaxmesh/decisoes/038-substituicao-xml.md
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.5)
 */

import { AppConfig, } from "../app-config.ts";
import { TjTime, } from "../time/tj-time.ts";
import { eachUtf8Char, } from "../utils/utf8.ts";
import type { Event, } from "./event.ts";
import type { Journal, } from "./journal.ts";
import type { Todo, } from "./todo.ts";

/** Máximo de octetos por linha de conteúdo, sem contar o final de linha. */
const LINE_LENGTH = 75;

/** Bytes UTF-8 de um code point (Ruby `String#bytesize` de um caractere). */
function utf8ByteLen(cp: number,): number {
  if (cp <= 0x7f) return 1;
  if (cp <= 0x7ff) return 2;
  if (cp <= 0xffff) return 3;
  return 4;
}

/** Ruby `String#each_line`: mantém o `\n` no fim de cada linha. */
function eachLine(str: string,): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of eachUtf8Char(str,)) {
    cur += ch;
    if (ch === "\n") {
      lines.push(cur,);
      cur = "";
    }
  }
  if (cur !== "") lines.push(cur,);
  return lines;
}

/**
 * Dobra linhas com mais de `LINELENGTH` octetos inserindo `\n` + espaço e
 * converte todas as quebras para CRLF (RFC 5545 §3.1).
 */
export function foldLines(str: string,): string {
  let newStr = "";
  for (const line of eachLine(str,)) {
    let bytes = 0;
    for (const ch of eachUtf8Char(line,)) {
      const cBytes = utf8ByteLen(ch.codePointAt(0,) ?? 0,);
      if (bytes + cBytes > LINE_LENGTH && ch !== "\n") {
        newStr += "\n ";
        bytes = 0;
      } else {
        bytes += cBytes;
      }
      newStr += ch;
    }
  }
  return newStr.replace(/\n/g, "\r\n",);
}

/** Documento iCalendar: agregador dos componentes VTODO/VEVENT/VJOURNAL. */
export class ICalendar {
  /** Ruby `LINELENGTH = 75` (constante de classe). */
  static readonly LINELENGTH = LINE_LENGTH;

  /** `attr_reader :uid` — já com o prefixo do pacote. */
  readonly uid: string;
  /** `attr_accessor :creationDate` */
  creationDate: TjTime;
  /** `attr_accessor :lastModified` */
  lastModified: TjTime;

  private todos: Todo[] = [];
  private events: Event[] = [];
  private journals: Journal[] = [];

  constructor(uid: string,) {
    this.uid = `${AppConfig.packageName}-${uid}`;
    // Ruby: @creationDate = @lastModified = TjTime.new.utc — a MESMA instância.
    this.creationDate = this.lastModified = TjTime.now();
  }

  /** Ruby `addTodo(todo)` — uso interno: quem cria o `Todo` se registra. */
  addTodo(todo: Todo,): void {
    this.todos.push(todo,);
  }

  /** Ruby `addEvent(event)`. */
  addEvent(event: Event,): void {
    this.events.push(event,);
  }

  /** Ruby `addJournal(journal)`. */
  addJournal(journal: Journal,): void {
    this.journals.push(journal,);
  }

  /** Ruby `dateTime(date)` — timestamp UTC no formato básico da RFC 5545. */
  dateTime(date: TjTime,): string {
    return date.to_s("%Y%m%dT%H%M%SZ", "UTC",);
  }

  /** Serializa o documento completo, com dobra de linhas e CRLF. */
  to_s(): string {
    let str = "BEGIN:VCALENDAR\n" +
      `PRODID:-//The ${AppConfig.softwareName} Project/NONSGML ` +
      `${AppConfig.softwareName} ${AppConfig.version}//EN\n` +
      "VERSION:2.0\n\n";
    for (const todo of this.todos) str += todo.to_s();
    for (const event of this.events) str += event.to_s();
    for (const journal of this.journals) str += journal.to_s();
    str += "END:VCALENDAR\n";
    return foldLines(str,);
  }
}

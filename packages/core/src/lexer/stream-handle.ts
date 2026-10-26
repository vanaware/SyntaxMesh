/**
 * StreamHandle — operações de baixo nível sobre o stream de entrada.
 *
 * Port de `TextParser/Scanner.rb` (l.51-204): `StreamHandle`,
 * `FileStreamHandle`, `BufferStreamHandle` e `MacroStackEntry`,
 * incluindo equivalentes de `StringIO` (`TextStream`) e
 * `StringScanner` (`LineScanner`) da stdlib do Ruby.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/Scanner.rb
 */
import { Log, } from "../log.ts";
import type { SourceFileInfo, } from "../source-file-info.ts";
import type { Macro, } from "./macro-table.ts";

/** Host mínimo (o Scanner) para repassar erros. Evita import circular. */
export interface ScannerHostLike {
  error(
    id: string,
    text: string,
    sfi?: SourceFileInfo | null,
    data?: unknown,
  ): void;
}

/** Log estrutural: satisfaz `typeof Log` (métodos estáticos) ou instância. */
export interface LogLike {
  msg(block: () => string,): void;
  activity(): void;
  startProgressMeter(text: string,): void;
  stopProgressMeter(): void;
}

/** Equivalente a `File.dirname` do Ruby. */
export function dirnameOf(path: string,): string {
  if (path === "" || path === ".") return ".";
  const idx = path.lastIndexOf("/",);
  if (idx < 0) return ".";
  if (idx === 0) return "/";
  return path.slice(0, idx,);
}

/**
 * TextStream — porta de `StringIO` para leitura linha a linha.
 * `gets()` devolve a linha incluindo o `\n`; `lineno` conta as leituras.
 */
export class TextStream {
  private content: string;
  private ptr = 0;
  /** Ruby `IO#lineno`: nº de linhas já lidas por `gets()`. */
  lineno = 0;

  constructor(content: string,) {
    this.content = content;
  }

  gets(): string | null {
    if (this.ptr >= this.content.length) return null;
    const nl = this.content.indexOf("\n", this.ptr,);
    const line = nl < 0
      ? this.content.slice(this.ptr,)
      : this.content.slice(this.ptr, nl + 1,);
    this.ptr = nl < 0 ? this.content.length : nl + 1;
    this.lineno++;
    return line;
  }

  eof(): boolean {
    return this.ptr >= this.content.length;
  }

  close(): void {
    this.content = "";
    this.ptr = 0;
  }
}

const stickyCache = new WeakMap<RegExp, RegExp>();

/**
 * LineScanner — porta do `StringScanner` (strscan) do Ruby.
 * `scan(re)` ancora na posição atual; sem avanço quando não casa.
 */
export class LineScanner {
  private _string: string;
  pos = 0;
  matched: string | null = null;

  constructor(string = "",) {
    this._string = string;
  }

  get string(): string {
    return this._string;
  }

  set string(value: string,) {
    this._string = value;
    this.pos = 0;
    this.matched = null;
  }

  scan(re: RegExp,): string | null {
    let sticky = stickyCache.get(re,);
    if (!sticky) {
      const flags = new Set(re.flags.split("",),);
      flags.add("y",);
      flags.delete("g",);
      sticky = new RegExp(re.source, [...flags,].join("",),);
      stickyCache.set(re, sticky,);
    }
    sticky.lastIndex = this.pos;
    const m = sticky.exec(this._string,);
    if (!m) {
      sticky.lastIndex = 0;
      // Ruby: scan malsucedido limpa o registro do último match.
      this.matched = null;
      return null;
    }
    this.matched = m[0];
    this.pos = sticky.lastIndex;
    return m[0];
  }

  /**
   * Contexto à esquerda do ÚLTIMO match (semântica strscan do Ruby):
   * exclui o match e devolve null sem match pendente de sucesso.
   */
  preMatch(): string | null {
    if (this.matched === null) return null;
    return this._string.slice(0, this.pos - this.matched.length,);
  }

  /** Resto à direita da posição atual (Ruby `post_match`). */
  postMatch(): string | null {
    if (this.matched === null) return null;
    return this._string.slice(this.pos,);
  }

  eos(): boolean {
    return this.pos >= this._string.length;
  }

  peek(n: number,): string {
    return this._string.slice(this.pos, this.pos + n,);
  }
}

/** Entry da pilha de macros (detecção de recursão + histórico). */
export class MacroStackEntry {
  constructor(
    readonly macro: Macro | null,
    readonly args: string[],
    readonly text: string,
    readonly endPos: number,
  ) {}
}

/**
 * StreamHandle — abstrai buffer vs arquivo para o Scanner.
 * Um handle por arquivo aninhado; o Scanner mantém a pilha.
 */
export class StreamHandle {
  fileName: string | null = null;
  protected log: LogLike;
  protected textScanner: ScannerHostLike;
  stream: TextStream | null = null;
  line: string | null = null;
  scanner: LineScanner | null = null;
  /** true se a linha corrente terminava com LF já consumido. */
  wrapped = false;
  readonly macroStack: MacroStackEntry[] = [];
  nextMacroEnd: number | null = null;

  constructor(log: LogLike, textScanner: ScannerHostLike,) {
    this.log = log;
    this.textScanner = textScanner;
  }

  error(id: string, message: string,): void {
    this.textScanner.error(id, message,);
  }

  close(): void {
    this.stream = null;
  }

  /**
   * Injeta _text_ no stream na posição corrente do cursor,
   * removendo a chamada de macro (_callLength_ caracteres) do fim da entrada.
   *
   * Nota (Categoria B corrigida): o Ruby mistura `bytesize` com índices de
   * caractere aqui; esta porta usa posições em caracteres, coerentes com
   * `LineScanner`.
   */
  injectText(text: string, callLength: number,): void {
    if (!this.scanner) return;
    // Ruby: `preCall = @scanner.pre_match[0..-(callLength + 1)]` — clampa a 0
    // quando o contexto à esquerda é menor que a chamada (str[0..-n] → "").
    const preMatchStr = this.scanner.preMatch() ?? "";
    const preCall = preMatchStr.slice(
      0,
      Math.max(0, preMatchStr.length - callLength,),
    );
    this.nextMacroEnd = preCall.length + text.length;
    this.line = preCall + text + (this.scanner.postMatch() ?? "");
    this.scanner.string = this.line;
    this.scanner.pos = preCall.length;
  }

  /** Injeta macro expandida; registra no histórico. false se recursão. */
  injectMacro(
    macro: Macro | null,
    args: string[],
    text: string,
    callLength: number,
  ): boolean {
    this.injectText(text, callLength,);

    // Detecção simples de chamadas recursivas de macro.
    if (this.macroStack.length > 20) return false;

    this.macroStack.push(
      new MacroStackEntry(macro, args, text, this.nextMacroEnd ?? 0,),
    );
    return true;
  }

  /** Garante que há uma linha para escanear; false no EOF do stream. */
  readyNextLine(): boolean {
    if (this.scanner === null || this.scanner.eos()) {
      const line = this.stream ? this.stream.gets() : null;
      if (line === null) {
        // Chegamos ao fim do arquivo corrente.
        this.scanner = null;
        return false;
      }
      this.line = line;
      // Atualiza o medidor de atividade a cada ~1024 linhas.
      if ((this.stream!.lineno & 0x3FF) === 0) this.log.activity();
      this.scanner = new LineScanner(this.line,);
      this.wrapped = this.line.length > 0 &&
        this.line[this.line.length - 1] === "\n";
    }
    return true;
  }

  scan(re: RegExp,): string | null {
    return this.scanner ? this.scanner.scan(re,) : null;
  }

  /** Remove da pilha macros completamente consumidas pelo cursor. */
  cleanupMacroStack(): void {
    if (this.nextMacroEnd !== null && this.scanner) {
      const pos = this.scanner.pos;
      while (this.nextMacroEnd !== null && this.nextMacroEnd < pos) {
        this.macroStack.pop();
        this.nextMacroEnd = this.macroStack.length > 0
          ? this.macroStack[this.macroStack.length - 1]!.endPos
          : null;
      }
    }
  }

  peek(n: number,): string | null {
    return this.scanner ? this.scanner.peek(n,) : null;
  }

  eof(): boolean {
    if (!this.stream || !this.scanner) return true;
    return this.stream.eof() && this.scanner.eos();
  }

  dirname(): string {
    return this.fileName ? dirnameOf(this.fileName,) : "";
  }

  /** Número da linha em processamento (Ruby mantém via `IO#lineno`). */
  lineNo(): number {
    let currentLine = this.stream && this.scanner ? this.stream.lineno : 1;
    // Se acabamos de ler o LF, soma 1 — o LF só pode ser o último caractere.
    if (this.wrapped && this.line && this.scanner && this.scanner.eos()) {
      currentLine += 1;
    }
    return currentLine;
  }

  /** Parte já processada da linha corrente (para mensagens de erro). */
  currentLine(): string {
    if (!this.line || !this.scanner) return "";
    return (this.scanner.preMatch() ?? "") + (this.scanner.matched ?? "");
  }
}

/** Leitor injetável para ambientes sem filesystem (browser/PWA). */
export type FileTextLoader = (fileName: string,) => string;

/**
 * FileStreamHandle — StreamHandle para arquivos.
 *
 * Browser (Fase 19/20): o arquivo inteiro é carregado de uma vez;
 * here usa-se `Deno.readTextFileSync` ou um `FileTextLoader` injetado.
 */
export class FileStreamHandle extends StreamHandle {
  /** Hook de carregamento (testes/browser); padrão: Deno filesystem. */
  static fileLoader: FileTextLoader | null = null;

  constructor(fileName: string, log: LogLike, textScanner: ScannerHostLike,) {
    super(log, textScanner,);
    this.fileName = fileName;
    const data = fileName === "." ? readStdin() : loadFileText(fileName,);
    this.stream = new TextStream(data,);
    this.log.msg(() => `Parsing file ${this.fileName} ...`);
    this.log.startProgressMeter(`Reading file ${fileName}`,);
  }

  override close(): void {
    if (this.stream) this.stream.close();
    super.close();
  }
}

/** StreamHandle sobre uma string em memória (buffer). */
export class BufferStreamHandle extends StreamHandle {
  constructor(buffer: string, log: LogLike, textScanner: ScannerHostLike,) {
    super(log, textScanner,);
    this.stream = new TextStream(buffer,);
  }
}

/** Lê o texto de um arquivo via hook injetado ou Deno filesystem. */
export function loadFileText(fileName: string,): string {
  if (FileStreamHandle.fileLoader) {
    return FileStreamHandle.fileLoader(fileName,);
  }
  const g = globalThis as Record<string, any>;
  if (g.Deno?.readTextFileSync) {
    return g.Deno.readTextFileSync(fileName,);
  }
  throw new Error(
    `Cannot read file ${fileName}: no filesystem in this runtime`,
  );
}

function readStdin(): string {
  const g = globalThis as Record<string, any>;
  if (g.Deno?.stdin && g.Deno.readFileSync) {
    const bytes: Uint8Array = g.Deno.readFileSync(g.Deno.stdin.rid ?? 0,);
    return new TextDecoder().decode(bytes,);
  }
  throw new Error("Cannot read stdin: not available in this runtime",);
}

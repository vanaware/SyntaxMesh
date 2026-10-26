/**
 * Scanner — scanner de texto modal com suporte a includes aninhados e macros.
 *
 * Port de `TextParser/Scanner.rb` (l.206-565). Classe abstrata: os padrões de
 * token são fornecidos pela subclasse (ex.: `ProjectFileScanner`). O scanner é
 * modal: cada modo usa apenas o subconjunto de padrões a ele atribuído.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/Scanner.rb
 */
import { type MessageType, } from "../message.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import { SourceFileInfo, } from "../source-file-info.ts";
import { Macro, MacroTable, } from "./macro-table.ts";
import {
  BufferStreamHandle,
  FileStreamHandle,
  type LogLike,
  type ScannerHostLike,
  type StreamHandle,
} from "./stream-handle.ts";

/** Pós-processamento de token: pode reescrever [tipo, texto] após o match. */
export type TokenPostProcessor = (
  type: string | null,
  text: string,
) => [string | null, unknown,];

/** Padrão de token: [tipo (null = ignorar), regex, modo(s), pós-processamento]. */
export type TokenPattern = [
  string | null,
  RegExp,
  string | string[] | undefined,
  TokenPostProcessor | null,
];

/** Token produzido pelo scanner: [tipo, texto, origem]. */
export type ScannerToken = [string, unknown, SourceFileInfo | null,];

/** Entrada da pilha de arquivos: handle, token em buffer e callback de EOF. */
type FileStackEntry = [StreamHandle, ScannerToken | null, (() => void) | null,];

export class Scanner implements ScannerHostLike {
  /** Nome do arquivo (ou texto) inicial (Ruby @masterFile). */
  readonly masterFile: string;
  protected messageHandler: MessageHandlerInstance;
  protected log: LogLike;
  /** Tabela de macro expansível durante o lexing (Ruby @macroTable). */
  readonly macroTable: MacroTable = new MacroTable();
  /** Handle do stream correntemente processado (Ruby @cf). */
  cf: StreamHandle | null = null;
  /** Pilha de arquivos aninhados (Ruby @fileStack). */
  fileStack: FileStackEntry[] = [];
  /** true quando o último arquivo chegou ao fim (Ruby @finishLastFile). */
  finishLastFile = false;
  /** true se o scanner opera sobre um buffer de texto. */
  fileNameIsBuffer = false;
  /** SourceFileInfo do início do token em processamento. */
  startOfToken: SourceFileInfo | null = null;
  /** Correção de número de linha para mensagens de erro. */
  lineDelta = 0;
  /** Padrões agrupados por modo (Ruby @patternsByMode). */
  readonly patternsByMode: Map<string, TokenPattern[]> = new Map();
  /** Modo ativo corrente (Ruby @scannerMode). */
  scannerMode: string = "";
  /** Modo inicial/final do arquivo (Ruby @defaultMode). */
  readonly defaultMode: string;
  /** Conjunto de padrões do modo ativo (ponteiro, não cópia). */
  activePatterns: TokenPattern[] | null = null;
  /** Caminho do arquivo mestre com barra final (Ruby @masterPath). */
  masterPath = "";
  /** Token devolvido pendente (Ruby @tokenBuffer). */
  tokenBuffer: ScannerToken | null = null;

  constructor(
    masterFile: string,
    log: LogLike,
    tokenPatterns: TokenPattern[],
    defaultMode: string,
  ) {
    this.masterFile = masterFile;
    this.messageHandler = MessageHandlerInstance.instance;
    this.log = log;
    this.defaultMode = defaultMode;

    for (const pat of tokenPatterns) {
      const type = pat[0];
      const regExp = pat[1];
      const mode = pat[2] ?? ":tjp";
      const postProc = pat[3];
      this.addPattern(type, regExp, mode, postProc,);
    }
    // Permite subclasses registrarem padrões após super(): se o modo ainda
    // não existir, apenas guarda o nome; a subclasse reatribui `mode` depois.
    this.activePatterns = this.patternsByMode.get(defaultMode,) ?? null;
    this.scannerMode = defaultMode;
  }

  /**
   * Adiciona um padrão ao scanner. _type_ é null para tokens ignorados;
   * _mode_ aceita um modo ou lista de modos. _postProc_ pode reescrever
   * [tipo, texto] após o match (Ruby addPattern, l.261-273).
   */
  addPattern(
    type: string | null,
    regExp: RegExp,
    mode: string | string[],
    postProc: TokenPostProcessor | null = null,
  ): void {
    const modes = Array.isArray(mode,) ? mode : [mode,];
    for (const m of modes) {
      if (!this.patternsByMode.has(m,)) {
        this.patternsByMode.set(m, [],);
      }
      this.patternsByMode.get(m,)!.push([type, regExp, m, postProc,],);
    }
  }

  /** Troca o modo do scanner; apenas padrões do novo modo ficam ativos. */
  set mode(newMode: string,) {
    const active = this.patternsByMode.get(newMode,);
    if (!active) {
      throw new Error(`Undefined mode ${newMode}`,);
    }
    this.activePatterns = active;
    this.scannerMode = newMode;
  }

  get mode(): string {
    return this.scannerMode;
  }

  /** Inicia o processamento; _fileNameIsBuffer_ opera sobre String. */
  open(fileNameIsBuffer = false,): void {
    this.fileNameIsBuffer = fileNameIsBuffer;
    if (fileNameIsBuffer) {
      this.cf = new BufferStreamHandle(this.masterFile, this.log, this,);
      this.fileStack = [[this.cf, null, null,],];
    } else {
      try {
        this.cf = new FileStreamHandle(this.masterFile, this.log, this,);
        this.fileStack = [[this.cf, null, null,],];
      } catch (e) {
        this.error("open_file", `Cannot open file ${this.masterFile}: ${e}`,);
      }
    }
    this.masterPath = (this.cf ? this.cf.dirname() : "") + "/";
    this.tokenBuffer = null;
  }

  /** Termina o processamento e reseta as estruturas. */
  close(): void {
    if (!this.fileNameIsBuffer) {
      this.log.startProgressMeter(`Reading file ${this.masterFile}`,);
      this.log.stopProgressMeter();
    }
    this.fileStack = [];
    this.cf = null;
    this.tokenBuffer = null;
  }

  /**
   * Passa a processar _includeFileName_ (relativo ao arquivo chamador);
   * ao terminar, retoma o pai. Retorna o nome qualificado do incluído.
   */
  include(
    includeFileName: string,
    sfi: SourceFileInfo | null,
    onEof: (() => void) | null = null,
  ): string {
    if (includeFileName[0] !== "/") {
      const parent = this.fileStack[this.fileStack.length - 1];
      const pathOfCallingFile = parent ? parent[0].dirname() : "";
      const path = pathOfCallingFile === "" ? "" : pathOfCallingFile + "/";
      includeFileName = path + includeFileName;
    }

    // Detecção de inclusão recursiva (não pega links de filesystem).
    for (const entry of this.fileStack) {
      if (includeFileName === entry[0].fileName) {
        this.error(
          "include_recursion",
          `Recursive inclusion of ${includeFileName} detected`,
          sfi,
        );
      }
    }

    // Guarda o token em buffer do pai na pilha.
    if (this.fileStack.length > 0) {
      this.fileStack[this.fileStack.length - 1]![1] = this.tokenBuffer;
    }
    this.tokenBuffer = null;
    this.finishLastFile = false;

    try {
      const handle = new FileStreamHandle(includeFileName, this.log, this,);
      this.cf = handle;
      this.fileStack.push([handle, null, onEof,],);
      this.log.msg(() => `Parsing file ${includeFileName}`);
    } catch (_e) {
      this.error(
        "bad_include",
        `Cannot open include file ${includeFileName}`,
        sfi,
      );
    }

    return includeFileName;
  }

  /** SourceFileInfo da posição corrente de processamento. */
  sourceFileInfo(): SourceFileInfo {
    return this.cf
      ? new SourceFileInfo(
        this.fileName(),
        this.cf.lineNo() - this.lineDelta,
        0,
      )
      : new SourceFileInfo(this.masterFile, 0, 0,);
  }

  /** Nome do arquivo corrente (ou o próprio texto, em buffer). */
  fileName(): string {
    return this.cf ? this.cf.fileName ?? "" : this.masterFile;
  }

  lineNo(): number {
    return this.cf ? this.cf.lineNo() : 0;
  }

  columnNo(): number {
    return 0;
  }

  /** Linha corrente já consumida do arquivo ativo. */
  line(): string {
    return this.cf ? this.cf.currentLine() : "";
  }

  /**
   * Próximo token do stream (com pilha de arquivos e EOFs de arquivo).
   * Ruby nextToken (l.381-422).
   */
  nextToken(): ScannerToken {
    // Devolve primeiro um token empurrado de volta.
    if (this.tokenBuffer !== null) {
      const res = this.tokenBuffer;
      this.tokenBuffer = null;
      return res;
    }

    if (this.finishLastFile) {
      // O arquivo anterior foi realmente concluído: fecha e remove da pilha.
      this.finishLastFile = false;

      const top = this.fileStack[this.fileStack.length - 1];
      const onEof = top ? top[2] : null;
      if (onEof) onEof();

      if (this.cf) this.cf.close();
      this.fileStack.pop();

      if (this.fileStack.length === 0) {
        // Fim do arquivo de nível superior.
        this.cf = null;
        this.tokenBuffer = null;
        this.finishLastFile = true;
        return ["endOfText", "<EOT>", this.startOfToken,];
      } else {
        // Retoma o arquivo que incluíu o corrente.
        const entry = this.fileStack[this.fileStack.length - 1]!;
        this.cf = entry[0];
        const tokenBuffer = entry[1];
        this.log.msg(() => `Parsing file ${this.cf?.fileName ?? ""} ...`);
        if (tokenBuffer) {
          if (tokenBuffer[0] === "eof") this.finishLastFile = true;
          return tokenBuffer;
        }
      }
    }

    return this.scanToken();
  }

  /** Devolve um token para ser relido; só 1 por vez (Ruby l.426-433). */
  returnToken(token: ScannerToken,): void {
    if (this.tokenBuffer !== null) {
      console.error(this.tokenBuffer,);
      throw new Error("Fatal Error: Cannot return more than 1 token in a row",);
    }
    this.tokenBuffer = token;
  }

  /** Adiciona uma macro à tabela de expansão. */
  addMacro(macro: Macro,): void {
    this.macroTable.add(macro,);
  }

  /** true se a macro _name_ já foi definida (Ruby `macroDefined?`). */
  macroDefined(name: string,): boolean {
    return this.macroTable.includes(name,);
  }

  /**
   * Expande uma macro e a injeta no stream. _prefix_ re-injeta o texto
   * imediatamente antes da chamada; _callLength_ é o comprimento de
   * `${...}` completo. Ruby expandMacro (l.450-464).
   */
  expandMacro(prefix: string, args: string[], callLength: number,): void {
    const resolved = this.macroTable.resolve(args, this.sourceFileInfo(),);
    const macro = resolved ? resolved[0] : null;
    const text = resolved ? resolved[1] : null;

    // Macro expandida vazia: ignora silenciosamente.
    if (text === "") return;

    if (!(macro && text)) {
      this.error("undefined_macro", `Undefined macro '${args[0]}' called`,);
    }

    const injected = this.cf
      ? this.cf.injectMacro(
        macro,
        args,
        (prefix ?? "") + (text ?? ""),
        callLength,
      )
      : false;
    if (!injected) {
      this.error("macro_stack_overflow", "Too many nested macro calls.",);
    }
  }

  /** Erro relacionado ao texto processado (lança ≈ Ruby trapSetup). */
  error(
    id: string,
    text: string,
    sfi: SourceFileInfo | null = null,
    data: unknown = null,
  ): void {
    this.message("error", id, text, sfi, data,);
  }

  warning(
    id: string,
    text: string,
    sfi: SourceFileInfo | null = null,
    data: unknown = null,
  ): void {
    this.message("warning", id, text, sfi, data,);
  }

  /**
   * Núcleo de lexing: casa padrões ativos, avançando linha a linha.
   * Ruby scanToken (l.477-533). A variável `match` persiste entre voltas do
   * loop externo exatamente como no Ruby (Categoria B preservada).
   */
  private scanToken(): ScannerToken {
    this.startOfToken = this.sourceFileInfo();
    let match: string | null = null;
    for (;;) {
      if (!this.cf || !this.cf.readyNextLine()) {
        if (this.scannerMode !== this.defaultMode) {
          // O stream reinicia a contagem de linhas; compensa via lineDelta.
          this.lineDelta = -(this.startOfToken!.lineNo - 1);
          this.error(
            "runaway_token",
            `Unterminated token starting at line ${this.startOfToken}`,
          );
        }
        // Fim do arquivo de entrada: token especial.
        this.finishLastFile = true;
        return ["eof", "<END>", this.startOfToken,];
      }

      if (this.activePatterns) {
        for (const entry of this.activePatterns) {
          // Ruby: `if (match = @cf.scan(re))` — a atribuição também zera
          // `match` quando o padrão não casa. Sem isso, um token ignorado
          // (type nil) deixaria `match` obsoleto e o loop nunca chegaria ao
          // branch de erro (infinite loop em `no_token_match`).
          match = this.cf.scan(entry[1],);
          if (match !== null) {
            let type: string | null = entry[0];
            let value: unknown = match;
            const postProc = entry[3];
            if (postProc) {
              [type, value,] = postProc(type, value as string,);
              match = value as string;
            }
            if (type === null) break; // Token ignorado.

            this.cf.cleanupMacroStack();
            return [type, value, this.startOfToken,];
          }
        }
      }

      if (match === null) {
        // Sem match: ou EOF inesperado, ou caractere não reconhecido.
        if (this.cf.eof()) {
          this.error("unexpected_eof", "Unexpected end of file found",);
        } else {
          this.error(
            "no_token_match",
            `Unexpected characters found: '${this.cf.peek(10,)}...'`,
          );
        }
      } else {
        // Remove macros expandidas completamente consumidas.
        this.cf.cleanupMacroStack();
      }
    }
  }

  /**
   * Loga no MessageHandler — equivalente ao `message` do Scanner.rb
   * (l.535-563): erros e warnings passam por `MessageHandler#error/warning`,
   * que LANÇA `TjRuntimeError` quando `trapSetup` está ativo (primeiro erro
   * aborta o parse — é o comportamento que os golden tests gravam). Inclui
   * histórico de macros como infos prévios.
   */
  private message(
    type: MessageType,
    id: string,
    text: string,
    sfi: SourceFileInfo | null,
    data: unknown,
  ): void {
    if (text === "") return;

    const line = this.cf ? this.cf.currentLine() : null;
    const at = sfi ?? this.sourceFileInfo();

    if (this.cf && this.cf.macroStack.length > 0) {
      this.messageHandler.info("macro_stack", "Macro call history:", null,);
      for (const entry of [...this.cf.macroStack,].reverse()) {
        const macro = entry.macro;
        if (!macro) continue;
        const args = entry.args.slice(1,).map((a,) => `"${a}"`);
        this.messageHandler.info(
          "macro_stack",
          `  \${${macro.name}${args.length === 0 ? "" : " "}` +
            `${args.join(" ",)}}`,
          macro.sourceFileInfo,
        );
      }
    }

    if (type === "error") {
      this.messageHandler.error(id, text, at, line, data,);
    } else {
      this.messageHandler.warning(id, text, at, line, data,);
    }
  }
}

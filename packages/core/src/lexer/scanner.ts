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
import { Macro, MacroTable, Template, } from "./macro-table.ts";
import type { AddTemplateResult, } from "./macro-table.ts";
import { templateEngine, } from "./template-engine.ts";
import {
  type ExpressionEvaluation,
  parseTemplateArguments,
  type TemplateArgumentValue,
} from "./template-arguments.ts";
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

/**
 * Limite de passes da Fase 1 (macro dentro de corpo de template). Alinhado ao
 * limite de 20 níveis do `macroStack` do Ruby.
 */
const BODY_EXPANSION_PASSES = 20;

/**
 * Profundidade máxima de templates em avaliação. É o **mesmo** 20 do
 * `macroStack` (Ruby l.211): templates e macros empilham no mesmo mecanismo de
 * injeção, então o teto é único e o backstop é o mesmo erro
 * `macro_stack_overflow`. Recursão direta/mútua é pega antes por
 * `template_recursion`.
 */
const TEMPLATE_DEPTH_LIMIT = 20;

/** Args posicionais de uma chamada de macro (Ruby `endMacroCall`). */
export interface PositionalMacroArgs {
  name: string;
  args: string[];
}

/** View vazia e congelada usada quando ainda não há projeto (§4.7). */
const EMPTY_PROJECT_VIEW: Readonly<Record<string, unknown>> = Object.freeze(
  {},
);

/**
 * Converte um valor JS qualquer (vindo de `expandTemplate(nome, args)`) em
 * `TemplateArgumentValue`, preservando números, booleanos, listas e objetos.
 * O que não se encaixa vira texto — nunca `undefined`/`null` no contexto.
 */
export function toArgumentValue(value: unknown,): TemplateArgumentValue {
  if (
    typeof value === "string" || typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value,)) {
    return value.map((item,) => toArgumentValue(item,));
  }
  if (value && typeof value === "object") {
    const out: { [key: string]: TemplateArgumentValue } = {};
    for (const [key, item,] of Object.entries(value,)) {
      out[key] = toArgumentValue(item,);
    }
    return out;
  }
  return String(value ?? "",);
}

/** Normaliza o objeto de argumentos de `expandTemplate` em mapa de params. */
function toArgumentMap(args: unknown,): Record<string, TemplateArgumentValue> {
  const out: Record<string, TemplateArgumentValue> = {};
  if (args && typeof args === "object" && !Array.isArray(args,)) {
    for (const [key, value,] of Object.entries(args,)) {
      out[key] = toArgumentValue(value,);
    }
  }
  return out;
}

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
  /**
   * Motor de expressões lógicas injetado pela Fase 11 para valorar argumentos
   * de template (subfase 23.4.6). `null` mantém a expressão como texto.
   */
  private expressionEvaluator:
    | ((text: string,) => ExpressionEvaluation)
    | null = null;
  /** View somente-leitura dos metadados do projeto (`project` do §4.7). */
  private projectContextProvider:
    | (() => Readonly<Record<string, unknown>> | null)
    | null = null;
  /** Resolvedor de IDs (`ids()` do §4.7). */
  private templateIdResolver: ((id: string,) => string) | null = null;
  /** Templates em avaliação **inline** (`expandTemplate`), base → topo. */
  private readonly inlineTemplateStack: string[] = [];

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

  /**
   * Registra um template no namespace unificado (extensão Fase 23).
   * Devolve o motivo da recusa para o chamador emitir a mensagem com o
   * `SourceFileInfo` da definição (ADR 033).
   */
  addTemplate(template: Template,): AddTemplateResult {
    return this.macroTable.addTemplate(template,);
  }

  /** true se _name_ é um template registrado (extensão Fase 23). */
  templateDefined(name: string,): boolean {
    return this.macroTable.templateDefined(name,);
  }

  /**
   * true se a macro _name_ já foi definida (Ruby `macroDefined?`).
   *
   * Predicado **macro-only**: um template de mesmo nome não conta (o
   * namespace é compartilhado, mas a redefinição de macro continua sendo o
   * warning do Ruby — ADR 033).
   */
  macroDefined(name: string,): boolean {
    return this.macroTable.macroDefined(name,);
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

  // ---------------------------------------------------------------------------
  // Extensão Fase 23 — expansão de `template` (ADR 033)
  // ---------------------------------------------------------------------------

  /**
   * Expande uma chamada `${NOME k=v …}` de template (plano §4.4, duas fases):
   *
   * 1. Fase 1 — `${MACRO …}` do corpo é expandido textualmente;
   * 2. Fase 2 — o corpo resultante é renderizado pelo Vento com os params;
   *
   * e o texto final reentra no stream pela mesma `injectMacro` das macros.
   *
   * O texto reentrante é reescaneado como TJP normal — é isso que faz uma
   * chamada de template produzida pelo render (`${OUTRO …}`) expandir em
   * cascata (23.3.9).
   */
  expandTemplateCall(
    prefix: string,
    name: string,
    rawArgs: string,
    callLength: number,
    callSfi: SourceFileInfo = this.sourceFileInfo(),
  ): void {
    const target = this.templateCallTarget(name,);
    const template = target.template;
    if (!template) {
      // `${?NOME …}` com template inexistente é vazio silencioso (§4.5.4).
      if (target.optional) return;
      // Inalcançável pelo caminho normal (o chamador decide pelo lookup), mas
      // mantém a mesma mensagem da macro se o namespace mudar no meio.
      this.error("undefined_macro", `Undefined macro '${name}' called`,);
      return;
    }
    const cleanName = template.name;

    // Proteções (§4.6): recursão com cadeia completa e teto de profundidade.
    // Ambas checam antes de renderizar, então o corpo nunca é reexecutado
    // indefinidamente.
    const chain = this.templateCallChain();
    const cycleAt = chain.indexOf(cleanName,);
    if (cycleAt >= 0) {
      const cycle = [...chain.slice(cycleAt,), cleanName,].join(" → ",);
      this.error(
        "template_recursion",
        `recursão detectada: ${cycle}`,
        callSfi,
      );
      return;
    }
    if (chain.length >= TEMPLATE_DEPTH_LIMIT) {
      this.error("macro_stack_overflow", "Too many nested macro calls.",);
      return;
    }

    const data = this.parseNamedArguments(cleanName, rawArgs, callSfi,);
    if (data === null) return;
    if (!this.validateTemplateArgs(template, data, callSfi,)) return;

    const content = this.renderTemplate(template, data, callSfi,);
    if (content === null) return;

    const injected = this.cf
      ? this.cf.injectMacro(
        null,
        [cleanName,],
        (prefix ?? "") + content,
        callLength,
      )
      : false;
    if (!injected) {
      this.error("macro_stack_overflow", "Too many nested macro calls.",);
    }
  }

  /**
   * Valida os argumentos contra a lista de parâmetros declarada (§5).
   *
   * Não declarado vem antes do faltante: um typo (`esforcoo`) costuma ser a
   * causa do "parâmetro faltante" e a mensagem certa é a do typo.
   */
  protected validateTemplateArgs(
    template: Template,
    data: Record<string, TemplateArgumentValue>,
    callSfi: SourceFileInfo,
  ): boolean {
    const name = template.name;
    for (const key of Object.keys(data,)) {
      if (!template.params.includes(key,)) {
        this.error(
          "template_unknown_param",
          `template '${name}': parâmetro '${key}' não declarado`,
          callSfi,
        );
        return false;
      }
    }
    for (const param of template.params) {
      if (!(param in data)) {
        this.error(
          "template_missing_param",
          `template '${name}': parâmetro '${param}' não fornecido`,
          callSfi,
        );
        return false;
      }
    }
    return true;
  }

  /**
   * Núcleo de renderização (duas fases, §4.4) compartilhado pela chamada do
   * stream (`${NOME …}`) e pela composição inline (`expandTemplate`).
   *
   * Devolve o texto renderizado ou `null` quando o erro já foi reportado.
   */
  protected renderTemplate(
    template: Template,
    data: Record<string, TemplateArgumentValue>,
    callSfi: SourceFileInfo,
  ): string | null {
    const cleanName = template.name;

    // Fase 1 — macros do corpo, antes do render.
    const expandedBody = this.expandMacrosInText(template.body,);

    // Fase 2 — render Vento com params + chaves globais no contexto (§4.7).
    const context = this.buildTemplateContext(cleanName, data, callSfi,);
    const rendered = templateEngine.render(expandedBody, context,);
    if (!rendered.ok) {
      const syntax = rendered.kind === "syntax";
      const kind = syntax ? "erro de sintaxe" : "erro de execução";
      // O corpo começa na linha da definição quando o texto segue o `[` na
      // mesma linha; começa uma linha depois quando o `[` fecha a linha.
      const offset = template.body.startsWith("\n",) ? 1 : 0;
      const line = template.sourceFileInfo.lineNo + offset + rendered.line - 1;
      this.error(
        syntax ? "template_syntax_error" : "template_render_error",
        `template '${cleanName}': ${kind} na linha ${rendered.line}: ${rendered.message}`,
        new SourceFileInfo(
          template.sourceFileInfo.fileName,
          line,
          rendered.column,
        ),
      );
      return null;
    }
    return rendered.content;
  }

  /**
   * Monta o contexto da renderização: chaves globais (§4.7) + parâmetros.
   *
   * O parâmetro **sobrescreve** a global homônima e a colisão vira warning
   * com o `sfi` da chamada (23.6.5) — o template continua renderizando.
   */
  protected buildTemplateContext(
    callName: string,
    data: Record<string, TemplateArgumentValue>,
    callSfi: SourceFileInfo,
  ): Record<string, unknown> {
    const context = this.templateGlobals(callSfi,);
    for (const key of Object.keys(data,)) {
      if (key in context) {
        this.warning(
          "template_shadowed_global",
          `template '${callName}': parâmetro '${key}' sobrescreve a chave ` +
            "global de mesmo nome",
          callSfi,
        );
      }
      context[key] = data[key];
    }
    return context;
  }

  /**
   * Chaves globais disponíveis em qualquer corpo (§4.7): `project` (view
   * congelada, somente leitura), `ids`, `expandTemplate`, `expandMacro` e
   * `expandTemplateList`.
   */
  protected templateGlobals(
    callSfi: SourceFileInfo,
  ): Record<string, unknown> {
    const view = this.projectContextProvider?.() ?? null;
    return {
      project: view ?? EMPTY_PROJECT_VIEW,
      ids: (id: unknown,) =>
        this.templateIdResolver?.(String(id ?? "",),) ?? "",
      expandTemplate: (name: unknown, args: unknown,) =>
        this.expandTemplateInline(String(name ?? "",), args, callSfi,),
      expandMacro: (name: unknown, ...args: unknown[]) =>
        this.expandMacroInline(
          String(name ?? "",),
          args.map((a,) => String(a ?? "",)),
          callSfi,
        ),
      expandTemplateList: (name: unknown, list: unknown,) =>
        this.expandTemplateListInline(String(name ?? "",), list, callSfi,),
    };
  }

  /**
   * `expandTemplate(nome, { … })` — renderiza outro template **inline** e
   * devolve o texto (sem injetar no stream). É a forma de composição
   * explícita recomendada pelo plano §4.4.
   */
  protected expandTemplateInline(
    name: string,
    args: unknown,
    callSfi: SourceFileInfo,
  ): string {
    const target = this.templateCallTarget(name,);
    const template = target.template;
    if (!template) {
      if (target.optional) return "";
      const clean = name.replace(/^\?/, "",);
      this.error("template_not_defined", `'${clean}' não definido`, callSfi,);
      return "";
    }
    const cleanName = template.name;

    // Recursão: a cadeia do stream + a pilha das chamadas inline em curso.
    const chain = [...this.templateCallChain(), ...this.inlineTemplateStack,];
    const cycleAt = chain.indexOf(cleanName,);
    if (cycleAt >= 0) {
      const cycle = [...chain.slice(cycleAt,), cleanName,].join(" → ",);
      this.error(
        "template_recursion",
        `recursão detectada: ${cycle}`,
        callSfi,
      );
      return "";
    }

    const data = toArgumentMap(args,);
    if (!this.validateTemplateArgs(template, data, callSfi,)) return "";

    this.inlineTemplateStack.push(cleanName,);
    try {
      return this.renderTemplate(template, data, callSfi,) ?? "";
    } finally {
      this.inlineTemplateStack.pop();
    }
  }

  /**
   * `expandMacro(nome, …)` — resolve a macro a partir de string (§4.7).
   * A macro continua sendo substituição textual; o texto devolvido entra no
   * corpo renderizado e é resscaneado normalmente.
   */
  protected expandMacroInline(
    name: string,
    args: string[],
    callSfi: SourceFileInfo,
  ): string {
    const resolved = this.macroTable.resolve([name, ...args,], callSfi,);
    if (!resolved) {
      if (name.startsWith("?",)) return "";
      this.error(
        "undefined_macro",
        `Undefined macro '${name}' called`,
        callSfi,
      );
      return "";
    }
    return resolved[1];
  }

  /**
   * `expandTemplateList(nome, lista)` — conveniência opcional do plano §4.7:
   * renderiza o mesmo template para cada item e devolve o array de textos.
   *
   * Item que não é objeto é ligado ao **primeiro** parâmetro declarado: é o
   * caso comum de uma lista de IDs (`["a", "b"]`).
   */
  protected expandTemplateListInline(
    name: string,
    list: unknown,
    callSfi: SourceFileInfo,
  ): string[] {
    if (!Array.isArray(list,)) return [];
    const params = this.templateCallTarget(name,).template?.params ?? [];
    const first = params[0];
    return list.map((item,) => {
      const isObject = item !== null && typeof item === "object" &&
        !Array.isArray(item,);
      const args = isObject || first === undefined ? item : { [first]: item, };
      return this.expandTemplateInline(name, args, callSfi,);
    },);
  }

  /**
   * Divide `NOME "a" "b"` em nome + args posicionais (Ruby `endMacroCall`).
   * O texto residual é o erro `junk_at_eom` do Ruby — o caminho de macro é
   * **congelado**: os dois chamadores (macro e Fase 1 do template) usam
   * exatamente a mesma rotina.
   */
  protected splitMacroArgs(argsStr: string,): PositionalMacroArgs {
    const spaceIdx = argsStr.indexOf(" ",);
    if (spaceIdx < 0) return { name: argsStr, args: [], };

    const name = argsStr.slice(0, spaceIdx,);
    let rest = argsStr.slice(name.length,);
    const args: string[] = [];
    // StringScanner interno para limpar as aspas duplas dos argumentos.
    for (;;) {
      const open = /^\s*"/.exec(rest,);
      if (!open) break;
      rest = rest.slice(open[0].length,);
      const body = /^(\\"|[^"])*/.exec(rest,)![0];
      args.push(body.replaceAll('\\"', '"',),);
      rest = rest.slice(body.length,);
      const close = /^"\s*/.exec(rest,);
      rest = close ? rest.slice(close[0].length,) : rest.slice(1,);
    }

    if (rest !== "") {
      this.error(
        "junk_at_eom",
        `Junk found at end of macro: ${rest}`,
      );
    }

    return { name, args, };
  }

  /**
   * Fase 1 — expande as chamadas `${MACRO …}` de um corpo de template.
   *
   * Só **macros**: `${TEMPLATE …}` no corpo é texto (chamada de template usa
   * `expandTemplate()` no contexto — plano §4.4). O escape `$${` perde um `$`
   * e não expande, como no `MacroTable#resolve` do Ruby.
   */
  protected expandMacrosInText(body: string,): string {
    let text = body;
    for (let pass = 0; pass < BODY_EXPANSION_PASSES; pass++) {
      let changed = false;
      const callRe = /\$\{\s*(\??[A-Za-z_]\w*)((?:\s*"(?:\\"|[^"])*")*)\s*\}/g;
      text = text.replaceAll(
        callRe,
        (
          match: string,
          rawName: string,
          rawArgs: string,
          offset: number,
          whole: string,
        ): string => {
          if (offset > 0 && whole[offset - 1] === "$") return match;
          const name = rawName.replace(/^\?/, "",);
          // Template no corpo permanece texto (§4.4).
          if (this.macroTable.template(name,)) return match;
          const { name: macroName, args, } = this.splitMacroArgs(
            rawName + rawArgs,
          );
          const resolved = this.macroTable.resolve(
            [macroName, ...args,],
            this.sourceFileInfo(),
          );
          if (!resolved) {
            this.error(
              "undefined_macro",
              `Undefined macro '${macroName}' called`,
            );
            return match;
          }
          changed = true;
          return resolved[1];
        },
      );
      if (!changed) return text;
    }
    this.error("macro_stack_overflow", "Too many nested macro calls.",);
    return text;
  }

  /**
   * Decide se _name_ aponta para um template, respeitando o prefixo `?`
   * (chamada opcional, §4.5.4). Devolve também o estado de opcionalidade
   * para que o chamador saiba silenciar um nome inexistente.
   */
  templateCallTarget(
    name: string,
  ): { template: Template | null; optional: boolean } {
    const optional = name.startsWith("?",);
    const clean = optional ? name.slice(1,) : name;
    return { template: this.macroTable.template(clean,), optional, };
  }

  /**
   * Cadeia de templates atualmente em avaliação, da base ao topo.
   *
   * A ancoragem é a mesma das macros: entradas `macro === null` na pilha de
   * expansões do stream, empilhadas por `injectMacro` e desempilhadas por
   * `cleanupMacroStack` conforme o cursor avança. Por isso a detecção de
   * recursão enxerga chamadas aninhadas produzidas pelo próprio render
   * (reentrada do stream), não apenas o aninhamento sintático.
   */
  protected templateCallChain(): string[] {
    const cf = this.cf;
    if (!cf) return [];
    const chain: string[] = [];
    for (const entry of cf.macroStack) {
      if (entry.macro === null && entry.args.length > 0) {
        chain.push(entry.args[0]!,);
      }
    }
    return chain;
  }

  /**
   * Liga o motor de expressões lógicas da Fase 11 à expansão de argumentos.
   * Sem avaliador, uma chamada como `isMilestone(!t1)` permanece texto.
   */
  setExpressionEvaluator(
    evaluator: ((text: string,) => ExpressionEvaluation) | null,
  ): void {
    this.expressionEvaluator = evaluator;
  }

  /**
   * Liga a view somente-leitura de `project` (§4.7). O provedor é **lazy**:
   * a chamada `${NOME …}` acontece depois do cabeçalho do projeto.
   */
  setProjectContextProvider(
    provider: (() => Readonly<Record<string, unknown>> | null) | null,
  ): void {
    this.projectContextProvider = provider;
  }

  /** Liga `ids()` (§4.7) ao resolvedor de IDs do projeto. */
  setTemplateIdResolver(
    resolver: ((id: string,) => string) | null,
  ): void {
    this.templateIdResolver = resolver;
  }

  /** Resultado do avaliador externo (`ok: false` quando não há motor). */
  protected evaluateArgumentExpression(text: string,): ExpressionEvaluation {
    return this.expressionEvaluator
      ? this.expressionEvaluator(text,)
      : { ok: false, };
  }

  /**
   * Converte `k=v k2="v 2"` no contexto da chamada (subfase 23.4).
   *
   * A tipagem (string/número/booleano/`!id`/lista/objeto/expressão) vive em
   * `template-arguments.ts`, que não conhece o scanner. Aqui só traduzimos a
   * recusa em mensagem localizada. Devolve `null` quando o texto não é uma
   * lista de pares válida (erro já reportado).
   */
  protected parseNamedArguments(
    callName: string,
    rawArgs: string,
    callSfi: SourceFileInfo,
  ): Record<string, TemplateArgumentValue> | null {
    const parsed = parseTemplateArguments(rawArgs, {
      evaluateExpression: (text: string,) =>
        this.evaluateArgumentExpression(text,),
    },);
    if (parsed.ok) return parsed.args;

    const prefix = `template '${callName}': `;
    switch (parsed.reason) {
      case "invalid_pair":
        this.error(
          "template_bad_argument",
          `${prefix}argumento inválido em '${parsed.at}'`,
          callSfi,
        );
        break;
      case "missing_value":
        this.error(
          "template_bad_argument",
          `${prefix}valor ausente para '${parsed.key}'`,
          callSfi,
        );
        break;
      case "unterminated_string":
        this.error(
          "template_bad_argument",
          `${prefix}string não fechada em '${parsed.key}'`,
          callSfi,
        );
        break;
      case "unbalanced":
        this.error(
          "template_bad_argument",
          `${prefix}delimitador não balanceado em '${parsed.key}'`,
          callSfi,
        );
        break;
    }
    return null;
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

/**
 * ProjectFileScanner — especialização do Scanner para a sintaxe TJP.
 *
 * Port de `ProjectFileScanner.rb` (arquivo inteiro). Registra os ~30
 * padrões com seus modos (:tjp, :dqString, :sqString, :szrString(1),
 * :macroCall, :macroDef, :cppComment) e os pós-processadores de token.
 *
 * Extensão SyntaxMesh (ADR 023): quando `language !== 'en'`, tokens `ID`
 * são normalizados para o keyword canônico via `LanguageRegistry.resolve`,
 * MANTENDO o tipo "ID" — o FSM casa literais pelo texto do token ID
 * (State#transition tenta transição literal antes do fallback :ID).
 *
 * Nota de port: os padrões de ID do Ruby são ASCII-only
 * (`[a-zA-Z_]` seguido de `\w`); aqui usamos classe Unicode (`\p{L}` e
 * `\p{N}`) para permitir keywords acentuados ('esforço', 'duración').
 *
 * @see docs/taskjuggler/lib/taskjuggler/ProjectFileScanner.rb
 */
import { TjTime, } from "../time/tj-time.ts";
import { globalRegistry, LanguageRegistry, } from "../i18n/mod.ts";
import type { CanonicalUnit, } from "../i18n/types.ts";
import type { LogLike, } from "./stream-handle.ts";
import {
  Scanner,
  type TokenPattern,
  type TokenPostProcessor,
} from "./scanner.ts";

/** Modos do scanner de arquivos TJP (Ruby Symbols → strings ':'-prefix). */
export const TJP_MODES = {
  tjp: ":tjp",
  dqString: ":dqString",
  sqString: ":sqString",
  szrString: ":szrString",
  szrString1: ":szrString1",
  macroCall: ":macroCall",
  macroDef: ":macroDef",
  cppComment: ":cppComment",
} as const;

/** Unidade canônica → literal curto usado pela gramática TJP. */
const UNIT_TO_LITERAL: Record<CanonicalUnit, string> = {
  minute: "min",
  hour: "h",
  day: "d",
  week: "w",
  month: "m",
  quarter: "q",
  year: "y",
};

export class ProjectFileScanner extends Scanner {
  /** Idioma do arquivo para normalização de keywords (ADR 023). */
  readonly language: string;
  /** Registro de idiomas injetável (testes usam instâncias isoladas). */
  protected registry: LanguageRegistry;

  /** Acumulador de strings multi-linha (Ruby @string). */
  private string = "";
  /** Indentação da primeira linha de uma string szr (Ruby @indent). */
  private indent = "";
  /** Texto da chamada de macro em montagem (Ruby @macroCall). */
  private macroCall = "";
  /** Modo a restaurar no fim da chamada de macro (Ruby @macroCallPreviousMode). */
  private macroCallPreviousMode = ":tjp";
  /** Texto da definição de macro em montagem (Ruby @macroDef). */
  private macroDef = "";

  /**
   * Provedor de variáveis de ambiente (Ruby `ENV[name]`).
   * Browser: substituído pela UI; padrão: `Deno.env` quando existir.
   */
  static envProvider: (name: string,) => string | null = (name,) => {
    const g = globalThis as Record<string, any>;
    return g.Deno?.env?.get(name,) ?? null;
  };

  constructor(
    masterFile: string,
    log: LogLike,
    language = "en",
    registry: LanguageRegistry = globalRegistry,
  ) {
    // Padrões registrados após super(): `this` indisponível nos argumentos.
    super(masterFile, log, [], TJP_MODES.tjp,);
    this.language = language;
    this.registry = registry;
    this.registerPatterns();
    // Reavalia activePatterns agora que ':tjp' existe.
    this.mode = TJP_MODES.tjp;
  }

  /** Registra todos os padrões na ordem exata do Ruby (ordem é crítica). */
  private registerPatterns(): void {
    const post = (fn: TokenPostProcessor,): TokenPostProcessor => fn;
    const patterns: TokenPattern[] = [
      // Quaisquer espaços em branco.
      [null, /\s+/, ":tjp", post(() => this.newPos()),],

      // Comentários de linha única iniciados por #.
      [null, /#.*\n?/, ":tjp", post(() => this.newPos()),],

      // Comentários de linha única estilo C++ iniciados por //.
      [null, /\/\/.*\n?/, ":tjp", post(() => this.newPos()),],

      // Comentários estilo C de linha única /* .. */.
      [null, /\/\*.*\*\//, ":tjp", post(() => this.newPos()),],

      // Comentários estilo C multi-linha: início (muda para :cppComment).
      [null, /\/\*([^*]*[^/]|.*)\n/, ":tjp", post(() => this.startComment()),],
      // Fim do comentário multi-linha (volta para :tjp).
      [null, /.*\*\//, ":cppComment", post(() => this.endComment()),],
      // Linhas que não contêm nem início nem fim do comentário.
      [null, /.*\n/, ":cppComment", null,],

      // Chamada de macro: o prefixo (número/identificador/parte de string)
      // é preservado e re-injetado junto com o texto expandido.
      [
        null,
        /([-a-zA-Z_0-9>:.+]*|"(\\"|[^"])*?|'(\\'|[^'])*?)?\$\{\s*(\??[a-zA-Z_]\w*)(\s*"(\\"|[^"])*")*/,
        ":tjp",
        post((_, match,) => this.startMacroCall(match,)),
      ],
      // Idem, ativo dentro de strings multi-linha de aspas duplas.
      [
        null,
        /(\\"|[^"])*?\$\{\s*(\??[a-zA-Z_]\w*)(\s*"(\\"|[^"])*")*/,
        ":dqString",
        post((_, match,) => this.startMacroCall(match,)),
      ],
      [
        null,
        /(\\'|[^'])*?\$\{\s*(\??[a-zA-Z_]\w*)(\s*"(\\"|[^"])*")*/,
        ":sqString",
        post((_, match,) => this.startMacroCall(match,)),
      ],
      // Fim da chamada: injeta prefixo + macro expandida; restaura o modo.
      [
        null,
        /(\s*"(\\"|[^"])*")*\s*\}/,
        ":macroCall",
        post((_, match,) => this.endMacroCall(match,)),
      ],
      // Argumentos em linhas sem início nem fim da chamada.
      [
        null,
        /.*\n/,
        ":macroCall",
        post((_, match,) => this.midMacroCall(match,)),
      ],

      // Referência a variável de ambiente: não pode ultrapassar a linha.
      [
        null,
        /([-a-zA-Z_0-9>:.+]*|"(\\"|[^"])*?|'(\\'|[^'])*?)?\$\([A-Z_][A-Z_0-9]*\)/,
        ":tjp",
        post((_, match,) => this.environmentVariable(match,)),
      ],

      // ID com sufixo de dois-pontos: foo:
      [
        "ID_WITH_COLON",
        /[A-Za-z_\p{L}][\p{L}\p{N}_]*:/u,
        ":tjp",
        post((type, match,) => this.chop(type, match,)),
      ],

      // ID absoluto: a.b.c
      [
        "ABSOLUTE_ID",
        /[A-Za-z_\p{L}][\p{L}\p{N}_]*(\.[A-Za-z_\p{L}][\p{L}\p{N}_]*)+/u,
        undefined,
        null,
      ],

      // ID comum: bar (com normalização i18n quando idioma ≠ en).
      [
        "ID",
        /[A-Za-z_\p{L}][\p{L}\p{N}_]*/u,
        undefined,
        post((type, match,) => this.i18nId(type, match,)),
      ],

      // Uma data.
      [
        "DATE",
        /\d{4}-\d{1,2}-\d{1,2}(-\d{1,2}:\d{1,2}(:\d{1,2})?(-[-+]?\d{4})?)?/,
        ":tjp",
        post((type, match,) => this.toDate(type, match,)),
      ],

      // Hora do dia.
      [
        "TIME",
        /\d{1,2}:\d{2}/,
        ":tjp",
        post((type, match,) => this.toTime(type, match,)),
      ],

      // Número de ponto flutuante (ex.: 3.143).
      [
        "FLOAT",
        /\d*\.\d+/,
        ":tjp",
        post((type, match,) => [type, Number.parseFloat(match,),]),
      ],

      // Número inteiro.
      [
        "INTEGER",
        /\d+/,
        ":tjp",
        post((type, match,) => [type, Number.parseInt(match, 10,),]),
      ],

      // String multi-linha entre aspas duplas: início (muda para :dqString).
      [
        null,
        /"(\\"|[^"])*/,
        ":tjp",
        post((_, match,) => this.startStringDQ(match,)),
      ],
      // Qualquer linha sem início nem fim.
      [
        null,
        /(\\"|[^"])*\n/,
        ":dqString",
        post((_, match,) => this.midStringDQ(match,)),
      ],
      // Fim da string (volta para :tjp).
      [
        "STRING",
        /(\\"|[^"])*"/,
        ":dqString",
        post((_, match,) => this.endStringDQ(match,)),
      ],

      // String multi-linha entre aspas simples.
      [
        null,
        /'(\\'|[^'])*/,
        ":tjp",
        post((_, match,) => this.startStringSQ(match,)),
      ],
      [
        null,
        /(\\'|[^'])*\n/,
        ":sqString",
        post((_, match,) => this.midStringSQ(match,)),
      ],
      [
        "STRING",
        /(\\'|[^'])*'/,
        ":sqString",
        post((_, match,) => this.endStringSQ(match,)),
      ],

      // String tesoura -8<- ... ->8-: a marca de abertura deve ser o último
      // item da linha. A indentação da 1ª linha vale para todas as demais.
      [
        null,
        /-8<-.*\n/,
        ":tjp",
        post((_, match,) => this.startStringSZR(match,)),
      ],
      // O fim pode estar na primeira linha (string vazia): ambos os modos.
      [
        "STRING",
        /\s*->8-/,
        ":szrString1",
        post((type, match,) => this.endStringSZR(type, match,)),
      ],
      [
        "STRING",
        /\s*->8-/,
        ":szrString",
        post((type, match,) => this.endStringSZR(type, match,)),
      ],
      // Macros dentro de strings tesoura.
      [
        null,
        /.*?\$\{\s*(\??[a-zA-Z_]\w*)(\s*"(\\"|[^"])*")*/,
        [":szrString", ":szrString1",],
        post((_, match,) => this.startMacroCall(match,)),
      ],
      // Qualquer linha sem início nem fim.
      [
        null,
        /.*\n/,
        ":szrString1",
        post((_, match,) => this.firstStringSZR(match,)),
      ],
      [
        null,
        /.*\n/,
        ":szrString",
        post((_, match,) => this.midStringSZR(match,)),
      ],

      // Definição de macro de linha única.
      [
        "MACRO",
        /\[.*\]\n/,
        ":tjp",
        post((type, match,) => this.chop2nl(type, match,)),
      ],

      // Definição de macro multi-linha: início (muda para :macroDef).
      [
        null,
        /\[.*\n/,
        ":tjp",
        post((_, match,) => this.startMacroDef(match,)),
      ],
      // Fim: ']' seguido imediatamente de quebra de linha (volta p/ :tjp).
      [
        "MACRO",
        /.*\]\n/,
        ":macroDef",
        post((type, match,) => this.endMacroDef(type, match,)),
      ],
      // Qualquer linha sem início nem fim.
      [
        null,
        /.*\n/,
        ":macroDef",
        post((_, match,) => this.midMacroDef(match,)),
      ],

      // Literais de múltiplos caracteres.
      ["LITERAL", /<=?/, undefined, null,],
      ["LITERAL", />=?/, undefined, null,],
      ["LITERAL", /!=?/, undefined, null,],

      // Todo o resto é devolvido como literal de caractere único.
      ["LITERAL", /./, undefined, null,],
    ];

    for (const [type, regExp, mode, postProc,] of patterns) {
      this.addPattern(type, regExp, mode ?? ":tjp", postProc,);
    }
  }

  // ---------------------------------------------------------------------------
  // Pós-processadores (ordem privada do Ruby)
  // ---------------------------------------------------------------------------

  /** Marca o início de token após ignorar texto; devolve token vazio. */
  private newPos(): [null, "",] {
    this.startOfToken = this.sourceFileInfo();
    return [null, "",];
  }

  private chop(type: string | null, match: string,): [string | null, string,] {
    // Remove o último caractere.
    return [type, match.slice(0, -1,),];
  }

  /** Remove o primeiro e o último caractere. */
  private chop2(type: string | null, match: string,): [string | null, string,] {
    return [type, match.slice(1, -1,),];
  }

  /** Remove o primeiro, o último caractere e o \n final (se houver). */
  private chop2nl(
    type: string | null,
    match: string,
  ): [string | null, string,] {
    if (match.endsWith("\n",)) {
      // Ruby match[1..-3]: remove '[', ']' e '\n'.
      return [type, match.slice(1, -2,),];
    }
    return [type, match.slice(1, -1,),];
  }

  private startComment(): [null, "",] {
    this.mode = TJP_MODES.cppComment;
    return [null, "",];
  }

  private endComment(): [null, "",] {
    this.mode = TJP_MODES.tjp;
    return [null, "",];
  }

  private startStringDQ(match: string,): [null, "",] {
    this.mode = TJP_MODES.dqString;
    // Remove a " inicial e as barras de escape das " escapadas.
    this.string = match.slice(1,).replaceAll('\\"', '"',);
    return [null, "",];
  }

  private midStringDQ(match: string,): [null, "",] {
    this.string += match.replaceAll('\\"', '"',);
    return [null, "",];
  }

  private endStringDQ(match: string,): ["STRING", string,] {
    this.mode = TJP_MODES.tjp;
    this.string += match.slice(0, -1,).replaceAll('\\"', '"',);
    return ["STRING", this.string,];
  }

  private startStringSQ(match: string,): [null, "",] {
    this.mode = TJP_MODES.sqString;
    this.string = match.slice(1,).replaceAll("\\'", "'",);
    return [null, "",];
  }

  private midStringSQ(match: string,): [null, "",] {
    this.string += match.replaceAll("\\'", "'",);
    return [null, "",];
  }

  private endStringSQ(match: string,): ["STRING", string,] {
    this.mode = TJP_MODES.tjp;
    this.string += match.slice(0, -1,).replaceAll("\\'", "'",);
    return ["STRING", this.string,];
  }

  private startStringSZR(match: string,): [null, "",] {
    // Deve haver quebra de linha após a marca; permitimos espaços entre
    // a marca e a quebra.
    if (
      match.length !== 5 &&
      !/-8<-\s*\n$/.test(match,)
    ) {
      this.lineDelta = 1;
      this.error(
        "junk_after_cut",
        "The cut mark -8<- must be immediately followed by a line break.",
      );
    }
    this.mode = TJP_MODES.szrString1;
    this.startOfToken = this.sourceFileInfo();
    this.string = "";
    return [null, "",];
  }

  private firstStringSZR(match: string,): [null, "",] {
    this.mode = TJP_MODES.szrString;
    // Separa a indentação líder do restante da string.
    const m = /(\s*)(.*\n)/.exec(match,);
    this.indent = m ? m[1]! : "";
    this.string = m ? m[2]! : "";
    return [null, "",];
  }

  private midStringSZR(match: string,): [null, "",] {
    // Ignora do início de match os caracteres iguais a @indent.
    let i = 0;
    while (i < this.indent.length && this.indent[i] === match[i]) i++;
    this.string += match.slice(i,);
    return [null, "",];
  }

  private endStringSZR(
    type: string | null,
    _match: string,
  ): [string | null, string,] {
    this.mode = TJP_MODES.tjp;
    return [type, this.string,];
  }

  /** Referência `$(VAR)`: injeta o valor da variável de ambiente. */
  private environmentVariable(match: string,): [null, "",] {
    // Caracteres antes de $( viram prefixo e são re-injetados.
    let prefix = "";
    let envRef = match;
    const start = match.indexOf("$(",);
    if (start > 0) {
      prefix = match.slice(0, start,);
      envRef = match.slice(start,);
    }
    // Remove '$(' e ')'.
    const varName = envRef.slice(2, -1,);

    const value = ProjectFileScanner.envProvider(varName,);
    if (value) {
      this.cf?.injectText(prefix + value, envRef.length,);
    } else {
      this.error(
        "unknown_env_var",
        `Unknown environment variable '${varName}'`,
      );
    }
    return [null, "",];
  }

  private startMacroDef(match: string,): [null, "",] {
    this.mode = TJP_MODES.macroDef;
    // Remove o '[' inicial.
    this.macroDef = match.slice(1,);
    return [null, "",];
  }

  private midMacroDef(match: string,): [null, "",] {
    this.macroDef += match;
    return [null, "",];
  }

  private endMacroDef(
    type: string | null,
    match: string,
  ): [string | null, string,] {
    this.mode = TJP_MODES.tjp;
    // Remove "](\n|$)".
    if (match.endsWith("\n",)) {
      this.macroDef += match.slice(0, -2,);
    } else {
      this.macroDef += match.slice(0, -1,);
    }
    return [type, this.macroDef,];
  }

  private startMacroCall(match: string,): [null, "",] {
    this.macroCallPreviousMode = this.scannerMode;
    this.mode = TJP_MODES.macroCall;
    this.macroCall = match;
    return [null, "",];
  }

  private midMacroCall(match: string,): [null, "",] {
    this.macroCall += match;
    return [null, "",];
  }

  private endMacroCall(match: string,): [null, "",] {
    this.mode = this.macroCallPreviousMode;
    this.macroCall += match;

    // Caracteres antes de ${ viram prefixo e são re-injetados.
    let prefix = "";
    const macroStart = this.macroCall.indexOf("${",);
    if (macroStart > 0) {
      prefix = this.macroCall.slice(0, macroStart,);
      this.macroCall = this.macroCall.slice(macroStart,);
    }

    const macroCallLength = this.macroCall.length;
    // Remove '${' e '}' e espaços nas bordas.
    const argsStr = this.macroCall
      .slice(2, -1,)
      .replace(/^[ \t\n]*(.*?)[ \t\n]*$/ms, "$1",);

    const spaceIdx = argsStr.indexOf(" ",);
    if (spaceIdx < 0) {
      this.expandMacro(prefix, [argsStr,], macroCallLength,);
    } else {
      const macroName = argsStr.slice(0, spaceIdx,);
      let rest = argsStr.slice(macroName.length,);
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

      this.expandMacro(prefix, [macroName, ...args,], macroCallLength,);
    }

    return [null, "",];
  }

  // ---------------------------------------------------------------------------
  // Conversões numéricas e temporais
  // ---------------------------------------------------------------------------

  private toDate(
    type: string | null,
    match: string,
  ): [string | null, unknown,] {
    try {
      return [type, TjTime.fromString(match,),];
    } catch (msg) {
      this.error("time_error", (msg as Error).message,);
      // Ruby: resumo do método devolve nil → token engolido (ignorado).
      return [null, "",];
    }
  }

  private toTime(
    type: string | null,
    match: string,
  ): [string | null, number,] {
    const [hStr, mStr,] = match.split(":",);
    let h = Number.parseInt(hStr!, 10,);
    if (h < 0 || h > 24) {
      this.error("time_bad_hour", `Hour ${h} out of range (0 - 24)`,);
      h = 0;
    }
    let m = Number.parseInt(mStr!, 10,);
    if (m < 0 || m > 59) {
      this.error("time_bad_minute", `Minute ${m} out of range (0 - 59)`,);
      m = 0;
    }
    if (h === 24 && m !== 0) {
      this.error("time_bad_time", `Time ${match} cannot be larger then 24:00`,);
    }

    return [type, (h * 60 + m) * 60,];
  }

  // ---------------------------------------------------------------------------
  // i18n (extensão SyntaxMesh — ADR 023)
  // ---------------------------------------------------------------------------

  /**
   * Normaliza tokens `ID`: se o texto for um sinônimo do idioma ativo,
   * devolve o keyword canônico Mantendo o tipo "ID" (o FSM casa literais
   * pelo texto em tokens ID — ver State#transition).
   */
  private i18nId(
    type: string | null,
    match: string,
  ): [string | null, string,] {
    if (this.language !== "en" && type === "ID") {
      const canonical = this.registry.resolve(match, this.language,);
      if (canonical !== null) {
        return ["ID", canonical,];
      }
      // Unidades de duração locais ('dias' → 'd', 'años' → 'y') — a gramática
      // casa os literais curtos en (rule_durationUnit). Só traduz sinônimos
      // próprios do idioma: 'days' em `loadunit days` (arquivo pt-BR) é
      // literal inglês válido do FSM e não pode virar 'd'.
      if (this.registry.hasUnitInLanguage(match, this.language,)) {
        const unit = this.registry.resolveUnit(match, this.language,);
        if (unit !== null) {
          const literal = UNIT_TO_LITERAL[unit];
          if (literal) {
            return ["ID", literal,];
          }
        }
      }
    }
    return [type, match,];
  }
}

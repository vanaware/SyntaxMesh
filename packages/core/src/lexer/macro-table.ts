import { type SourceFileInfo, } from "../source-file-info.ts";

/**
 * Macro — representa uma definição de macro usada pelo scanner.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/MacroTable.rb
 */
export class Macro {
  readonly name: string;
  readonly value: string;
  readonly sourceFileInfo: SourceFileInfo;

  constructor(name: string, value: string, sourceFileInfo: SourceFileInfo,) {
    if (!name || name.length === 0) {
      throw new Error("Macro name cannot be empty",);
    }
    this.name = name;
    this.value = value;
    this.sourceFileInfo = sourceFileInfo;
  }
}

/**
 * Template — definição do elemento `template` (extensão TS-only, ADR 033).
 *
 * O corpo é **texto cru**: nada é interpretado no registro; a renderização
 * Vento acontece só na chamada (`${NOME …}`), dentro do scanner.
 *
 * @see docs/syntaxmesh/fases/fase-23-template.md (§4.1)
 */
export class Template {
  readonly name: string;
  /** Corpo cru, sem os delimitadores `[` `]`. */
  readonly body: string;
  /** Parâmetros nomeados declarados, na ordem da declaração. */
  readonly params: string[];
  readonly sourceFileInfo: SourceFileInfo;

  constructor(
    name: string,
    body: string,
    params: string[],
    sourceFileInfo: SourceFileInfo,
  ) {
    if (!name || name.length === 0) {
      throw new Error("Template name cannot be empty",);
    }
    this.name = name;
    this.body = body;
    this.params = params;
    this.sourceFileInfo = sourceFileInfo;
  }
}

/** Tipo de entrada do namespace unificado macro/template. */
export type MacroKind = "macro" | "template";

/** Entrada do namespace: macro ou template. */
export type MacroEntry = Macro | Template;

/** Resultado de `addTemplate` — o chamador traduz para mensagem localizada. */
export type AddTemplateResult =
  | { ok: true }
  /** Nome não começa com letra maiúscula (plano §4.1). */
  | { ok: false; reason: "bad_name" }
  /** Nome já registrado no namespace compartilhado (§4.5). */
  | { ok: false; reason: "collision"; existing: MacroKind };

/** Nome de template válido: inicia com letra maiúscula ASCII (regra da macro). */
export function isValidTemplateName(name: string,): boolean {
  return /^[A-Z]/.test(name,);
}

/**
 * MacroTable — armazena macros e templates no **mesmo namespace** e resolve
 * as chamadas `${...}` no momento da expansão.
 *
 * O contrato de macro da Fase 10 (`add`/`includes`/`resolve`) permanece
 * intacto; `template` é uma ramificação interna (ADR 033, decisão 4). Os dois
 * tipos não coexistem com o mesmo nome: a colisão é reportada na definição.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/MacroTable.rb
 */
export class MacroTable {
  private readonly entries: Map<string, MacroEntry>;

  constructor() {
    this.entries = new Map();
  }

  /** Adiciona ou substitui uma macro na tabela. */
  add(macro: Macro,): void {
    this.entries.set(macro.name, macro,);
  }

  /**
   * Registra um template no namespace compartilhado.
   *
   * Não lança: devolve o motivo da recusa para que o chamador emita a
   * mensagem com o `SourceFileInfo` da segunda definição (§5 do plano).
   * Colisão macro+macro **não** passa por aqui — ela continua sendo o
   * `warning marco_redefinition` do Ruby (caminho de macro congelado).
   */
  addTemplate(template: Template,): AddTemplateResult {
    if (!isValidTemplateName(template.name,)) {
      return { ok: false, reason: "bad_name", };
    }
    const existing = this.kindOf(template.name,);
    if (existing !== null) {
      return { ok: false, reason: "collision", existing, };
    }
    this.entries.set(template.name, template,);
    return { ok: true, };
  }

  /** Remove todas as definições (macros e templates) da tabela. */
  clear(): void {
    this.entries.clear();
  }

  /**
   * true se o nome existe no namespace — macro **ou** template.
   * (`macroDefined` continua sendo o predicado macro-only do Ruby.)
   */
  includes(name: string,): boolean {
    return this.entries.has(name,);
  }

  /** true se _name_ é uma macro (Ruby `include?`). */
  macroDefined(name: string,): boolean {
    return this.entries.get(name,) instanceof Macro;
  }

  /** true se _name_ é um template. */
  templateDefined(name: string,): boolean {
    return this.entries.get(name,) instanceof Template;
  }

  /** Tipo da entrada registrada (`null` se não existe). */
  kindOf(name: string,): MacroKind | null {
    const entry = this.entries.get(name,);
    if (entry instanceof Macro) return "macro";
    if (entry instanceof Template) return "template";
    return null;
  }

  /** Entrada crua do namespace (ramo único de lookup do scanner). */
  lookup(name: string,): MacroEntry | null {
    return this.entries.get(name,) ?? null;
  }

  /** Template registrado ou null. */
  template(name: string,): Template | null {
    const entry = this.entries.get(name,);
    return entry instanceof Template ? entry : null;
  }

  /** Templates registrados, na ordem de definição. */
  templates(): Template[] {
    const result: Template[] = [];
    for (const entry of this.entries.values()) {
      if (entry instanceof Template) result.push(entry,);
    }
    return result;
  }

  /**
   * Resolve uma chamada de macro.
   *
   * O primeiro argumento é o nome (ou nome opcional com prefixo `?`).
   * Os demais são parâmetros substituindo os tokens `${n}` na definição.
   * Se a macro não existe, retorna `null`.
   *
   * Um **template** de mesmo nome nunca é resolvido por aqui: o ramo de
   * template do scanner decide antes (ver `Scanner#expandMacro`).
   */
  resolve(
    args: string[],
    sourceFileInfo: SourceFileInfo,
  ): [Macro | null, string,] | null {
    const name = args[0] ?? "";
    // Se o primeiro caractere do nome for '?', a macro pode ser indefinida
    // e é silenciosamente ignorada.
    if (name.length > 0 && name[0] === "?") {
      const cleanName = name.slice(1,);
      // Ruby l.66: macro opcional **indefinida** devolve `[nil, '']` — o
      // `text === ''` faz expandMacro ignorar a chamada em silêncio.
      const optional = this.entries.get(cleanName,);
      if (!(optional instanceof Macro)) {
        return [null, "",];
      }
      // Definida: o Ruby segue o fluxo normal com o nome sem '?' e expande o
      // corpo (args[0] continua sendo '?NAME', então `${0}` vira '?NAME').
      return [optional, substituteArguments(optional.value, args,),];
    }
    const macro = this.entries.get(name,);
    if (!(macro instanceof Macro)) {
      return null;
    }

    return [macro, substituteArguments(macro.value, args,),];
  }
}

/**
 * Substitui os tokens `${n}` do corpo pelos argumentos posicionais e
 * desescapa `$${` (Ruby `MacroTable#resolve` l.71-83).
 */
function substituteArguments(value: string, args: string[],): string {
  let resolved = value;
  for (let i = 0; i < args.length; i++) {
    const idx = i;
    const pattern = new RegExp(`(([^$]|^))\\$\\{${idx}\\}`, "g",);
    resolved = resolved.replaceAll(pattern, "$1" + args[i],);
  }
  // Remove o escape caractere de todos os '${...}' escapados.
  return resolved.replaceAll("$${", "${",);
}

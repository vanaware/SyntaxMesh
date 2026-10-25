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
 * MacroTable — armazena macros definidas e resolve-as no momento da chamada.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/MacroTable.rb
 */
export class MacroTable {
  private readonly macros: Map<string, Macro>;

  constructor() {
    this.macros = new Map();
  }

  /** Adiciona ou substitui uma macro na tabela. */
  add(macro: Macro,): void {
    this.macros.set(macro.name, macro,);
  }

  /** Remove todas as definições da tabela. */
  clear(): void {
    this.macros.clear();
  }

  /** Retorna true se uma macro com o nome _name_ está definida (Ruby `include?`). */
  includes(name: string,): boolean {
    return this.macros.has(name,);
  }

  /**
   * Resolve uma chamada de macro.
   *
   * O primeiro argumento é o nome (ou nome opcional com prefixo `?`).
   * Os demais são parâmetros substituindo os tokens `${n}` na definição.
   * Se a macro não existe, retorna `null`.
   */
  resolve(
    args: string[],
    sourceFileInfo: SourceFileInfo,
  ): [Macro, string,] | null {
    const name = args[0] ?? "";
    // Se o primeiro caractere do nome for '?', a macro pode ser indefinida
    // e é silenciosamente ignorada.
    if (name.length > 0 && name[0] === "?") {
      const cleanName = name.slice(1,);
      if (!this.macros.has(cleanName,)) {
        return null;
      }
      return [this.macros.get(cleanName,)!, "",];
    }
    const macro = this.macros.get(name,);
    if (!macro) {
      return null;
    }

    let resolved = macro.value;
    for (let i = 0; i < args.length; i++) {
      const idx = i;
      const pattern = new RegExp(`(([^$]|^))\\$\\{${idx}\\}`, "g",);
      resolved = resolved.replaceAll(pattern, "$1" + args[i],);
    }
    // Remove o escape caractere de todos os '${...}' escapados.
    resolved = resolved.replaceAll("$${", "${",);
    return [macro, resolved,];
  }
}

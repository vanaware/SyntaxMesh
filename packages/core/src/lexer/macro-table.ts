import { type SourceFileInfo, } from "../source-file-info.ts";

/**
 * Macro — represents a macro definition used by the scanner.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/MacroTable.rb
 */
export class Macro {
  /** Name the macro is called by. */
  readonly name: string;
  /** Body of the macro, expanded in place of the call. */
  readonly value: string;
  /** Source location where the macro was defined. */
  readonly sourceFileInfo: SourceFileInfo;

  /**
   * Ruby `initialize(name, value, sourceFileInfo)`.
   *
   * @param name Name the macro is called by.
   * @param value Body of the macro.
   * @param sourceFileInfo Source location of the definition.
   * @throws Error When the name is empty.
   */
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
 * Template — definition of the `template` element (a TS-only extension,
 * ADR 033).
 *
 * The body is **raw text**: nothing is interpreted at registration time; the
 * Vento rendering happens only on a call (`${NAME …}`), inside the scanner.
 *
 * @see docs/syntaxmesh/fases/fase-23-template.md (§4.1)
 */
export class Template {
  /** Name the template is called by. */
  readonly name: string;
  /** Raw body, without the `[` `]` delimiters. */
  readonly body: string;
  /** Declared named parameters, in declaration order. */
  readonly params: string[];
  /** Source location where the template was defined. */
  readonly sourceFileInfo: SourceFileInfo;

  /**
   * Builds a template definition.
   *
   * @param name Name the template is called by.
   * @param body Raw body of the template.
   * @param params Declared named parameters.
   * @param sourceFileInfo Source location of the definition.
   * @throws Error When the name is empty.
   */
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

/** Kind of entry of the unified macro/template namespace. */
export type MacroKind = "macro" | "template";

/** Entry of the namespace: a macro or a template. */
export type MacroEntry = Macro | Template;

/** Result of `addTemplate` — the caller translates it into a localized message. */
export type AddTemplateResult =
  | { ok: true }
  /** The name does not start with an uppercase letter (plan §4.1). */
  | { ok: false; reason: "bad_name" }
  /** The name is already registered in the shared namespace (§4.5). */
  | { ok: false; reason: "collision"; existing: MacroKind };

/**
 * Valid template name: starts with an ASCII uppercase letter (the macro rule).
 *
 * @param name Name to validate.
 * @returns Whether the name is acceptable for a template.
 */
export function isValidTemplateName(name: string,): boolean {
  return /^[A-Z]/.test(name,);
}

/**
 * MacroTable — stores macros and templates in the **same namespace** and
 * resolves the `${...}` calls at expansion time.
 *
 * The phase 10 macro contract (`add`/`includes`/`resolve`) stays intact;
 * `template` is an internal branch (ADR 033, decision 4). The two kinds cannot
 * coexist with the same name: the collision is reported at definition time.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/MacroTable.rb
 */
export class MacroTable {
  private readonly entries: Map<string, MacroEntry>;

  /** Creates an empty table. */
  constructor() {
    this.entries = new Map();
  }

  /**
   * Adds or replaces a macro in the table.
   *
   * @param macro Macro to register.
   */
  add(macro: Macro,): void {
    this.entries.set(macro.name, macro,);
  }

  /**
   * Registers a template in the shared namespace.
   *
   * It does not throw: it returns the refusal reason so the caller can emit the
   * message with the `SourceFileInfo` of the second definition (plan §5). A
   * macro+macro collision does **not** come through here — it is still the
   * Ruby `warning marco_redefinition` (frozen macro path).
   *
   * @param template Template to register.
   * @returns Whether the registration succeeded, and why it failed.
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

  /** Removes every definition (macros and templates) from the table. */
  clear(): void {
    this.entries.clear();
  }

  /**
   * true if the name exists in the namespace — macro **or** template.
   * (`macroDefined` remains the macro-only predicate of Ruby.)
   *
   * @param name Name to look up.
   * @returns Whether the name is registered.
   */
  includes(name: string,): boolean {
    return this.entries.has(name,);
  }

  /**
   * true if _name_ is a macro (Ruby `include?`).
   *
   * @param name Name to look up.
   * @returns Whether a macro with that name exists.
   */
  macroDefined(name: string,): boolean {
    return this.entries.get(name,) instanceof Macro;
  }

  /**
   * true if _name_ is a template.
   *
   * @param name Name to look up.
   * @returns Whether a template with that name exists.
   */
  templateDefined(name: string,): boolean {
    return this.entries.get(name,) instanceof Template;
  }

  /**
   * Kind of the registered entry (`null` when it does not exist).
   *
   * @param name Name to look up.
   * @returns The kind of the entry, or `null`.
   */
  kindOf(name: string,): MacroKind | null {
    const entry = this.entries.get(name,);
    if (entry instanceof Macro) return "macro";
    if (entry instanceof Template) return "template";
    return null;
  }

  /**
   * Raw entry of the namespace (single lookup branch of the scanner).
   *
   * @param name Name to look up.
   * @returns The entry, or `null`.
   */
  lookup(name: string,): MacroEntry | null {
    return this.entries.get(name,) ?? null;
  }

  /**
   * Registered template, or null.
   *
   * @param name Name to look up.
   * @returns The template, or `null`.
   */
  template(name: string,): Template | null {
    const entry = this.entries.get(name,);
    return entry instanceof Template ? entry : null;
  }

  /**
   * Registered templates, in definition order.
   *
   * @returns The templates of the table.
   */
  templates(): Template[] {
    const result: Template[] = [];
    for (const entry of this.entries.values()) {
      if (entry instanceof Template) result.push(entry,);
    }
    return result;
  }

  /**
   * Resolves a macro call.
   *
   * The first argument is the name (or an optional name prefixed by `?`). The
   * remaining ones are parameters replacing the `${n}` tokens in the definition.
   * If the macro does not exist, it returns `null`.
   *
   * A **template** with the same name is never resolved here: the template
   * branch of the scanner decides first (see `Scanner#expandMacro`).
   *
   * @param args Arguments of the call; `args[0]` is the name.
   * @param sourceFileInfo Source location of the call.
   * @returns The macro plus its expanded body, or `null` when undefined.
   */
  resolve(
    args: string[],
    sourceFileInfo: SourceFileInfo,
  ): [Macro | null, string,] | null {
    const name = args[0] ?? "";
    // If the first character of the name is '?', the macro may be undefined
    // and is silently ignored.
    if (name.length > 0 && name[0] === "?") {
      const cleanName = name.slice(1,);
      // Ruby l.66: an **undefined** optional macro returns `[nil, '']` — the
      // `text === ''` makes expandMacro silently ignore the call.
      const optional = this.entries.get(cleanName,);
      if (!(optional instanceof Macro)) {
        return [null, "",];
      }
      // Defined: Ruby follows the normal flow with the name without '?' and
      // expands the body (args[0] is still '?NAME', so `${0}` becomes '?NAME').
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
 * Replaces the `${n}` tokens of the body with the positional arguments and
 * unescapes `$${` (Ruby `MacroTable#resolve` l.71-83).
 *
 * @param value Body of the macro.
 * @param args Arguments of the call.
 * @returns The body with the placeholders substituted.
 */
function substituteArguments(value: string, args: string[],): string {
  let resolved = value;
  for (let i = 0; i < args.length; i++) {
    const idx = i;
    const pattern = new RegExp(`(([^$]|^))\\$\\{${idx}\\}`, "g",);
    resolved = resolved.replaceAll(pattern, "$1" + args[i],);
  }
  // Remove the escape character from every escaped '${...}'.
  return resolved.replaceAll("$${", "${",);
}

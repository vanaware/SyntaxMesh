/**
 * Pure command-line parser for the SyntaxMesh console (22.12.15).
 *
 * Semantic console verbs become typed requests for canonical extension commands.
 * CLI-compatible `run`/`smx`/`tj3` and bare `man`/`ts`/`ss` forms stay as argv so
 * the shared F24 parser remains the only authority for their option validation.
 */
import type { ExecutionCommandOptions, } from "../commands/contracts.ts";
import type { SheetCommandOptions, } from "../commands/sheets.ts";

/** One host-independent console request. */
export type ConsoleRequest =
  | {
    kind: "project";
    action: "add" | "remove" | "list" | "setActive" | "refresh";
    project?: string;
  }
  | {
    kind: "execute";
    action: "compile" | "checkSyntax" | "scheduleOnly" | "freeze";
    project?: string;
    freezeDate?: string;
    byTask?: boolean;
    options?: ExecutionCommandOptions;
  }
  | {
    kind: "sheet";
    action:
      | "checkTimeSheet"
      | "checkStatusSheet"
      | "timeSend"
      | "timeReceive"
      | "timeSummary"
      | "statusSend"
      | "statusReceive";
    project?: string;
    sheet?: string;
    options?: SheetCommandOptions;
  }
  | {
    kind: "report";
    action: "list" | "render" | "open" | "export";
    project?: string;
    report?: string;
    pattern?: string;
    reportsIsRegex?: boolean;
    dynamicAttributes?: string;
    format?: string;
    target?: string;
  }
  | {
    kind: "run";
    argv: string[];
    stdin?: string;
    useActiveProject?: boolean;
  }
  | { kind: "clear" }
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "exit" };

/** Successful parse or a human-readable usage error. */
export type ParseConsoleResult =
  | { ok: true; value: ConsoleRequest }
  | { ok: false; error: string };

type OptionKind = "boolean" | "value";

interface OptionDefinition {
  key: string;
  kind: OptionKind;
}

type OptionDefinitions = Readonly<Record<string, OptionDefinition>>;

const DEBUG_FLAGS = new Set(["--debug", "--debuglevel", "--debugmodules",],);

/** Splits one console line without invoking a shell or expanding variables. */
function tokenize(line: string,): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let started = false;

  for (const character of line) {
    if (quote !== null) {
      if (character === quote) {
        quote = null;
      } else {
        current += character;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      started = true;
      continue;
    }
    if (/\s/.test(character,)) {
      if (started) {
        tokens.push(current,);
        current = "";
        started = false;
      }
      continue;
    }
    current += character;
    started = true;
  }

  if (quote !== null) throw new Error("unterminated quoted argument",);
  if (started) tokens.push(current,);
  return tokens;
}

/** Reads the documented semantic options shared by console commands. */
class OptionReader {
  readonly positionals: string[] = [];
  private readonly values = new Map<string, string>();
  private readonly booleans = new Set<string>();

  constructor(
    args: readonly string[],
    private readonly definitions: OptionDefinitions,
  ) {
    for (let index = 0; index < args.length; index++) {
      const argument = args[index]!;
      if (argument === "--") {
        this.positionals.push(...args.slice(index + 1,),);
        break;
      }
      if (!argument.startsWith("-",) || argument === "-") {
        this.positionals.push(argument,);
        continue;
      }

      const equals = argument.startsWith("--",) ? argument.indexOf("=",) : -1;
      const name = equals < 0 ? argument : argument.slice(0, equals,);
      const inline = equals < 0 ? null : argument.slice(equals + 1,);
      const definition = this.definitions[name];
      if (definition === undefined) {
        if (DEBUG_FLAGS.has(name,)) {
          throw new Error(
            `Option '${name}' is not yet available (no equivalent in the port).`,
          );
        }
        throw new Error(`unknown option: ${name}`,);
      }

      if (definition.kind === "boolean") {
        if (inline !== null) {
          throw new Error(`Option '${name}' does not take a value.`,);
        }
        this.booleans.add(definition.key,);
        continue;
      }

      if (inline !== null) {
        this.values.set(definition.key, inline,);
        continue;
      }
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error(`Option '${name}' requires a value.`,);
      }
      index++;
      this.values.set(definition.key, value,);
    }
  }

  /** Whether one boolean option was present. */
  has(key: string,): boolean {
    return this.booleans.has(key,);
  }

  /** One option value, or undefined when absent. */
  value(key: string,): string | undefined {
    return this.values.get(key,);
  }
}

const PROJECT_OPTIONS: OptionDefinitions = {
  "--project": { key: "project", kind: "value", },
};

const EXECUTION_OPTIONS: OptionDefinitions = {
  ...PROJECT_OPTIONS,
  "--config": { key: "configUri", kind: "value", },
  "--output-dir": { key: "outputDir", kind: "value", },
  "-o": { key: "outputDir", kind: "value", },
  "--report": { key: "report", kind: "value", },
  "--reports": { key: "reports", kind: "value", },
  "-A": { key: "dynamicAttributes", kind: "value", },
  "--dynamic-attributes": { key: "dynamicAttributes", kind: "value", },
  "--force-reports": { key: "forceReports", kind: "boolean", },
  "-f": { key: "forceReports", kind: "boolean", },
  "--abort-on-warnings": { key: "abortOnWarnings", kind: "boolean", },
  "--warn-ts-deltas": { key: "warnTsDeltas", kind: "boolean", },
  "--add-trace": { key: "addTrace", kind: "boolean", },
  "--check-syntax": { key: "checkSyntax", kind: "boolean", },
  "--no-reports": { key: "noReports", kind: "boolean", },
  "--freeze": { key: "freeze", kind: "boolean", },
  "--freeze-by-task": { key: "byTask", kind: "boolean", },
  "--freezebytask": { key: "byTask", kind: "boolean", },
  "--freezedate": { key: "freezeDate", kind: "value", },
};

const REPORT_OPTIONS: OptionDefinitions = {
  ...PROJECT_OPTIONS,
  "--pattern": { key: "pattern", kind: "value", },
  "--list-reports": { key: "listReports", kind: "value", },
  "--report": { key: "report", kind: "value", },
  "--reports": { key: "reports", kind: "value", },
  "-A": { key: "dynamicAttributes", kind: "value", },
  "--dynamic-attributes": { key: "dynamicAttributes", kind: "value", },
  "--format": { key: "format", kind: "value", },
  "--target": { key: "target", kind: "value", },
  "--output-dir": { key: "target", kind: "value", },
  "-o": { key: "target", kind: "value", },
};

const SHEET_CHECK_OPTIONS: OptionDefinitions = {
  ...PROJECT_OPTIONS,
  "--sheet": { key: "sheet", kind: "value", },
  "--config": { key: "configUri", kind: "value", },
};

/** Resolves one optional positional project plus its explicit flag form. */
function positionalProject(
  reader: OptionReader,
): string | undefined {
  const flagged = reader.value("project",);
  const positional = reader.positionals[0];
  if (flagged !== undefined && positional !== undefined) {
    throw new Error(
      "project was supplied both positionally and with --project",
    );
  }
  if (reader.positionals.length > 1) {
    throw new Error("too many positional arguments",);
  }
  return flagged ?? positional;
}

/** Parses `project <action> [project]`. */
function parseProject(args: readonly string[],): ConsoleRequest {
  const verb = args[0];
  const actions: Record<
    string,
    Extract<ConsoleRequest, { kind: "project" }>["action"]
  > = {
    add: "add",
    remove: "remove",
    list: "list",
    "set-active": "setActive",
    refresh: "refresh",
  };
  const action = verb === undefined ? undefined : actions[verb];
  if (action === undefined) {
    throw new Error(
      "project action must be add, remove, list, set-active or refresh",
    );
  }

  const reader = new OptionReader(args.slice(1,), PROJECT_OPTIONS,);
  if (action === "list") {
    if (
      reader.positionals.length > 0 || reader.value("project",) !== undefined
    ) {
      throw new Error("project list does not accept a project argument",);
    }
    return { kind: "project", action, };
  }
  const project = positionalProject(reader,);
  return {
    kind: "project",
    action,
    ...(project === undefined ? {} : { project, }),
  };
}

/** Parses compile/check/schedule/freeze verbs and their semantic flags. */
function parseExecution(args: readonly string[],): ConsoleRequest {
  const verb = args[0];
  if (
    verb !== "compile" && verb !== "check-syntax" &&
    verb !== "schedule-only" && verb !== "freeze"
  ) {
    throw new Error(`unknown execution command: ${verb ?? ""}`,);
  }
  const reader = new OptionReader(args.slice(1,), EXECUTION_OPTIONS,);
  const project = positionalProject(reader,);
  const checkSyntax = verb === "check-syntax" || reader.has("checkSyntax",);
  const noReports = verb === "schedule-only" || reader.has("noReports",);
  const freeze = verb === "freeze" || reader.has("freeze",) ||
    reader.has("byTask",) || reader.value("freezeDate",) !== undefined;
  const selected = [checkSyntax, noReports, freeze,].filter(Boolean,).length;
  if (selected > 1) {
    throw new Error("check-syntax, no-reports and freeze flags conflict",);
  }
  const action = checkSyntax
    ? "checkSyntax"
    : noReports
    ? "scheduleOnly"
    : freeze
    ? "freeze"
    : "compile";

  const options: ExecutionCommandOptions = {};
  const configUri = reader.value("configUri",);
  const outputDir = reader.value("outputDir",);
  const report = reader.value("report",);
  const reports = reader.value("reports",);
  const dynamicAttributes = reader.value("dynamicAttributes",);
  if (configUri !== undefined) options.configUri = configUri;
  if (outputDir !== undefined) options.outputDir = outputDir;
  if (report !== undefined && reports !== undefined) {
    throw new Error("--report and --reports conflict",);
  }
  if (report !== undefined) {
    options.report = report;
    options.reportsIsRegex = false;
  } else if (reports !== undefined) {
    options.report = reports;
    options.reportsIsRegex = true;
  }
  if (dynamicAttributes !== undefined) {
    options.dynamicAttributes = dynamicAttributes;
  }
  for (
    const [flag, key,] of [
      ["forceReports", "forceReports",],
      ["abortOnWarnings", "abortOnWarnings",],
      ["warnTsDeltas", "warnTsDeltas",],
      ["addTrace", "addTrace",],
    ] as const
  ) {
    if (reader.has(flag,)) options[key] = true;
  }

  const freezeDate = reader.value("freezeDate",);
  return {
    kind: "execute",
    action,
    ...(project === undefined ? {} : { project, }),
    ...(action === "freeze" && freezeDate !== undefined ? { freezeDate, } : {}),
    ...(action === "freeze" && reader.has("byTask",) ? { byTask: true, } : {}),
    ...(Object.keys(options,).length === 0 ? {} : { options, }),
  };
}

/** Parses `report <action> [project] [selection]`. */
function parseReport(args: readonly string[],): ConsoleRequest {
  const verb = args[0];
  if (
    verb !== "list" && verb !== "render" && verb !== "open" && verb !== "export"
  ) {
    throw new Error("report action must be list, render, open or export",);
  }
  const reader = new OptionReader(args.slice(1,), REPORT_OPTIONS,);
  if (reader.positionals.length > 2) {
    throw new Error("too many positional arguments",);
  }
  const flaggedProject = reader.value("project",);
  const positionalProject = reader.positionals[0];
  if (flaggedProject !== undefined && positionalProject !== undefined) {
    throw new Error(
      "project was supplied both positionally and with --project",
    );
  }
  const project = flaggedProject ?? positionalProject;
  const selection = reader.positionals[1];
  const dynamicAttributes = reader.value("dynamicAttributes",);

  if (verb === "list") {
    const pattern = reader.value("pattern",) ?? reader.value("listReports",);
    if (
      reader.value("pattern",) !== undefined &&
      reader.value("listReports",) !== undefined
    ) {
      throw new Error("--pattern and --list-reports conflict",);
    }
    if (pattern !== undefined && selection !== undefined) {
      throw new Error("report pattern was supplied more than once",);
    }
    const selected = pattern ?? selection;
    return {
      kind: "report",
      action: "list",
      ...(project === undefined ? {} : { project, }),
      ...(selected === undefined ? {} : {
        pattern: selected,
        reportsIsRegex: true,
      }),
    };
  }

  const exact = reader.value("report",);
  const regex = reader.value("reports",);
  if (exact !== undefined && regex !== undefined) {
    throw new Error("--report and --reports conflict",);
  }
  const flaggedSelection = exact ?? regex;
  if (flaggedSelection !== undefined && selection !== undefined) {
    throw new Error("report selection was supplied more than once",);
  }
  const report = flaggedSelection ?? selection;
  const action: Extract<ConsoleRequest, { kind: "report" }>["action"] = verb;
  const base = {
    kind: "report" as const,
    action,
    ...(project === undefined ? {} : { project, }),
    ...(report === undefined ? {} : { report, }),
    ...(verb === "render" && exact !== undefined
      ? { reportsIsRegex: false, }
      : {}),
    ...(verb === "render" && regex !== undefined
      ? { reportsIsRegex: true, }
      : {}),
    ...(dynamicAttributes === undefined ? {} : { dynamicAttributes, }),
  };

  if (verb !== "export") return base;
  const format = reader.value("format",);
  const target = reader.value("target",);
  return {
    ...base,
    ...(format === undefined ? {} : { format, }),
    ...(target === undefined ? {} : { target, }),
  };
}

/** Parses `check-ts`/`check-ss` with one sheet or project plus sheet. */
function parseSheetCheck(
  action: "checkTimeSheet" | "checkStatusSheet",
  args: readonly string[],
): ConsoleRequest {
  const reader = new OptionReader(args, SHEET_CHECK_OPTIONS,);
  const flaggedProject = reader.value("project",);
  const flaggedSheet = reader.value("sheet",);
  let project = flaggedProject;
  let sheet = flaggedSheet;

  if (reader.positionals.length > 2) {
    throw new Error("too many positional arguments",);
  }
  if (reader.positionals.length === 2) {
    if (project !== undefined) {
      throw new Error(
        "project was supplied both positionally and with --project",
      );
    }
    project = reader.positionals[0];
    if (sheet !== undefined) {
      throw new Error("sheet was supplied more than once",);
    }
    sheet = reader.positionals[1];
  } else if (reader.positionals.length === 1) {
    if (sheet !== undefined) {
      throw new Error("sheet was supplied more than once",);
    }
    sheet = reader.positionals[0];
  }
  if (sheet === undefined) throw new Error("sheet file is required",);

  const configUri = reader.value("configUri",);
  const options: SheetCommandOptions = {};
  if (configUri !== undefined) options.configUri = configUri;
  return {
    kind: "sheet",
    action,
    ...(project === undefined ? {} : { project, }),
    sheet,
    ...(Object.keys(options,).length === 0 ? {} : { options, }),
  };
}

/** Parses one already-tokenized semantic command. */
function parseSemantic(tokens: readonly string[],): ConsoleRequest {
  const verb = tokens[0];
  if (verb === "project") return parseProject(tokens.slice(1,),);
  if (verb === "report") return parseReport(tokens.slice(1,),);
  if (verb === "check-ts") {
    return parseSheetCheck("checkTimeSheet", tokens.slice(1,),);
  }
  if (verb === "check-ss") {
    return parseSheetCheck("checkStatusSheet", tokens.slice(1,),);
  }
  if (
    verb === "compile" || verb === "check-syntax" ||
    verb === "schedule-only" || verb === "freeze"
  ) {
    return parseExecution(tokens,);
  }
  if (
    verb === "clear" || verb === "help" || verb === "version" || verb === "exit"
  ) {
    if (tokens.length !== 1) {
      throw new Error(`${verb} does not accept arguments`,);
    }
    return { kind: verb, };
  }
  if (verb?.startsWith("syntaxmesh.",) === true) {
    throw new Error("console input cannot be used as a command id",);
  }
  throw new Error(`unknown console command: ${verb ?? ""}`,);
}

/**
 * Parses one console line into a typed request.
 *
 * @param line raw console input; quotes are grouped without shell expansion.
 * @returns the request or a usage error; run argv is intentionally not validated.
 */
export function parseConsoleLine(line: string,): ParseConsoleResult {
  try {
    const tokens = tokenize(line,);
    if (tokens.length === 0) {
      return { ok: false, error: "empty console command", };
    }
    const verb = tokens[0]!;
    if (verb === "run" || verb === "smx" || verb === "tj3") {
      return { ok: true, value: { kind: "run", argv: tokens.slice(1,), }, };
    }
    if (verb === "man") {
      return { ok: true, value: { kind: "run", argv: [...tokens,], }, };
    }
    if (verb === "ts" || verb === "ss") {
      return {
        ok: true,
        value: { kind: "run", argv: [...tokens,], useActiveProject: true, },
      };
    }
    return { ok: true, value: parseSemantic(tokens,), };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error,),
    };
  }
}

/**
 * Seções de resultado do envelope (Fase 24 — adendo v2.1 §3.4).
 *
 * Cada construtor devolve **dados** (nada de chamar `exit`, imprimir ou gravar)
 * e só é invocado quando o request pede a seção correspondente. O contrato é
 * o do adendo: seção ausente = não pedida.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3.3/§3.4
 */
import { AppConfig, } from "../app-config.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import type { SheetCheckResult, } from "../taskjuggler.ts";
import { EXIT_ERROR, EXIT_OK, } from "./envelope.ts";
import type { Project, } from "../model/project.ts";
import type { Report, } from "../model/report.ts";
import {
  renderReports,
  type RenderReportsOptions,
} from "../reports/reports-json.ts";
import type {
  ExecutionManRequest,
  ExecutionSheetAppOptions,
  FreezeSection,
  ListReportsEntry,
  ManSection,
  OptionSpec,
  SheetAppName,
  SheetSection,
} from "./types.ts";

/**
 * Especificação das opções de execução v1 (plano §5.2).
 *
 * **Fonte única**: alimenta a seção `help` do envelope e a definição do comando
 * Cliffy na CLI (24.3). Manter aqui evita duas listas divergentes.
 */
export const OPTION_SPECS: readonly OptionSpec[] = [
  {
    name: "config",
    short: null,
    type: "string",
    argument: "<file>",
    description: "Read YAML configuration from the given file.",
  },
  {
    name: "abort-on-warnings",
    short: null,
    type: "boolean",
    argument: null,
    description: "Treat warnings as errors.",
  },
  {
    name: "check-syntax",
    short: null,
    type: "boolean",
    argument: null,
    description: "Only parse the project, do not schedule or report.",
  },
  {
    name: "list-reports",
    short: null,
    type: "string",
    argument: "<regex>",
    description: "List all reports matching the regular expression.",
  },
  {
    name: "no-reports",
    short: null,
    type: "boolean",
    argument: null,
    description: "Schedule but do not generate any reports.",
  },
  {
    name: "report",
    short: null,
    type: "string",
    argument: "<id>",
    description: "Generate only the given report (repeatable).",
  },
  {
    name: "reports",
    short: null,
    type: "string",
    argument: "<regex>",
    description: "Generate the reports matching the regular expression.",
  },
  {
    name: "dynamic-attributes",
    short: "A",
    type: "string",
    argument: "<attrs>",
    description: "Override report attributes for the generated report.",
  },
  {
    name: "output-dir",
    short: "o",
    type: "string",
    argument: "<dir>",
    description: "Directory the reports should go into.",
  },
  {
    name: "force-reports",
    short: null,
    type: "boolean",
    argument: null,
    description: "Generate reports even after errors were found.",
  },
  {
    name: "warn-ts-deltas",
    short: null,
    type: "boolean",
    argument: null,
    description: "Warn about differences between time sheet data and plan.",
  },
  {
    name: "add-trace",
    short: null,
    type: "boolean",
    argument: null,
    description: "Enable trace reports.",
  },
  {
    name: "version",
    short: null,
    type: "boolean",
    argument: null,
    description: "Print the version of the application and exit.",
  },
  {
    name: "help",
    short: null,
    type: "boolean",
    argument: null,
    description: "Print this help and exit.",
  },
  {
    name: "freeze",
    short: null,
    type: "boolean",
    argument: null,
    description: "Generate a booking freeze file from the master file.",
    deferred: "Fase 24 — 24.9 (reescrita do master .tjp pela política da CLI)",
  },
  {
    name: "freeze-by-task",
    short: null,
    type: "boolean",
    argument: null,
    description: "Group bookings by task instead of resource (with --freeze).",
    deferred: "Fase 24 — 24.9",
  },
  {
    name: "check-time-sheet",
    short: null,
    type: "boolean",
    argument: null,
    description: "Validate a time sheet against the project.",
    deferred: "Fase 24 — 24.10 (apps de sheet)",
  },
  {
    name: "check-status-sheet",
    short: null,
    type: "boolean",
    argument: null,
    description: "Validate a status sheet against the project.",
    deferred: "Fase 24 — 24.10 (apps de sheet)",
  },
];

/** Seção `check` — parse sem agenda (fonte do exit do `--check-syntax`). */
export function checkSection(valid: boolean,): { valid: boolean } {
  return { valid, };
}

/** Compara por id canônico (`report.id`), igual ao resto do modelo. */
function matches(report: Report, pattern: string, isRegex: boolean,): boolean {
  if (!isRegex) return report.id === pattern || report.fullId === pattern;
  try {
    return new RegExp(pattern,).test(report.fullId,);
  } catch {
    return false;
  }
}

/**
 * Seção `listReports` — `[{ name, type }]` na ordem de declaração.
 *
 * Não usa `Project#listReports`, que imprime no console (caminho legado).
 */
export function listReportsSection(
  project: Project,
  pattern: string | null = null,
  isRegex = true,
): ListReportsEntry[] {
  const entries: ListReportsEntry[] = [];
  for (const item of project.reports.toArray()) {
    const report = item as Report;
    if (
      pattern !== null && pattern !== "" && !matches(report, pattern, isRegex,)
    ) {
      continue;
    }
    entries.push({ name: report.name, type: report.typeSpec ?? "", },);
  }
  return entries;
}

/** Seção `reports` — delega o contrato a `renderReports` (24.2.15). */
export function reportsSection(
  project: Project,
  options: RenderReportsOptions = {},
) {
  return renderReports(project, options,);
}

/** Seção `help` — especificação estruturada das opções de execução. */
export function helpSection(): OptionSpec[] {
  return OPTION_SPECS.map((spec,) => ({ ...spec, }));
}

/** Seção `version` — `AppConfig` é a fonte (preenchida no build). */
export function versionSection(): { name: string; version: string } {
  return {
    name: AppConfig.softwareName,
    version: AppConfig.version,
  };
}

/**
 * Seção `freeze` (24.2.26) — forma do envelope + âncora.
 *
 * O núcleo da reescrita do master `.tjp` continua ancorado na Fase 24 → 24.9:
 * o `execute` devolve `{ fileName, contents }` e a **gravação** é do consumidor
 * (`io.writeText`). Até 24.9 não há conteúdo a devolver, então a seção fica
 * ausente e o chamador registra a mensagem de indisponibilidade.
 */
export function freezeSection(
  fileName: string,
  contents: string,
): FreezeSection {
  return { fileName, contents, };
}

/** Seção `man` (24.2.26) — forma do envelope; doc-core é da Fase 22. */
export function manSection(
  request: ExecutionManRequest,
  content: string,
): ManSection {
  return {
    format: request.format,
    keyword: request.keyword ?? null,
    content,
  };
}

/** Seção `sheet` (24.2.26) — apps da F18 devolvem dados, nunca gravam. */
export function sheetSection(
  app: SheetAppName,
  data: Omit<SheetSection, "app"> = {},
): SheetSection {
  return { app, ...data, };
}

/**
 * Saída da seção `sheet`: a seção em si mais o `exitCode` a propagar.
 *
 * A seção não carrega o `MessageHandler` — quem decide o código final combina
 * este valor com os erros acumulados (matriz do plano §5.3).
 */
export interface SheetSectionOutcome {
  section: SheetSection;
  exitCode: number;
}

/**
 * Mínimo que a seção `sheet` precisa do `TaskJuggler` (24.2.33).
 *
 * Estrutural de propósito: evita o ciclo `execute → sections → taskjuggler`.
 */
export interface SheetChecker {
  checkTimeSheetContent(
    content: string,
    fileName?: string,
  ): SheetCheckResult;
  checkStatusSheetContent(
    content: string,
    fileName?: string,
  ): SheetCheckResult;
}

/**
 * Checa `check-ts`/`check-ss` sobre o **conteúdo** do request (24.2.33).
 *
 * O journal compilado sai em `section.reportText` — é a substituição do campo
 * mutável `lastSheetReport` na via envelope. Sem conteúdo o app falha com
 * mensagem própria (nada de ler disco para “adivinhar” a folha).
 */
export function checkSheetSection(
  checker: SheetChecker,
  app: "check-ts" | "check-ss",
  options: ExecutionSheetAppOptions | null = {},
): SheetSectionOutcome {
  const handler = MessageHandlerInstance.instance;
  const content = options?.sheetContent ?? null;
  if (content === null || content.trim() === "") {
    handler.error(
      "sheet_app_input_missing",
      `No sheet content provided for '${app}' (appOptions.sheetContent)`,
    );
    return {
      section: sheetSection(app, { exitCode: EXIT_ERROR, },),
      exitCode: EXIT_ERROR,
    };
  }

  const fileName = options?.sheetFile ??
    (app === "check-ts" ? "<time sheet>" : "<status sheet>");
  const result = app === "check-ts"
    ? checker.checkTimeSheetContent(content, fileName,)
    : checker.checkStatusSheetContent(content, fileName,);
  const exitCode = result.valid ? EXIT_OK : EXIT_ERROR;
  return {
    section: sheetSection(app, {
      exitCode,
      ...(result.report === null ? {} : { reportText: result.report, }),
    },),
    exitCode,
  };
}

/**
 * Seção `sheet` para os apps ainda ancorados na Fase 24 (24.10).
 *
 * `ts/ss` × `send`/`receive`/`summary` precisam da política de saída da CLI
 * (arquivos, destinatários) que só existe em 24.10; a mecânica de dados já
 * está pronta (`runSheetAppData`, 24.2.32).
 */
export function anchoredSheetSection(app: SheetAppName,): SheetSectionOutcome {
  MessageHandlerInstance.instance.error(
    "sheet_app_not_available",
    `Sheet app '${app}' is not available yet (Phase 24 — task 24.10).`,
  );
  return {
    section: sheetSection(app, { exitCode: EXIT_ERROR, },),
    exitCode: EXIT_ERROR,
  };
}

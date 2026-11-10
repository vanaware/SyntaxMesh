/**
 * Result sections of the envelope (phase 24 — appendix v2.1 §3.4).
 *
 * Every builder returns **data** (no `exit`, no printing, no writing) and is
 * only invoked when the request asks for the corresponding section. The
 * contract is the appendix's: an absent section means it was not requested.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3.3/§3.4
 */
import { AppConfig, } from "../app-config.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import type { SheetCheckResult, } from "../taskjuggler.ts";
import { normalizeStorePath, } from "../interfaces/memory-file-store.ts";
import { runSheetAppData, } from "../sheets/app-data.ts";
import type { SheetAppBase, } from "../sheets/apps/app-base.ts";
import { SsReceiverApp, } from "../sheets/apps/ss-receiver-app.ts";
import { SsSenderApp, } from "../sheets/apps/ss-sender-app.ts";
import { TsReceiverApp, } from "../sheets/apps/ts-receiver-app.ts";
import { TsSenderApp, } from "../sheets/apps/ts-sender-app.ts";
import { TsSummaryApp, } from "../sheets/apps/ts-summary-app.ts";
import type { EmailMessage, } from "../sheets/email-message.ts";
import { EXIT_ERROR, EXIT_OK, } from "./envelope.ts";
import type { Project, } from "../model/project.ts";
import type { Report, } from "../model/report.ts";
import type { ManOutput, } from "../docgen/man.ts";
import {
  renderReports,
  type RenderReportsOptions,
  type ReportsJson,
} from "../reports/reports-json.ts";
import type {
  ExecutionManRequest,
  ExecutionSheetAppOptions,
  FreezeFile,
  FreezeSection,
  ListReportsEntry,
  ManSection,
  OptionSpec,
  SheetAppName,
  SheetEmail,
  SheetSection,
} from "./types.ts";

/**
 * Specification of the v1 execution options (plan §5.2).
 *
 * **Single source**: feeds the `help` section of the envelope and the Cliffy
 * command definition in the CLI (24.3). Keeping it here avoids two diverging
 * lists.
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
    name: "format",
    short: null,
    type: "string",
    argument: "<format>",
    description:
      "Output format of the 'man' command: text (default), html or smx.",
  },
  {
    name: "force-reports",
    // `Tj3.rb` l.148-151: `-f, --force-reports`. In the sheet apps the same
    // `-f` is `--force` (the subcommand decides — see `parseArgs`).
    short: "f",
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
  },
  {
    name: "freeze-by-task",
    short: null,
    type: "boolean",
    argument: null,
    description: "Group bookings by task instead of resource (with --freeze).",
  },
  {
    name: "freezedate",
    short: null,
    type: "string",
    argument: "<date>",
    description: "Cut-off date of the booking file (default: now).",
  },
  {
    name: "check-time-sheet",
    short: null,
    type: "string",
    argument: "<tji-file>",
    description: "Validate a time sheet against the project.",
  },
  {
    name: "check-status-sheet",
    short: null,
    type: "string",
    argument: "<tji-file>",
    description: "Validate a status sheet against the project.",
  },
];

/** `check` section — parse without scheduling (exit source of `--check-syntax`). */
export function checkSection(valid: boolean,): { valid: boolean } {
  return { valid, };
}

/** Compares by canonical id (`report.id`), like the rest of the model. */
function matches(report: Report, pattern: string, isRegex: boolean,): boolean {
  if (!isRegex) return report.id === pattern || report.fullId === pattern;
  try {
    return new RegExp(pattern,).test(report.fullId,);
  } catch {
    return false;
  }
}

/**
 * `listReports` section — `[{ name, type }]` in declaration order.
 *
 * Does not use `Project#listReports`, which prints to the console (legacy path).
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

/** `reports` section — delegates the contract to `renderReports` (24.2.15). */
export function reportsSection(
  project: Project,
  options: RenderReportsOptions = {},
): ReportsJson {
  return renderReports(project, options,);
}

/** `help` section — structured specification of the execution options. */
export function helpSection(): OptionSpec[] {
  return OPTION_SPECS.map((spec,) => ({ ...spec, }));
}

/** `version` section — `AppConfig` is the source (filled at build time). */
export function versionSection(): { name: string; version: string } {
  return {
    name: AppConfig.softwareName,
    version: AppConfig.version,
  };
}

/**
 * `freeze` section (24.9.4) — freeze artifacts as **data**.
 *
 * The generation core lives in `TaskJuggler.freeze` (header + export of the
 * bookings); the consumer writes them.
 */
export function freezeSection(files: FreezeFile[],): FreezeSection {
  return { files, };
}

/**
 * `man` section (24.9.1–24.9.3) — syntax documentation as **data**.
 *
 * The content comes from the phase 22 `doc-core` (`generateMan`): the finished
 * text in `content` and, in the `html` format, the `name → content` map of the
 * manual in `files`. Writing to disk belongs to the CLI output policy (24.5).
 */
export function manSection(
  request: ExecutionManRequest,
  output: ManOutput,
): ManSection {
  return {
    format: output.format,
    keywords: [...(request.keywords ?? []),],
    content: output.content,
    files: output.files,
  };
}

/** `sheet` section (24.2.26) — phase 18 apps return data, they never write. */
export function sheetSection(
  app: SheetAppName,
  data: Omit<SheetSection, "app"> = {},
): SheetSection {
  return { app, ...data, };
}

/**
 * Outcome of a `sheet`-family section: the section data plus the exit code to
 * propagate.
 *
 * The section carries no {@link MessageHandlerInstance} — whoever computes the
 * final status combines this value with the accumulated error count.
 */
export interface SheetSectionOutcome {
  /** Data produced by the sheet app; never `null`, even on failure. */
  section: SheetSection;
  /** `0` when the app succeeded, `1` when it reported an error. */
  exitCode: number;
}

/**
 * The smallest slice of `TaskJuggler` the `sheet` section needs (24.2.33).
 *
 * Structural on purpose: it avoids the import cycle
 * `execute → sections → taskjuggler`.
 */
export interface SheetChecker {
  /**
   * Parses a time-sheet resource as text and returns the journal it produces.
   *
   * @param content Time sheet source, already read from disk by the caller.
   * @param fileName Name used in diagnostics when `content` has no location.
   */
  checkTimeSheetContent(
    content: string,
    fileName?: string,
  ): SheetCheckResult;
  /**
   * Parses a status-sheet resource as text and returns the journal it produces.
   *
   * @param content Status sheet source, already read from disk by the caller.
   * @param fileName Name used in diagnostics when `content` has no location.
   */
  checkStatusSheetContent(
    content: string,
    fileName?: string,
  ): SheetCheckResult;
}

/**
 * Checks `check-ts`/`check-ss` against the **content** of the request (24.2.33).
 *
 * The compiled journal comes out in `section.reportText` — it replaces the
 * mutable `lastSheetReport` field on the envelope path. Without content the app
 * fails with its own message (never reads the disk to "guess" the sheet).
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
 * Builds the sheet app matching the request name (24.10.1–4).
 *
 * The options arrive already typed from the consumer; the core only picks the
 * class. The `check-ts`/`check-ss` branch does **not** go through here — that is
 * a sheet check against the project, not an email app (appendix §3.4).
 */
function buildSheetApp(
  app: Exclude<SheetAppName, "check-ts" | "check-ss">,
  options: ExecutionSheetAppOptions,
): SheetAppBase {
  const common = {
    workingDir: options.workingDir ?? null,
    dryRun: options.dryRun ?? false,
    config: options.config ?? null,
    endDate: options.endDate ?? null,
  };
  switch (app) {
    case "ts-send":
      return new TsSenderApp({
        ...common,
        resources: options.resources ?? [],
        force: options.force ?? false,
        intervalDuration: options.intervalDuration ?? null,
      },);
    case "ts-receive":
      return new TsReceiverApp(common,);
    case "ts-summary":
      return new TsSummaryApp({
        ...common,
        resources: options.resources ?? [],
        sheetRecipients: options.sheetRecipients ?? [],
        digestRecipients: options.digestRecipients ?? [],
      },);
    case "ss-send":
      return new SsSenderApp({
        ...common,
        resources: options.resources ?? [],
        force: options.force ?? false,
        intervalDuration: options.intervalDuration ?? null,
        hideResource: options.hideResource ?? null,
      },);
    case "ss-receive":
      return new SsReceiverApp(common,);
  }
}

/** App messages as structured data (`raw` is the complete RFC 822). */
function sheetEmails(emails: EmailMessage[],): SheetEmail[] {
  return emails.map((email,) => ({
    to: email.to,
    subject: email.subject,
    text: email.raw,
  }));
}

/**
 * Text of the `ts summary` digest (24.10.3).
 *
 * The app sends the digest to the `digestRecipients` and then the reminders — so
 * taking the last message is not enough. The effective recipient list comes from
 * the handler (config + options), and the last email addressed to it is the
 * digest.
 */
function digestText(
  app: SheetAppBase,
  emails: EmailMessage[],
): string | undefined {
  if (!(app instanceof TsSummaryApp)) return undefined;
  const recipients = app.handler.digestRecipients;
  const digest = [...emails,].reverse().find((mail,) =>
    recipients.includes(mail.to,)
  );
  return digest?.raw ?? emails.at(-1,)?.raw;
}

/**
 * Files the app **created or changed** in the ephemeral store.
 *
 * The delta against the seed avoids rewriting templates/sheets the app merely
 * read: only what the pipeline produced reaches the consumer.
 */
function createdFiles(
  seed: readonly { path: string; content: string }[],
  produced: readonly { path: string; content: string }[],
): Array<{ name: string; contents: string }> {
  const before = new Map<string, string>();
  for (const file of seed) {
    before.set(normalizeStorePath(file.path,), file.content,);
  }
  const created: Array<{ name: string; contents: string }> = [];
  for (const file of produced) {
    const path = normalizeStorePath(file.path,);
    if (before.get(path,) === file.content) continue;
    created.push({ name: file.path, contents: file.content, },);
  }
  return created;
}

/**
 * `sheet` section for the phase 18 email apps (24.10.1–24.10.4).
 *
 * Runs the app over a `MemoryFileStore` seeded with `appOptions.files` and
 * returns the result as data: complete emails, attachments, digest and the
 * generated files. Nothing is read from the disk nor sent over SMTP
 * (ADR 036/037).
 */
export async function runSheetSection(
  project: Project,
  app: Exclude<SheetAppName, "check-ts" | "check-ss">,
  options: ExecutionSheetAppOptions | null = {},
): Promise<SheetSectionOutcome> {
  const opts = options ?? {};
  const seed = opts.files ?? [];
  const instance = buildSheetApp(app, opts,);
  const result = await runSheetAppData(instance, project, {
    files: seed,
    dirs: opts.dirs ?? [],
    rawEmail: opts.rawMessage ?? null,
  },);

  const emails = sheetEmails(result.emails,);
  const summary = digestText(instance, result.emails,);
  const section = sheetSection(app, {
    exitCode: result.exitCode,
    ...(emails.length === 0 ? {} : { emailText: emails[0]!.text, }),
    ...(emails.length === 0 ? {} : { emails, }),
    ...(result.attachments.length === 0
      ? {}
      : { attachments: result.attachments, }),
    ...(summary === undefined ? {} : { summaryText: summary, }),
    files: createdFiles(seed, result.files,),
  },);

  const failed = result.exitCode !== EXIT_OK ||
    MessageHandlerInstance.instance.errors > 0;
  return { section, exitCode: failed ? EXIT_ERROR : EXIT_OK, };
}

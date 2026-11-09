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
    name: "format",
    short: null,
    type: "string",
    argument: "<format>",
    description:
      "Output format of the 'man' command: text (default), html or smx.",
  },
  {
    name: "force-reports",
    // `Tj3.rb` l.148-151: `-f, --force-reports`. Nos apps de sheet o mesmo
    // `-f` é `--force` (quem decide é o subcomando — ver `parseArgs`).
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
 * Seção `freeze` (24.9.4) — artefatos do freeze como **dados**.
 *
 * O núcleo da geração está em `TaskJuggler.freeze` (header + export dos
 * bookings); quem grava é o consumidor.
 */
export function freezeSection(files: FreezeFile[],): FreezeSection {
  return { files, };
}

/**
 * Seção `man` (24.9.1–24.9.3) — documentação de sintaxe como **dado**.
 *
 * O conteúdo vem do `doc-core` da Fase 22 (`generateMan`): texto pronto em
 * `content` e, no formato `html`, o mapa `nome → conteúdo` do manual em
 * `files`. Gravar em disco é da política de saída da CLI (24.5).
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
 * Constrói o app de sheet correspondente ao nome do request (24.10.1–4).
 *
 * As opções chegam já tipadas do consumidor; o core só escolhe a classe. O
 * ramo `check-ts`/`check-ss` **não** passa por aqui — é verificação de folha
 * contra o projeto, não um app de email (§3.4 do adendo).
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

/** Mensagens do app como dado estruturado (`raw` é o RFC 822 completo). */
function sheetEmails(emails: EmailMessage[],): SheetEmail[] {
  return emails.map((email,) => ({
    to: email.to,
    subject: email.subject,
    text: email.raw,
  }));
}

/**
 * Texto do resumo do `ts summary` (24.10.3).
 *
 * O app envia o resumo aos `digestRecipients` e, depois, os lembretes — por
 * isso não basta pegar a última mensagem. A lista efetiva de destinatários vem
 * do handler (config + opções), e o último email para ela é o resumo.
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
 * Arquivos que o app **criou ou alterou** no store efêmero.
 *
 * O delta contra a semente evita reescrever templates/folhas que o app apenas
 * leu: só o que o pipeline produziu chega ao consumidor.
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
 * Seção `sheet` para os apps de email da Fase 18 (24.10.1–24.10.4).
 *
 * Roda o app sobre um `MemoryFileStore` semeado com `appOptions.files` e
 * devolve o resultado como dado: emails completos, anexos, resumo e os
 * arquivos gerados. Nada é lido de disco nem enviado por SMTP (ADR 036/037).
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

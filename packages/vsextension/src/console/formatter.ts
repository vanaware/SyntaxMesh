/**
 * Pure text formatters for the shared SyntaxMesh console core (22.12.15).
 *
 * Inputs are the same plain-data results returned by canonical commands. The
 * module has no editor, process or host-global dependency and never writes output
 * itself; Desktop and Web adapters decide where the returned text is displayed.
 */
import type {
  ExecutionMessage,
  ExecutionResult,
  ExecutionResults,
  ListReportsEntry,
} from "@vanaware/syntaxmesh";
import { formatMessage, } from "@vanaware/syntaxmesh-cli/reporter";
import type { ArtifactResult, } from "../commands/contracts.ts";
import type { ManCommandResult, } from "../commands/manual.ts";
import type { Tj3RunResult, } from "../commands/run.ts";
import type { SheetCommandResult, } from "../commands/sheets.ts";
import type { ProjectSummary, } from "../daemon/types.ts";

/** Renders loaded projects with their active marker and last known state. */
export function formatProjectList(
  projects: readonly ProjectSummary[],
): string {
  if (projects.length === 0) return "No projects loaded.\n";
  const lines = ["Projects:",];
  for (const project of projects) {
    const marker = project.active ? "*" : "-";
    lines.push(
      `  ${marker} ${project.entry} [${project.status}] ` +
        `reports=${project.reportCount} intent=${project.lastIntent} ` +
        project.uri,
    );
  }
  return `${lines.join("\n",)}\n`;
}

/** Renders one report inventory in declaration order. */
export function formatReportList(
  reports: readonly ListReportsEntry[],
): string {
  if (reports.length === 0) return "No reports declared.\n";
  const lines = ["Reports:",];
  for (const report of reports) {
    lines.push(`  ${report.name} (${report.type})`,);
  }
  return `${lines.join("\n",)}\n`;
}

/** Derives the semantic intent echoed by an execution request. */
function executionIntent(result: ExecutionResult,): string {
  const options = result.options;
  if (options.help) return "help";
  if (options.version) return "version";
  if (options.man !== null) return "man";
  if (options.app !== null) return options.app;
  if (options.freeze !== null) return "freeze";
  if (options.checkSyntax) return "checkSyntax";
  if (options.noReports) return "scheduleOnly";
  if (options.report !== null || options.listReports !== null) return "report";
  return "compile";
}

/** Renders structured execution messages with the shared CLI-compatible format. */
function messageLines(messages: readonly ExecutionMessage[],): string[] {
  if (messages.length === 0) return [];
  return [
    "Messages:",
    ...messages.map((message,) => `  ${formatMessage(message,)}`),
  ];
}

/** Renders one summary line for a generated report without dumping its content. */
function reportSummary(
  report: NonNullable<ExecutionResults["reports"]>["reports"][number],
): string {
  if (report.formats.length > 0) {
    return `  ${report.name}: ${
      report.formats.map((item,) => item.format).join(", ",)
    }`;
  }
  if (report.errors.length > 0) {
    return `  ${report.name}: errors: ${report.errors.join("; ",)}`;
  }
  return `  ${report.name}`;
}

/** Renders the execution envelope status, intent, messages and result metadata. */
export function formatExecutionResult(result: ExecutionResult,): string {
  const lines = [
    `Execution: ${result.ok ? "ok" : "failed"}`,
    `Intent: ${executionIntent(result,)}`,
    `Exit code: ${result.exitCode}`,
    `Entry: ${result.options.entry}`,
  ];
  if (result.results.check !== undefined) {
    lines.push(`Syntax: ${result.results.check.valid ? "valid" : "invalid"}`,);
  }
  lines.push(...messageLines(result.messages,),);

  if (result.results.listReports !== undefined) {
    lines.push("Report list:",);
    for (const report of result.results.listReports) {
      lines.push(`  ${report.name} (${report.type})`,);
    }
  }
  if (result.results.reports !== undefined) {
    lines.push("Reports:",);
    for (const report of result.results.reports.reports) {
      lines.push(reportSummary(report,),);
    }
  }
  if (result.results.freeze !== undefined) {
    lines.push("Freeze files:",);
    for (const file of result.results.freeze.files) {
      lines.push(`  ${file.fileName}`,);
    }
  }
  if (result.results.sheet !== undefined) {
    const exit = result.results.sheet.exitCode === undefined
      ? "no exit code"
      : `exit ${result.results.sheet.exitCode}`;
    lines.push(`Sheet: ${result.results.sheet.app} (${exit})`,);
  }
  if (result.results.man !== undefined) {
    lines.push(`Manual: ${result.results.man.format}`,);
  }
  return `${lines.join("\n",)}\n`;
}

/** Renders classified artifact names in production order. */
function artifactLines(artifacts: readonly ArtifactResult[],): string[] {
  if (artifacts.length === 0) return [];
  return [
    "Artifacts:",
    ...artifacts.map((artifact,) =>
      `  ${artifact.fileName} (${artifact.kind})`
    ),
  ];
}

/** Ensures one text block ends with a newline without changing its content. */
function terminated(text: string,): string {
  return text === "" || text.endsWith("\n",) ? text : `${text}\n`;
}

/** Appends one already-rendered section without introducing blank separators. */
function appendSection(output: string, section: string,): string {
  if (section === "") return output;
  const base = output === "" ? output : terminated(output,);
  return base + section;
}

/** Renders manual stdout/content, messages and written artifact names. */
export function formatManResult(result: ManCommandResult,): string {
  const stdout = result.stdout === ""
    ? result.execution.results.man?.content ?? ""
    : result.stdout;
  let output = terminated(stdout,);
  const messages = messageLines(result.execution.messages,);
  if (messages.length > 0) {
    output = appendSection(output, `${messages.join("\n",)}\n`,);
  }
  const artifacts = artifactLines(result.artifacts,);
  if (artifacts.length > 0) {
    output = appendSection(output, `${artifacts.join("\n",)}\n`,);
  }
  return output;
}

/** Renders sheet stdout/stderr, printable sheet text and artifact names. */
export function formatSheetResult(result: SheetCommandResult,): string {
  let output = result.stdout;
  output = appendSection(output, terminated(result.stderr,),);
  const sheet = result.execution.results.sheet;
  if (sheet !== undefined) {
    const printable = [
      sheet.emailText,
      ...(sheet.emails?.map((email,) => email.text) ?? []),
      sheet.summaryText,
      sheet.reportText,
    ];
    for (const text of printable) {
      if (text === undefined || text === "" || output.includes(text,)) continue;
      output = appendSection(output, terminated(text,),);
    }
  }
  const artifacts = artifactLines(result.artifacts,);
  if (artifacts.length > 0) {
    output = appendSection(output, `${artifacts.join("\n",)}\n`,);
  }
  return output;
}

/** Renders captured run output and artifacts without duplicating envelope messages. */
export function formatRunResult(result: Tj3RunResult,): string {
  let output = result.stdout;
  output = appendSection(output, terminated(result.stderr,),);
  const artifacts = artifactLines(result.artifacts,);
  if (artifacts.length > 0) {
    output = appendSection(output, `${artifacts.join("\n",)}\n`,);
  }
  return output;
}

/**
 * `output-policy.ts` — dispatching of the envelope sections (phase 24 — 24.5).
 *
 * Sole owner of the **destination** decision (addendum §4): a report with
 * `stdout: true` is printed in the terminal with the delimiter
 * `--- <name> [<format>] ---`; without `stdout` it becomes the file
 * `{name}.{ext}` in the echoed `outputDir`. The other sections (`check`,
 * `listReports`, `version`, `help`, `freeze`, `man`, `sheet`) are dispatched here
 * too, so the policy lives in a single place (plan §11 point 9).
 *
 * The core never decides the destination, never sanitises a name and never
 * touches the disk (addendum §3.5): everything this module consumes is envelope
 * data. I/O comes in by injection (`OutputPolicyIo`), so there is no disk, no
 * `Deno` and no `process` here.
 *
 * Error policy (addendum §4.4): a non-empty `reports[].errors` — or `ok: false` —
 * **aborts** the whole dispatch. Nothing is printed or partially written; the
 * `exitCode` of the envelope already carries the 1 and the consumer only
 * reports it.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §4
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.5)
 */
import type {
  ExecutionResult,
  ReportJsonEntry,
  ReportsJson,
  SheetSection,
} from "@vanaware/syntaxmesh";
import { imageRefs, } from "./images.ts";

/** I/O of the policy — injectable subset of `io.ts`. */
export interface OutputPolicyIo {
  /** Writes a line to `stdout`. */
  print: (text: string,) => void;
  /** Writes UTF-8 content (overwrites). */
  write: (path: string, content: string,) => Promise<void>;
  /** Creates a directory recursively. */
  mkpath: (dir: string,) => Promise<void>;
  /** Copies a file (HTML assets). */
  copy: (from: string, to: string,) => Promise<void>;
  /** Lists the names of a directory (empty when it is a file). */
  listDir: (path: string,) => Promise<string[]>;
  /** `true` when the path is a directory (file/missing ⇒ `false`). */
  isDir: (path: string,) => Promise<boolean>;
  /** Existence of a file or directory. */
  exists: (path: string,) => Promise<boolean>;
}

/** Auxiliary assets referenced by non-selfcontained HTML. */
export interface AssetOptions {
  /** Root where the declared subdirectories/files live. */
  root: string;
  /** Subdirectories to copy (default: `css/` and `icons/`). */
  dirs?: string[];
  /** Standalone files to copy (default: `scripts/wz_tooltip.js`). */
  files?: string[];
}

/** Dispatch options. */
export interface OutputPolicyOptions {
  /** Injected I/O. */
  io: OutputPolicyIo;
  /** HTML assets; absent turns the copy off (24.5.16). */
  assets?: AssetOptions | null;
  /**
   * Root of the relative paths of the `sheet` section (the app's
   * `-d/--directory`, `""` = current directory). The names in the envelope are
   * relative to it.
   */
  sheetBaseDir?: string;
  /**
   * Root where the relative image paths are **read** from (default `""` = the
   * working directory of the process, from where the master was read). The image
   * is copied next to the output preserving the reference; the report text is
   * never rewritten (24.10.8).
   */
  imageDir?: string;
  /** Reports a report error (CLI reporter). */
  onError?: ((text: string,) => void) | null;
}

/** Outcome of the dispatch. */
export interface OutputPolicyOutcome {
  /** Reports printed in the terminal. */
  printed: number;
  /** Paths written, in production order. */
  written: string[];
  /** Assets copied (destination). */
  assets: string[];
  /** `true` when the policy aborted on error (nothing was produced). */
  aborted: boolean;
}

/**
 * Suffix per format — mirrors the table of plan §5.5 point 1.
 *
 * Only formats whose suffix differs from the id are listed; the others use the
 * id itself. `ctags` has no suffix (the core writes the plain name).
 */
const FORMAT_EXTENSIONS: Record<string, string> = {
  csv: "csv",
  html: "html",
  json: "json",
  markdown: "md",
  iCal: "ics",
  mspxml: "xml",
  niku: "xml",
  tjp: "tjp",
  ctags: "",
};

/** Asset subdirectories referenced by the HTML (24.5.16). */
const DEFAULT_ASSET_DIRS = ["css", "icons",];
/** Standalone files referenced by the HTML (24.5.16). */
const DEFAULT_ASSET_FILES = ["scripts/wz_tooltip.js",];

/** Characters that are invalid in a file name (addendum §4.3). */
const INVALID_NAME_CHARS = /[\\?%*:|"<>]/g;

/** File extension of a format. */
export function extensionOf(format: string,): string {
  return Object.hasOwn(FORMAT_EXTENSIONS, format,)
    ? FORMAT_EXTENSIONS[format]!
    : format;
}

/**
 * Sanitises the report name for use as a file name.
 *
 * Drops path components (a simple defence against `../`), replaces the invalid
 * characters with `_` and trims the edges. An empty name falls back to `report`.
 */
export function sanitizeFileName(name: string,): string {
  const segments = name.split("/",).filter((part,) =>
    part !== "" && part !== "." && part !== ".."
  );
  const last = segments.length === 0 ? "" : segments[segments.length - 1]!;
  const trimmed = last.replace(INVALID_NAME_CHARS, "_",).trim();
  return trimmed === "" ? "report" : trimmed;
}

/** `{name}.{ext}` — plain name when the format has no suffix. */
export function fileNameFor(name: string, format: string,): string {
  const base = sanitizeFileName(name,);
  const ext = extensionOf(format,);
  return ext === "" ? base : `${base}.${ext}`;
}

/** Print delimiter (`--- <name> [<format>] ---`). */
export function delimiterFor(name: string, format: string,): string {
  return `--- ${name} [${format}] ---`;
}

/** Directory of a path already normalised with `/` (or `""` at the root). */
function dirOf(path: string,): string {
  const index = path.lastIndexOf("/",);
  if (index < 0) return "";
  return index === 0 ? "/" : path.slice(0, index,);
}

/** Joins directory and name without a double slash (`/` only, as in the envelope). */
function joinPath(dir: string, name: string,): string {
  if (dir === "" || dir === ".") return name;
  if (dir === "/") return `/${name}`;
  return `${dir.replace(/\/+$/, "",)}/${name}`;
}

/** Content without the doubled trailing newline on printing. */
function trimTrailingNewline(content: string,): string {
  return content.endsWith("\n",) ? content.slice(0, -1,) : content;
}

/** Explicit `stdout` or name `.` (`tj3` convention: print in the terminal). */
function goesToStdout(entry: ReportJsonEntry,): boolean {
  return entry.stdout || entry.name === ".";
}

/** Errors of the section, already prefixed with the report name. */
function reportErrors(section: ReportsJson,): string[] {
  const errors: string[] = [];
  for (const entry of section.reports) {
    for (const text of entry.errors) errors.push(`${entry.name}: ${text}`,);
  }
  return errors;
}

/** Copies an asset directory recursively to the destination. */
async function copyTree(
  io: OutputPolicyIo,
  from: string,
  to: string,
  created: Set<string>,
  written: string[],
): Promise<void> {
  if (!(await io.exists(from,))) return;
  if (!(await io.isDir(from,))) {
    // Leaf: a file. The destination directory is created only once.
    const dir = dirOf(to,);
    if (dir !== "" && !created.has(dir,)) {
      await io.mkpath(dir,);
      created.add(dir,);
    }
    await io.copy(from, to,);
    written.push(to,);
    return;
  }
  for (const name of await io.listDir(from,)) {
    await copyTree(
      io,
      joinPath(from, name,),
      joinPath(to, name,),
      created,
      written,
    );
  }
}

/**
 * Copies, next to the report, the relative images it cites (24.10.8).
 *
 * The `src` of the HTML/Markdown already is the correct relative path with
 * respect to the output file; what is missing is the file existing there.
 * External references (`http(s)://`, `data:`), absolute paths and paths with a
 * `..` segment are left out — no reading outside the image root (addendum
 * §4.3). A source equal to the destination is skipped.
 */
async function copyReportImages(
  io: OutputPolicyIo,
  options: OutputPolicyOptions,
  format: { format: string; content: string },
  reportPath: string,
  created: Set<string>,
  written: string[],
): Promise<void> {
  if (format.format !== "html" && format.format !== "markdown") return;
  const root = options.imageDir ?? "";
  const destDir = dirOf(reportPath,);
  for (const ref of imageRefs(format.content, format.format,)) {
    const from = joinPath(root, ref,);
    const to = joinPath(destDir, ref,);
    if (from === to) continue;
    if (!(await io.exists(from,))) continue;
    const dir = dirOf(to,);
    if (dir !== "" && !created.has(dir,)) {
      await io.mkpath(dir,);
      created.add(dir,);
    }
    await io.copy(from, to,);
    written.push(to,);
  }
}

/**
 * Dispatches the `reports` section (addendum §4.2/§4.3).
 *
 * With any report error the function **aborts before producing** — no partial
 * output (addendum §4.4) — and returns `aborted: true`.
 */
export async function dispatchReports(
  section: ReportsJson,
  options: OutputPolicyOptions,
): Promise<OutputPolicyOutcome> {
  const { io, } = options;
  const outcome: OutputPolicyOutcome = {
    printed: 0,
    written: [],
    assets: [],
    aborted: false,
  };

  const errors = reportErrors(section,);
  if (errors.length > 0 || !section.ok) {
    const messages = errors.length > 0
      ? errors
      : ["Reports failed; no output was produced.",];
    for (const text of messages) options.onError?.(text,);
    outcome.aborted = true;
    return outcome;
  }

  const baseDir = section.outputDir ?? "";
  const created = new Set<string>();
  let wantsAssets = false;

  for (const entry of section.reports) {
    if (goesToStdout(entry,)) {
      for (const format of entry.formats) {
        io.print(delimiterFor(entry.name, format.format,),);
        io.print(trimTrailingNewline(format.content,),);
      }
      outcome.printed++;
      continue;
    }
    for (const format of entry.formats) {
      const path = joinPath(baseDir, fileNameFor(entry.name, format.format,),);
      const dir = dirOf(path,);
      if (dir !== "" && !created.has(dir,)) {
        await io.mkpath(dir,);
        created.add(dir,);
      }
      await io.write(path, format.content,);
      outcome.written.push(path,);
      await copyReportImages(
        io,
        options,
        format,
        path,
        created,
        outcome.assets,
      );
      if (format.format === "html" && !entry.selfcontained) wantsAssets = true;
    }
  }

  const assets = options.assets;
  if (wantsAssets && assets !== undefined && assets !== null) {
    for (const name of assets.dirs ?? DEFAULT_ASSET_DIRS) {
      const from = joinPath(assets.root, name,);
      const to = joinPath(baseDir, name,);
      await copyTree(io, from, to, created, outcome.assets,);
    }
    // Standalone files (the repo's `scripts/` holds build tools, not only the
    // `wz_tooltip.js` the HTML loads).
    for (const name of assets.files ?? DEFAULT_ASSET_FILES) {
      const from = joinPath(assets.root, name,);
      if (!(await io.exists(from,))) continue;
      const to = joinPath(baseDir, name,);
      const dir = dirOf(to,);
      if (dir !== "" && !created.has(dir,)) {
        await io.mkpath(dir,);
        created.add(dir,);
      }
      await io.copy(from, to,);
      outcome.assets.push(to,);
    }
  }

  return outcome;
}

/** Prints the structured representation of a simple section. */
function printSection(
  io: OutputPolicyIo,
  result: ExecutionResult,
): number {
  let printed = 0;
  const sections = result.results;
  if (sections.version !== undefined) {
    io.print(`${sections.version.name} ${sections.version.version}`,);
    printed++;
  }
  if (sections.check !== undefined) {
    io.print(
      sections.check.valid ? "Syntax check passed." : "Syntax check failed.",
    );
    printed++;
  }
  for (const report of sections.listReports ?? []) {
    io.print(`${report.name} (${report.type})`,);
    printed++;
  }
  if (sections.man !== undefined && sections.man.content !== "") {
    // The `man` content ends with `\n`; `print` already closes the line.
    io.print(trimTrailingNewline(sections.man.content,),);
    printed++;
  }
  return printed;
}

/** Writes a path, creating the parent directory only once per dispatch. */
async function writeWithDir(
  io: OutputPolicyIo,
  created: Set<string>,
  path: string,
  contents: string,
): Promise<void> {
  const dir = dirOf(path,);
  if (dir !== "" && !created.has(dir,)) {
    await io.mkpath(dir,);
    created.add(dir,);
  }
  await io.write(path, contents,);
}

/**
 * Dispatches the `freeze` section (24.9.4/24.9.5).
 *
 * The core returns both artefacts (`-header.tji` and `-bookings.tji`) with the
 * name derived from the master; writing them is this policy's job, as in `tj3`.
 * Ruby truncates both files (`File.open(…, 'w')`), so an empty `-bookings.tji`
 * **is** written — skipping the empty artefact would leave the content of a
 * previous freeze on disk.
 */
async function dispatchFreeze(
  result: ExecutionResult,
  io: OutputPolicyIo,
  outcome: OutputPolicyOutcome,
  created: Set<string>,
): Promise<void> {
  const freeze = result.results.freeze;
  if (freeze === undefined) return;
  for (const file of freeze.files) {
    await writeWithDir(io, created, file.fileName, file.contents,);
    outcome.written.push(file.fileName,);
  }
}

/**
 * Dispatches the `man` section in the `html` format (24.9.1–24.9.3).
 *
 * The core returns the whole manual as a `name → content` map (chapters, one
 * page per keyword, `toc.html`, `alphabet.html`, `navbar.html`, `index.html` and
 * the stylesheet). Writing them is this policy's job: everything goes to
 * `--output-dir` (default: current directory, like `tj3man`'s `-d`).
 *
 * In the `text`/`smx` formats there is no file at all — `content` was already
 * printed by {@link printSection}.
 */
async function dispatchMan(
  result: ExecutionResult,
  io: OutputPolicyIo,
  outcome: OutputPolicyOutcome,
  created: Set<string>,
): Promise<void> {
  const man = result.results.man;
  if (man === undefined || man.files.length === 0) return;
  const base = result.options.outputDir ?? "";
  for (const file of man.files) {
    const path = joinPath(base, file.name,);
    await writeWithDir(io, created, path, file.contents,);
    outcome.written.push(path,);
  }
}

/** Name of the `outbox/*.eml` of a message (`001-dev@example.com.eml`). */
function emlName(index: number, to: string,): string {
  const seq = String(index + 1,).padStart(3, "0",);
  return `outbox/${seq}-${sanitizeFileName(to,)}.eml`;
}

/**
 * Dispatches the `sheet` section (24.10.1–24.10.4).
 *
 * Without SMTP (ADR 036), delivery becomes data: the diagnostic/summary text
 * goes to the terminal, each message becomes `outbox/*.eml` and the files the
 * app created (templates, sheets) are written under the working directory.
 * Attachments are already among those files — they are **received data**, not a
 * second destination.
 */
async function dispatchSheet(
  section: SheetSection,
  options: OutputPolicyOptions,
  outcome: OutputPolicyOutcome,
  created: Set<string>,
): Promise<void> {
  const { io, } = options;
  const text = section.reportText ?? section.summaryText ?? section.emailText;
  if (text !== undefined && text !== "") {
    io.print(trimTrailingNewline(text,),);
    outcome.printed++;
  }

  const base = options.sheetBaseDir ?? "";
  const write = async (name: string, contents: string,): Promise<void> => {
    const path = joinPath(base, name,);
    await writeWithDir(io, created, path, contents,);
    outcome.written.push(path,);
  };

  for (const file of section.files ?? []) {
    await write(file.name, file.contents,);
  }
  const emails = section.emails ?? [];
  for (const [index, email,] of emails.entries()) {
    await write(emlName(index, email.to,), email.text,);
  }
}

/**
 * Dispatches **every** envelope section in the order of addendum §4.1.
 *
 * `freeze` writes the two artefacts the core returned (24.9); `sheet` is the
 * output of the F18 apps (24.10) and is only produced when the execution
 * succeeded (addendum §4.4: no partial output in the name of an execution that
 * failed). Reports follow the same rule inside `dispatchReports`.
 */
export async function dispatchSections(
  result: ExecutionResult,
  options: OutputPolicyOptions,
): Promise<OutputPolicyOutcome> {
  const { io, } = options;
  const outcome: OutputPolicyOutcome = {
    printed: 0,
    written: [],
    assets: [],
    aborted: false,
  };

  outcome.printed += printSection(io, result,);

  // Directories already created in this dispatch (freeze, man and sheet share).
  const created = new Set<string>();
  await dispatchFreeze(result, io, outcome, created,);
  await dispatchMan(result, io, outcome, created,);

  const sheet = result.results.sheet;
  if (sheet !== undefined) {
    if (result.ok) {
      await dispatchSheet(sheet, options, outcome, created,);
    } else {
      // The diagnostic already went to the reporter; a failed app sends no email.
      outcome.aborted = true;
    }
  }

  const reports = result.results.reports;
  if (reports !== undefined) {
    const dispatched = await dispatchReports(reports, options,);
    outcome.printed += dispatched.printed;
    outcome.written.push(...dispatched.written,);
    outcome.assets.push(...dispatched.assets,);
    // Monotonic: an earlier abort (sheet with failure) is not "un-aborted" by
    // a report dispatch that went well.
    outcome.aborted = outcome.aborted || dispatched.aborted;
  }

  return outcome;
}

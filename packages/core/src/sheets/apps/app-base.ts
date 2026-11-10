/**
 * SheetAppBase — shared core of the five sheet apps.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/Tj3SheetAppBase.rb` plus the part of
 * `Tj3AppBase.rb` the core can take over: building the `RuntimeConfig`, fixing
 * the end of the period and turning the outcome into an exit code. What does
 * **not** move here is the `OptionParser`: Phase 24 reads argv/stdin and hands
 * over already-typed options (`workingDir`, `dryRun`, `config`, `endDate`, ...)
 * — see `docs/syntaxmesh/fases/fase-24-cli.md` §5.4.
 *
 * Two mandatory adaptations of the phase:
 *  - **ADR 036** — there is no SMTP: the senders return `EmailMessage` and the
 *    receivers consume the received RFC 822 text as a `string`.
 *  - **ADR 037** — the `FileStore` is injected by the caller (here, via
 *    {@link SheetAppContext}), so `run()` is `async`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Tj3SheetAppBase.rb
 * @see docs/taskjuggler/lib/taskjuggler/RuntimeConfig.rb
 * @see docs/taskjuggler/lib/taskjuggler/Tj3AppBase.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.18)
 */

import type { FileStore, } from "../../interfaces/file-store.ts";
import { MessageHandlerInstance, } from "../../message-handler.ts";
import { TjRuntimeError, } from "../../model/errors.ts";
import type { Project, } from "../../model/project.ts";
import { TjTime, } from "../../time/tj-time.ts";
import { SheetHandlerBase, } from "../sheet-handler-base.ts";
import { localDate, } from "../sheet-sender.ts";

/** Success exit code (Ruby `appMain` → 0). */
export const SHEET_APP_EXIT_OK = 0;
/** Failure exit code (Ruby `main` → 1 after `TjRuntimeError`). */
export const SHEET_APP_EXIT_ERROR = 1;

/**
 * Content of one section of the configuration file (`RuntimeConfig`).
 *
 * Ruby's YAML becomes an already-parsed JS object; section keys carry the `_`
 * prefix (`_global`, `_timesheets`, ...), like `p['_' + sec]` in
 * `RuntimeConfig#configure`.
 */
export type SheetAppConfig = Record<string, unknown>;

/** Name of the root section of each sheet kind in the config (`_timesheets`/...). */
export type SheetAppConfigRoot = "timesheets" | "statussheets";

/** Role of the app inside the subsystem, used to locate the config section. */
export type SheetAppRole = "sender" | "receiver" | "summary";

/** Options common to the five apps (what the `OptionParser` fills in Phase 24). */
export interface SheetAppOptions {
  /** `-d/--directory` (Ruby `@workingDir`). */
  workingDir?: string | null;
  /** `--dryrun`: writes no emails and commits nothing to SCM (ADR 036). */
  dryRun?: boolean;
  /** Configuration already read from the file (Ruby `RuntimeConfig`) — ADR 037. */
  config?: SheetAppConfig | null;
  /**
   * `-e/--enddate`: `YYYY-MM-DD` or a weekday (0=Sunday ... 6=Saturday).
   * Absent = per-app default (`nextDayOfWeek`).
   */
  endDate?: string | number | null;
  /** Injectable clock: keeps `date` deterministic in tests. */
  now?: (() => Date) | null;
}

/**
 * App input — what Ruby obtained from `tj3client` (project) and from STDIN
 * (message). Without a subprocess, both arrive ready (ADR 036).
 */
export interface SheetAppContext {
  /** Project already loaded (`ProjectFileParser`/`tj3client`). */
  project: Project;
  /** Destination of templates, sheets and `outbox/` (ADR 037). */
  fileStore?: FileStore | null;
  /** RFC 822 text read from a file/STDIN — used by the receivers. */
  rawEmail?: string | null;
}

/**
 * Interprets `-e/--enddate` like Ruby's `optsEndDate`.
 *
 * `YYYY-MM-DD` is accepted as a literal date (`Time.mktime` normalises
 * out-of-month days, like JS `Date`); anything else is read as a weekday
 * (`arg.to_i % 7`, so invalid text becomes Sunday, as in Ruby).
 *
 * @param value Raw option value.
 * @param now Reference date used when a weekday is given.
 * @returns The resolved date as `YYYY-MM-DD`.
 */
export function parseEndDate(
  value: string | number,
  now: Date = new Date(),
): string {
  if (typeof value === "string") {
    const ymd = /([0-9]{4})-([0-9]{2})-([0-9]{2})/u.exec(value,);
    if (ymd) {
      const year = Number(ymd[1],);
      const month = Number(ymd[2],);
      const day = Number(ymd[3],);
      return localDate(new Date(year, month - 1, day,),);
    }
  }

  const parsed = typeof value === "number"
    ? value
    : Number.parseInt(value, 10,);
  const dayOfWeek = Number.isNaN(parsed,) ? 0 : ((parsed % 7) + 7) % 7;
  return TjTime.fromDate(now,).nextDayOfWeek(dayOfWeek,).toString();
}

/**
 * Base of the sheet apps (`tj3ts_sender`, `tj3ts_receiver`, `tj3ts_summary`,
 * `tj3ss_sender`, `tj3ss_receiver`).
 *
 * The subclass only builds the handler and implements {@link appMain};
 * configuration, date and exit code live here.
 */
export abstract class SheetAppBase {
  /** Name that signs the email (`X-TaskJuggler`) and the log (Ruby `AppConfig.appName`). */
  readonly appName: string;

  /** `-d/--directory` (Ruby `@workingDir`). */
  workingDir: string | null;

  /** `--dryrun` (Ruby `@dryRun`). */
  dryRun: boolean;

  /** Configuration already parsed (Ruby `RuntimeConfig`), or `null`. */
  config: SheetAppConfig | null;

  /** End of the reporting period as `YYYY-MM-DD` (Ruby `@date`). */
  date: string;

  /** Injectable clock (Ruby `TjTime.new`). */
  protected readonly now: () => Date;

  /**
   * Creates the app.
   *
   * @param appName Name used to sign emails and log lines.
   * @param defaultDayOfWeek Weekday used when `endDate` is absent.
   * @param options Typed options produced by the CLI layer.
   */
  constructor(
    appName: string,
    defaultDayOfWeek: number,
    options: SheetAppOptions = {},
  ) {
    this.appName = appName;
    this.workingDir = options.workingDir ?? null;
    this.dryRun = options.dryRun ?? false;
    this.config = options.config ?? null;
    this.now = options.now ?? (() => new Date());

    // Ruby: each app sets `@date = TjTime.new.nextDayOfWeek(<dow>)` in the
    // constructor, and `-e/--enddate` overrides it afterwards.
    this.date = options.endDate === undefined || options.endDate === null
      ? this.defaultDate(defaultDayOfWeek,)
      : parseEndDate(options.endDate, this.now(),);
  }

  /** Handler of the app — each app exposes the concrete one (`sender`, `receiver`, ...). */
  abstract readonly handler: SheetHandlerBase;

  /** Body of the app (Ruby `appMain`), without the exit code. */
  protected abstract appMain(context: SheetAppContext,): Promise<void>;

  /**
   * Runs the app and returns the exit code (Ruby `main`).
   *
   * A `TjRuntimeError` was already announced by the `MessageHandler`
   * (`error`/`fatal`); here it only becomes `1`. Programming errors keep
   * propagating — the Phase 24 wrapper is what turns them into `crash_trap`.
   *
   * @param context Project, file store and raw email handed to the app.
   * @returns The process exit code.
   */
  async run(context: SheetAppContext,): Promise<number> {
    const errorsBefore = MessageHandlerInstance.instance.errors;
    try {
      await this.appMain(context,);
    } catch (error) {
      if (!(error instanceof TjRuntimeError)) throw error;
      return SHEET_APP_EXIT_ERROR;
    }
    return MessageHandlerInstance.instance.errors > errorsBefore
      ? SHEET_APP_EXIT_ERROR
      : SHEET_APP_EXIT_OK;
  }

  /**
   * Default of `date`: the next occurrence of the given weekday.
   *
   * Faithful to `Tj3TsSender#initialize` (`nextDayOfWeek(1)`) and to
   * `Tj3SsSender#initialize` (`nextDayOfWeek(3)`).
   *
   * @param dayOfWeek Weekday index (0 = Sunday).
   * @returns The resolved date as `YYYY-MM-DD`.
   */
  defaultDate(dayOfWeek: number,): string {
    return TjTime.fromDate(this.now(),).nextDayOfWeek(dayOfWeek,).toString();
  }

  /**
   * Rewrites `date` like Ruby's `optsEndDate`.
   *
   * @param value New value of `-e/--enddate`.
   * @returns The resolved date as `YYYY-MM-DD`.
   */
  setEndDate(value: string | number,): string {
    this.date = parseEndDate(value, this.now(),);
    return this.date;
  }

  /**
   * Applies one config section to the handler (Ruby `RuntimeConfig#configure`).
   *
   * Only fields that **exist** on the object are copied, as Ruby does when
   * walking the instance variables — a wrong name in the file is ignored instead
   * of creating a new field.
   *
   * @param target Handler that receives the section values.
   * @param section Section path, e.g. `"global"` or `"timesheets.sender"`.
   * @returns `false` when the section is not in the config.
   */
  configureTarget(target: SheetHandlerBase, section: string,): boolean {
    const node = this.sectionNode(section,);
    if (node === null) return false;

    const fields = target as unknown as Record<string, unknown>;
    for (const [key, value,] of Object.entries(node,)) {
      if (!(key in fields)) continue;
      // Ruby's YAML reads `2026-05-18` as a `Date`; the `date` field is a string.
      fields[key] = value instanceof Date ? localDate(value,) : value;
    }
    return true;
  }

  /**
   * Applies the three app sections, in Ruby's order (`global`, then the root,
   * then the role) — the last one to set a field wins.
   *
   * @param target Handler that receives the section values.
   * @param root Root section (`timesheets` or `statussheets`).
   * @param role Role section (`sender`, `receiver` or `summary`).
   * @returns `true` when any section existed in the config.
   */
  configureSheet(
    target: SheetHandlerBase,
    root: SheetAppConfigRoot,
    role: SheetAppRole,
  ): boolean {
    const applied = [
      this.configureTarget(target, "global",),
      this.configureTarget(target, root,),
      this.configureTarget(target, `${root}.${role}`,),
    ];
    return applied.some((value,) => value);
  }

  /**
   * Prepares the handler: config → `workingDir` → `dryRun`, as each Ruby
   * `appMain` did before calling the pipeline.
   *
   * @param handler Handler to configure.
   * @param root Root section (`timesheets` or `statussheets`).
   * @param role Role section (`sender`, `receiver` or `summary`).
   */
  protected prepare(
    handler: SheetHandlerBase,
    root: SheetAppConfigRoot,
    role: SheetAppRole,
  ): void {
    this.configureSheet(handler, root, role,);
    if (this.workingDir !== null) handler.workingDir = this.workingDir;
    handler.dryRun = this.dryRun;
  }

  /**
   * Injects the `FileStore` from the context into the handler (ADR 037).
   *
   * @param handler Handler that receives the store.
   * @param context App context holding the optional store.
   */
  protected attach(
    handler: SheetHandlerBase,
    context: SheetAppContext,
  ): void {
    if (context.fileStore) handler.setFileStore(context.fileStore,);
  }

  /**
   * Walks `config` down to a section (`_global`, `_timesheets.sender`, ...).
   *
   * @param section Dotted section path.
   * @returns The section object, or `null` when it does not exist.
   */
  private sectionNode(section: string,): SheetAppConfig | null {
    let node: unknown = this.config;
    for (const name of section.split(".",)) {
      if (node === null || typeof node !== "object") return null;
      node = (node as SheetAppConfig)["_" + name];
    }
    if (node === null || typeof node !== "object" || Array.isArray(node,)) {
      return null;
    }
    return node as SheetAppConfig;
  }
}

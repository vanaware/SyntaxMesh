/**
 * TagFile (phase 14.20.3) — produces a vim-compatible ctags file.
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/reports/TagFile.rb`. It
 * collects the resources, tasks and reports that have a `sourceFileInfo`
 * recorded by the parser and serializes one ctags line per property, sorted by
 * `tag` (the `fullId` of the property).
 *
 * ⚠️ Browser (ADR 027): `to_ctags()` returns the string; there is no disk
 * write. The header uses the `AppConfig` metadata.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.20.3)
 * @see docs/taskjuggler/lib/taskjuggler/reports/TagFile.rb
 */
import { Report, } from "../model/report.ts";
import type { Project, } from "../model/project.ts";
import type { Task, } from "../model/task.ts";
import type { Resource, } from "../model/resource.ts";
import { PropertyList, } from "../model/property-list.ts";
import { AppConfig, } from "../app-config.ts";
import { ReportBase, } from "./report-base.ts";
import { registerContentFactory, } from "../model/report-content.ts";

/** ctags kind: `r` resource, `t` task, `p` report. */
export type TagKind = "r" | "t" | "p";

/** One line of a ctags file: the tag, its source file, line and kind. */
export class TagFileEntry {
  /**
   * Creates an entry.
   *
   * @param tag Tag text (`fullId` of the property).
   * @param file Source file holding the property.
   * @param line Line number of the property definition.
   * @param kind Kind of the property.
   */
  constructor(
    readonly tag: string,
    readonly file: string,
    readonly line: number,
    readonly kind: TagKind,
  ) {}

  /** Comparison by `tag` (equivalent to the Ruby `<=>`). */
  compareTo(other: TagFileEntry,): number {
    if (this.tag < other.tag) return -1;
    if (this.tag > other.tag) return 1;
    return 0;
  }

  /** ctags line: `tag\tfile\tline;"\tkind\n`. */
  to_ctags(): string {
    return `${this.tag}\t${this.file}\t${this.line};"\t${this.kind}\n`;
  }
}

/**
 * The `tagfile` generator: one ctags entry per resource, task and report.
 */
export class TagFile extends ReportBase {
  private tags: TagFileEntry[] = [];
  /** Exposed for tests only — the filtered resource list. */
  private resourceList!: PropertyList<Resource>;
  private taskList!: PropertyList<Task>;

  /**
   * Creates a tag file report.
   *
   * @param report Report definition being rendered.
   */
  constructor(report: Report,) {
    super(report,);
  }

  /** Emits one ctags entry per resource, task and report. */
  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
    this.tags = [];

    const project = this.project as Project;

    // Resources.
    this.resourceList = new PropertyList<Resource>(project.resources,);
    this.resourceList.setSorting(
      (this.a("sortResources",) as Array<[string, boolean, number,]>) ?? [],
    );
    this.resourceList = this.filterResourceList(
      this.resourceList,
      null,
      this.a("hideResource",) as never,
      this.a("rollupResource",) as never,
      this.a("openNodes",) as never,
    );
    for (const resource of this.resourceList.toArray()) {
      const sfi = resource.sourceFileInfo;
      if (!sfi) continue;
      this.tags.push(
        new TagFileEntry(resource.fullId, sfi.fileName, sfi.lineNo, "r",),
      );
    }

    // Tasks.
    this.taskList = new PropertyList<Task>(project.tasks,);
    this.taskList.setSorting(
      (this.a("sortTasks",) as Array<[string, boolean, number,]>) ?? [],
    );
    this.taskList = this.filterTaskList(
      this.taskList,
      null,
      this.a("hideTask",) as never,
      this.a("rollupTask",) as never,
      this.a("openNodes",) as never,
    );
    for (const task of this.taskList.toArray()) {
      const sfi = task.sourceFileInfo;
      if (!sfi) continue;
      this.tags.push(
        new TagFileEntry(task.fullId, sfi.fileName, sfi.lineNo, "t",),
      );
    }

    // Reports.
    for (const report of project.reports.toArray()) {
      const sfi = report.sourceFileInfo;
      if (!sfi) continue;
      this.tags.push(
        new TagFileEntry(report.fullId, sfi.fileName, sfi.lineNo, "p",),
      );
    }
  }

  /** Internal entry list, exposed for tests (order not guaranteed). */
  getEntries(): readonly TagFileEntry[] {
    return this.tags;
  }

  /**
   * Full ctags file string: header plus the entries sorted by tag.
   * @see http://vimdoc.sourceforge.net/htmldoc/tagsrch.html
   */
  to_ctags(): string {
    const s =
      '!_TAG_FILE_FORMAT\t2\t/extended format; --format=1 will not append ;" to lines/\n' +
      "!_TAG_FILE_SORTED\t1\t/0=unsorted, 1=sorted, 2=foldcase/\n" +
      `!_TAG_PROGRAM_AUTHOR\t${AppConfig.authors}\t//\n` +
      `!_TAG_PROGRAM_NAME\t${AppConfig.softwareName}\t//\n` +
      `!_TAG_PROGRAM_URL\t${AppConfig.contact}\t/official site/\n` +
      `!_TAG_PROGRAM_VERSION\t${AppConfig.version}\t//\n`;
    const sorted = [...this.tags,].sort((a, b,) => a.compareTo(b,));
    return s + sorted.map((t,) => t.to_ctags()).join("",);
  }
}

// Registers the `tagfile` content factory (14.11 dispatch).
registerContentFactory(
  "tagfile",
  (report: unknown,): TagFile => new TagFile(report as Report,),
);

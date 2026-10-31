/**
 * TagFile (Fase 14.20.3) — gera um arquivo ctags compatível com vim.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/TagFile.rb`. Coleta
 * resources, tasks e reports que tenham `sourceFileInfo` registrado pelo parser
 * e serializa uma linha ctags por propriedade. A ordenação é por `tag` (o
 * `fullId` da propriedade).
 *
 * ⚠️ Browser (ADR 027): `to_ctags()` retorna a string; nenhuma escrita a
 * disco. O cabeçalho usa os metadados de `AppConfig`.
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

/** kind ctags: `r` recurso, `t` tarefa, `p` relatório. */
export type TagKind = "r" | "t" | "p";

export class TagFileEntry {
  constructor(
    readonly tag: string,
    readonly file: string,
    readonly line: number,
    readonly kind: TagKind,
  ) {}

  /** Comparador por `tag` (equivalente a Ruby `<=>`). */
  compareTo(other: TagFileEntry,): number {
    if (this.tag < other.tag) return -1;
    if (this.tag > other.tag) return 1;
    return 0;
  }

  /** Linha ctags: `tag\tfile\tline;"\tkind\n`. */
  to_ctags(): string {
    return `${this.tag}\t${this.file}\t${this.line};"\t${this.kind}\n`;
  }
}

export class TagFile extends ReportBase {
  private tags: TagFileEntry[] = [];
  /** Exposto apenas para testes — a lista filtrada de recursos. */
  private resourceList!: PropertyList<Resource>;
  private taskList!: PropertyList<Task>;

  constructor(report: Report,) {
    super(report,);
  }

  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
    this.tags = [];

    const project = this.project as Project;

    // Recursos.
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

    // Tarefas.
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

    // Relatórios.
    for (const report of project.reports.toArray()) {
      const sfi = report.sourceFileInfo;
      if (!sfi) continue;
      this.tags.push(
        new TagFileEntry(report.fullId, sfi.fileName, sfi.lineNo, "p",),
      );
    }
  }

  /** Lista interna de entradas, exposta para testes (ordem não garantida). */
  getEntries(): readonly TagFileEntry[] {
    return this.tags;
  }

  /**
   * String completa do arquivo ctags: cabeçalho + entradas ordenadas por tag.
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

// Registra a fábrica de conteúdo `tagfile` (14.11 dispatch).
registerContentFactory(
  "tagfile",
  (report: unknown,): TagFile => new TagFile(report as Report,),
);

/**
 * Testes de TagFile (Fase 14.20.3).
 *
 * Cobre `TagFileEntry` (comparação e `to_ctags`), coleta de resources/tasks/
 * reports com `sourceFileInfo`, exclusão de propriedades sem SFI, ordenação por
 * tag e o cabeçalho ctags. Também valida o registro da fábrica `tagfile`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.20.3)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { SourceFileInfo, } from "../../src/source-file-info.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TagFile, TagFileEntry, } from "../../src/reports/tag-file.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import { contentFactories, } from "../../src/model/report-content.ts";
import { AppConfig, } from "../../src/app-config.ts";

describe("TagFileEntry (14.20.3.2)", () => {
  it('serializa linha ctags com TABs e `;"`', () => {
    const e = new TagFileEntry("alpha", "proj.tjp", 42, "t",);
    assertEquals(e.to_ctags(), 'alpha\tproj.tjp\t42;"\tt\n',);
  });

  it("compareTo ordena por tag", () => {
    const a = new TagFileEntry("a", "f", 1, "r",);
    const b = new TagFileEntry("b", "f", 2, "r",);
    assertEquals(a.compareTo(b,), -1,);
    assertEquals(b.compareTo(a,), 1,);
    assertEquals(a.compareTo(a,), 0,);
  });
});

describe("TagFile (14.20.3)", () => {
  let project: Project;
  let report: Report;

  beforeEach(() => {
    project = createTestProject(1,);
    report = new Report(project, "tags", "tags", null,);
    report.typeSpec = ReportType.TagFile;
    report.set("start", TjTime.fromString("2026-01-01",),);
    report.set("end", TjTime.fromString("2026-12-31",),);
    report.set("scenarios", [0,],);
    report.set("sortTasks", [],);
    report.set("sortResources", [],);
    project.reportContexts.push(new ReportContext(project, report,),);
  },);

  function newTagFile(): TagFile {
    const tf = new TagFile(report,);
    tf.generateIntermediateFormat();
    return tf;
  }

  it("ignora propriedades sem sourceFileInfo (14.20.3.2)", () => {
    new Resource(project, "r1", "R1", null,);
    new Task(project, "t1", "T1", null,);
    const tf = newTagFile();
    assertEquals(tf.getEntries().length, 0,);
  });

  it("coleta resources, tasks e reports com SFI (14.20.3.2/14.20.3.4)", () => {
    const r = new Resource(project, "r1", "R1", null,);
    r.sourceFileInfo = new SourceFileInfo("proj.tjp", 10, 1,);
    const t = new Task(project, "t1", "T1", null,);
    t.sourceFileInfo = new SourceFileInfo("proj.tjp", 20, 1,);
    report.sourceFileInfo = new SourceFileInfo("proj.tjp", 30, 1,);

    const tf = newTagFile();
    const entries = tf.getEntries();
    assertEquals(
      entries.length,
      3,
      "3 entradas: 1 recurso + 1 tarefa + 1 report",
    );
    const kinds = entries.map((e,) => e.kind).sort();
    assertEquals(kinds, ["p", "r", "t",],);
    const r1 = entries.find((e,) => e.tag === "r1")!;
    assertEquals(r1.line, 10,);
    const t1 = entries.find((e,) => e.tag === "t1")!;
    assertEquals(t1.line, 20,);
  });

  it("to_ctags emite cabeçalho e entradas ordenadas por tag (14.20.3.3/14.20.3.5)", () => {
    const r = new Resource(project, "zeta", "Z", null,);
    r.sourceFileInfo = new SourceFileInfo("z.tjp", 5, 1,);
    const t = new Task(project, "alfa", "A", null,);
    t.sourceFileInfo = new SourceFileInfo("z.tjp", 7, 1,);

    const out = newTagFile().to_ctags();
    // Cabeçalho.
    assert(out.includes("!_TAG_FILE_FORMAT\t2\t",),);
    assert(out.includes("!_TAG_FILE_SORTED\t1\t",),);
    assert(out.includes(`!_TAG_PROGRAM_NAME\t${AppConfig.softwareName}\t`,),);
    assert(out.includes(`!_TAG_PROGRAM_VERSION\t${AppConfig.version}\t`,),);
    // Corpo: ordenado por tag.
    const iAlfa = out.indexOf("alfa\t",);
    const iZeta = out.indexOf("zeta\t",);
    assert(iAlfa > 0 && iZeta > 0 && iAlfa < iZeta, "alfa antes de zeta",);
    assert(out.includes(`alfa\tz.tjp\t7;"\tt\n`,),);
    assert(out.includes(`zeta\tz.tjp\t5;"\tr\n`,),);
  });

  it("'tagfile' está registrado na fábrica de conteúdo (14.20.3.6)", () => {
    const factory = contentFactories.get("tagfile",);
    assert(factory, "fábrica tagfile presente",);
    const c = factory!(report,) as unknown as TagFile;
    assert(c instanceof TagFile,);
  });
});

import { type ProjectLike, } from "./project-like.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { ReportScenario, } from "./report-scenario.ts";
import { ReportType, } from "./report-type.ts";

export class Report extends PropertyTreeNode {
  typeSpec: ReportType | null;
  content: unknown;

  constructor(
    project: ProjectLike,
    id: string | null,
    name: string,
    parent: Report | null,
  ) {
    super(project.reports, id, name, parent,);
    project.addReport(this);
    this.typeSpec = null;
    this.content = null;
    this.data = Array.from({ length: project.scenarioCount }, () => null as any);
    for (let i = 0; i < project.scenarioCount; i++) {
      new ReportScenario(this, i, this.getScenarioAttributes(i));
    }
  }

  override scenarioData(scIdx: number): ReportScenario {
    return this.data[scIdx]! as ReportScenario;
  }

  /**
   * Rejeita nomes de arquivo com caracteres inválidos.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Report.rb:checkFileName
   */
  checkFileName(name: string): void {
    const invalid = /[?%*:"<>|]/;
    if (invalid.test(name)) {
      throw new Error(
        `Invalid file name '${name}': contains invalid characters`,
      );
    }
  }

  /**
   * Retorna o caminho absoluto, prependindo outputDir se relativo.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Report.rb:absoluteFileName
   */
  absoluteFileName(name: string): string {
    if (name.startsWith("/")) {
      return name;
    }
    const outputDir = this.project.get("outputDir");
    const dir = (outputDir as string) || "";
    return dir + "/" + name;
  }

  /**
   * Retorna true se o nome já é absoluto.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Report.rb:absoluteFileName?
   */
  absoluteFileNameExists(name: string): boolean {
    return name.startsWith("/");
  }
}
import { type ProjectLike, } from "./project-like.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { ReportScenario, } from "./report-scenario.ts";
import { ReportType, } from "./report-type.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";

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
    // Ruby Report#initialize (l.48-52): checkFileName antes de addReport.
    this.checkFileName(name,);
    project.addReport(this,);
    this.typeSpec = null;
    this.content = null;
    for (let i = 0; i < project.scenarioCount; i++) {
      this.data[i] = new ReportScenario(
        this,
        i,
        this.getScenarioAttributes(i,),
      );
    }
  }

  override scenarioData(scIdx: number,): ReportScenario {
    return this.data[scIdx]! as ReportScenario;
  }

  /**
   * Rejeita nomes de arquivo com caracteres inválidos.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Report.rb:checkFileName
   */
  checkFileName(name: string,): void {
    // Ruby (Report.rb l.455-466): no Linux a regex é /[\\?%*:|"<>]/.
    const illegal = /[\\?%*:|"<>]/;
    if (illegal.test(name,)) {
      // `sourceFileInfo` ainda é nil no construtor → linha null no golden.
      MessageHandlerInstance.instance.error(
        "invalid_file_name",
        "File names may not contain any of the following characters: " +
          '\\?%*:|"<>',
        null,
        null,
        null,
        null,
      );
    }
  }

  /**
   * Retorna o caminho absoluto, prependindo outputDir se relativo.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Report.rb:absoluteFileName
   */
  absoluteFileName(name: string,): string {
    if (name.startsWith("/",)) {
      return name;
    }
    const outputDir = this.project.get("outputDir",);
    const dir = (outputDir as string) || "";
    return dir + "/" + name;
  }

  /**
   * Retorna true se o nome já é absoluto.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Report.rb:absoluteFileName?
   */
  absoluteFileNameExists(name: string,): boolean {
    return name.startsWith("/",);
  }

  /**
   * Gera o relatório (stub para Fase 14).
   */
  generate(_formats?: string[], _scIdx?: number,): void {
    // Fase 14: implementação real
  }
}

/**
 * SimpleQueryExpander — substitui placeholders `<-attributo->` pelo valor
 * da query correspondente (Fase 11.11).
 *
 * Port de `SimpleQueryExpander.rb`. O `<-scenario->` não é um atributo
 * consultável e é tratado à parte. Regex exata: `/<-([a-zA-Z][_a-zA-Z]*)->/g`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/SimpleQueryExpander.rb
 */
import { MessageHandlerInstance, } from "../message-handler.ts";
import type { SourceFileInfo, } from "../source-file-info.ts";
import type { Query, } from "./query.ts";

export class SimpleQueryExpander {
  private inputStr: string;
  private query: Query;
  private sourceFileInfo: SourceFileInfo | null;

  constructor(inputStr: string, query: Query, sfi: SourceFileInfo | null,) {
    this.inputStr = inputStr;
    this.query = query.dup();
    this.sourceFileInfo = sfi;
  }

  expand(): string {
    let str = this.inputStr;
    // O nome do cenário não é um atributo consultável — tratado à parte.
    if (this.query.scenarioIdx !== undefined && this.query.project) {
      const sc = this.query.project.scenario(this.query.scenarioIdx,);
      str = str.replaceAll(/<-scenario->/g, sc ? sc.id : "",);
    }
    str = str.replaceAll(
      /<-([a-zA-Z][_a-zA-Z]*)->/g,
      (match: string,): string => {
        const attribute = match.slice(2, -2,);
        this.query.attributeId = attribute;
        this.query.process();
        if (this.query.ok) {
          return this.query.to_s();
        }
        MessageHandlerInstance.instance.error(
          "sqe_expand_failed",
          `Unknown attribute ${attribute}`,
          this.sourceFileInfo,
        );
        return "";
      },
    );
    return str;
  }
}

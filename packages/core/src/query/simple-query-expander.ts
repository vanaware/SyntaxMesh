/**
 * SimpleQueryExpander — replaces `<-attribute->` placeholders with the value of
 * the matching query (phase 11.11).
 *
 * Port of `SimpleQueryExpander.rb`. `<-scenario->` is not a queryable attribute
 * and is handled separately. Exact pattern: `/<-([a-zA-Z][_a-zA-Z]*)->/g`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/SimpleQueryExpander.rb
 */
import { MessageHandlerInstance, } from "../message-handler.ts";
import type { SourceFileInfo, } from "../source-file-info.ts";
import type { Query, } from "./query.ts";

/**
 * Expands `<-attribute->` placeholders of a text against a query.
 *
 * The instance works on a private copy of the query, so the caller's query is
 * never modified by the expansion.
 */
export class SimpleQueryExpander {
  private inputStr: string;
  private query: Query;
  private sourceFileInfo: SourceFileInfo | null;

  /**
   * Creates an expander for a text.
   *
   * @param inputStr Text containing the placeholders.
   * @param query Query whose values feed the placeholders.
   * @param sfi Source location used to report unknown attributes, or `null`.
   */
  constructor(inputStr: string, query: Query, sfi: SourceFileInfo | null,) {
    this.inputStr = inputStr;
    this.query = query.dup();
    this.sourceFileInfo = sfi;
  }

  /**
   * Substitutes every placeholder and returns the resulting text.
   *
   * Unknown attributes are reported and replaced with an empty string.
   *
   * @returns The expanded text.
   */
  expand(): string {
    let str = this.inputStr;
    // The scenario name is not a queryable attribute — handled separately.
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

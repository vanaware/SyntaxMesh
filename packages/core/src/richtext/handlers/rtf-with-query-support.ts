/**
 * RTFWithQuerySupport — base for function handlers that resolve a `Query`
 * (phase 12.13).
 *
 * Adds to {@link RichTextFunctionHandler} a `query` field (the model filled by
 * the `ReportContext`) and a `setQuery` setter that **duplicates** the received
 * query — the handler modifies it during `prepareQuery`, so it must not
 * contaminate the original instance. `RichTextIntermediate.setQuery` propagates
 * the query to the handlers exposing this method.
 *
 * Faithful port of `RichText/RTFWithQuerySupport.rb:19-33`. The base `dup()`
 * (shallow copy) preserves `query` automatically.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFWithQuerySupport.rb
 * @see ADR 025 (RichText and function handlers)
 */

import { RichTextFunctionHandler, } from "./function-handler.ts";
import type { SourceFileInfo, } from "../../source-file-info.ts";
import type { Query, } from "../../query/query.ts";

export abstract class RTFWithQuerySupport extends RichTextFunctionHandler {
  /** Template query registered by the context; `null` until `setQuery`. */
  protected query: Query | null = null;

  constructor(
    type: string,
    sourceFileInfo: SourceFileInfo | null = null,
  ) {
    super(type, sourceFileInfo,);
    this.query = null;
  }

  /**
   * Registers the `Query` used to resolve the lookups. Duplicates the object,
   * since it will be modified (RTFWithQuerySupport.rb:29-31).
   */
  setQuery(query: Query,): void {
    this.query = query.dup();
  }
}

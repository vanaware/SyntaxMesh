/**
 * Custom function extension `[[name:args]]` (phase 13.6).
 *
 * Markdown has no `[[…]]` as a function (in RichText, `[[…]]` is an internal
 * reference). Here it is the going-forward syntax for the phase 12 functions
 * (`query`, `report`, `reportlink`, `navigator`). The converted payload is the
 * same `data` of `inlinefunc`/`blockfunc`: `[name, args]`.
 *
 * Args convention (13.6.4): `key=value`, `key="value with spaces"` and
 * positionals. Positionals get keys `_1`, `_2`, …; in the `query` function an
 * isolated positional is sugar for `attribute` (same semantics as
 * `<-effort->`, 13.7).
 *
 * @see ADR 026 (Markdown as the going-forward format)
 * @see packages/core/src/richtext/rich-text-syntax-rules.ts (`blockFunction`,
 *      `inlineFunction`, `functionArguments`)
 */

import type { Extraction, MdastNode, } from "../types.ts";
import { placeholderFor, walkAndExpand, } from "./placeholders.ts";

/** Extraction of a `[[name:args]]` (13.6.2). */
export interface FunctionExtraction {
  placeholder: string;
  name: string;
  args: Record<string, string>;
  /** Original text (`[[query:attribute=effort]]`). */
  source: string;
}

/** `[[name:arguments]]` (13.6.3). */
const FUNCTION_RE = /\[\[([a-z]+):([^\]]+)\]\]/g;

/** `key="value"`, `key=value` or positional token (13.6.4). */
const ARG_RE = /([a-zA-Z_][\w-]*)="([^"]*)"|([a-zA-Z_][\w-]*)=(\S+)|(\S+)/g;

/**
 * Parses the argument string of a function.
 *
 * ```ts
 * parseFunctionArgs("query", 'attribute="effort total" start=2024-01-01');
 * // { attribute: "effort total", start: "2024-01-01" }
 * ```
 */
export function parseFunctionArgs(
  name: string,
  raw: string,
): Record<string, string> {
  const args: Record<string, string> = {};
  const positional: string[] = [];
  for (const match of raw.matchAll(ARG_RE,)) {
    if (match[1] !== undefined) args[match[1]] = match[2] ?? "";
    else if (match[3] !== undefined) args[match[3]] = match[4] ?? "";
    else if (match[5] !== undefined) positional.push(match[5],);
  }
  if (name === "query" && positional.length === 1 && !args["attribute"]) {
    // `<-effort->` ≡ `[[query:attribute=effort]]` (13.7).
    args["attribute"] = positional[0]!;
  } else {
    positional.forEach((value, i,) => {
      args[`_${i + 1}`] = value;
    },);
  }
  return args;
}

/** Replaces `[[func:…]]` with `§FUNC_n§` (13.6.3, 13.6.7). */
export function preprocessFunctions(
  text: string,
  startIndex = 0,
): { text: string; extractions: FunctionExtraction[] } {
  const extractions: FunctionExtraction[] = [];
  let index = startIndex;
  const out = text.replace(
    FUNCTION_RE,
    (match, name: string, rawArgs: string,) => {
      const placeholder = placeholderFor("FUNC", index++,);
      extractions.push({
        placeholder,
        name,
        args: parseFunctionArgs(name, rawArgs,),
        source: match,
      },);
      return placeholder;
    },
  );
  return { text: out, extractions, };
}

/** Converts to the pipeline's generic `Extraction`. */
export function functionToExtraction(e: FunctionExtraction,): Extraction {
  return {
    placeholder: e.placeholder,
    category: "inlinefunc",
    payload: [e.name, e.args,],
    source: e.source,
  };
}

/**
 * Replaces the function placeholders with `richtextExtension` nodes (13.6.8).
 *
 * `[[report:…]]`/`[[navigator:…]]` alone in a paragraph become `blockfunc`;
 * an unknown function falls back to raw text (13.6.10).
 */
export function postprocessFunctions(
  node: MdastNode,
  extractions: FunctionExtraction[],
  options: {
    isKnownFunction?: (name: string,) => boolean;
    isBlockFunction?: (name: string,) => boolean;
  } = {},
): MdastNode {
  return walkAndExpand(
    node,
    extractions.map(functionToExtraction,),
    options,
  );
}

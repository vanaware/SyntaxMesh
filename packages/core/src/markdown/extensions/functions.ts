/**
 * Extensão de funções customizadas `[[name:args]]` (Fase 13.6).
 *
 * Markdown não tem `[[…]]` como função (no RichText, `[[…]]` é referência
 * interna). Aqui é a sintaxe going-forward para as funções da Fase 12
 * (`query`, `report`, `reportlink`, `navigator`). O payload convertido é o
 * mesmo `data` de `inlinefunc`/`blockfunc`: `[nome, args]`.
 *
 * Convenção de args (13.6.4): `chave=valor`, `chave="valor com espaço"` e
 * posicionais. Posicionais ganham chaves `_1`, `_2`, …; na função `query` um
 * posicional isolado é açucar para `attribute` (mesma semântica de
 * `<-effort->`, 13.7).
 *
 * @see ADR 026 (Markdown como formato going-forward)
 * @see packages/core/src/richtext/rich-text-syntax-rules.ts (`blockFunction`,
 *      `inlineFunction`, `functionArguments`)
 */

import type { Extraction, MdastNode, } from "../types.ts";
import { placeholderFor, walkAndExpand, } from "./placeholders.ts";

/** Extração de um `[[name:args]]` (13.6.2). */
export interface FunctionExtraction {
  placeholder: string;
  name: string;
  args: Record<string, string>;
  /** Texto original (`[[query:attribute=effort]]`). */
  source: string;
}

/** `[[nome:argumentos]]` (13.6.3). */
const FUNCTION_RE = /\[\[([a-z]+):([^\]]+)\]\]/g;

/** `chave="valor"`, `chave=valor` ou token posicional (13.6.4). */
const ARG_RE = /([a-zA-Z_][\w-]*)="([^"]*)"|([a-zA-Z_][\w-]*)=(\S+)|(\S+)/g;

/**
 * Parseia a string de argumentos de uma função.
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

/** Troca `[[func:…]]` por `§FUNC_n§` (13.6.3, 13.6.7). */
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

/** Converte para o `Extraction` genérico do pipeline. */
export function functionToExtraction(e: FunctionExtraction,): Extraction {
  return {
    placeholder: e.placeholder,
    category: "inlinefunc",
    payload: [e.name, e.args,],
    source: e.source,
  };
}

/**
 * Substitui os placeholders de função por nós `richtextExtension` (13.6.8).
 *
 * `[[report:…]]`/`[[navigator:…]]` sozinhos num parágrafo viram `blockfunc`;
 * função desconhecida volta como texto cru (13.6.10).
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

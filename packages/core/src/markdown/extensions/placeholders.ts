/**
 * Placeholders das extensões Markdown (Fase 13.4–13.8).
 *
 * As extensões (`<fcol:…>`, `[[func:…]]`, `<-nome->`) são arrancadas do texto
 * antes do parse `mdast` e voltam como nós sintéticos `richtextExtension`
 * depois. Este módulo centraliza a mecânica (divisão de texto, construção do
 * nó, expansão recursiva de conteúdo) para que cada extensão só descreva sua
 * regex e seu payload.
 *
 * @see ADR 026 (Markdown como formato going-forward)
 * @see docs/syntaxmesh/fases/fase-13-markdown.md §4.2
 */

import type { PhrasingContent, } from "mdast";
import { parseMdastInline, } from "../parse-mdast.ts";
import type { Extraction, MdastExtension, MdastNode, } from "../types.ts";

/** Divisor dos placeholders (`§COLOR_0§`). Deliberamente raro em Markdown. */
export const PLACEHOLDER_DELIM = "§";

/** Constrói o placeholder de um tipo de extensão (`COLOR`, `FUNC`, `MINIQ`). */
export function placeholderFor(kind: string, index: number,): string {
  return `${PLACEHOLDER_DELIM}${kind}_${index}${PLACEHOLDER_DELIM}`;
}

/** Um `Extraction` endereçável por placeholder. */
export interface ExtensionResolver {
  /** Busca a extração do placeholder (ou `undefined` se não é extensão). */
  lookup(placeholder: string,): Extraction | undefined;
  /**
   * Funções reconhecidas pelos handlers da Fase 12. Quando ausente, todas são
   * aceitas; quando presente, função desconhecida volta como texto cru.
   */
  isKnownFunction?(name: string,): boolean;
  /** Funções que viram `blockfunc` quando sozinhas num parágrafo. */
  isBlockFunction?(name: string,): boolean;
}

/** Resolver backed por uma coleção de extrações (usado em testes e no pipeline). */
export function mapResolver(
  extractions: Iterable<Extraction>,
  options: {
    isKnownFunction?: (name: string,) => boolean;
    isBlockFunction?: (name: string,) => boolean;
  } = {},
): ExtensionResolver {
  const map = new Map<string, Extraction>();
  for (const e of extractions) map.set(e.placeholder, e,);
  return {
    lookup: (p: string,) => map.get(p,),
    isKnownFunction: options.isKnownFunction,
    isBlockFunction: options.isBlockFunction,
  };
}

/** Fatia do texto resultante da divisão por placeholders. */
export type TextSlice =
  | { kind: "text"; value: string }
  | { kind: "extension"; extraction: Extraction };

/** Divide `value` nas ocorrências dos placeholders registrados no resolver. */
export function splitPlaceholders(
  value: string,
  resolver: ExtensionResolver,
): TextSlice[] {
  const slices: TextSlice[] = [];
  let rest = value;
  while (true) {
    let best: { index: number; length: number; extraction: Extraction } | null =
      null;
    // Procuramos o placeholder mais à esquerda entre todos os registrados.
    for (const candidate of knownPlaceholders(rest, resolver,)) {
      const e = resolver.lookup(candidate,);
      if (!e) continue;
      const index = rest.indexOf(candidate,);
      if (index < 0) continue;
      if (!best || index < best.index) {
        best = { index, length: candidate.length, extraction: e, };
      }
    }
    if (!best) {
      if (rest !== "") slices.push({ kind: "text", value: rest, },);
      return slices;
    }
    if (best.index > 0) {
      slices.push({ kind: "text", value: rest.slice(0, best.index,), },);
    }
    slices.push({ kind: "extension", extraction: best.extraction, },);
    rest = rest.slice(best.index + best.length,);
  }
}

/** Placeholders (prefixo `§`) que aparecem em `text`. */
function knownPlaceholders(
  text: string,
  resolver: ExtensionResolver,
): string[] {
  const found = text.match(/§[A-Z]+_\d+§/g,);
  if (!found) return [];
  return found.filter((p,) => resolver.lookup(p,) !== undefined);
}

/** Payload `[nome, args]` de uma função. */
function funcPayload(e: Extraction,): [string, Record<string, string>,] | null {
  return Array.isArray(e.payload,)
    ? e.payload as [string, Record<string, string>,]
    : null;
}

/** Constrói o nó sintético de uma extração (com conteúdo recursivo em `fontCol`). */
export function buildExtensionNode(
  e: Extraction,
  resolver: ExtensionResolver,
): MdastExtension | PhrasingContent {
  const func = funcPayload(e,);
  if (func && resolver.isKnownFunction && !resolver.isKnownFunction(func[0],)) {
    // Função desconhecida → texto cru, sem markup e sem exceção em `to_s`.
    return { type: "text", value: e.source, };
  }
  const children: PhrasingContent[] = e.content !== undefined
    ? expandInline(e.content, resolver,)
    : [];
  return {
    type: "richtextExtension",
    category: e.category,
    payload: e.payload,
    children,
  };
}

/** Parseia conteúdo inline de extensão e expande placeholders aninhados. */
export function expandInline(
  content: string,
  resolver: ExtensionResolver,
): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  for (const node of parseMdastInline(content,)) {
    out.push(...expandNodeInline(node, resolver,),);
  }
  return out;
}

/** Expande placeholders dentro de um nó inline (text → 0..n nós). */
function expandNodeInline(
  node: PhrasingContent,
  resolver: ExtensionResolver,
): PhrasingContent[] {
  if (node.type !== "text") return [node,];
  const value = (node as { value: string }).value;
  const slices = splitPlaceholders(value, resolver,);
  if (slices.length === 1 && slices[0]!.kind === "text") return [node,];
  return slicesToPhrasing(slices, resolver,);
}

/** Converte as fatias em nós `mdast` inline. */
function slicesToPhrasing(
  slices: TextSlice[],
  resolver: ExtensionResolver,
): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  for (const slice of slices) {
    if (slice.kind === "text") {
      out.push({ type: "text", value: slice.value, },);
    } else {
      out.push(
        buildExtensionNode(slice.extraction, resolver,) as PhrasingContent,
      );
    }
  }
  return out;
}

/** Nós com `children` inline que precisamos percorrer. */
interface HasChildren {
  children: PhrasingContent[];
}

function hasInlineChildren(node: unknown,): node is HasChildren {
  return typeof node === "object" && node !== null &&
    Array.isArray((node as HasChildren).children,);
}

/**
 * Percorre `node` (mutando os arrays de filhos) expandindo placeholders e
 * promovendo funções de bloco solitárias a `blockfunc` (13.6.8).
 *
 * Retorna o próprio nó, como pedem os `postprocess*` das extensões (13.4.5,
 * 13.6.8, 13.7.4).
 */
export function walkAndExpand(
  node: MdastNode,
  extractions: Iterable<Extraction>,
  options: {
    isKnownFunction?: (name: string,) => boolean;
    isBlockFunction?: (name: string,) => boolean;
  } = {},
): MdastNode {
  expandChildren(
    node as unknown as HasChildren,
    mapResolver(extractions, options,),
  );
  return node;
}

function expandChildren(
  parent: HasChildren,
  resolver: ExtensionResolver,
): void {
  const out: PhrasingContent[] = [];
  for (const child of parent.children) {
    if (hasInlineChildren(child,) && child.type !== "richtextExtension") {
      expandChildren(child, resolver,);
    }
    if (child.type === "text") {
      out.push(...expandNodeInline(child, resolver,),);
    } else {
      out.push(child,);
    }
  }
  parent.children = out;
  promoteLoneBlockFunction(parent, resolver,);
}

/** Parágrafo com uma única função de bloco vira `blockfunc`. */
function promoteLoneBlockFunction(
  parent: HasChildren,
  resolver: ExtensionResolver,
): void {
  if (parent.children.length !== 1) return;
  const only = parent.children[0] as unknown as Partial<MdastExtension>;
  if (only.type !== "richtextExtension" || only.category !== "inlinefunc") {
    return;
  }
  const name = Array.isArray(only.payload,) ? only.payload[0] : "";
  if (resolver.isBlockFunction?.(name,)) {
    (only as MdastExtension).category = "blockfunc";
  }
}

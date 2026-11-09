/**
 * `images.ts` — referências de imagem em relatórios (Fase 24 — 24.10.8).
 *
 * O core decide **se** uma referência é externa ou relativa e devolve um
 * descritor (`resolveImageRef`, 13.14.3); materializar o arquivo é da CLI.
 * Este módulo só extrai as referências relativas — sem disco, sem rede — para
 * que a política de saída copie a imagem para ao lado do relatório,
 * preservando o caminho relativo que o HTML/Markdown já cita (o browser
 * resolve o resto, como no `tj3`).
 *
 * Referências externas (`http(s)://`, `//`, `data:`) passam intactas: não há
 * arquivo para copiar. Caminhos absolutos e com segmento `..` são ignorados —
 * a política nunca lê fora da raiz de imagens (adendo §4.3).
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown-tarefas.md (13.14.3)
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.10.8)
 */
import { isExternalImageRef, } from "@vanaware/syntaxmesh";

/** Raiz de sistema (POSIX ou letra de unidade do Windows). */
const ABSOLUTE_REF = /^(?:[\\/]|[A-Za-z]:[\\/])/u;

/** `![alt](ref "title")` — o grupo 2 é o caminho. */
const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/gu;

/** `<img … src="ref" …>` (aspas duplas ou simples). */
const HTML_IMAGE = /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/giu;

/**
 * `<object … data="ref" type="image/…" …>` — como o `RichTextIntermediate`
 * emite imagem no HTML do `tj3` (`Element.rb:551-570`). Só tags cujo `type` é
 * `image/…` entram: `<object>` também serve para outros mídias no HTML.
 */
const HTML_OBJECT =
  /<object\b[^>]*?\bdata\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>/giu;
const OBJECT_TYPE = /\btype\s*=\s*(?:"|')(image\/[^"']*)/iu;

/**
 * Caminhos relativos de imagem citados por um relatório.
 *
 * Aceita os formatos que carregam mídia (`markdown`, `html`); qualquer outro
 * devolve lista vazia. Duplicatas aparecem uma vez só, na ordem de citação.
 */
export function imageRefs(content: string, format: string,): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string | undefined,): void => {
    if (raw === undefined || raw === "") return;
    // `./fotos/a.jpg` e `fotos/a.jpg` são o mesmo arquivo: normaliza para que
    // o destino (ao lado do relatório) não ganhe um `./` no meio do caminho.
    const ref = raw.replace(/^\.\//u, "",);
    if (isExternalImageRef(ref,)) return;
    // `..` conta como **segmento**: `fotos/a..b.jpg` é nome válido.
    if (ABSOLUTE_REF.test(ref,) || ref.split("/",).includes("..",)) return;
    if (seen.has(ref,)) return;
    seen.add(ref,);
    refs.push(ref,);
  };

  if (format === "markdown") {
    for (const match of content.matchAll(MARKDOWN_IMAGE,)) push(match[2],);
  } else if (format === "html") {
    for (const match of content.matchAll(HTML_IMAGE,)) {
      push(match[1] ?? match[2],);
    }
    for (const match of content.matchAll(HTML_OBJECT,)) {
      if (!OBJECT_TYPE.test(match[0],)) continue;
      push(match[1] ?? match[2],);
    }
  }
  return refs;
}

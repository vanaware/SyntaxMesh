/**
 * `images.ts` — image references in reports (phase 24 — 24.10.8).
 *
 * The core decides **whether** a reference is external or relative and returns a
 * descriptor (`resolveImageRef`, 13.14.3); materialising the file is the CLI's
 * job. This module only extracts the relative references — no disk, no network —
 * so the output policy can copy the image next to the report, preserving the
 * relative path the HTML/Markdown already cites (the browser resolves the rest,
 * as in `tj3`).
 *
 * External references (`http(s)://`, `//`, `data:`) pass through untouched: there
 * is no file to copy. Absolute paths and paths with a `..` segment are ignored —
 * the policy never reads outside the image root (addendum §4.3).
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown-tarefas.md (13.14.3)
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.10.8)
 */
import { isExternalImageRef, } from "@vanaware/syntaxmesh";

/** File-system root (POSIX or a Windows drive letter). */
const ABSOLUTE_REF = /^(?:[\\/]|[A-Za-z]:[\\/])/u;

/** `![alt](ref "title")` — group 2 is the path. */
const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/gu;

/** `<img … src="ref" …>` (double or single quotes). */
const HTML_IMAGE = /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/giu;

/**
 * `<object … data="ref" type="image/…" …>` — the way `RichTextIntermediate`
 * emits an image in `tj3`'s HTML (`Element.rb:551-570`). Only tags whose `type` is
 * `image/…` qualify: `<object>` is also used for other media in HTML.
 */
const HTML_OBJECT =
  /<object\b[^>]*?\bdata\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>/giu;
const OBJECT_TYPE = /\btype\s*=\s*(?:"|')(image\/[^"']*)/iu;

/**
 * Relative image paths cited by a report.
 *
 * Accepts the formats that carry media (`markdown`, `html`); any other returns an
 * empty list. Duplicates appear only once, in citation order.
 */
export function imageRefs(content: string, format: string,): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string | undefined,): void => {
    if (raw === undefined || raw === "") return;
    // `./fotos/a.jpg` and `fotos/a.jpg` are the same file: normalise so the
    // destination (next to the report) does not gain a `./` mid-path.
    const ref = raw.replace(/^\.\//u, "",);
    if (isExternalImageRef(ref,)) return;
    // `..` counts as a **segment**: `fotos/a..b.jpg` is a valid name.
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

/**
 * Image gallery of the reports (SyntaxMesh extension — 14C.0.9).
 *
 * HTML string from a `Picture[]`, with the `maxpictures` cut applied **to the
 * output only** (the input is never mutated). Used by RdoReport (14C.3.6) and
 * by the journal columns with photos.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.0.9)
 */
import type { Picture, PictureHtmlOptions, } from "../model/picture.ts";
import { Picture as PictureClass, } from "../model/picture.ts";

/**
 * Renders `pictures` as `<div class="tj_gallery">…</div>`.
 *
 * @param pictures   Source list (never changed).
 * @param maxPictures Limit of the OUTPUT (`undefined`/`null` = unlimited).
 * @param options    Forwarded to `Picture#to_html` (14C.0.8).
 */
export function picturesToHtml(
  pictures: readonly Picture[],
  maxPictures?: number | null,
  options: PictureHtmlOptions = {},
): string {
  let list: readonly Picture[] = pictures;
  if (maxPictures !== undefined && maxPictures !== null && maxPictures >= 0) {
    list = pictures.slice(0, maxPictures,);
  }
  if (list.length === 0) return "";
  const inner = list.map((p,) => p.to_html(options,).toHTML()).join("\n",);
  return `<div class="tj_gallery">\n${inner}\n</div>`;
}

/** Markdown image regex: `![alt](path)` (14C.3.7). */
const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

/** RichText/MediaWiki image regex: `[[Image:path|...]]` (14C.3.7). */
const RICHTEXT_IMAGE = /\[\[(?:Image|File):([^\]|]+)([^\]]*)\]\]/gi;

/**
 * Extracts the images embedded in the `details` body of a journal entry
 * (SyntaxMesh extension — 14C.3.7).
 *
 * Both formats are accepted: Markdown (`![alt](path)`, including the `img` node
 * serialization of RichText) and RichText/MediaWiki (`[[Image:path|alt|...]]`).
 * The images come back in declaration order, without deduplication —
 * deduplicating against `entry.pictures` is the job of the report.
 */
export function picturesFromDetails(
  details: string | null | undefined,
): Picture[] {
  if (!details) return [];
  const out: Picture[] = [];
  for (const match of details.matchAll(MARKDOWN_IMAGE,)) {
    const [alt, path,] = [match[1] ?? "", match[2] ?? "",];
    if (path === "") continue;
    out.push(makePicture(path, alt,),);
  }
  for (const match of details.matchAll(RICHTEXT_IMAGE,)) {
    const path = (match[1] ?? "").trim();
    if (path === "") continue;
    // `match[2]` starts at the separator `|`: drops the leading empty fields.
    const fields = (match[2] ?? "").split("|",).map((s,) => s.trim()).filter(
      (s,) => s !== "",
    );
    out.push(makePicture(path, fields[0] ?? "",),);
  }
  return out;
}

/** Picture from path + alt (empty caption). */
function makePicture(path: string, alt: string,): Picture {
  const picture = new PictureClass(path,);
  if (alt !== "") picture.alt = alt;
  return picture;
}

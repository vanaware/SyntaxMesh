/**
 * Galeria de imagens dos relatórios (extensão SyntaxMesh — 14C.0.9).
 *
 * String HTML a partir de `Picture[]`, com corte por `maxpictures` aplicado
 * **somente à saída** (a entrada nunca é mutada). Usada pelo RdoReport
 * (14C.3.6) e pelas colunas de journal com fotos.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.0.9)
 */
import type { Picture, PictureHtmlOptions, } from "../model/picture.ts";
import { Picture as PictureClass, } from "../model/picture.ts";

/**
 * Renderiza `pictures` como `<div class="tj_gallery">…</div>`.
 *
 * @param pictures   Lista de origem (nunca alterada).
 * @param maxPictures Limite da SAÍDA (`undefined`/`null` = ilimitado).
 * @param options    Encaminhado a `Picture#to_html` (14C.0.8).
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

/** Regex de imagem Markdown: `![alt](caminho)` (14C.3.7). */
const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

/** Regex de imagem RichText/MediaWiki: `[[Image:path|...]]` (14C.3.7). */
const RICHTEXT_IMAGE = /\[\[(?:Image|File):([^\]|]+)([^\]]*)\]\]/gi;

/**
 * Extrai as imagens embutidas no corpo `details` de uma entrada de diário
 * (extensão SyntaxMesh — 14C.3.7).
 *
 * Ambos os formatos são aceitos: Markdown (`![alt](path)`, incluindo a
 * serialização de nós `img` do RichText) e RichText/MediaWiki
 * (`[[Image:path|alt|...]]`). As imagens voltam na ordem de declaração, sem
 * deduplicação — a deduplicação com `entry.pictures` é do relatório.
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
    // `match[2]` começa no `|` separador: descarta os campos vazios iniciais.
    const fields = (match[2] ?? "").split("|",).map((s,) => s.trim()).filter(
      (s,) => s !== "",
    );
    out.push(makePicture(path, fields[0] ?? "",),);
  }
  return out;
}

/** Picture a partir de caminho + alt (caption vazio). */
function makePicture(path: string, alt: string,): Picture {
  const picture = new PictureClass(path,);
  if (alt !== "") picture.alt = alt;
  return picture;
}

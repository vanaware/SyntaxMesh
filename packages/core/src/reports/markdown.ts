/**
 * Markdown output of the reports (phase 14 — addendum §10 / block 14C.8).
 *
 * The addendum asks for **pure** markdown (text, tables, links, images) before
 * any embedded HTML element. That is why the tables come out as GFM pipe
 * tables and the cells never carry report markup: the value comes from the
 * intermediate format (`ReportTable#to_csv`) and is escaped.
 *
 * SyntaxMesh extension without a Ruby oracle: TaskJuggler only knows HTML,
 * CSV, TJP, iCal, niku and mspxml.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §10
 */

/** A table cell as markdown text (escaped for the pipe line). */
export function markdownCell(value: unknown,): string {
  if (value === null || value === undefined) return "";
  let text = String(value,);
  if (text === "") return "";
  const multiLine = /[\r\n]/u.test(text,);
  // `|` closes the column and `\` would escape the escaped pipe — both go out.
  text = text.replace(/\\/gu, "\\\\",).replace(/\|/gu, "\\|",);
  if (multiLine) {
    text = text.replace(/\r\n?/gu, "\n",).replace(/\n/gu, "<br>",);
  }
  return text;
}

/**
 * Text of a cell/block of the intermediate format as markdown. RichText blocks
 * are serialized by the tree (12.x/13.x); strings pass through untouched.
 */
export function markdownText(value: unknown,): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  const maybe = value as { to_markdown?: () => string };
  if (typeof maybe.to_markdown === "function") {
    return maybe.to_markdown().trim();
  }
  return String(value,).trim();
}

/**
 * Alignment of a column: numeric values to the right (`---:`), text to the left
 * (`---`). A column with no value at all stays neutral.
 */
function markdownAlignment(rows: unknown[][], index: number,): string {
  let numeric = false;
  for (const row of rows) {
    const value = row[index];
    if (value === null || value === undefined || value === "") continue;
    if (typeof value !== "number") return "---";
    numeric = true;
  }
  return numeric ? "---:" : "---";
}

/** Table width: the maximum between the header and the rows. */
function tableWidth(headers: string[], rows: unknown[][],): number {
  let width = headers.length;
  for (const row of rows) {
    if (row.length > width) width = row.length;
  }
  return width;
}

function padRow(
  cells: readonly unknown[],
  width: number,
  render: (value: unknown,) => string,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < width; i++) out.push(render(cells[i],),);
  return out;
}

function pipeLine(cells: string[],): string {
  return `| ${cells.join(" | ",)} |`;
}

/**
 * GFM table. `headers` comes from the `ReportTable` columns; `rows` is the
 * `to_csv` grid (one row per `ReportTableLine`). Rows shorter than the header
 * are padded with empty cells.
 */
export function markdownTable(headers: string[], rows: unknown[][],): string {
  if (headers.length === 0 && rows.length === 0) return "";
  const width = tableWidth(headers, rows,);
  if (width === 0) return "";
  const head = padRow(headers, width, (value,) => markdownCell(value,),);
  const separator: string[] = [];
  for (let i = 0; i < width; i++) {
    separator.push(markdownAlignment(rows, i,),);
  }
  const lines = [pipeLine(head,), pipeLine(separator,),];
  for (const row of rows) {
    lines.push(
      pipeLine(padRow(row, width, (value,) => markdownCell(value,),),),
    );
  }
  return lines.join("\n",);
}

/** Sections of a markdown document: separated by a blank line. */
export function markdownSections(
  sections: (string | null | undefined)[],
): string {
  const parts: string[] = [];
  for (const section of sections) {
    if (section === null || section === undefined) continue;
    const text = section.replace(/\s+$/u, "",).replace(/^\s*\n/u, "",);
    if (text === "") continue;
    parts.push(text,);
  }
  if (parts.length === 0) return "";
  return parts.join("\n\n",) + "\n";
}

/** Document heading (`# title`). */
export function markdownHeading(level: number, text: string,): string {
  const title = text.replace(/\s+/gu, " ",).trim();
  if (title === "") return "";
  const clamped = Math.min(Math.max(level, 1,), 6,);
  return `${"#".repeat(clamped,)} ${title}\n`;
}

/** Markdown image; `caption` becomes the `title` of the link. */
export function markdownImage(
  path: string,
  alt: string | null = null,
  caption: string | null = null,
): string {
  const target = path.replace(/\s/gu, "%20",);
  const altText = (alt ?? "").replace(/[[\]]/gu, "",);
  const title = caption?.trim() ?? "";
  return title === ""
    ? `![${altText}](${target})`
    : `![${altText}](${target} "${title.replace(/"/gu, "'",)}")`;
}

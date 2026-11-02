/**
 * Saída Markdown dos relatórios (Fase 14 — adendo §10 / bloco 14C.8).
 *
 * O pedido do adendo é markdown **puro** (texto, tabelas, links, imagens)
 * antes de qualquer elemento HTML embutido. Por isso as tabelas saem como
 * tabelas de pipes GFM e as células nunca carregam marcação do relatório: o
 * valor vem do formato intermediário (`ReportTable#to_csv`) e é escapado.
 *
 * Extensão SyntaxMesh sem oracle Ruby: o TaskJuggler só conhece HTML, CSV,
 * TJP, iCal, niku e mspxml.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §10
 */

/** Uma célula de tabela como texto markdown (escapado para a linha de pipes). */
export function markdownCell(value: unknown,): string {
  if (value === null || value === undefined) return "";
  let text = String(value,);
  if (text === "") return "";
  const multiLine = /[\r\n]/u.test(text,);
  // `|` fecha a coluna e `\` escaparia o pipe escapado — ambos precisam sair.
  text = text.replace(/\\/gu, "\\\\",).replace(/\|/gu, "\\|",);
  if (multiLine) {
    text = text.replace(/\r\n?/gu, "\n",).replace(/\n/gu, "<br>",);
  }
  return text;
}

/**
 * Texto de uma célula/bloco do formato intermediário como markdown. Blocos
 * RichText são serializados pela árvore (12.x/13.x); strings passam intactas.
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
 * Alinhamento de uma coluna: valores numéricos à direita (`---:`), texto à
 * esquerda (`---`). Coluna sem valor nenhum fica neutra.
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

/** Largura da tabela: máximo entre cabeçalho e linhas. */
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
 * Tabela GFM. `headers` vem das colunas do `ReportTable`; `rows` é a grade do
 * `to_csv` (uma linha por `ReportTableLine`). Linhas mais curtas que o
 * cabeçalho são completadas com células vazias.
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

/** Seções de um documento markdown: separadas por uma linha em branco. */
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

/** Cabeçalho de documento (`# título`). */
export function markdownHeading(level: number, text: string,): string {
  const title = text.replace(/\s+/gu, " ",).trim();
  if (title === "") return "";
  const clamped = Math.min(Math.max(level, 1,), 6,);
  return `${"#".repeat(clamped,)} ${title}\n`;
}

/** Imagem markdown; `caption` vira o `title` do link. */
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

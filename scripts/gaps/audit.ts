/**
 * gaps/audit — varre `completude-matrix.md` e falha se algum gap está
 * `pendente` (Fase 11-Gaps, 11.G.A.4.4 / 11.G.G.3.2).
 *
 * Status válidos: `fechado`, `verificado`, `verificado (entregue por 12.18)`,
 * `ancorado`, `sweep concluído`. Qualquer linha cujo status contenha
 * `pendente` ou esteja vazia faz o script falhar com exit != 0.
 */
import { resolve, } from "@std/path";

const MATRIX = resolve(
  import.meta.dirname!,
  "..",
  "..",
  "docs/syntaxmesh/fases/completude-matrix.md",
);

const OK_STATUS = /^(fechado|verificado|ancorado|sweep concluído)/i;

const text = Deno.readTextFileSync(MATRIX,);
// Parse das linhas de tabela Markdown: `| G<n> | … | status | …`
const rows = text.split("\n",).filter((l,) => /^\|\s*\*?\*?G\d+/.test(l,));

if (rows.length === 0) {
  console.error("gaps:audit FALHOU — nenhuma linha G<n> na matriz.",);
  Deno.exit(1,);
}

interface RowStatus {
  id: string;
  status: string;
}

const parsed: RowStatus[] = rows.map((row,) => {
  const cols = row.split("|",).map((c,) => c.trim()).filter((c,) => c !== "");
  const idCell = cols[0]!.replace(/\*\*/g, "",);
  const idMatch = idCell.match(/^G(\d+)/,);
  const id = idMatch ? `G${idMatch[1]}` : idCell;
  // Última coluna é considerada status; se houver `Commit` e `Teste`, usamos
  // coluna 5 (índice 4) como status — ver matriz para layout.
  const status = cols[4] ?? cols[cols.length - 1] ?? "";
  return { id, status, };
},);

const pending = parsed.filter((r,) => !OK_STATUS.test(r.status,));

if (pending.length === 0) {
  console.log(
    `gaps:audit OK — ${parsed.length} gaps, todos fechados/verificados/ancorados.`,
  );
} else {
  console.error(
    `gaps:audit FALHOU — ${pending.length} gap(s) ainda pendentes:`,
  );
  for (const p of pending) {
    console.error(`  ${p.id}: status="${p.status}"`,);
  }
  Deno.exit(1,);
}

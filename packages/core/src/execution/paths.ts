/**
 * Normalização de caminhos da fronteira de execução (Fase 24 — ADR 034).
 *
 * Puro: não consulta o filesystem. O `include` do TJP é resolvido pelo scanner
 * concatenando `dirname(arquivo-pai) + "/" + nome`, o que produz formas como
 * `./a/b.tji` ou `a/../b.tji`; o *lookup* contra a lista de arquivos do request
 * precisa da forma canônica (`a/b.tji`).
 */

/**
 * Canoniza um caminho posix relativo ou absoluto, sem tocar no disco.
 *
 * - remove `.` e segmentos vazios (barras duplicadas, barra final);
 * - resolve `..` textualmente (mantém `..` à esquerda em caminho relativo);
 * - preserva a raiz `/` de caminhos absolutos;
 * - `""` e `"."` normalizam para `"."`.
 */
export function normalizeInputPath(path: string,): string {
  const absolute = path.startsWith("/",);
  const parts: string[] = [];
  for (const part of path.split("/",)) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      const last = parts[parts.length - 1];
      if (last !== undefined && last !== "..") {
        parts.pop();
      } else if (!absolute) {
        parts.push("..",);
      }
      continue;
    }
    parts.push(part,);
  }
  const joined = parts.join("/",);
  if (absolute) return `/${joined}`;
  return joined === "" ? "." : joined;
}

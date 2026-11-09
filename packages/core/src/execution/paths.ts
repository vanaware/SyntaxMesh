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

/**
 * Diretório-pai posix de um caminho canônico (`"."` na raiz relativa).
 *
 * Puro como o resto do módulo: `a/b.tji` → `a`, `b.tji` → `.`, `/x` → `/`.
 */
export function dirnameOf(path: string,): string {
  const index = path.lastIndexOf("/",);
  if (index < 0) return ".";
  if (index === 0) return "/";
  return path.slice(0, index,);
}

/**
 * Remove a extensão final (`master.tjp` → `master`).
 *
 * Só corta o último ponto do **basename**: `a.b/master` e `master` ficam
 * intactos, como o `File.basename(f, ext)` implícito do freeze no Ruby.
 */
export function stripExtension(path: string,): string {
  const slash = path.lastIndexOf("/",);
  const dot = path.lastIndexOf(".",);
  if (dot <= slash + 1) return path;
  return path.slice(0, dot,);
}

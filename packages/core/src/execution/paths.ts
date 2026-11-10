/**
 * Path normalization of the execution boundary (phase 24 — ADR 034).
 *
 * Pure: it does not touch the filesystem. The TJP `include` is resolved by the
 * scanner by concatenating `dirname(parent-file) + "/" + name`, which produces
 * shapes like `./a/b.tji` or `a/../b.tji`; the lookup against the request file
 * list needs the canonical form (`a/b.tji`).
 */

/**
 * Canonicalizes a relative or absolute posix path, without touching the disk.
 *
 * - removes `.` and empty segments (duplicated slashes, trailing slash);
 * - resolves `..` textually (keeps a leading `..` in a relative path);
 * - preserves the `/` root of absolute paths;
 * - `""` and `"."` normalize to `"."`.
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
 * Posix parent directory of a canonical path (`"."` at the relative root).
 *
 * Pure like the rest of the module: `a/b.tji` → `a`, `b.tji` → `.`, `/x` →
 * `/`.
 */
export function dirnameOf(path: string,): string {
  const index = path.lastIndexOf("/",);
  if (index < 0) return ".";
  if (index === 0) return "/";
  return path.slice(0, index,);
}

/**
 * Removes the trailing extension (`master.tjp` → `master`).
 *
 * It only cuts the last dot of the **basename**: `a.b/master` and `master` stay
 * untouched, like the implicit `File.basename(f, ext)` of the Ruby freeze.
 */
export function stripExtension(path: string,): string {
  const slash = path.lastIndexOf("/",);
  const dot = path.lastIndexOf(".",);
  if (dot <= slash + 1) return path;
  return path.slice(0, dot,);
}

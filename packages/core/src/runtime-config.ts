/**
 * RuntimeConfig — faithful port of `RuntimeConfig.rb` (Ruby 3.8.4).
 *
 * Ruby reads the `--config` YAML at CLI boot and, per app, applies the values
 * of a dotted section (`global`, `global.log`, `timesheets.sender` …) onto the
 * matching instance variables of the target object. Only keys that **already
 * exist** on the object are set — a wrong name in the file is silently
 * ignored, exactly as Ruby does while walking `object.instance_variables`.
 *
 * The sheet apps already had their own private copy of this logic (24.10);
 * phase 24 task 24.3.11 promotes it to a shared helper so the plain CLI can
 * also apply the `_global` and `_global.log` sections of the YAML to
 * `MessageHandlerInstance` (the same seam Ruby's `Tj3Daemon` uses). The
 * helper has **no I/O**: reading the file and parsing the YAML stays in the
 * CLI layer (ADR 034 — the core never touches disk).
 *
 * Section names in the YAML carry a leading underscore (`_global`, `_log`) to
 * distinguish them from leaf keys — Ruby does the same via
 * `p = p['_' + sec]` (RuntimeConfig.rb:51).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RuntimeConfig.rb
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md §24.3.11
 */

/** A YAML config section, already parsed by the caller. */
export type ConfigTree = Record<string, unknown>;

/**
 * Walks `config` down to a dotted section (`"global"`, `"global.log"`,
 * `"timesheets.sender"` …). Each name is looked up under its underscore-prefixed
 * key (`_global`, `_log`, …), as Ruby does.
 *
 * @param config Root of the parsed YAML, or `null` when no file was provided.
 * @param section Dotted section path.
 * @returns The section object, or `null` when any level is missing/not a hash.
 */
export function sectionNode(
  config: ConfigTree | null | undefined,
  section: string,
): ConfigTree | null {
  let node: unknown = config;
  if (!node) return null;
  for (const name of section.split(".",)) {
    if (node === null || typeof node !== "object") return null;
    node = (node as ConfigTree)["_" + name];
  }
  if (
    node === null || node === undefined || typeof node !== "object" ||
    Array.isArray(node,)
  ) {
    return null;
  }
  return node as ConfigTree;
}

/**
 * Applies one YAML section onto `target` (Ruby `RuntimeConfig#configure`).
 *
 * Only keys that already exist as own or inherited members of `target` are
 * copied; every other key is silently dropped. Setters on the target do fire
 * because we assign via `target[key] = value` on the instance.
 *
 * `Date` values (Ruby YAML parses `2026-05-18` as a Date; the JS YAML parser
 * does too, thanks to `@std/yaml`) are rendered back to `YYYY-MM-DD` so
 * string-typed fields on the target keep working.
 *
 * @param target Object whose existing keys receive the values.
 * @param config Root of the parsed YAML (or `null`).
 * @param section Dotted section path (e.g. `"global"`, `"global.log"`).
 * @returns `true` when the section resolved to a hash (matching Ruby); `false`
 *   when any level of the dotted path was missing or not a hash.
 */
export function configureFromSection(
  target: object,
  config: ConfigTree | null | undefined,
  section: string,
): boolean {
  const node = sectionNode(config ?? null, section,);
  if (node === null) return false;
  const sink = target as Record<string, unknown>;
  for (const [key, value,] of Object.entries(node,)) {
    if (!(key in sink)) continue;
    sink[key] = value instanceof Date ? toYmd(value,) : value;
  }
  // Faithful to Ruby: `true` whenever the section resolves to a hash, even
  // when no key happened to match a member of `target` (unknown keys are
  // silently dropped).
  return true;
}

/** `Date` → `YYYY-MM-DD` in the machine's local time (mirrors `localDate`). */
function toYmd(d: Date,): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1,).padStart(2, "0",);
  const day = String(d.getDate(),).padStart(2, "0",);
  return `${y}-${m}-${day}`;
}

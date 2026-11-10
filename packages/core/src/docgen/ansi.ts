/**
 * `ansi.ts` — subset of `Term::ANSIColor` used by the keyword documentation
 * (22.1b.3/24.9).
 *
 * Ruby paints `Keyword:`, `Warning:` and the `[sc]`/`[ig]`/`[ip]` marks
 * whenever the output is a terminal; the gem decides through
 * `$stdout.tty?`. Here `doc-core` **does not** know terminals: the consumer
 * decides (the CLI passes `--no-color`), so every function receives
 * `enabled`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/KeywordDocumentation.rb (l.192-300)
 */

/** Reset sequence (end of any style). */
const RESET = "\x1b[0m";

/** SGR codes used by the manual (the same as `Term::ANSIColor`). */
export const ANSI_CODES = {
  bold: "\x1b[1m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
} as const;

/** Styles recognized by {@link paint}. */
export type AnsiStyle = keyof typeof ANSI_CODES;

/** Applies (or not) a style to the text. */
export function paint(
  style: AnsiStyle,
  text: string,
  enabled: boolean,
): string {
  return enabled ? `${ANSI_CODES[style]}${text}${RESET}` : text;
}

/** `blue(text)` — manual labels (`Keyword:`, `Purpose:`, …). */
export function blue(text: string, enabled: boolean,): string {
  return paint("blue", text, enabled,);
}

/** `bold(text)` — the keyword name. */
export function bold(text: string, enabled: boolean,): string {
  return paint("bold", text, enabled,);
}

/** `red(text)` — the support level warning. */
export function red(text: string, enabled: boolean,): string {
  return paint("red", text, enabled,);
}

/** `cyan(text)` — the attribute marks (`[sc]`, `[ig]`, `[ip]`). */
export function cyan(text: string, enabled: boolean,): string {
  return paint("cyan", text, enabled,);
}

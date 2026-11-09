/**
 * `ansi.ts` — subconjunto de `Term::ANSIColor` usado pela documentação de
 * keywords (22.1b.3/24.9).
 *
 * O Ruby pinta `Keyword:`, `Warning:` e as marcas `[sc]`/`[ig]`/`[ip]` sempre
 * que a saída é um terminal; a gem decide por `$stdout.tty?`. Aqui o
 * `doc-core` **não** conhece terminal: quem decide é o consumidor (a CLI passa
 * `--no-color`), então todas as funções recebem `enabled`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/KeywordDocumentation.rb (l.192-300)
 */

/** Sequência de reset (fim de qualquer estilo). */
const RESET = "\x1b[0m";

/** Códigos SGR usados pelo manual (os mesmos do `Term::ANSIColor`). */
export const ANSI_CODES = {
  bold: "\x1b[1m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
} as const;

/** Estilos reconhecidos por {@link paint}. */
export type AnsiStyle = keyof typeof ANSI_CODES;

/** Aplica (ou não) um estilo ao texto. */
export function paint(
  style: AnsiStyle,
  text: string,
  enabled: boolean,
): string {
  return enabled ? `${ANSI_CODES[style]}${text}${RESET}` : text;
}

/** `blue(text)` — rótulos do manual (`Keyword:`, `Purpose:`, …). */
export function blue(text: string, enabled: boolean,): string {
  return paint("blue", text, enabled,);
}

/** `bold(text)` — o nome da keyword. */
export function bold(text: string, enabled: boolean,): string {
  return paint("bold", text, enabled,);
}

/** `red(text)` — o aviso de nível de suporte. */
export function red(text: string, enabled: boolean,): string {
  return paint("red", text, enabled,);
}

/** `cyan(text)` — as marcas de atributo (`[sc]`, `[ig]`, `[ip]`). */
export function cyan(text: string, enabled: boolean,): string {
  return paint("cyan", text, enabled,);
}

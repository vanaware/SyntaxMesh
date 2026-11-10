/**
 * UTF-8 helpers — "no-op" port of `UTF8String.rb`.
 *
 * Ruby 1.8 needed reimplementations of `each_char`, `length`, `reverse` and
 * `ljust` (plus a `<<` accepting code points). On Ruby >= 1.9 and in
 * JavaScript strings are UTF-16 and iteration by code point is already
 * native, so the functions below are just the runtime's idiomatic form —
 * exactly the `RUBY_VERSION >= '1.9.0'` branch of the original file.
 *
 * @see docs/taskjuggler/lib/taskjuggler/UTF8String.rb
 * @see docs/syntaxmesh/fases/fase-16-apoio-tarefas.md (16.12)
 */

/** Iterates the UTF-8 characters of `str` (Ruby `each_utf8_char`). */
export function eachUtf8Char(str: string,): IterableIterator<string> {
  return str[Symbol.iterator]();
}

/** Number of UTF-8 characters (Ruby `length_utf8`; an emoji counts as 1). */
export function lengthUtf8(str: string,): number {
  return [...str,].length;
}

/** Reverses by characters, not by bytes (Ruby `String#reverse`). */
export function reverseUtf8(str: string,): string {
  return [...str,].reverse().join("",);
}

/** Left-aligns up to `len` characters (Ruby `ljust`). */
export function ljust(str: string, len: number, pad = " ",): string {
  return str.padEnd(len, pad,);
}

/**
 * Normalizes to UTF-8/NFC and converts `\r\n` to `\n`
 * (Ruby `forceUTF8Encoding` with `:universal_newline`).
 */
export function forceUTF8Encoding(str: string,): string {
  return str.normalize("NFC",).replace(/\r\n/g, "\n",);
}

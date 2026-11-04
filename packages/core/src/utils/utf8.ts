/**
 * Helpers UTF-8 — port "no-op" de `UTF8String.rb`.
 *
 * O Ruby 1.8 precisava de reimplementações de `each_char`, `length`,
 * `reverse` e `ljust` (e de um `<<` que aceitava code points). No Ruby >= 1.9
 * e em JavaScript as strings são UTF-16 e a iteração por code point já é
 * nativa, então as funções abaixo são apenas a forma idiomática do runtime —
 * exatamente o ramo `RUBY_VERSION >= '1.9.0'` do arquivo original.
 *
 * @see docs/taskjuggler/lib/taskjuggler/UTF8String.rb
 * @see docs/syntaxmesh/fases/fase-16-apoio-tarefas.md (16.12)
 */

/** Itera pelos caracteres UTF-8 de `str` (Ruby `each_utf8_char`). */
export function eachUtf8Char(str: string,): IterableIterator<string> {
  return str[Symbol.iterator]();
}

/** Número de caracteres UTF-8 (Ruby `length_utf8`; emoji conta 1). */
export function lengthUtf8(str: string,): number {
  return [...str,].length;
}

/** Inverte por caracteres, não por bytes (Ruby `String#reverse`). */
export function reverseUtf8(str: string,): string {
  return [...str,].reverse().join("",);
}

/** Alinha à esquerda até `len` caracteres (Ruby `ljust`). */
export function ljust(str: string, len: number, pad = " ",): string {
  return str.padEnd(len, pad,);
}

/**
 * Normaliza para UTF-8/NFC e converte `\r\n` em `\n`
 * (Ruby `forceUTF8Encoding` com `:universal_newline`).
 */
export function forceUTF8Encoding(str: string,): string {
  return str.normalize("NFC",).replace(/\r\n/g, "\n",);
}

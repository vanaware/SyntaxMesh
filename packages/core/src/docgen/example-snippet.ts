/**
 * `example-snippet.ts` — extração dos exemplos anotados de sintaxe (22.1b.4).
 *
 * Port fiel de `TjpExample.rb` (123 linhas). O corpus de exemplos são arquivos
 * de projeto anotados: qualquer linha começando com `# *** EXAMPLE: <tag> +`
 * abre um trecho e `# *** EXAMPLE: <tag> -` fecha. Sem tag, `text()` devolve o
 * arquivo inteiro **sem** as linhas de anotação.
 *
 * O Ruby lê do disco (`File.open`); aqui o conteúdo entra por `parse(text)` —
 * `doc-core` não faz E/S. Quem lê o arquivo é o chamador (a CLI, quando o
 * corpus é distribuído como asset).
 *
 * @see docs/taskjuggler/lib/taskjuggler/TjpExample.rb
 */

/** Marca das linhas de anotação (`TjpExample.rb:71`). */
const MARK = "# *** EXAMPLE: ";

/**
 * Arquivo de exemplo anotado, com os trechos (`snips`) indexados por tag.
 */
export class ExampleSnippet {
  /** Linhas de cada trecho; `"full text"` guarda o arquivo inteiro. */
  private readonly snippets: Map<string, string[]> = new Map();

  constructor() {
    this.snippets.set("full text", [],);
  }

  /**
   * Processa o texto de um arquivo anotado.
   *
   * @throws {Error} tag repetida, tag fechada sem abrir, ou indicador
   *   diferente de `+`/`-` — como as mensagens do Ruby.
   */
  parse(text: string,): void {
    const state = new Map<string, boolean>();

    for (const line of splitLines(text,)) {
      if (line.startsWith(MARK,)) {
        const tokens = line.split(/\s+/,);
        const tag = tokens[3];
        const indicator = tokens[4];
        if (tag === undefined) {
          throw new Error(`Bad annotation line: ${line}`,);
        }
        if (indicator === "+") {
          if (state.get(tag,)) {
            throw new Error(`Snippet ${tag} has already been started`,);
          }
          state.set(tag, true,);
        } else if (indicator === "-") {
          if (!state.get(tag,)) {
            throw new Error(`Snippet ${tag} has not yet been started`,);
          }
          state.set(tag, false,);
        } else {
          throw new Error(
            `Bad indicator ${indicator}. Must be '+' or '-': ${line}`,
          );
        }
        continue;
      }

      for (const [tag, active,] of state) {
        if (!active) continue;
        let buffer = this.snippets.get(tag,);
        if (buffer === undefined) {
          buffer = [];
          this.snippets.set(tag, buffer,);
        }
        buffer.push(line,);
      }
      this.snippets.get("full text",)!.push(line,);
    }

    for (const buffer of this.snippets.values()) {
      if (buffer[buffer.length - 1] === "\n") buffer.pop();
    }
  }

  /**
   * Conteúdo do trecho `tag` (ou do arquivo inteiro quando `null`).
   *
   * @returns `null` quando a tag não existe — o Ruby devolve `nil` e o
   *   chamador transforma em erro (`KeywordDocumentation.rb:687-689`).
   */
  text(tag: string | null = null,): string | null {
    const key = tag ?? "full text";
    const buffer = this.snippets.get(key,);
    return buffer === undefined ? null : buffer.join("",);
  }
}

/**
 * Quebra o texto em linhas **mantendo** o `\n` de cada uma.
 *
 * `each_line` do Ruby preserva o terminador; `split("\n")` não. O último
 * fragmento sem `\n` também entra (arquivo sem newline final).
 */
function splitLines(text: string,): string[] {
  const lines: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      lines.push(text.slice(start, i + 1,),);
      start = i + 1;
    }
  }
  if (start < text.length) lines.push(text.slice(start,),);
  return lines;
}

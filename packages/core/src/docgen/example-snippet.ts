/**
 * `example-snippet.ts` — extraction of the annotated syntax examples (22.1b.4).
 *
 * Faithful port of `TjpExample.rb` (123 lines). The example corpus consists of
 * annotated project files: any line starting with `# *** EXAMPLE: <tag> +`
 * opens a snippet and `# *** EXAMPLE: <tag> -` closes it. Without a tag,
 * `text()` returns the whole file **without** the annotation lines.
 *
 * Ruby reads from disk (`File.open`); here the content comes in through
 * `parse(text)` — `doc-core` performs no I/O. The caller reads the file (the
 * CLI, when the corpus is distributed as an asset).
 *
 * @see docs/taskjuggler/lib/taskjuggler/TjpExample.rb
 */

/** Marker of the annotation lines (`TjpExample.rb:71`). */
const MARK = "# *** EXAMPLE: ";

/**
 * Annotated example file, with the snippets (`snips`) indexed by tag.
 */
export class ExampleSnippet {
  /** Lines of each snippet; `"full text"` holds the whole file. */
  private readonly snippets: Map<string, string[]> = new Map();

  constructor() {
    this.snippets.set("full text", [],);
  }

  /**
   * Processes the text of an annotated file.
   *
   * @throws {Error} Repeated tag, tag closed without opening, or indicator
   *   other than `+`/`-` — like the Ruby messages.
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
   * Content of the `tag` snippet (or of the whole file when `null`).
   *
   * @returns `null` when the tag does not exist — Ruby returns `nil` and the
   *   caller turns it into an error (`KeywordDocumentation.rb:687-689`).
   */
  text(tag: string | null = null,): string | null {
    const key = tag ?? "full text";
    const buffer = this.snippets.get(key,);
    return buffer === undefined ? null : buffer.join("",);
  }
}

/**
 * Splits the text into lines **keeping** the `\n` of each one.
 *
 * Ruby's `each_line` preserves the terminator; `split("\n")` does not. The
 * last fragment without `\n` also comes in (file without a trailing newline).
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

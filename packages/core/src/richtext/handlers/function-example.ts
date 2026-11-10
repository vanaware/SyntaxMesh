/**
 * RichTextFunctionExample — handler of the `[[example:…]]` function (phase
 * 12.12).
 *
 * Embeds an example `.tjp` code snippet into an HTML code block
 * (`<div class="codeframe"><pre class="code">…</pre></div>`). In Ruby the text
 * comes from `TjpExample`, which reads files from
 * `data/test/TestSuite/Syntax/Correct`. A PWA has no disk access, so the
 * extraction is injected through {@link ExampleLoader} (abstracted I/O boundary
 * — the output format stays faithful). Without a loader, the handler logs a
 * non-fatal error.
 *
 * Faithful port of `RichText/FunctionExample.rb`, with the file read delegated
 * to a loader.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/FunctionExample.rb
 * @see ADR 025 (RichText and function handlers)
 */

import { RichTextFunctionHandler, } from "./function-handler.ts";
import type { RichTextFunctionArgs, } from "./function-handler.ts";
import type { XMLElementLike, } from "../../xml/xml-element-like.ts";
import { XMLElement, } from "../../xml/xml-element.ts";
import type { SourceFileInfo, } from "../../source-file-info.ts";

/**
 * Extracts the text of the `file` example for the given `tag` (or the whole
 * file).
 */
export type ExampleLoader = (
  file: string,
  tag: string | null,
) => string | null;

export class RichTextFunctionExample extends RichTextFunctionHandler {
  private readonly loader: ExampleLoader | null;

  constructor(
    loader: ExampleLoader | null = null,
    sourceFileInfo: SourceFileInfo | null = null,
  ) {
    super("example", sourceFileInfo,);
    this.blockFunction = true;
    this.loader = loader;
  }

  /** Not supported for this function. */
  override to_s(_args: RichTextFunctionArgs,): string {
    return "";
  }

  /** Not supported for this function. */
  override to_tagged(_args: RichTextFunctionArgs,): string | null {
    return null;
  }

  /** Builds `<div class="codeframe"><pre class="code">text</pre></div>`. */
  override to_html(args: RichTextFunctionArgs,): XMLElementLike | null {
    const file = args["file"];
    if (!file) {
      throw new Error("'file' argument missing",);
    }
    const tag = args["tag"] ?? null;

    const frame = new XMLElement("div", { class: "codeframe", },);
    const pre = new XMLElement("pre", { class: "code", },);
    frame.append(pre,);

    const text = this.loader ? this.loader(file, tag,) : null;
    if (text === null) {
      // No loader (browser) or a missing tag — records the failure and returns
      // the empty frame, mirroring the structure Ruby would produce.
      this.error(
        "example_unavailable",
        `There is no tag '${tag}' in file ${file}.`,
      );
      return frame;
    }
    pre.append(text,);
    return frame;
  }
}

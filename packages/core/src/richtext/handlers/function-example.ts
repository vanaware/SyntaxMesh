/**
 * RichTextFunctionExample — handler da função `[[example:…]]` (Fase 12.12).
 *
 * Incorpora um trecho de código `.tjp` de exemplo num bloco de código HTML
 * (`<div class="codeframe"><pre class="code">…</pre></div>`). No Ruby o texto
 * vem de `TjpExample`, que lê arquivos de `data/test/TestSuite/Syntax/Correct`.
 * Num PWA não há acesso ao disco, então a extração é injetada via
 * {@link ExampleLoader} (fronteira de IO abstraída — o formato de saída
 * permanece fiel). Sem loader, o handler registra um erro não-fatal.
 *
 * Port fiel de `RichText/FunctionExample.rb`, com a leitura de arquivo
 * delegada a um loader.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/FunctionExample.rb
 * @see ADR 025 (RichText e function handlers)
 */

import { RichTextFunctionHandler, } from "./function-handler.ts";
import type { RichTextFunctionArgs, } from "./function-handler.ts";
import type { XMLElementLike, } from "../xml-like.ts";
import { SimpleXMLElement, } from "../xml-like.ts";
import type { SourceFileInfo, } from "../../source-file-info.ts";

/** Extrai o texto do exemplo `file` para a `tag` dada (ou o arquivo inteiro). */
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

  /** Não suportado para esta função. */
  override to_s(_args: RichTextFunctionArgs,): string {
    return "";
  }

  /** Não suportado para esta função. */
  override to_tagged(_args: RichTextFunctionArgs,): string | null {
    return null;
  }

  /** Monta `<div class="codeframe"><pre class="code">texto</pre></div>`. */
  override to_html(args: RichTextFunctionArgs,): XMLElementLike | null {
    const file = args["file"];
    if (!file) {
      throw new Error("'file' argument missing",);
    }
    const tag = args["tag"] ?? null;

    const frame = new SimpleXMLElement("div", { class: "codeframe", },);
    const pre = new SimpleXMLElement("pre", { class: "code", },);
    frame.append(pre,);

    const text = this.loader ? this.loader(file, tag,) : null;
    if (text === null) {
      // Sem loader (browser) ou tag inexistente — registra a falha e devolve
      // a moldura vazia, espelhando a estrutura que o Ruby produziria.
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

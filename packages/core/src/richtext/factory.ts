/**
 * RichTextFactory — costura de injeção entre o parser TJP (Fase 10) e o
 * RichText real (Fase 12.18).
 *
 * A Fase 10 mantinha `ProjectFileParser.newRichText` como um stub ancorado;
 * ela passa a delegar a criação do `RichTextIntermediate` a um
 * {@link RichTextFactory}. A implementação {@link RichTextFactoryImpl} monta um
 * {@link RichText} com os handlers padrão ({@link RTFHandlers}) e gera a
 * representação intermediária — espelhando o corpo de `newRichText` em
 * `ProjectFileParser.rb:221-233`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/ProjectFileParser.rb
 * @see ADR 025 (RichText e function handlers)
 */

import { RichText, } from "./rich-text.ts";
import type { RichTextIntermediate, } from "./rich-text-intermediate.ts";
import { RTFHandlers, } from "./handlers/rtf-handlers.ts";
import type { SourceFileInfo, } from "../source-file-info.ts";
import type { Project, } from "../model/project.ts";
import { TjArgumentError, } from "../time/tj-time.ts";

/** Fábrica de `RichTextIntermediate` usada pelo parser de arquivos TJP. */
export interface RichTextFactory {
  create(
    text: string,
    tokenSet?: string[] | null,
  ): RichTextIntermediate;
}

export class RichTextFactoryImpl implements RichTextFactory {
  private readonly project: Project | null;
  private readonly sourceFileInfo: SourceFileInfo | null;

  constructor(
    project: Project | null,
    sourceFileInfo: SourceFileInfo | null = null,
  ) {
    this.project = project;
    this.sourceFileInfo = sourceFileInfo;
  }

  /**
   * Cria um {@link RichText} com os handlers padrão e gera sua representação
   * intermediária. Lança `TjArgumentError` se o parser não produzir árvore
   * (equivalente ao retorno `null` do Ruby, tornado falha explícita aqui).
   */
  create(
    text: string,
    tokenSet: string[] | null = null,
  ): RichTextIntermediate {
    const rt = new RichText(
      text,
      RTFHandlers.create(this.project, this.sourceFileInfo,),
    );
    const rti = rt.generateIntermediateFormat([0, 0, 0,], tokenSet,);
    if (!rti) {
      throw new TjArgumentError("Failed to parse RichText input",);
    }
    return rti;
  }
}

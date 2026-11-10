/**
 * RichTextFactory — dependency-injection seam between the TJP parser (Phase 10)
 * and the real RichText (Phase 12.18).
 *
 * Phase 10 kept `ProjectFileParser.newRichText` as an anchored stub; it now
 * delegates the creation of the `RichTextIntermediate` to a
 * {@link RichTextFactory}. The {@link RichTextFactoryImpl} implementation builds
 * a {@link RichText} with the default handlers ({@link RTFHandlers}) and
 * generates the intermediate representation — mirroring the body of
 * `newRichText` in `ProjectFileParser.rb:221-233`.
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

/** Factory of `RichTextIntermediate` used by the TJP file parser. */
export interface RichTextFactory {
  /**
   * Parses the text and returns its intermediate representation.
   *
   * @param text RichText source text (TJP markup).
   * @param tokenSet Optional token substitutions already resolved by the caller.
   * @returns The intermediate representation of the parsed text.
   */
  create(
    text: string,
    tokenSet?: string[] | null,
  ): RichTextIntermediate;
}

/**
 * Default {@link RichTextFactory}, bound to a project and a source file.
 */
export class RichTextFactoryImpl implements RichTextFactory {
  private readonly project: Project | null;
  private readonly sourceFileInfo: SourceFileInfo | null;

  /**
   * Creates the factory.
   *
   * @param project Project the generated reports will query, if any.
   * @param sourceFileInfo Origin of the text, used in error messages.
   */
  constructor(
    project: Project | null,
    sourceFileInfo: SourceFileInfo | null = null,
  ) {
    this.project = project;
    this.sourceFileInfo = sourceFileInfo;
  }

  /**
   * Creates a {@link RichText} with the default handlers and generates its
   * intermediate representation. Throws `TjArgumentError` when the parser
   * produces no tree (equivalent to Ruby returning `null`, turned into an
   * explicit failure here).
   *
   * @param text RichText source text (TJP markup).
   * @param tokenSet Optional token substitutions already resolved by the caller.
   * @returns The intermediate representation of the parsed text.
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

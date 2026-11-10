/**
 * Pre/post-processing pipeline of the Markdown extensions (phase 13.8).
 *
 * Fixed order (13.8.4): **color → functions → mini-queries**. Each stage
 * registers its extractions in a map keyed by placeholder; during
 * post-processing the placeholders come back as `richtextExtension` nodes
 * (13.8.5).
 *
 * The content captured by `<fcol:…>…</fcol>` also goes through the function
 * and mini-query stages, so nesting works without touching the Markdown
 * parser.
 *
 * @see ADR 026 (Markdown as the going-forward format)
 * @see docs/syntaxmesh/fases/fase-13-markdown.md §4.2
 */

import type { Extraction, MdastRoot, } from "../types.ts";
import { colorToExtraction, preprocessColor, } from "./color.ts";
import { functionToExtraction, preprocessFunctions, } from "./functions.ts";
import { miniQueryToExtraction, preprocessMiniQueries, } from "./mini-query.ts";
import { walkAndExpand, } from "./placeholders.ts";
import { DEFAULT_BLOCK_FUNCTIONS, DEFAULT_KNOWN_FUNCTIONS, } from "../types.ts";

/** Pipeline options (known functions / block functions). */
export interface PipelineOptions {
  /** A function without a handler in phase 12 comes back as raw text. */
  isKnownFunction?: (name: string,) => boolean;
  /** A function alone in a paragraph becomes a `blockfunc`. */
  isBlockFunction?: (name: string,) => boolean;
}

type Counter = "COLOR" | "FUNC" | "MINIQ";

/** Registers the extension extractions and rewrites their placeholders. */
export class ExtractionPipeline {
  /** Registered extractions, addressed by their placeholder. */
  private readonly extractions: Map<string, Extraction> = new Map();
  /** Per-kind counters, used to keep placeholders unique (13.8 collision risk). */
  private readonly next: Record<Counter, number> = {
    COLOR: 0,
    FUNC: 0,
    MINIQ: 0,
  };
  private readonly options: Required<PipelineOptions>;

  /**
   * Builds the pipeline with the default function predicates.
   *
   * @param options Overrides for the known/block function predicates.
   */
  constructor(options: PipelineOptions = {},) {
    this.options = {
      isKnownFunction: options.isKnownFunction ??
        ((name: string,) => DEFAULT_KNOWN_FUNCTIONS.includes(name,)),
      isBlockFunction: options.isBlockFunction ??
        ((name: string,) => DEFAULT_BLOCK_FUNCTIONS.includes(name,)),
    };
  }

  /**
   * Extracts the extensions and returns the text with placeholders.
   *
   * @param text Markdown source before parsing.
   * @returns The same text with every extension replaced by a placeholder.
   */
  preprocess(text: string,): string {
    const color = preprocessColor(text, this.next.COLOR,);
    this.next.COLOR += color.extractions.length;
    for (const e of color.extractions) {
      this.extractions.set(e.placeholder, colorToExtraction(e,),);
    }
    // Functions and mini-queries live both in the text and inside <fcol:…>.
    const outer = this.preprocessInlineStages(color.text,);
    for (const e of color.extractions) {
      const registered = this.extractions.get(e.placeholder,);
      if (!registered) continue;
      registered.content = this.preprocessInlineStages(e.content,);
    }
    return outer;
  }

  /**
   * Runs `functions` and then `mini-queries` over a fragment.
   *
   * @param text Fragment to scan.
   * @returns The fragment with both stages applied.
   */
  private preprocessInlineStages(text: string,): string {
    const funcs = preprocessFunctions(text, this.next.FUNC,);
    this.next.FUNC += funcs.extractions.length;
    for (const e of funcs.extractions) {
      this.extractions.set(e.placeholder, functionToExtraction(e,),);
    }
    const minis = preprocessMiniQueries(funcs.text, this.next.MINIQ,);
    this.next.MINIQ += minis.extractions.length;
    for (const e of minis.extractions) {
      this.extractions.set(e.placeholder, miniQueryToExtraction(e,),);
    }
    return minis.text;
  }

  /**
   * Replaces the placeholders of the AST with `richtextExtension` nodes
   * (13.8.5).
   *
   * @param mdast Parsed tree produced from the preprocessed text.
   * @returns The same tree with the placeholders expanded.
   */
  postprocessMdast(mdast: MdastRoot,): MdastRoot {
    return walkAndExpand(
      mdast,
      this.extractions.values(),
      this.options,
    ) as MdastRoot;
  }

  /**
   * Extraction registered for a placeholder (or `undefined`).
   *
   * @param placeholder Placeholder previously emitted by `preprocess`.
   * @returns The matching extraction, if any.
   */
  lookup(placeholder: string,): Extraction | undefined {
    return this.extractions.get(placeholder,);
  }

  /**
   * Every extraction registered so far.
   *
   * @returns The registered extractions, in insertion order.
   */
  all(): Extraction[] {
    return [...this.extractions.values(),];
  }

  /** Clears extractions and counters (instance reused for another document). */
  reset(): void {
    this.extractions.clear();
    this.next.COLOR = 0;
    this.next.FUNC = 0;
    this.next.MINIQ = 0;
  }
}

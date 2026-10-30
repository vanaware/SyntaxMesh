/**
 * Pipeline de pré/pós-processamento das extensões Markdown (Fase 13.8).
 *
 * Ordem fixa (13.8.4): **color → functions → mini-queries**. Cada estágio
 * registra suas extrações num mapa por placeholder; no pós-processamento os
 * placeholders voltam como nós `richtextExtension` (13.8.5).
 *
 * O conteúdo capturado por `<fcol:…>…</fcol>` também passa pelos estágios de
 * função e mini-query, então aninhamento funciona sem tocar no parser Markdown.
 *
 * @see ADR 026 (Markdown como formato going-forward)
 * @see docs/syntaxmesh/fases/fase-13-markdown.md §4.2
 */

import type { Extraction, MdastRoot, } from "../types.ts";
import { colorToExtraction, preprocessColor, } from "./color.ts";
import { functionToExtraction, preprocessFunctions, } from "./functions.ts";
import { miniQueryToExtraction, preprocessMiniQueries, } from "./mini-query.ts";
import { walkAndExpand, } from "./placeholders.ts";
import { DEFAULT_BLOCK_FUNCTIONS, DEFAULT_KNOWN_FUNCTIONS, } from "../types.ts";

/** Opções do pipeline (funções conhecidas / de bloco). */
export interface PipelineOptions {
  /** Função sem handler na Fase 12 volta como texto cru. */
  isKnownFunction?: (name: string,) => boolean;
  /** Função sozinha em parágrafo vira `blockfunc`. */
  isBlockFunction?: (name: string,) => boolean;
}

type Counter = "COLOR" | "FUNC" | "MINIQ";

export class ExtractionPipeline {
  /** Extrações registradas, endereçadas pelo placeholder. */
  private readonly extractions: Map<string, Extraction> = new Map();
  /** Contadores por tipo, para placeholders únicos (13.8, risco de colisão). */
  private readonly next: Record<Counter, number> = {
    COLOR: 0,
    FUNC: 0,
    MINIQ: 0,
  };
  private readonly options: Required<PipelineOptions>;

  constructor(options: PipelineOptions = {},) {
    this.options = {
      isKnownFunction: options.isKnownFunction ??
        ((name: string,) => DEFAULT_KNOWN_FUNCTIONS.includes(name,)),
      isBlockFunction: options.isBlockFunction ??
        ((name: string,) => DEFAULT_BLOCK_FUNCTIONS.includes(name,)),
    };
  }

  /** Extrai as extensões e devolve o texto com placeholders. */
  preprocess(text: string,): string {
    const color = preprocessColor(text, this.next.COLOR,);
    this.next.COLOR += color.extractions.length;
    for (const e of color.extractions) {
      this.extractions.set(e.placeholder, colorToExtraction(e,),);
    }
    // Funções e mini-queries vivem tanto no texto quanto dentro de <fcol:…>.
    const outer = this.preprocessInlineStages(color.text,);
    for (const e of color.extractions) {
      const registered = this.extractions.get(e.placeholder,);
      if (!registered) continue;
      registered.content = this.preprocessInlineStages(e.content,);
    }
    return outer;
  }

  /** Roda `functions` e depois `mini-queries` sobre um trecho. */
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

  /** Substitui os placeholders da AST por nós `richtextExtension` (13.8.5). */
  postprocessMdast(mdast: MdastRoot,): MdastRoot {
    return walkAndExpand(
      mdast,
      this.extractions.values(),
      this.options,
    ) as MdastRoot;
  }

  /** Extração registrada para um placeholder (ou `undefined`). */
  lookup(placeholder: string,): Extraction | undefined {
    return this.extractions.get(placeholder,);
  }

  /** Todas as extrações registradas até agora. */
  all(): Extraction[] {
    return [...this.extractions.values(),];
  }

  /** Zera extrações e contadores (reuso da instância em outro documento). */
  reset(): void {
    this.extractions.clear();
    this.next.COLOR = 0;
    this.next.FUNC = 0;
    this.next.MINIQ = 0;
  }
}

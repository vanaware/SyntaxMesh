/**
 * CustomData — pseudo-atributo injetado no resultado de uma Query
 * (Fase 11.6.1.11 / 11.7.2.2).
 *
 * Relatórios podem alimentar a `Query` com valores pré-computados (por ex.
 * totais de coluna) que não são atributos diretos da propriedade. `process()`
 * consome `customData` antes de qualquer dispatch dinâmico.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Query.rb (setCustomData / @customData)
 */
import type { RichTextIntermediate, } from "../attributes/rich/rich-text-port.ts";

/** Valores de resultado que uma Query deve devolver para um pseudo-atributo. */
export interface CustomData {
  numerical?: number | null;
  string?: string | null;
  sortable?: unknown;
  rti?: RichTextIntermediate | null;
}

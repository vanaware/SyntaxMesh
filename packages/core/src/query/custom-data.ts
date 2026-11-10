/**
 * CustomData — pseudo-attribute injected into the result of a `Query`
 * (phases 11.6.1.11 / 11.7.2.2).
 *
 * Reports may feed the `Query` with pre-computed values (e.g. column totals)
 * that are not direct attributes of the property. `process()` consumes
 * `customData` before any dynamic dispatch.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Query.rb (setCustomData / @customData)
 */
import type { RichTextIntermediate, } from "../attributes/rich/rich-text-port.ts";

/** Result values a `Query` must return for a pseudo-attribute. */
export interface CustomData {
  /** Numeric value of the pseudo-attribute, or `null`. */
  numerical?: number | null;
  /** String value of the pseudo-attribute, or `null`. */
  string?: string | null;
  /** Opaque sort key used when the value is sorted. */
  sortable?: unknown;
  /** Rich text value of the pseudo-attribute, or `null`. */
  rti?: RichTextIntermediate | null;
}

/**
 * Minimal interface for what `AttributeBase` needs to know about the property
 * that contains it.
 *
 * In phase 3 we only have `id` and `name`. Phase 4 (PropertyTreeNode) expands
 * this interface (adds `project`, `children`, `parent`, etc.).
 *
 * This interface keeps phase 3 from importing `PropertyTreeNode` (which only
 * exists in phase 4). Once phase 4 lands, `PropertyTreeNode implements
 * PropertyLike` without breaking anything.
 */
export interface PropertyLike {
  /** Full ID of the property (e.g. "proj.task1.subtask2"). */
  readonly id: string;

  /** Friendly name of the property. */
  readonly name: string;
}

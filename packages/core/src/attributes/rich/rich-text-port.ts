/**
 * Port interface for RichText Intermediate.
 *
 * Used for compatibility with the RichText phase (phase 12).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:RichTextAttribute
 */

/**
 * Interface representing the intermediate format of rich text.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:RichTextAttribute
 */
export interface RichTextIntermediate {
  /** Rich input text. */
  richText: {
    inputText: string;
  };

  /**
   * Converts to a string.
   */
  to_s(): string;
}

/**
 * Interface de porta para RichText Intermediate.
 *
 * Usada para compatibilidade com a fase de RichText (Fase 12).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:RichTextAttribute
 */

/**
 * Interface que representa o formato intermediário de texto rico.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:RichTextAttribute
 */
export interface RichTextIntermediate {
  /** Texto de entrada rico. */
  richText: {
    inputText: string;
  };

  /**
   * Converte para string.
   */
  to_s(): string;
}

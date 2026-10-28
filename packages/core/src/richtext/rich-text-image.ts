/**
 * RichTextImage — representação de imagem no markup RichText (Fase 12.2).
 *
 * Corresponde a `[[File:path.png alt=... middle]]` no MediaWiki/TJ. Port fiel
 * de `RichText/Element.rb:22` (`RichTextImage`): `fileName` é somente leitura,
 * `altText` e `verticalAlign` são acessores mutáveis (inicialmente `null`).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/Element.rb:22-31
 */
export class RichTextImage {
  /** Nome/caminho do arquivo da imagem. */
  readonly fileName: string;
  /** Texto alternativo (`alt=...`), opcional. */
  altText: string | null;
  /** Alinhamento vertical (ex.: `middle`), opcional. */
  verticalAlign: string | null;

  constructor(fileName: string,) {
    this.fileName = fileName;
    this.altText = null;
    this.verticalAlign = null;
  }
}

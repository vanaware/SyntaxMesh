/**
 * RichTextImage — image representation in the RichText markup (phase 12.2).
 *
 * Corresponds to `[[File:path.png alt=... middle]]` in MediaWiki/TJ. Faithful
 * port of `RichText/Element.rb:22` (`RichTextImage`): `fileName` is read-only,
 * `altText` and `verticalAlign` are mutable accessors (initially `null`).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/Element.rb:22-31
 */
export class RichTextImage {
  /** File name/path of the image. */
  readonly fileName: string;
  /** Alternative text (`alt=...`), optional. */
  altText: string | null;
  /** Vertical alignment (e.g. `middle`), optional. */
  verticalAlign: string | null;

  constructor(fileName: string,) {
    this.fileName = fileName;
    this.altText = null;
    this.verticalAlign = null;
  }
}

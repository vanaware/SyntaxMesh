/**
 * TjpSyntaxRules — picture/format block (phase 10, complement C3.3).
 *
 * `picture` and `format` are SyntaxMesh extensions attached to a `journalentry`
 * or to a timesheet/statussheet `status`. `format` chooses the dialect of the
 * body (`markdown` — default — or `richtext`); `picture` registers an image
 * (path + caption/align/width/alt). Both operate on `this.journalEntry`, which
 * the journalentry rules (task.ts) and the status rules (tracking.ts) fill in.
 *
 * Since the phase 14 complement (14C.5.1) the SAME `format` rule also serves
 * the **report** scope (header/footer/prolog/epilog/caption/…): there the
 * dialect is `richtext` by default, to preserve the existing `.tjp` files.
 *
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (Bloco C3.3)
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.5.1)
 */
import { Picture, type PictureAlign, } from "../../model/picture.ts";
import { type EntryFormat, type JournalEntry, } from "../../model/journal.ts";
import { Report, } from "../../model/report.ts";
import { applyReportFormat, } from "./report.ts";
import type { ProjectFileParser, } from "../project-file-parser.ts";
import { rule, } from "./helpers.ts";

/** Current entry being processed (journalentry or status). */
const asEntry = (parser: ProjectFileParser,): JournalEntry | null =>
  (parser.journalEntry as JournalEntry | null) ?? null;

/**
 * Applies `format <dialect>` to the current scope (mechanism shared between
 * `journalentry`/`status` and `report`).
 *
 * A `report` dialect is propagated to the RichText attributes already read by
 * the parser (`applyReportFormat`), so `format` may come before or after
 * `header`/`footer`/… — attribute order does not matter in TJP.
 */
export function applyFormat(
  parser: ProjectFileParser,
  format: EntryFormat,
): void {
  const entry = asEntry(parser,);
  if (entry) {
    entry.format = format;
    return;
  }
  const prop = parser.property;
  if (prop instanceof Report) applyReportFormat(parser, prop, format,);
}

/** Registers the `picture` and `format` rules. */
export function registerJournalRules(p: ProjectFileParser,): void {
  // ------------------------------------------------------------------
  // picture "<path>" { caption/align/width/alt }
  // ------------------------------------------------------------------
  rule(p, "picture", () => {
    p.pattern(
      ["!pictureHeader", "!pictureBody",],
      function (this: ProjectFileParser,): unknown {
        this.picture = null;
        return this.val[0];
      },
    );
    p.doc(
      "picture",
      "Attaches an image to the current journal entry or status report.",
    );
  },);

  rule(p, "pictureHeader", () => {
    p.pattern(
      ["_picture", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        const pic = new Picture(String(this.val[1],),);
        this.picture = pic;
        asEntry(this,)?.pictures.push(pic,);
        return pic;
      },
    );
    p.arg(1, "path", "Path to the picture file.",);
  },);

  rule(p, "pictureBody", () => {
    p.optional();
    p.pattern(["_{", "!pictureAttributes", "_}",], null,);
  },);

  rule(p, "pictureAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(
      ["_caption", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        (this.picture as Picture).caption = String(this.val[1],);
        return null;
      },
    );
    p.doc("caption.picture", "Caption shown under the picture.",);

    p.pattern(
      ["_align", "!pictureAlign",],
      function (this: ProjectFileParser,): unknown {
        (this.picture as Picture).align = this.val[1] as PictureAlign;
        return null;
      },
    );
    p.doc("align.picture", "Horizontal alignment of the picture.",);

    p.pattern(
      ["_width", "$INTEGER",],
      function (this: ProjectFileParser,): unknown {
        (this.picture as Picture).width = Number(this.val[1],);
        return null;
      },
    );
    p.doc("width.picture", "Display width of the picture in pixels.",);

    p.pattern(
      ["_alt", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        (this.picture as Picture).alt = String(this.val[1],);
        return null;
      },
    );
    p.doc("alt.picture", "Alternative text for the picture.",);
  },);

  rule(p, "pictureAlign", () => {
    p.pattern(["_left",], () => "left",);
    p.descr("Align picture to the left",);
    p.pattern(["_center",], () => "center",);
    p.descr("Align picture to the center",);
    p.pattern(["_right",], () => "right",);
    p.descr("Align picture to the right",);
  },);

  // ------------------------------------------------------------------
  // format markdown|richtext (default markdown em entries, richtext em reports)
  // ------------------------------------------------------------------
  rule(p, "format", () => {
    p.pattern(
      ["_format", "!formatKeyword",],
      function (this: ProjectFileParser,): unknown {
        applyFormat(this, this.val[1] as EntryFormat,);
        return null;
      },
    );
    p.doc(
      "format",
      "Selects the markup dialect of the body: markdown or richtext.",
    );
  },);

  rule(p, "formatKeyword", () => {
    p.pattern(["_markdown",], () => "markdown",);
    p.descr("Markdown format",);
    p.pattern(["_richtext",], () => "richtext",);
    p.descr("RichText format",);
  },);
}

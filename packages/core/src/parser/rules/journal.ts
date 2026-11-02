/**
 * TjpSyntaxRules — bloco picture/format (Fase 10 Complemento C3.3).
 *
 * `picture` e `format` são extensões SyntaxMesh anexadas a uma `journalentry`
 * ou a um `status` de timesheet/statussheet. `format` escolhe o dialeto do
 * corpo (`markdown` — default — ou `richtext`); `picture` registra uma imagem
 * (path + caption/align/width/alt). Ambos operam sobre `this.journalEntry`,
 * que as regras de journalentry (task.ts) e de status (tracking.ts) preenchem.
 *
 * Desde a Fase 14 Complemento (14C.5.1) a MESMA regra `format` também atende
 * ao escopo de **report** (header/footer/prolog/epilog/caption/…): o dialeto
 * lá é `richtext` por default, para preservar os `.tjp` existentes.
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

/** Entry corrente em processamento (journalentry ou status). */
const asEntry = (parser: ProjectFileParser,): JournalEntry | null =>
  (parser.journalEntry as JournalEntry | null) ?? null;

/**
 * Aplica `format <dialeto>` ao escopo corrente (mecanismo compartilhado entre
 * `journalentry`/`status` e `report`).
 *
 * O dialeto de um `report` é propagado aos atributos RichText já lidos pelo
 * parser (`applyReportFormat`), então `format` pode vir antes ou depois de
 * `header`/`footer`/… — a ordem dos atributos não importa em TJP.
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

/** Registra as regras de `picture` e `format`. */
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

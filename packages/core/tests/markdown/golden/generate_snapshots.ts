/**
 * Gerador de snapshots Markdown (Fase 13.12.1).
 *
 * Executa cada fixture pelo `MarkdownFactory` e congela as quatro saídas
 * (`to_s`, `to_html().toHTML()`, `to_tagged`, `to_markdown`). Para fixtures que
 * contêm handlers de função (`[[query:…]]`, `<-…->`) sem uma `Query` registrada,
 * `to_s`/`to_html` lançam — nesse caso os campos são omitidos e o teste só
 * valida `to_tagged` + `to_markdown`.
 *
 * Rodar: `deno run -A --no-check tests/markdown/golden/generate_snapshots.ts`
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown-tarefas.md (13.12)
 */

import { MarkdownFactory, } from "../../../src/markdown/factory.ts";

interface FixtureDef {
  name: string;
  group: string;
  input: string;
}

const FIXTURES: FixtureDef[] = [
  // 13.12.2 — Markdown simples (heading, paragraph, lists)
  { name: "heading", group: "simple", input: "# Hello", },
  { name: "paragraph", group: "simple", input: "Hello world", },
  { name: "bold", group: "simple", input: "This is **bold** text", },
  { name: "italic", group: "simple", input: "Some *emph*", },
  { name: "unordered-list", group: "simple", input: "- a\n- b", },
  { name: "ordered-list", group: "simple", input: "1. one\n2. two", },
  // 13.12.3 — Extensões (color, functions, mini-query)
  { name: "fontcol", group: "extensions", input: "<fcol:red>CAUTION</fcol>", },
  {
    name: "fontcol-mix",
    group: "extensions",
    input: "<fcol:green>OK</fcol> and `code`",
  },
  {
    name: "function-query",
    group: "extensions",
    input: "Effort: [[query:attribute=effort]]",
  },
  {
    name: "miniquery",
    group: "extensions",
    input: "Cost <-cost-> total",
  },
  {
    name: "fontcol-hex",
    group: "extensions",
    input: "<fcol:#ff0000>hex</fcol>",
  },
  // 13.12.4 — HTML inline (com sanitização)
  {
    name: "html-span",
    group: "html",
    input: "<span class='x'>hi</span>",
  },
  {
    name: "html-script-stripped",
    group: "html",
    input: "<script>alert(1)</script>ok",
  },
  {
    name: "html-iframe-stripped",
    group: "html",
    input: "<iframe src='http://e'></iframe>text",
  },
  {
    name: "html-event-stripped",
    group: "html",
    input: '<a href="http://x" onclick="evil()">link</a>',
  },
  {
    name: "html-raw-bold",
    group: "html",
    input: "<b>raw bold</b>",
  },
  // 13.12.5 — blockquotes, code blocks, imagens, links
  { name: "inline-code", group: "misc", input: "`code`", },
  { name: "code-block", group: "misc", input: "```\nx = 1\n```", },
  { name: "blockquote", group: "misc", input: "> quoted", },
  { name: "thematic-break", group: "misc", input: "a\n\n---\n\nb", },
  { name: "link", group: "misc", input: "[text](http://x.com)", },
  { name: "image", group: "misc", input: "![alt](img.png)", },
  {
    name: "image-external",
    group: "misc",
    input: "![logo](https://cdn.example.com/l.png)",
  },
  {
    name: "heading-blockquote",
    group: "misc",
    input: "# T\n\n> quote **bold**",
  },
];

interface Snapshot {
  name: string;
  group: string;
  input: string;
  to_tagged: string;
  to_markdown: string;
  to_s?: string;
  to_html?: string;
}

const factory = new MarkdownFactory(null,);
const snapshots: Snapshot[] = FIXTURES.map((fx,) => {
  const rti = factory.create(fx.input,);
  const snap: Snapshot = {
    name: fx.name,
    group: fx.group,
    input: fx.input,
    to_tagged: rti.to_tagged(),
    to_markdown: rti.to_markdown(),
  };
  // to_s / to_html só para fixtures sem handler de função pendente.
  try {
    snap.to_s = rti.to_s();
    const html = rti.to_html();
    snap.to_html = html ? html.toHTML() : null as unknown as string;
  } catch {
    // Query não registrada: omitir to_s/to_html.
  }
  return snap;
},);

const out = JSON.stringify(
  { generated_by: "generate_snapshots.ts", snapshots, },
  null,
  2,
);
Deno.writeTextFileSync(
  new URL("./markdown-snapshots.json", import.meta.url,).pathname,
  out + "\n",
);
console.log(`Wrote ${snapshots.length} snapshots.`,);

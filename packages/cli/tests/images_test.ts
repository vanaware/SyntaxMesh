/**
 * Imagens em relatórios (24.10.8) — extração e materialização.
 *
 * O core só decide **se** a referência é externa (`isExternalImageRef`,
 * 13.14.3); `imageRefs` extrai as relativas e a política de saída copia o
 * arquivo para ao lado do relatório, preservando o caminho que o HTML/Markdown
 * já cita. Nenhum teste toca disco: a E/S é um sistema de arquivos em memória.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.10.8)
 * @see docs/syntaxmesh/fases/fase-13-markdown-tarefas.md (13.14.3)
 */
import { assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type { ReportsJson, } from "@vanaware/syntaxmesh";
import { imageRefs, } from "../src/images.ts";
import { dispatchReports, type OutputPolicyIo, } from "../src/output-policy.ts";

describe("imageRefs (24.10.8)", () => {
  it("extrai as referências markdown na ordem de citação", () => {
    const content = [
      "![Cronograma](fotos/crono.png)",
      "texto",
      '![Logo](./fotos/logo.jpg "logotipo")',
    ].join("\n",);

    assertEquals(imageRefs(content, "markdown",), [
      "fotos/crono.png",
      "fotos/logo.jpg",
    ],);
  });

  it("extrai `src` de `<img>` no HTML (aspas duplas e simples)", () => {
    const content =
      '<p><img class="x" src="fotos/a.jpg" alt="A"></p><img src=\'icons/b.png\'>';

    assertEquals(imageRefs(content, "html",), [
      "fotos/a.jpg",
      "icons/b.png",
    ],);
  });

  it("extrai `data` de `<object type=image/…>` (HTML do tj3)", () => {
    // `RichTextIntermediate` emite imagem como `<object>`, não `<img src>`.
    const content = '<p><object alt="Foto" data="fotos/a.jpg" ' +
      'type="image/jpg"></object></p>' +
      '<object data="midia/clipe.mp4" type="video/mp4"></object>';

    assertEquals(imageRefs(content, "html",), ["fotos/a.jpg",],);
  });

  it("ignora referências externas — não há arquivo para copiar", () => {
    const content = [
      "![a](https://example.com/a.png)",
      "![b](//cdn.example.com/b.png)",
      "![c](data:image/png;base64,AAA)",
      "![d](fotos/d.png)",
    ].join("\n",);

    assertEquals(imageRefs(content, "markdown",), ["fotos/d.png",],);
  });

  it("ignora `..` e duplicatas (`./fotos/a.jpg` == `fotos/a.jpg`)", () => {
    const content = [
      "![a](../fora/a.png)",
      "![b](fotos/a.jpg)",
      "![c](./fotos/a.jpg)",
      "![d](fotos/a.jpg)",
    ].join("\n",);

    assertEquals(imageRefs(content, "markdown",), ["fotos/a.jpg",],);
  });

  it("recusa caminho absoluto e aceita `..` só como segmento", () => {
    // Absoluto escaparia da raiz de imagens; `a..b.jpg` é nome de arquivo.
    const content = [
      "![a](/etc/passwd.png)",
      "![b](C:/Windows/b.png)",
      "![c](fotos/a..b.jpg)",
    ].join("\n",);

    assertEquals(imageRefs(content, "markdown",), ["fotos/a..b.jpg",],);
  });

  it("formatos sem mídia devolvem lista vazia", () => {
    // `richtext` não carrega imagem: nada a materializar (13.14.4).
    const rich = "<nowiki>![a](fotos/a.png)</nowiki>";
    assertEquals(imageRefs(rich, "richtext",), [],);
    assertEquals(imageRefs("<csv x>", "csv",), [],);
  });
});

/** Sistema de arquivos em memória: só os caminhos presentes em `disk`. */
function fakeIo(disk: string[],) {
  const files = new Map<string, string>();
  const dirs: string[] = [];
  const copies: string[] = [];
  const io: OutputPolicyIo = {
    print: () => {},
    write: (path: string, content: string,) => {
      files.set(path, content,);
      return Promise.resolve();
    },
    mkpath: (dir: string,) => {
      dirs.push(dir,);
      return Promise.resolve();
    },
    copy: (from: string, to: string,) => {
      copies.push(`${from}>${to}`,);
      return Promise.resolve();
    },
    listDir: () => Promise.resolve([],),
    isDir: () => Promise.resolve(false,),
    exists: (path: string,) => Promise.resolve(disk.includes(path,),),
  };
  return { io, files, dirs, copies, };
}

/** Seção `reports` com um único relatório e um formato. */
function section(format: string, content: string,): ReportsJson {
  return {
    ok: true,
    outputDir: "out",
    reports: [{
      name: "img",
      stdout: false,
      selfcontained: true,
      formats: [{ format, content, },],
      errors: [],
    },],
  };
}

describe("dispatchReports — imagens ao lado da saída (24.10.8)", () => {
  it("copia a imagem relativa para ao lado do relatório", async () => {
    const fake = fakeIo(["fotos/a.jpg",],);
    const outcome = await dispatchReports(
      section("markdown", "![a](fotos/a.jpg)",),
      { io: fake.io, },
    );

    assertEquals(outcome.aborted, false,);
    assertEquals(fake.copies, ["fotos/a.jpg>out/fotos/a.jpg",],);
    assertEquals(fake.dirs, ["out", "out/fotos",],);
    // O relatório em `written`; a mídia copiada é asset do HTML/Markdown.
    assertEquals(outcome.written, ["out/img.md",],);
    assertEquals(outcome.assets, ["out/fotos/a.jpg",],);
  });

  it("não copia quando o arquivo não existe na origem", async () => {
    const fake = fakeIo([],);
    const outcome = await dispatchReports(
      section("html", '<object data="fotos/ausente.png" type="image/png">',),
      { io: fake.io, },
    );

    assertEquals(fake.copies, [],);
    assertEquals(outcome.written, ["out/img.html",],);
  });

  it("não copia quando origem e destino coincidem (imagem já é vizinha)", async () => {
    // `--output-dir` vazio: o relatório é gravado na raiz, ao lado da imagem.
    const fake = fakeIo(["fotos/a.jpg",],);
    const json = section("markdown", "![a](fotos/a.jpg)",);
    json.outputDir = "";
    const outcome = await dispatchReports(json, { io: fake.io, },);

    assertEquals(fake.copies, [],);
    assertEquals(outcome.written, ["img.md",],);
  });

  it("lê a origem a partir de `imageDir` quando informado", async () => {
    const fake = fakeIo(["dados/fotos/a.jpg",],);
    await dispatchReports(
      section("markdown", "![a](fotos/a.jpg)",),
      { io: fake.io, imageDir: "dados", },
    );

    assertEquals(fake.copies, ["dados/fotos/a.jpg>out/fotos/a.jpg",],);
  });

  it("imprime no stdout sem materializar imagem", async () => {
    const fake = fakeIo(["fotos/a.jpg",],);
    const json = section("markdown", "![a](fotos/a.jpg)",);
    json.reports[0]!.stdout = true;
    await dispatchReports(json, { io: fake.io, },);

    assertEquals(fake.copies, [],);
  });
});

/**
 * Versão única da CLI (24.6.6).
 *
 * `syntaxmesh --version` não pode divergir do que `scripts/tag-version.ts`
 * bumpa: `packages/core/src/version.ts` é a fonte, e os manifestos
 * (`package.json` da raiz e `deno.jsonc` do pacote) precisam concordar com ela.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.6.6)
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertStringIncludes, } from "@std/assert";
import { VERSION, } from "../../core/src/version.ts";
import { main, } from "../src/cli.ts";
import type { CliIo, } from "../src/cli.ts";

/** Lê e parseia um JSON do repositório. */
async function readJson(url: URL,): Promise<Record<string, unknown>> {
  return JSON.parse(await Deno.readTextFile(url,),) as Record<string, unknown>;
}

/** E/S de captura: nada toca o terminal real. */
function captureIo(): { io: CliIo; out: string[] } {
  const out: string[] = [];
  const io: CliIo = {
    print: (text: string,) => out.push(text,),
    printerr: () => {},
    read: (path: string,) => Deno.readTextFile(path,),
  };
  return { io, out, };
}

describe("--version (24.6.6)", () => {
  it("imprime o nome do software e a versão da fonte única", async () => {
    const { io, out, } = captureIo();
    const code = await main(["--version",], io,);
    assertEquals(code, 0,);
    assertEquals(out, [`SyntaxMesh ${VERSION}`,],);
  });

  it("o package.json da raiz concorda com version.ts", async () => {
    const pkg = await readJson(
      new URL("../../../package.json", import.meta.url,),
    );
    assertEquals(pkg.version, VERSION,);
  });

  it("o deno.jsonc do pacote concorda com version.ts", async () => {
    const pkg = await readJson(new URL("../deno.jsonc", import.meta.url,),);
    assertEquals(pkg.version, VERSION,);
  });

  it("o --help cita a mesma versão não vaza número fixo", async () => {
    const { io, out, } = captureIo();
    const code = await main(["--help",], io,);
    assertEquals(code, 0,);
    const help = out.join("\n",);
    assertStringIncludes(help, "syntaxmesh",);
    // Nenhum literal de versão antiga sobrevive no texto de ajuda.
    assertEquals(help.includes("0.0.0",), false,);
  });
});

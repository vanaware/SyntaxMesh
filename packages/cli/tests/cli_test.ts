/**
 * Testes do fluxo único da CLI (24.3.5/24.3.6/24.3.11/24.3.12/24.3.16).
 *
 * Tudo roda in-process: a E/S é injetada (leitor em memória + writers de
 * captura), então nenhum teste toca disco, terminal ou processo. O subprocesso
 * fica em `cli.integration_test.ts` (24.3.13).
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.3)
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { VERSION, } from "../../core/src/version.ts";
import { collectInputFiles, helpText, main, } from "../src/cli.ts";

/** Cabeçalho de projeto válido para os fixtures em memória. */
const HEADER = 'project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {\n';

/** Corpo que agenda limpo: recurso alocado na única tarefa. */
const BODY =
  'resource dev "Dev"\ntask t1 "T1" { effort 2d\n  allocate dev\n}\n';

/** Leitor em memória: caminho ausente rejeita como `ENOENT`. */
function memoryReader(
  files: Record<string, string>,
): (path: string,) => Promise<string> {
  return (path: string,) =>
    Object.hasOwn(files, path,)
      ? Promise.resolve(files[path]!,)
      : Promise.reject(new Error(`ENOENT: ${path}`,),);
}

/** Saída capturada de uma execução de `main`. */
interface Captured {
  exit: number;
  out: string[];
  err: string[];
}

/** Roda `main` com E/S injetada. */
async function run(
  argv: string[],
  files: Record<string, string> = {},
): Promise<Captured> {
  const out: string[] = [];
  const err: string[] = [];
  const exit = await main(argv, {
    read: memoryReader(files,),
    print: (text: string,) => out.push(text,),
    printerr: (text: string,) => err.push(text,),
  },);
  return { exit, out, err, };
}

describe("collectInputFiles (24.3.6)", () => {
  it("normaliza o caminho do master", async () => {
    const closure = await collectInputFiles(
      "./proj.smx",
      memoryReader({ "proj.smx": HEADER, },),
    );
    assertEquals(closure.files.map((file,) => file.path), ["proj.smx",],);
    assertEquals(closure.missing, [],);
  });

  it("fecha includes aninhados resolvidos a partir do pai", async () => {
    const closure = await collectInputFiles(
      "dir/proj.smx",
      memoryReader({
        "dir/proj.smx": `${HEADER}}\ninclude "common.tji"\n`,
        "dir/common.tji": 'include "sub/extra.tji"\n',
        "dir/sub/extra.tji": 'task t1 "T1" { effort 2d }\n',
      },),
    );
    assertEquals(
      closure.files.map((file,) => file.path),
      ["dir/proj.smx", "dir/common.tji", "dir/sub/extra.tji",],
    );
  });

  it("registra include ausente sem interromper a leitura", async () => {
    const closure = await collectInputFiles(
      "proj.smx",
      memoryReader({ "proj.smx": `${HEADER}}\ninclude "missing.tji"\n`, },),
    );
    // `include` do próprio diretório do master.
    assertEquals(closure.files.map((file,) => file.path), ["proj.smx",],);
    assertEquals(closure.missing, ["missing.tji",],);
  });

  it("não repete arquivos em ciclo de includes", async () => {
    const closure = await collectInputFiles(
      "a.smx",
      memoryReader({
        "a.smx": 'include "b.tji"\n',
        "b.tji": 'include "a.smx"\n',
      },),
    );
    assertEquals(closure.files.map((file,) => file.path), ["a.smx", "b.tji",],);
  });

  it("master ausente devolve lista vazia", async () => {
    const closure = await collectInputFiles("nope.smx", memoryReader({},),);
    assertEquals(closure.files, [],);
    assertEquals(closure.missing, ["nope.smx",],);
  });
});

describe("main — fluxo único (24.3.6)", () => {
  it("projeto válido com include termina em 0", async () => {
    const result = await run(["proj.smx", "--check-syntax",], {
      "proj.smx": `${HEADER}}\ninclude "common.tji"\n`,
      "common.tji": 'task t1 "T1" { effort 2d }\n',
    },);
    assertEquals(result.exit, 0,);
    // Seção pedida em stdout; mensagens e resumo ficam no reporter.
    assertEquals(result.out[0], "Syntax check passed.",);
  });

  it("projeto inválido termina em 1 com mensagem do core em stderr", async () => {
    const result = await run(["proj.smx",], {
      "proj.smx": "not a project\n",
    },);
    assertEquals(result.exit, 1,);
    // `Message#to_s` do Ruby: `arquivo:linha: Tipo: texto`.
    assert(
      result.err.some((line,) => line.startsWith("proj.smx:1: Error: ",)),
    );
    assertEquals(result.err.at(-1,), "1 error, 0 warnings",);
    // Sem projeto carregado não há resumo.
    assertEquals(result.out, [],);
  });

  it("projeto válido imprime o resumo do projeto em stdout", async () => {
    const result = await run(["proj.smx",], {
      "proj.smx": `${HEADER}}\n${BODY}`,
    },);
    assertEquals(result.exit, 0,);
    assertEquals(result.out[0], 'Project prj "Test" v1.0',);
    assert(result.out.includes("  tasks: 1, resources: 1, accounts: 0",),);
    assert(result.out.some((line,) => line.startsWith("  cost: ",)),);
  });

  it("master inexistente falha antes do execute", async () => {
    const result = await run(["nope.smx",],);
    assertEquals(result.exit, 1,);
    assertEquals(result.err, ["Cannot open file 'nope.smx'.",],);
  });

  it("--version responde sem projeto", async () => {
    const result = await run(["--version",],);
    assertEquals(result.exit, 0,);
    assertEquals(result.out, [`SyntaxMesh ${VERSION}`,],);
  });

  it("--help imprime a ajuda do Cliffy sem ANSI", async () => {
    const result = await run(["--help",],);
    assertEquals(result.exit, 0,);
    assert(result.out.join("\n",).includes("Usage:",),);
    assertEquals(result.out.join("\n",).includes("\u001b",), false,);
  });

  it("erro de uso sai em 1 com dica de ajuda", async () => {
    const result = await run(["proj.smx", "--nope",], { "proj.smx": HEADER, },);
    assertEquals(result.exit, 1,);
    assertEquals(result.err, [
      "Unknown option '--nope'.",
      "Try 'syntaxmesh --help' for more information.",
    ],);
  });

  it("--config lê o YAML e avisa que a aplicação está pendente (24.3.11)", async () => {
    const result = await run(
      ["proj.smx", "--check-syntax", "--config", "tj3.conf",],
      {
        "proj.smx": `${HEADER}}\n${BODY}`,
        "tj3.conf": "reports:\n  - plan\n",
      },
    );
    assertEquals(result.exit, 0,);
    assert(result.err.some((line,) => line.includes("not applied yet",)),);
  });

  it("--silent esconde info e resumo, mantendo erros (24.3.12/24.4.7)", async () => {
    const valid = `${HEADER}}\n${BODY}`;
    const noisy = await run(["proj.smx",], { "proj.smx": valid, },);
    const quiet = await run(["proj.smx", "--silent",], { "proj.smx": valid, },);
    assertEquals(quiet.exit, 0,);
    // O resumo é apresentação: some com `--silent`.
    assert(noisy.out.length > 0,);
    assertEquals(quiet.out, [],);
    // Ruby: `--silent` cala info/debug; avisos e erros continuam.
    assertEquals(
      quiet.err.some((line,) => line.startsWith("Info: ",)),
      false,
    );
    assert(quiet.err.some((line,) => line.includes("Warning: ",)),);
  });
});

describe("English-first (24.3.16)", () => {
  it("a ajuda humana é ASCII (sem texto traduzido)", async () => {
    const text = await helpText();
    assertEquals(
      /^[\x20-\x7E\n\t]*$/.test(text,),
      true,
      "unexpected non-ASCII character in --help",
    );
  });

  it("erros de argv e de flag adiada são ASCII", async () => {
    const deferred = await run(["proj.smx", "--freeze",],);
    const unknown = await run(["proj.smx", "--nope",],);
    for (const line of [...deferred.err, ...unknown.err,]) {
      assertEquals(/^[\x20-\x7E]*$/.test(line,), true, line,);
    }
    assertEquals(
      deferred.err[0],
      "Option '--freeze' is not yet available (phase 24.9).",
    );
  });
});

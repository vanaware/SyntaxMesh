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
import { MessageHandlerInstance, VERSION, } from "@vanaware/syntaxmesh";
import {
  type CliIo,
  collectInputFiles,
  collectSheetFiles,
  helpText,
  main,
} from "../src/cli.ts";

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

/** Roda `main` com E/S injetada.
 *
 * `extra` cobre as leituras opcionais do `CliIo` (`--from -` e a varredura das
 * árvores de folhas), que só existem quando o argv as pede.
 */
async function run(
  argv: string[],
  files: Record<string, string> = {},
  extra: Partial<Pick<CliIo, "readStdin" | "listDir" | "isDir">> = {},
): Promise<Captured> {
  const out: string[] = [];
  const err: string[] = [];
  const exit = await main(argv, {
    read: memoryReader(files,),
    print: (text: string,) => out.push(text,),
    printerr: (text: string,) => err.push(text,),
    ...extra,
  },);
  return { exit, out, err, };
}

/**
 * E/S em memória para uma árvore de arquivos **com diretórios**.
 *
 * `collectSheetFiles` precisa distinguir arquivo de diretório, então o `read`
 * aceita exatamente as chaves do mapa e o `isDir` só os prefixos declarados.
 */
function treeIo(tree: Record<string, string>,): CliIo {
  const dirs = new Set<string>(["",],);
  for (const path of Object.keys(tree,)) {
    const parts = path.split("/",);
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i,).join("/",),);
    }
  }
  return {
    read: memoryReader(tree,),
    print: () => {},
    printerr: () => {},
    listDir: (path: string,) => {
      const prefix = path === "" ? "" : `${path}/`;
      const names = new Set<string>();
      for (const file of Object.keys(tree,)) {
        if (!file.startsWith(prefix,)) continue;
        names.add(file.slice(prefix.length,).split("/",)[0]!,);
      }
      if (names.size === 0) {
        return Promise.reject(new Error(`ENOENT: ${path}`,),);
      }
      return Promise.resolve([...names,],);
    },
    isDir: (path: string,) => Promise.resolve(dirs.has(path,),),
  };
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

describe("collectSheetFiles (24.10)", () => {
  it("varre as quatro árvores com caminhos relativos à raiz", async () => {
    const files = await collectSheetFiles(
      "work",
      treeIo({
        "work/TimeSheets/2026-05-18/dev.tji": "timesheet dev\n",
        "work/TimeSheetTemplates/week.tji": "timesheet dev\n",
        "work/StatusSheets/2026-05-18/dev.tji": "status dev\n",
        "work/StatusSheetTemplates/week.tji": "status dev\n",
        // Fora das árvores conhecidas: nunca entra no seed.
        "work/outros/ignore.tji": "x\n",
      },),
    );
    assertEquals(files.map((file,) => file.path).sort(), [
      "StatusSheetTemplates/week.tji",
      "StatusSheets/2026-05-18/dev.tji",
      "TimeSheetTemplates/week.tji",
      "TimeSheets/2026-05-18/dev.tji",
    ],);
    assertEquals(
      files.find((file,) => file.path === "TimeSheets/2026-05-18/dev.tji")
        ?.content,
      "timesheet dev\n",
    );
  });

  it("raiz ausente devolve lista vazia, sem inventar dado", async () => {
    assertEquals(await collectSheetFiles("nope", treeIo({},),), [],);
  });

  it("arquivo ilegível fica fora do seed", async () => {
    const io = treeIo({
      "TimeSheets/a.tji": "a\n",
      "TimeSheets/b.tji": "b\n",
    },);
    const files = await collectSheetFiles("", {
      ...io,
      read: (path: string,) =>
        path.endsWith("b.tji",)
          ? Promise.reject(new Error("EACCES",),)
          : io.read(path,),
    },);
    assertEquals(files.map((file,) => file.path), ["TimeSheets/a.tji",],);
  });
});

describe("main — leituras pedidas pelo argv (24.10)", () => {
  it("--from - lê a mensagem do stdin", async () => {
    let reads = 0;
    const result = await run(["ts", "receive", "--from", "-", "proj.smx",], {
      "proj.smx": `${HEADER}}\n${BODY}`,
    }, {
      readStdin: () => {
        reads++;
        return Promise.resolve(
          "From: dev@example.com\nSubject: sheet\n\nbody\n",
        );
      },
    },);
    assertEquals(reads, 1,);
    assertEquals(
      result.err.some((line,) => line.includes("Cannot read the email",)),
      false,
    );
  });

  it("--from - sem stdin termina em 1 com mensagem própria", async () => {
    const result = await run(["ts", "receive", "--from", "-", "proj.smx",], {
      "proj.smx": `${HEADER}}\n${BODY}`,
    }, {
      readStdin: () => Promise.reject(new Error("no stdin",),),
    },);
    assertEquals(result.exit, 1,);
    assertEquals(result.err, [
      "Cannot read the email message from '-'.",
    ],);
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

  it("--version sai antes de abrir o master (Ruby on_tail)", async () => {
    // Com arquivo na linha de comando o nome nem precisa existir.
    const result = await run(["--version", "nope.smx",],);
    assertEquals(result.exit, 0,);
    assertEquals(result.out, [`SyntaxMesh ${VERSION}`,],);
    assertEquals(result.err, [],);
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

  it("--config aplica _global / _global._log ao MessageHandlerInstance (24.3.11)", async () => {
    // Ruby `Tj3Daemon` lê o YAML e configura `MessageHandlerInstance` com as
    // seções `_global` e `_global._log`. Antes da F21 1ª onda isto era um stub
    // que emitia `Warning: ... not applied yet`; a CLI agora faz o apply real.
    const mhi = MessageHandlerInstance.instance;
    mhi.reset();
    try {
      const result = await run(
        ["proj.smx", "--check-syntax", "--config", "tj3.conf",],
        {
          "proj.smx": `${HEADER}}\n${BODY}`,
          "tj3.conf":
            "_global:\n  hideScenario: true\n  _log:\n    logFile: /tmp/tj.conf.log\n",
        },
      );
      assertEquals(result.exit, 0,);
      // Nenhum aviso de pendência na stderr.
      assertEquals(
        result.err.some((line,) => line.includes("not applied yet",)),
        false,
      );
      // O YAML foi realmente aplicado no handler compartilhado.
      assertEquals(mhi.hideScenario, true,);
      assertEquals(mhi.logFile, "/tmp/tj.conf.log",);
    } finally {
      mhi.reset();
    }
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
    const deferred = await run(["proj.smx", "--debug",],);
    const unknown = await run(["proj.smx", "--nope",],);
    for (const line of [...deferred.err, ...unknown.err,]) {
      assertEquals(/^[\x20-\x7E]*$/.test(line,), true, line,);
    }
    assertEquals(
      deferred.err[0],
      "Option '--debug' is not yet available (no equivalent in the port).",
    );
  });
});

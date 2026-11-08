/**
 * Integração por **subprocesso** da CLI (24.3.13/24.4.8/24.5).
 *
 * Roda `deno run src/cli.ts` de verdade — argv, `exit` e leitura de disco
 * entram pelo caminho de produção, sem E/S injetada. As fixtures válidas usam
 * as MWEs e a TestSuite do repositório; as demais são escritas num diretório
 * temporário.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.3.13/24.4.8/24.5)
 */
import { afterAll, beforeAll, describe, it, } from "@std/testing/bdd";
import { assertEquals, assertStringIncludes, } from "@std/assert";
import { join, } from "node:path";

/** `src/cli.ts` do pacote, independente do cwd do runner. */
const CLI = new URL("../src/cli.ts", import.meta.url,);
/** Raiz das fixtures do repositório. */
const DOCS = new URL("../../../docs/", import.meta.url,).pathname;
/** Fixture válida do repositório. */
const MWE001 = `${DOCS}Learning/mwe001/tutorial.tjp`;
/** TestSuite do TaskJuggler Ruby (corpus da regra zero). */
const TESTSUITE = `${DOCS}taskjuggler/test/TestSuite/`;

/** Resultado de uma execução real da CLI. */
interface CliRun {
  code: number;
  out: string;
  err: string;
}

/** Executa a CLI com os argumentos dados.
 *
 * `cwd` fica **fora** do pacote por default: sem `--output-dir` a política
 * grava no diretório corrente, e um teste nunca deve sujar o repositório.
 */
async function runCli(argv: string[], cwd = workDir,): Promise<CliRun> {
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      CLI.pathname,
      ...argv,
    ],
    cwd,
    stdout: "piped",
    stderr: "piped",
  },);
  const output = await command.output();
  const decoder = new TextDecoder();
  return {
    code: output.code,
    out: decoder.decode(output.stdout,),
    err: decoder.decode(output.stderr,),
  };
}

/** Diretório temporário dos fixtures desta suíte. */
let tempDir: string;
/** Diretório corrente de todas as execuções (nunca o pacote). */
let workDir: string;

/** Cabeçalho de projeto compartilhado pelas fixtures em `.smx`. */
const HEADER = 'project prj "Cli" "1.0" 2026-01-01 - 2026-12-31 {\n';
/** Corpo com recurso alocado: agenda limpa e relatório não vazio. */
const BODY =
  'resource dev "Dev"\ntask t1 "T1" { effort 2d\n  allocate dev\n}\n';

beforeAll(async () => {
  tempDir = await Deno.makeTempDir({ prefix: "syntaxmesh-cli-", },);
  workDir = await Deno.makeTempDir({ prefix: "syntaxmesh-cwd-", },);
  await Deno.writeTextFile(
    join(tempDir, "bad.smx",),
    "this is not a project\n",
  );
  await Deno.writeTextFile(
    join(tempDir, "common.tji",),
    'task t1 "T1" { effort 2d }\n',
  );
  await Deno.writeTextFile(
    join(tempDir, "proj.smx",),
    'project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {\n}\n' +
      'include "common.tji"\n',
  );
  // Relatórios mistos: um para arquivo, um para o terminal (24.5.6).
  await Deno.writeTextFile(
    join(tempDir, "mixed.smx",),
    `${HEADER}}\n${BODY}
` +
      'taskreport "Tarefas" {\n  formats csv\n  columns name, start, end\n}\n' +
      'taskreport "Console" stdout {\n  formats csv\n  columns name\n}\n',
  );
  // Formato inexistente: o parser recusa antes de qualquer geração (24.5.15).
  await Deno.writeTextFile(
    join(tempDir, "badformat.smx",),
    `${HEADER}}\n${BODY}\n` +
      'taskreport "Tarefas" {\n  formats xls\n  columns name\n}\n',
  );
  // Fechamento de `include` em 2 níveis (24.5.10).
  await Deno.mkdir(join(tempDir, "inc",), { recursive: true, },);
  await Deno.writeTextFile(
    join(tempDir, "inc", "top.smx",),
    `${HEADER}}\ninclude "mid.tji"\n` +
      'taskreport "Incluido" {\n  formats csv\n  columns name\n}\n',
  );
  await Deno.writeTextFile(
    join(tempDir, "inc", "mid.tji",),
    'resource dev "Dev"\ninclude "sub/deep.tji"\n',
  );
  await Deno.mkdir(join(tempDir, "inc", "sub",), { recursive: true, },);
  await Deno.writeTextFile(
    join(tempDir, "inc", "sub", "deep.tji",),
    'task t9 "Nove" { effort 2d\n  allocate dev\n}\n',
  );
},);

afterAll(async () => {
  await Deno.remove(tempDir, { recursive: true, },);
  await Deno.remove(workDir, { recursive: true, },);
},);

describe("cli.integration (24.3.13/24.4.8)", () => {
  it("fixture válida (mwe001) termina em 0 com resumo do projeto", async () => {
    const result = await runCli([MWE001,],);
    assertEquals(result.code, 0, result.out + result.err,);
    // Resumo do projeto em stdout (24.4.5): identidade + contagens.
    assertStringIncludes(result.out, 'Project prj "My First Project"',);
    assertStringIncludes(result.out, "tasks: ",);
  });

  it("fixture inválida termina em 1 com erro de parse em stderr", async () => {
    const result = await runCli([join(tempDir, "bad.smx",),],);
    assertEquals(result.code, 1,);
    // Mensagens vão para stderr com a localização (24.4.1/24.4.2).
    assertStringIncludes(result.err, "bad.smx:1: Error: ",);
    assertStringIncludes(result.err, "1 error, 0 warnings",);
    assertEquals(result.out, "",);
  });

  it("master .smx com include monta o fechamento e passa no --check-syntax", async () => {
    const result = await runCli([
      join(tempDir, "proj.smx",),
      "--check-syntax",
    ],);
    assertEquals(result.code, 0, result.out + result.err,);
    assertStringIncludes(result.out, "Syntax check passed.",);
  });

  it("--version não exige arquivo", async () => {
    const result = await runCli(["--version",],);
    assertEquals(result.code, 0,);
    assertStringIncludes(result.out, "SyntaxMesh",);
  });
});

/** Cria um diretório de saída temporário e o devolve. */
function outputDir(): string {
  return Deno.makeTempDirSync({ prefix: "syntaxmesh-out-", },);
}

/** Nomes dos arquivos diretamente no diretório (não recursivo). */
function filesIn(dir: string,): string[] {
  return [...Deno.readDirSync(dir,),].filter((item,) => item.isFile).map((
    item,
  ) => item.name).sort();
}

describe("output policy — matriz de fixtures (24.5.7)", () => {
  for (const mwe of [1, 2, 3, 5, 6, 7, 8, 9,]) {
    it(`mwe00${mwe} executa e grava relatórios em --output-dir`, async () => {
      const out = outputDir();
      const result = await runCli([
        `${DOCS}Learning/mwe00${mwe}/tutorial.tjp`,
        "--output-dir",
        out,
      ],);
      try {
        assertEquals(result.code, 0, result.out + result.err,);
        assertEquals(
          filesIn(out,).length > 0,
          true,
          "nenhum relatório gravado",
        );
      } finally {
        Deno.removeSync(out, { recursive: true, },);
      }
    });
  }

  // Divergência do **core**, não da CLI: `deliveries.start` (marco fixado no
  // início do projeto) é comparado com o início do pai e acusa "antes" com a
  // mesma data impressa. Triagem da 1ª onda da Fase 21 (golden × tj3).
  it.ignore("mwe004 executa (divergência do scheduler: task_start_in_parent)", async () => {
    const out = outputDir();
    const result = await runCli([
      `${DOCS}Learning/mwe004/tutorial.tjp`,
      "--output-dir",
      out,
    ],);
    Deno.removeSync(out, { recursive: true, },);
    assertEquals(result.code, 0, result.err,);
  });
});

describe("output policy — matriz de erros (24.5.8)", () => {
  const fixtures = [
    "Syntax/Errors/adopt_self.tjp",
    "Syntax/Errors/bad_include.tjp",
    "Syntax/Errors/bad_time_zone.tjp",
    "Syntax/Errors/adopt_duplicate_child-1.tjp",
    "Syntax/Errors/alert_name_redef.tjp",
  ];

  for (const fixture of fixtures) {
    it(`${fixture} termina em 1 sem saída parcial`, async () => {
      const out = outputDir();
      const result = await runCli([
        `${TESTSUITE}${fixture}`,
        "--output-dir",
        out,
      ],);
      try {
        assertEquals(result.code, 1,);
        assertStringIncludes(result.err, "Error: ",);
        assertEquals(result.out, "",);
        assertEquals(filesIn(out,), [],);
      } finally {
        Deno.removeSync(out, { recursive: true, },);
      }
    });
  }
});

describe("output policy — matriz de agenda correta (24.5.9)", () => {
  const fixtures = [
    "Scheduler/Correct/Allocate.tjp",
    "Scheduler/Correct/Container.tjp",
    "Scheduler/Correct/DateAndDep.tjp",
    "Scheduler/Correct/Booking.tjp",
    "Scheduler/Correct/Container-2.tjp",
  ];

  for (const fixture of fixtures) {
    it(`${fixture} termina em 0`, async () => {
      const out = outputDir();
      const result = await runCli([
        `${TESTSUITE}${fixture}`,
        "--output-dir",
        out,
      ],);
      try {
        assertEquals(result.code, 0, result.err,);
      } finally {
        Deno.removeSync(out, { recursive: true, },);
      }
    });
  }
});

describe("output policy — ponta a ponta (24.5.6/24.5.10–24.5.16)", () => {
  it("relatórios mistos: terminal com delimitador + arquivo", async () => {
    const out = outputDir();
    const result = await runCli([
      join(tempDir, "mixed.smx",),
      "--output-dir",
      out,
    ],);
    try {
      assertEquals(result.code, 0, result.err,);
      assertStringIncludes(result.out, "--- Console [csv] ---",);
      assertEquals(filesIn(out,), ["Tarefas.csv",],);
    } finally {
      Deno.removeSync(out, { recursive: true, },);
    }
  });

  it("include em 2 níveis: o relatório enxerga a tarefa do neto", async () => {
    const out = outputDir();
    const result = await runCli([
      join(tempDir, "inc", "top.smx",),
      "--output-dir",
      out,
    ],);
    try {
      assertEquals(result.code, 0, result.err,);
      const csv = Deno.readTextFileSync(join(out, "Incluido.csv",),);
      assertStringIncludes(csv, "Nove",);
    } finally {
      Deno.removeSync(out, { recursive: true, },);
    }
  });

  it("--no-reports agenda sem gravar nem imprimir", async () => {
    const out = outputDir();
    const result = await runCli([
      join(tempDir, "mixed.smx",),
      "--output-dir",
      out,
      "--no-reports",
    ],);
    try {
      assertEquals(result.code, 0, result.err,);
      assertEquals(filesIn(out,), [],);
      assertEquals(result.out.includes("--- ",), false,);
    } finally {
      Deno.removeSync(out, { recursive: true, },);
    }
  });

  it("--force-reports gera apesar do erro de agenda", async () => {
    const out = outputDir();
    const result = await runCli([
      `${DOCS}Learning/mwe004/tutorial.tjp`,
      "--output-dir",
      out,
      "--force-reports",
    ],);
    try {
      // O exit continua 1 (o erro existe), mas os artefatos saem.
      assertEquals(result.code, 1,);
      assertEquals(filesIn(out,).length > 0, true,);
    } finally {
      Deno.removeSync(out, { recursive: true, },);
    }
  });

  it("--reports filtra por id e --list-reports enumera", async () => {
    const out = outputDir();
    try {
      const filtered = await runCli([
        join(tempDir, "mixed.smx",),
        "--output-dir",
        out,
        "--reports",
        "report1",
      ],);
      assertEquals(filtered.code, 0, filtered.err,);
      assertEquals(filesIn(out,), ["Tarefas.csv",],);
      assertEquals(filtered.out.includes("--- Console",), false,);

      const listed = await runCli([
        join(tempDir, "mixed.smx",),
        "--list-reports",
        ".*",
      ],);
      assertEquals(listed.code, 0, listed.err,);
      assertStringIncludes(listed.out, "Tarefas (taskreport)",);
      assertStringIncludes(listed.out, "Console (taskreport)",);
    } finally {
      Deno.removeSync(out, { recursive: true, },);
    }
  });

  it("idempotência: duas execuções geram o mesmo conteúdo", async () => {
    const out = outputDir();
    const argv = [join(tempDir, "mixed.smx",), "--output-dir", out,];
    try {
      await runCli(argv,);
      const first = Deno.readTextFileSync(join(out, "Tarefas.csv",),);
      await runCli(argv,);
      const second = Deno.readTextFileSync(join(out, "Tarefas.csv",),);
      assertEquals(second, first,);
    } finally {
      Deno.removeSync(out, { recursive: true, },);
    }
  });

  it("sem --output-dir grava no diretório corrente (default do tj3)", async () => {
    const cwd = outputDir();
    try {
      const result = await runCli([join(tempDir, "mixed.smx",),], cwd,);
      assertEquals(result.code, 0, result.err,);
      assertEquals(filesIn(cwd,), ["Tarefas.csv",],);
    } finally {
      Deno.removeSync(cwd, { recursive: true, },);
    }
  });

  it("formato desconhecido: exit 1, stdout vazio e nenhum arquivo", async () => {
    const out = outputDir();
    const result = await runCli([
      join(tempDir, "badformat.smx",),
      "--output-dir",
      out,
    ],);
    try {
      assertEquals(result.code, 1,);
      assertEquals(result.out, "",);
      assertStringIncludes(result.err, "Unexpected token 'xls'",);
      assertStringIncludes(result.err, "badformat.smx:",);
      assertEquals(filesIn(out,), [],);
    } finally {
      Deno.removeSync(out, { recursive: true, },);
    }
  });

  it("html não-selfcontained copia css/ e icons/ para o output-dir", async () => {
    const out = outputDir();
    const result = await runCli([MWE001, "--output-dir", out,],);
    try {
      assertEquals(result.code, 0, result.err,);
      assertEquals(
        Deno.statSync(join(out, "css", "tjreport.css",),).isFile,
        true,
      );
      assertEquals(
        Deno.statSync(join(out, "icons", "task.png",),).isFile,
        true,
      );
    } finally {
      Deno.removeSync(out, { recursive: true, },);
    }
  });

  it("template da F23 renderiza pela CLI e sai 0 (23.7.7)", async () => {
    // `template` é extensão SyntaxMesh (ADR 033), logo não há oracle Ruby: o
    // smoke só prova que a expansão sobrevive ao caminho completo da CLI. A
    // fixture `basic.tjp` não serve — as tasks dela têm `effort` sem
    // `allocate`, então o scheduler erra **de propósito** (`Task t1 has an
    // effort but no resource allocations`). `reports.tjp` usa o mesmo
    // `template` e agenda limpo.
    const cwd = outputDir();
    const fixture = new URL(
      "../../core/tests/fixtures/templates/reports.tjp",
      import.meta.url,
    ).pathname;
    try {
      const result = await runCli([fixture, "--no-reports",], cwd,);
      assertEquals(result.code, 0, result.err,);
      assertStringIncludes(result.out, "Template Reports",);
      assertEquals(filesIn(cwd,), [],);
    } finally {
      Deno.removeSync(cwd, { recursive: true, },);
    }
  });
});

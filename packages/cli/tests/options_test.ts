/**
 * Testes de `parseArgs`/`resolveExit` (24.3.1–24.3.12).
 *
 * `parseArgs` é pura: nenhum teste aqui toca processo, disco ou terminal. O
 * mapa de flags segue o plano §5.2 e as duas famílias fora do request
 * (`--silent`/`--no-color` → renderer; `--config` → caminho a ler) têm
 * asserção própria.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli.md §5.2
 */
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { CliUsageError, parseArgs, resolveExit, } from "../src/options.ts";

/** Mensagem do erro de uso lançado por `argv`. */
function usageMessage(argv: string[],): string {
  const error = assertThrows(() => parseArgs(argv,), CliUsageError,);
  return error.message;
}

describe("parseArgs — posicional e flags booleanas (24.3.1/24.3.2)", () => {
  it("mapeia o arquivo posicional para entry", () => {
    const { request, } = parseArgs(["proj.tjp",],);
    assertEquals(request.entry, "proj.tjp",);
  });

  it("mapeia --check-syntax, --no-reports e --force-reports", () => {
    const { request, } = parseArgs([
      "proj.smx",
      "--check-syntax",
      "--no-reports",
      "--force-reports",
    ],);
    assertEquals(request.checkSyntax, true,);
    assertEquals(request.noReports, true,);
    assertEquals(request.forceReports, true,);
  });

  it("mapeia --abort-on-warnings, --warn-ts-deltas e --add-trace (24.3.7)", () => {
    const { request, } = parseArgs([
      "proj.smx",
      "--abort-on-warnings",
      "--warn-ts-deltas",
      "--add-trace",
    ],);
    assertEquals(request.abortOnWarnings, true,);
    assertEquals(request.warnTsDeltas, true,);
    assertEquals(request.addTrace, true,);
  });

  it("aceita a forma inline --output-dir=dir (24.3.8)", () => {
    const { request, } = parseArgs(["proj.smx", "--output-dir=out/",],);
    assertEquals(request.outputDir, "out/",);
  });
});

describe("parseArgs — flags com valor (24.3.9/24.3.10/24.3.11)", () => {
  it("--list-reports vira request.listReports", () => {
    const { request, } = parseArgs(["proj.smx", "--list-reports", "^rl",],);
    assertEquals(request.listReports, "^rl",);
    assertEquals(request.listReportsIsRegex, undefined,);
  });

  it("--report vira request.report e --reports marca regex", () => {
    assertEquals(
      parseArgs(["proj.smx", "--report", "plan",],).request.report,
      "plan",
    );
    const { request, } = parseArgs(["proj.smx", "--reports", "^plan",],);
    assertEquals(request.report, "^plan",);
    assertEquals(request.reportsIsRegex, true,);
  });

  it("-A vira request.dynamicAttributes cru", () => {
    const { request, } = parseArgs([
      "proj.smx",
      "--report",
      "plan",
      "-A",
      "hidetask 0",
    ],);
    assertEquals(request.dynamicAttributes, "hidetask 0",);
  });

  it("--config sai como configFile, não como conteúdo", () => {
    const { request, configFile, } = parseArgs([
      "proj.smx",
      "--config",
      "tj3.conf",
    ],);
    assertEquals(configFile, "tj3.conf",);
    assertEquals(request.configContent, undefined,);
  });

  it("aceita o <project-id> posicional do --report", () => {
    const { request, } = parseArgs(["proj.smx", "--report", "plan", "pid",],);
    assertEquals(request.entry, "proj.smx",);
    assertEquals(request.report, "plan",);
  });
});

describe("parseArgs — renderer e metadados (24.3.5/24.3.12)", () => {
  it("--silent e --no-color vão ao renderer, não ao request", () => {
    const { request, renderer, } = parseArgs([
      "proj.smx",
      "--silent",
      "--no-color",
    ],);
    assertEquals(renderer, { silent: true, color: false, },);
    const fields = request as Record<string, unknown>;
    assertEquals(fields.silent, undefined,);
    assertEquals(fields.color, undefined,);
  });

  it("--help e --version viram campos do request", () => {
    assertEquals(parseArgs(["--help",],).request.help, true,);
    assertEquals(parseArgs(["-h",],).request.help, true,);
    assertEquals(parseArgs(["--version",],).request.version, true,);
    assertEquals(parseArgs(["-V",],).request.version, true,);
  });
});

describe("parseArgs — erros de uso (24.3.3)", () => {
  it("--freeze e afins erram com 'not yet available'", () => {
    assert(
      usageMessage(["proj.smx", "--freeze",],).includes("not yet available",),
    );
    assert(
      usageMessage(["proj.smx", "--check-time-sheet",],).includes(
        "not yet available",
      ),
    );
    assert(
      usageMessage(["proj.smx", "--debug",],).includes("not yet available",),
    );
  });

  it("flag desconhecida e valor faltando erram em inglês", () => {
    assertEquals(
      usageMessage(["proj.smx", "--nope",],),
      "Unknown option '--nope'.",
    );
    assertEquals(
      usageMessage(["proj.smx", "--report",],),
      "Option '--report' requires a value.",
    );
  });

  it("posicional extra sem --report é erro", () => {
    assertEquals(
      usageMessage(["a.smx", "b.smx",],),
      "Unexpected argument 'b.smx'.",
    );
  });

  it("flag booleana com valor inline é rejeitada", () => {
    assertEquals(
      usageMessage(["proj.smx", "--check-syntax=1",],),
      "Option '--check-syntax' does not take a value.",
    );
  });

  it("sem arquivo e sem --help/--version é erro", () => {
    assertEquals(usageMessage([],), "No input file given.",);
    assertEquals(usageMessage(["--silent",],), "No input file given.",);
  });
});

describe("resolveExit (24.3.4)", () => {
  it("encaminha exitCode 0 e 1 do envelope", () => {
    const base = { ok: true, options: {}, messages: [], results: {}, };
    assertEquals(resolveExit({ ...base, exitCode: 0, } as never,), 0,);
    assertEquals(resolveExit({ ...base, exitCode: 1, } as never,), 1,);
  });

  it("sem envelope (erro de flag) devolve 1", () => {
    assertEquals(resolveExit(null,), 1,);
    assertEquals(resolveExit(undefined,), 1,);
  });

  it("exitCode inesperado não vira sucesso", () => {
    const result = {
      exitCode: 2,
      ok: true,
      options: {},
      messages: [],
      results: {},
    };
    assertEquals(resolveExit(result as never,), 1,);
  });
});

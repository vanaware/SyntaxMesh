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
  it("--debug* ainda erram com 'not yet available'", () => {
    for (const flag of ["--debug", "--debuglevel", "--debugmodules",]) {
      assert(
        usageMessage(["proj.smx", flag,],).includes("not yet available",),
        flag,
      );
    }
  });

  it("flags de valor dos apps de sheet sem valor erram (24.10)", () => {
    assertEquals(
      usageMessage(["proj.smx", "--check-time-sheet",],),
      "Option '--check-time-sheet' requires a value.",
    );
    assertEquals(
      usageMessage(["proj.smx", "--freezedate",],),
      "Option '--freezedate' requires a value.",
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

describe("parseArgs — freeze (24.9.5)", () => {
  it("--freeze sozinho pede freeze sem data", () => {
    const { request, } = parseArgs(["proj.smx", "--freeze",],);
    assertEquals(request.freeze, {},);
  });

  it("--freezedate e --freeze-by-task completam o pedido", () => {
    const { request, } = parseArgs([
      "proj.smx",
      "--freeze",
      "--freezedate",
      "2026-05-18",
      "--freeze-by-task",
    ],);
    assertEquals(request.freeze, { date: "2026-05-18", byTask: true, },);
  });

  it("aceita --freezebytask (grafia do tj3) e a ordem livre", () => {
    const { request, } = parseArgs([
      "--freezedate=2026-05-18",
      "--freezebytask",
      "--freeze",
      "proj.smx",
    ],);
    assertEquals(request.freeze, { date: "2026-05-18", byTask: true, },);
  });

  it("sem --freeze a data não liga o freeze (como no tj3)", () => {
    const { request, } = parseArgs([
      "proj.smx",
      "--freezedate",
      "2026-05-18",
    ],);
    assertEquals(request.freeze, undefined,);
  });
});

describe("parseArgs — apps de sheet (24.10.1–24.10.4)", () => {
  it("subcomandos ts/ss viram request.app e liberam o arquivo", () => {
    const send = parseArgs(["ts", "send", "proj.smx",],);
    assertEquals(send.request.app, "ts-send",);
    assertEquals(send.request.entry, "proj.smx",);

    assertEquals(
      parseArgs(["ts", "receive", "proj.smx",],).request.app,
      "ts-receive",
    );
    assertEquals(
      parseArgs(["ts", "summary", "proj.smx",],).request.app,
      "ts-summary",
    );
    assertEquals(
      parseArgs(["ss", "send", "proj.smx",],).request.app,
      "ss-send",
    );
    assertEquals(
      parseArgs(["ss", "receive", "proj.smx",],).request.app,
      "ss-receive",
    );
  });

  it("palavra que não é subcomando continua sendo o arquivo", () => {
    const { request, } = parseArgs(["ts",],);
    assertEquals(request.app, undefined,);
    assertEquals(request.entry, "ts",);
  });

  it("flags do sender viram appOptions (forma do Ruby)", () => {
    const { request, } = parseArgs([
      "ts",
      "send",
      "-r",
      "dev",
      "-r",
      "ops",
      "--force",
      "--dryrun",
      "-e",
      "2026-05-18",
      "-d",
      "work",
      "proj.smx",
    ],);
    assertEquals(request.app, "ts-send",);
    assertEquals(request.appOptions, {
      resources: ["dev", "ops",],
      force: true,
      dryRun: true,
      endDate: "2026-05-18",
    },);
  });

  it("-d/--directory não vai ao core (raiz do chamador)", () => {
    const parsed = parseArgs(["ts", "send", "-d", "work", "proj.smx",],);
    assertEquals(parsed.sheetDir, "work",);
    assertEquals(parsed.request.appOptions, undefined,);
  });

  it("--sheet e --digest do summary são repetíveis", () => {
    const { request, } = parseArgs([
      "ts",
      "summary",
      "--sheet",
      "a@example.com",
      "-t",
      "b@example.com",
      "--digest",
      "boss@example.com",
      "proj.smx",
    ],);
    assertEquals(request.appOptions?.sheetRecipients, [
      "a@example.com",
      "b@example.com",
    ],);
    // Ruby `Tj3TsSummary.rb` l.52-57: `-t/--to` alimenta **as duas** listas.
    assertEquals(request.appOptions?.digestRecipients, [
      "b@example.com",
      "boss@example.com",
    ],);
  });

  it("-f é --force-reports no tj3 e --force nos apps de sheet", () => {
    const report = parseArgs(["proj.smx", "-f",],);
    assertEquals(report.request.forceReports, true,);
    assertEquals(report.request.appOptions, undefined,);

    const sheet = parseArgs(["ts", "send", "-f", "proj.smx",],);
    assertEquals(sheet.request.forceReports, undefined,);
    assertEquals(sheet.request.appOptions?.force, true,);

    // `--force` (grafia longa dos apps) continua valendo sozinho.
    assertEquals(
      parseArgs(["ts", "send", "--force", "proj.smx",],).request.appOptions
        ?.force,
      true,
    );
  });

  it("--check-time-sheet/--check-status-sheet viram app + caminho", () => {
    const ts = parseArgs(["proj.smx", "--check-time-sheet", "dev.tji",],);
    assertEquals(ts.request.app, "check-ts",);
    assertEquals(ts.sheetFile, "dev.tji",);

    const ss = parseArgs(["proj.smx", "--check-status-sheet", "dev.tji",],);
    assertEquals(ss.request.app, "check-ss",);
    assertEquals(ss.sheetFile, "dev.tji",);
  });

  it("--from vira caminho da mensagem e só vale nos receivers", () => {
    const received = parseArgs([
      "ts",
      "receive",
      "--from",
      "mail.eml",
      "proj.smx",
    ],);
    assertEquals(received.messageFile, "mail.eml",);

    const stdin = parseArgs([
      "ss",
      "receive",
      "--from",
      "-",
      "proj.smx",
    ],);
    assertEquals(stdin.messageFile, "-",);

    assertEquals(
      usageMessage(["ts", "send", "--from", "mail.eml", "proj.smx",],),
      "Option '--from' only applies to 'ts receive' and 'ss receive'.",
    );
  });

  it("flag de app sem subcomando e dois apps no mesmo argv erram", () => {
    assert(
      usageMessage(["proj.smx", "--digest", "x@example.com",],).includes(
        "requires a sheet app",
      ),
    );
    assert(
      usageMessage([
        "proj.smx",
        "--check-time-sheet",
        "a.tji",
        "--check-status-sheet",
        "b.tji",
      ],).includes("conflicts with",),
    );
  });

  it("repetir a mesma folha é erro de uso, não descarte silencioso", () => {
    // Ruby acumula (`@timeSheets << arg`); o envelope checa uma por vez.
    assertEquals(
      usageMessage([
        "proj.smx",
        "--check-time-sheet",
        "a.tji",
        "--check-time-sheet",
        "b.tji",
      ],),
      "Option '--check-time-sheet' accepts only one sheet per run.",
    );
  });
});

describe("parseArgs — subcomando man (24.9.1–24.9.3)", () => {
  it("`man` sem keyword pede o documento completo em text", () => {
    const { request, } = parseArgs(["man",],);
    assertEquals(request.man, { format: "text", },);
    assertEquals(request.entry, undefined,);
  });

  it("os posicionais seguintes são keywords", () => {
    const { request, } = parseArgs(["man", "task", "resource",],);
    assertEquals(request.man, {
      format: "text",
      keywords: ["task", "resource",],
    },);
  });

  it("aceita --format text|html|smx em qualquer posição", () => {
    for (const format of ["text", "html", "smx",] as const) {
      const { request, } = parseArgs(["--format", format, "man", "task",],);
      assertEquals(request.man!.format, format,);
      assertEquals(request.man!.keywords, ["task",],);
    }
  });

  it("formato desconhecido é erro de uso", () => {
    assertEquals(
      usageMessage(["man", "--format", "pdf",],),
      "Unknown man format 'pdf' (expected text, html or smx).",
    );
  });

  it("--format fora do `man` é erro de uso", () => {
    assertEquals(
      usageMessage(["proj.smx", "--format", "html",],),
      "Option '--format' only applies to the 'man' command.",
    );
  });

  it("`man` convive com --output-dir e não exige arquivo de projeto", () => {
    const { request, } = parseArgs([
      "man",
      "--format",
      "html",
      "--output-dir",
      "docs/manual",
    ],);
    assertEquals(request.man!.format, "html",);
    assertEquals(request.outputDir, "docs/manual",);
    assertEquals(request.entry, undefined,);
  });

  it("um segundo posicional em `man` é keyword, não erro de uso", () => {
    const { request, } = parseArgs(["man", "a", "b",],);
    assertEquals(request.man!.keywords, ["a", "b",],);
    assertEquals(request.entry, undefined,);
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

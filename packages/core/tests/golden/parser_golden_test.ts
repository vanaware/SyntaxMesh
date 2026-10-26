/**
 * 10.19 — Golden tests do parser (ADR 011/013).
 *
 * `parser.golden.json` é gerado por `scripts/golden/parser-*.rb` contra o
 * TaskJuggler Ruby real (tj3 --check-syntax nos MWEs; API MessageChecker
 * nos diretórios TestSuite/Syntax/Correct e Errors). Cada caso registra a
 * verdade Ruby: `{ file, ok, messages: [{ type, id, lineNo }] }`.
 *
 * Este teste re-executa o parser TypeScript sobre o mesmo arquivo e exige
 * comportamento idêntico. Divergências são bugs de port (Regra 1 do
 * README de goldens) — nada de `xfail` silencioso.
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { ProjectFileParser, } from "../../src/parser/mod.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

interface MsgRef {
  type: string;
  id: string;
  lineNo: number | null;
}

interface ParserCase {
  file: string;
  ok: boolean;
  messages: MsgRef[];
}

/**
 * Casos que dependem do parser de RichText (Fase 12): os arquivos Correct
 * usam `-8<-` markup que hoje lança NotYetImplementedError, e
 * `unsupported_token` exige `RichText::Parser#limitTokenSet`
 * (RichText/Parser.rb l.49) para rejeitar o token `*` em sumário de journal.
 * Skip explícito e documentado — não é xfail silencioso: a lista some
 * quando a Fase 12 conectar o RichText no parser.
 */
const PENDING_FASE_12 =
  /\/Syntax\/(?:Correct\/(?:CustomAttributes|EnvVar|MinMax|tutorial)|Errors\/unsupported_token)\.tjp$/;

/** Raiz do repo a partir de packages/core/tests/golden/. */
const REPO_ROOT = new URL("../../../../", import.meta.url,);

function loadGolden(): ParserCase[] {
  const url = new URL("./parser.golden.json", import.meta.url,);
  const content = Deno.readTextFileSync(url,);
  return (JSON.parse(content,) as { cases: ParserCase[] }).cases;
}

interface TsOutcome {
  ok: boolean;
  messages: MsgRef[];
}

/** Parseia `rel` (caminho relativo ao repo) como arquivo mestre. */
export function parseMasterFile(rel: string,): TsOutcome {
  // Ruby: `TaskJuggler.new` chama `TjTime.setTimeZone('UTC')`
  // (TaskJuggler.rb l.40) — o fuso global é resetado a cada arquivo, sem
  // isso uma diretiva `timezone` de um arquivo vazaria no próximo
  // (ex.: Pacific/Marquesas → datas ":30" → misaligned_date falso).
  TjTime.setTimeZone("UTC",);
  const mh = MessageHandlerInstance.instance;
  // test_Syntax.rb l.36/49: `mh.trapSetup = true` — primeiro erro aborta.
  mh.trapSetup = true;
  mh.messages.length = 0;
  mh.errors = 0;
  const parser = new ProjectFileParser();
  let crashed = false;
  let result: unknown = null;
  try {
    parser.open(new URL(rel, REPO_ROOT,).pathname, true, false,);
    result = parser.parse("project",);
  } catch {
    crashed = true;
  }
  const messages = mh.messages.map((m,) => ({
    type: m.type,
    id: m.id,
    lineNo: m.sourceFileInfo ? m.sourceFileInfo.lineNo : null,
  }));
  // Ruby TaskJuggler#parse: !!parse(:project) && MessageHandler.errors == 0.
  const ok = !crashed && result !== false && result !== null &&
    mh.errors === 0;
  return { ok, messages, };
}

describe("Parser golden (10.19)", () => {
  // Ruby: harness fixa ENV['TZ']='Europe/Berlin' mas TaskJuggler.new
  // sobrescreve para 'UTC' antes de cada parse (setTimeZone faz
  // ENV['TZ']=zone). O fuso efetivo do parse é UTC.
  Deno.env.set("TZ", "UTC",);
  // test_Syntax.rb injeta estas variáveis (arquivos Correct usam $(TESTn)).
  Deno.env.set("TEST1", "t_e_s_t_1",);
  Deno.env.set("TEST2", '"A test String"',);
  Deno.env.set("TEST3", "3",);

  const cases = loadGolden();

  it("10.19.11 cobertura ≥ 100 casos", () => {
    assert(
      cases.length >= 100,
      `esperava ≥ 100 casos, obtive ${cases.length}`,
    );
  });

  for (const c of cases) {
    if (PENDING_FASE_12.test(c.file,)) {
      // Fase 12 (RichText): skip explícito — ver comentário em PENDING_FASE_12.
      const skipped = { name: c.file, skip: true, fn: () => {}, };
      it(skipped,);
      continue;
    }
    it(c.file, () => {
      const ts = parseMasterFile(c.file,);
      assertEquals(ts.ok, c.ok, `${c.file}: ok divergiu`,);
      assertEquals(ts.messages, c.messages, `${c.file}: mensagens divergem`,);
    },);
  }
});

describe("Parser golden regressão (10.19.12)", () => {
  const enabled = Deno.env.get("GOLDEN_REGENERATE_CHECK",) === "1";
  it(
    "regenera via ruby e compara com o JSON commitado",
    {
      ignore: !enabled,
      fn: () => {
        const scripts = [
          ...Array.from(
            { length: 9, },
            (_, i,) => `parser-mwe${String(i + 1,).padStart(3, "0",)}.rb`,
          ),
          "parser-syntax-correct.rb",
          "parser-syntax-errors.rb",
        ];
        const fresh: ParserCase[] = [];
        for (const script of scripts) {
          const url = new URL(
            `../../../../scripts/golden/${script}`,
            import.meta.url,
          );
          const proc = new Deno.Command("ruby", {
            args: [url.pathname,],
            stdout: "piped",
            stderr: "piped",
          },).outputSync();
          assert(proc.success, `ruby ${script} falhou`,);
          const text = new TextDecoder().decode(proc.stdout,);
          const json = text.match(/\{[\s\S]*\}/,)![0];
          const parsed = JSON.parse(json,) as {
            cases?: ParserCase[];
            file?: string;
          };
          if (parsed.cases) fresh.push(...parsed.cases,);
          else fresh.push(parsed as ParserCase,);
        }
        assertEquals(fresh, loadGolden(), "golden desatualizado",);
      },
    },
  );
});

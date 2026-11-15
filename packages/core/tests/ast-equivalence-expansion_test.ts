/**
 * 26.8 — Expansão da equivalência de AST para ≥30 fixtures × 3 idiomas
 * (F21 wave 1, ADR 023/042).
 *
 * As famílias `*.en.tjp` de `tests/fixtures/i18n/` (22 famílias novas +
 * `complemento-keywords`) somam-se aos 9 MWEs de `ast-equivalence_test.ts`
 * (en referenciado in place em `docs/Learning/`). Cada família é uma
 * tradução mecânica: apenas keywords variam; ids, strings, datas e literais
 * são idênticos. O teste parseia as três versões e compara o snapshot
 * estrutural após `normalizeAST` (10.18.4).
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.8)
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { type ParseOutcome, parseProject, } from "./parser/parse-helper.ts";
import {
  type AstSnap,
  normalizeAST,
  snapshotAST,
} from "./helpers/ast-snapshot.ts";
import type { Project, } from "../src/model/project.ts";

const LANGS = ["en", "pt-BR", "es",] as const;

/** MWEs cobertos por `ast-equivalence_test.ts` (en in place). */
const MWE_COUNT = 9;

/** Famílias descobertas no diretório de fixtures (ordem determinística). */
const FAMILIES = [
  ...Deno.readDirSync(new URL("./fixtures/i18n/", import.meta.url,),),
]
  .filter((e,) => e.isFile && e.name.endsWith(".en.tjp",))
  .map((e,) => e.name.replace(/\.en\.tjp$/, "",))
  .sort();

function readFixture(family: string, lang: string,): string {
  const path = `./fixtures/i18n/${family}.${lang}.tjp`;
  return Deno.readTextFileSync(new URL(path, import.meta.url,),);
}

function parseAndSnap(text: string,): ParseOutcome & { snap: AstSnap } {
  const out = parseProject(text,);
  assert(
    out.threw === null,
    `parse lançou: ${out.threw?.message ?? ""} (${out.messageIds.join(",",)})`,
  );
  assert(
    out.result instanceof Object && out.result !== null,
    `resultado não-Project: ${String(out.result,)} msgs=${
      out.messageIds.join(",",)
    }`,
  );
  return { ...out, snap: snapshotAST(out.result as Project,), };
}

for (const family of FAMILIES) {
  describe(`${family}: AST equivalente entre en/pt-BR/es (26.8.6)`, () => {
    it("as três versões parseiam sem mensagens", () => {
      for (const lang of LANGS) {
        const out = parseAndSnap(readFixture(family, lang,),);
        assertEquals(out.messageIds, [], `${family}.${lang} mensagens`,);
      }
    });

    it("pt-BR produz AST equivalente ao en", () => {
      const en = normalizeAST(parseAndSnap(readFixture(family, "en",),).snap,);
      const pt = normalizeAST(
        parseAndSnap(readFixture(family, "pt-BR",),).snap,
      );
      assertEquals(pt, en, `${family} pt-BR ≠ en`,);
    });

    it("es produz AST equivalente ao en", () => {
      const en = normalizeAST(parseAndSnap(readFixture(family, "en",),).snap,);
      const es = normalizeAST(parseAndSnap(readFixture(family, "es",),).snap,);
      assertEquals(es, en, `${family} es ≠ en`,);
    });
  });
}

describe("26.8.7/26.8.8 — agregado da expansão", () => {
  it("≥30 famílias de fixtures no total (MWEs + descobertas)", () => {
    const total = MWE_COUNT + FAMILIES.length;
    assert(total >= 30, `apenas ${total} famílias (esperado ≥30)`,);
  });

  it("todas as famílias descobertas × 3 idiomas têm AST idêntica", () => {
    for (const family of FAMILIES) {
      const en = normalizeAST(parseAndSnap(readFixture(family, "en",),).snap,);
      for (const lang of ["pt-BR", "es",] as const) {
        const other = normalizeAST(
          parseAndSnap(readFixture(family, lang,),).snap,
        );
        assertEquals(other, en, `${family}.${lang} ≠ en`,);
      }
    }
  });
});

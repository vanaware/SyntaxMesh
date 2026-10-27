/**
 * C3.9.3 — Equivalência de AST para as keywords novas do Complemento C3.
 *
 * O fixture `complemento-keywords.{en,pt-BR,es}.tjp` exercita as keywords
 * introduzidas em C3.1–C3.7 (material/unit/unitprice/totalquantity,
 * timebasis, journalentry + picture (caption/align/width/alt) + format,
 * breakdownreport/rdoreport + groupby/maxpictures/columns novas +
 * hidejournalentry). Os IDs das entidades são mantidos em português
 * (material "Steel", name "T1" etc.) para que o único fator de variação
 * entre idiomas seja a keyword — não o nome.
 *
 * O teste verifica que as três versões parseiam sem mensagens e produzem
 * ASTs estruturalmente equivalentes.
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { type ParseOutcome, parseProject, } from "./parser/parse-helper.ts";
import {
  type AstSnap,
  normalizeAST,
  snapshotAST,
} from "./ast-equivalence_test.ts";
import type { Project, } from "../src/model/project.ts";

function readFixture(lang: string,): string {
  const path = `./fixtures/i18n/complemento-keywords.${lang}.tjp`;
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

describe("C3.9.3 AST equivalence (complemento keywords)", () => {
  it("en parseia sem mensagens", () => {
    const out = parseProject(readFixture("en",),);
    assertEquals(out.threw, null, `threw=${out.threw?.message}`,);
    assertEquals(out.messageIds, [], `messages=${out.messageIds.join(",",)}`,);
  });

  it("pt-BR parseia sem mensagens", () => {
    const out = parseProject(readFixture("pt-BR",),);
    assertEquals(out.threw, null, `threw=${out.threw?.message}`,);
    assertEquals(out.messageIds, [], `messages=${out.messageIds.join(",",)}`,);
  });

  it("es parseia sem mensagens", () => {
    const out = parseProject(readFixture("es",),);
    assertEquals(out.threw, null, `threw=${out.threw?.message}`,);
    assertEquals(out.messageIds, [], `messages=${out.messageIds.join(",",)}`,);
  });

  it("pt-BR produz AST equivalente ao en", () => {
    const en = normalizeAST(parseAndSnap(readFixture("en",),).snap,);
    const pt = normalizeAST(parseAndSnap(readFixture("pt-BR",),).snap,);
    assertEquals(pt, en, "pt-BR ≠ en",);
  });

  it("es produz AST equivalente ao en", () => {
    const en = normalizeAST(parseAndSnap(readFixture("en",),).snap,);
    const es = normalizeAST(parseAndSnap(readFixture("es",),).snap,);
    assertEquals(es, en, "es ≠ en",);
  });
});

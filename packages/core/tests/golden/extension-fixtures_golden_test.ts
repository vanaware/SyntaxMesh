/**
 * C4.2 — Fixtures de extensão (sem oracle no TaskJuggler Ruby).
 *
 * Os blocos `material` / `picture` / `timebasis` / `breakdownreport` /
 * `rdoreport` não existem no TJ 3.8.4, então não há golden comparativo via
 * `tj3`. Estes fixtures servem como smoke de parse + checagem estrutural do
 * modelo (carregam e produzrem as entidades esperadas).
 *
 * Cobre: material + journalentry + picture (C3.1/C3.2/C3.3), timebasis
 * (5 ramos: duration/calendar/length/working + milestone → erro, C3.4) e
 * breakdownreport/rdoreport com colunas novas + hidejournalentry (C3.5–C3.7).
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { type ParseOutcome, parseProject, } from "../parser/parse-helper.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";
import type { JournalEntry, } from "../../src/model/journal.ts";
import type { Material, } from "../../src/model/material.ts";

function loadExt(name: string,): string {
  const url = new URL(`../fixtures/ext/${name}.tjp`, import.meta.url,);
  return Deno.readTextFileSync(url,);
}

function parseExt(name: string,): ParseOutcome {
  return parseProject(loadExt(name,),);
}

function asProject(out: ParseOutcome,): Project {
  assert(
    out.threw === null,
    `parse lançou: ${out.threw?.message ?? ""} (${out.messageIds.join(",",)})`,
  );
  assert(
    out.result instanceof Object && out.result !== false,
    `resultado inválido: ${String(out.result,)} msgs=${
      out.messageIds.join(",",)
    }`,
  );
  return out.result as Project;
}

/** IDs das colunas de um relatório. */
function colIds(r: Report,): string[] {
  const cols = (r.get("columns",) as unknown as Array<{ id: string }>) ?? [];
  return cols.map((c,) => c.id);
}

describe("C4.2 ext fixture: material-journalentry-picture", () => {
  it("carrega sem mensagens de erro", () => {
    const out = parseExt("material-journalentry-picture",);
    assertEquals(out.threw, null, `threw=${out.threw?.message}`,);
    assertEquals(out.messageIds, [], `msgs=${out.messageIds.join(",",)}`,);
  });

  it("registra materials com unit/unitprice/totalquantity", () => {
    const p = asProject(parseExt("material-journalentry-picture",),);
    const steel = p.material("steel",) as Material;
    assert(steel !== null, "material steel não registrado",);
    assertEquals(steel.get("unit",), "kg",);
    assertEquals(steel.get("cost",), 2.5,);
    assertEquals(steel.get("totalquantity",), 1000,);
    assert(p.material("concrete",) !== null, "material concrete ausente",);
  });

  it("anexa pictures + format às journal entries", () => {
    const p = asProject(parseExt("material-journalentry-picture",),);
    const entries = p.journal.entries as JournalEntry[];
    // 1 entry no material (2 pictures) + 1 entry na task (1 picture).
    assertEquals(
      entries.length,
      2,
      `esperava 2 entries, obtive ${entries.length}`,
    );
    const withPics = entries.filter((e,) => e.pictures.length > 0);
    assertEquals(withPics.length, 2, "ambas as entries deveriam ter picture",);
    const steelEntry = entries.find((e,) => e.pictures.length === 2)!;
    assertEquals(steelEntry.format, "markdown",);
    assertEquals(steelEntry.pictures[0]!.caption, "Empilhamento",);
    assertEquals(steelEntry.pictures[0]!.align, "left",);
    assertEquals(steelEntry.pictures[0]!.width, 320,);
    assertEquals(steelEntry.pictures[1]!.align, "center",);
    const taskEntry = entries.find((e,) => e.pictures.length === 1)!;
    assertEquals(taskEntry.format, "richtext",);
    assertEquals(taskEntry.pictures[0]!.align, "right",);
  });
});

describe("C4.2 ext fixture: breakdown-rdo-reports", () => {
  it("carrega e registra breakdownreport/rdoreport", () => {
    const p = asProject(parseExt("breakdown-rdo-reports",),);
    const br = p.report("br",) as Report;
    assert(br !== null, "breakdownreport ausente",);
    assertEquals(br.typeSpec, "breakdownreport",);
    assertEquals(br.get("groupby",), "task",);
    assertEquals(
      colIds(br,),
      ["bsi", "name", "materials", "charges", "effort",],
    );
    const rdo = p.report("rdo",) as Report;
    assert(rdo !== null, "rdoreport ausente",);
    assertEquals(rdo.typeSpec, "rdoreport",);
    assertEquals(rdo.get("groupby",), "date",);
    assertEquals(rdo.get("maxpictures",), 5,);
  });
});

describe("C4.2 ext fixture: timebasis-branches", () => {
  it("duration/calendar/length/working normalizam corretamente", () => {
    const p = asProject(parseExt("timebasis-branches",),);
    const tb = (id: string,) =>
      p.task(id,)?.getForScenario("timebasis", 0,) ?? null;
    assertEquals(tb("tb_duration",), "duration",);
    assertEquals(tb("tb_calendar",), "duration",);
    assertEquals(tb("tb_length",), "length",);
    assertEquals(tb("tb_working",), "length",);
  });

  it("milestone + timebasis dispara timebasis_not_supported", () => {
    const out = parseExt("timebasis-branches",);
    assert(
      out.messageIds.includes("timebasis_not_supported",),
      `esperado timebasis_not_supported, obtido ${out.messageIds.join(",",)}`,
    );
  });
});

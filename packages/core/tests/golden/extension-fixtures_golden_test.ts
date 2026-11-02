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

  it("registra materials com unit/unitprice e quantidade derivada", () => {
    const p = asProject(parseExt("material-journalentry-picture",),);
    const steel = p.material("steel",) as Material;
    assert(steel !== null, "material steel não registrado",);
    assertEquals(steel.get("unit",), "kg",);
    assertEquals(steel.get("cost",), 2.5,);
    // `totalquantity` foi removido: a quantidade vem das alocações da task
    // (`material steel 200 perday`, 14C.11.10).
    assertEquals(steel.allocatedQuantity(0,), 200,);
    assertEquals(steel.allocatedCost(0,), 500,);
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

// ---------------------------------------------------------------------------
// 14C.0.11 — fixture base do complemento (materials + diários + relatórios).
// ---------------------------------------------------------------------------
describe("14C.0.11 ext fixture: 14c-rdo-budget", () => {
  it("carrega sem mensagens e registra entidades por índice", () => {
    const out = parseExt("14c-rdo-budget",);
    assertEquals(
      out.messageIds,
      [],
      `msgs=${out.messages.map((m,) => `${m.id}:${m.text}`).join(" | ",)}`,
    );
    const p = asProject(out,);
    // Materiais + alocações + charges.
    assert(p.material("steel",) !== null,);
    assert(p.material("concrete",) !== null,);
    const allocs = p.task("phase1",)!.getForScenario(
      "materialallocations",
      0,
    ) as unknown[];
    assertEquals(allocs.length, 2,);
    const charges = p.task("phase1",)!.getForScenario(
      "charge",
      0,
    ) as unknown[];
    assertEquals(charges.length, 1,);
    // Diários indexados por entidade (14C.0.4).
    const j = p.journal;
    assertEquals(j.entries.length, 5,);
    assertEquals(j.entriesByTask.size, 1,);
    assertEquals(j.entriesByResource.size, 1,);
    assertEquals(j.entriesByMaterial.size, 1,);
    assertEquals(j.entriesByAccount.size, 1,);
    // Pictures e formato nas entradas.
    const steel = j.entriesByMaterial.get(p.material("steel",)!,)!;
    assertEquals(steel[0]!.pictures.length, 2,);
    assertEquals(steel[0]!.format, "markdown",);
    assertEquals(steel[0]!.alertLevel, 0,); // green = índice 0
  });

  it("registra os três relatórios com formats json quando pedido", () => {
    const p = asProject(parseExt("14c-rdo-budget",),);
    const tr = p.report("tr",) as Report;
    assertEquals(tr.get("formats",), ["html", "csv", "json",],);
    const br = p.report("br",) as Report;
    assertEquals(br.typeSpec, "breakdownreport",);
    assertEquals(br.get("groupby",), "account",);
    const rdo = p.report("rdo",) as Report;
    assertEquals(rdo.typeSpec, "rdoreport",);
    assertEquals(rdo.get("maxpictures",), 5,);
    assertEquals(rdo.get("journalMode",), "journal",);
  });
});

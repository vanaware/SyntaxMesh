/**
 * MaterialListRE (phase 14 addendum C1.4) — material listing.
 *
 * SyntaxMesh extension (no equivalent in TJ Ruby, which has no
 * `materialreport`). A specialization of `TableReport` that walks
 * `project.materials` in the report order and emits one row per material. The
 * default columns (`no`, `name`, `unit`, `unitprice`, `totalcost`) are declared
 * by the parser; the allocation/cost/journal variants are resolved in
 * `TableReport.genMaterialCell` (sub-tasks C1.5–C1.7).
 *
 * The content is registered in the content factory under `materialreport`, so
 * `Report.generateIntermediateFormat` can instantiate it.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.1.4)
 */
import type { Report, } from "../model/report.ts";
import { PropertyList, } from "../model/property-list.ts";
import type { Material, } from "../model/material.ts";
import { ReportTable, } from "./report-table.ts";
import { TableReport, } from "./table-report.ts";
import { registerContentFactory, } from "../model/report-content.ts";

/** Renders the `materialreport` list of materials. */
export class MaterialListRE extends TableReport {
  /**
   * Creates the material list generator.
   *
   * @param report Report node the generator renders.
   */
  constructor(report: Report,) {
    super(report,);
    // TableReport sets `report.content = this`; here we create the real
    // intermediate table (14.6) that accumulates rows and columns.
    this.table = new ReportTable();
    this.table.selfcontained = !!this.a("selfcontained",);
    this.table.auxDir = (this.a("auxdir",) as string | undefined) ?? "";
  }

  /** Builds the intermediate format (the table) row by row. */
  override generateIntermediateFormat(): void {
    // Propagates the current Query to the RichText blocks (ReportBase).
    super.generateIntermediateFormat();

    // Material list in the report order (`sortby`). Without `sortby` it keeps
    // the deterministic order of the PropertySet (`seqno`).
    let materialList = new PropertyList<Material>(this.project.materials,);
    const sortBy = this.a("sortBy",) as
      | Array<[string, boolean, number,]>
      | null;
    if (sortBy && sortBy.length > 0) materialList.setSorting(sortBy,);
    materialList.query = this.currentQuery();
    // `hidematerial`/`rollupmaterial` (14C.6.6/6.9): hides and consolidates the
    // material subtree, with the same semantics as `hideresource`.
    materialList = this.filterMaterialList(
      materialList,
      this.a("hideMaterial",) as never,
      this.a("rollupMaterial",) as never,
      this.a("openNodes",) as never,
    );
    materialList.sort();

    // Header (one column at a time). Materials do not derive a period from
    // tasks: `adjustColumnPeriod` uses the report only.
    for (const columnDef of this.columnList()) {
      this.adjustColumnPeriod(columnDef,);
      this.generateHeaderCell(columnDef,);
    }

    // Generates the list itself.
    this.generateMaterialList(materialList, 0,);
  }
}

// Registers the `materialreport` content in the factory (14.11).
registerContentFactory(
  "materialreport",
  (report: unknown,): MaterialListRE => new MaterialListRE(report as Report,),
);

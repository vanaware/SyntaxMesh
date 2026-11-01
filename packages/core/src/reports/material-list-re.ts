/**
 * MaterialListRE (Fase 14 Complemento C1.4) — listagem de materiais.
 *
 * Extensão SyntaxMesh (sem equivalente no TJ Ruby, que não tem `materialreport`).
 * Especialização de `TableReport` que percorre `project.materials` na ordem do
 * relatório e gera uma linha por material. As colunas padrão (`no`, `name`,
 * `unit`, `unitprice`, `totalcost`) são definidas pelo parser; as variantes de
 * alocações/custos/journal são resolvidas em `TableReport.genMaterialCell`
 * (sub-tarefas C1.5–C1.7).
 *
 * O conteúdo é registrado na fábrica de conteúdo sob `materialreport`,
 * permitindo que `Report.generateIntermediateFormat` o instancie.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.1.4)
 */
import type { Report, } from "../model/report.ts";
import { PropertyList, } from "../model/property-list.ts";
import type { Material, } from "../model/material.ts";
import { ReportTable, } from "./report-table.ts";
import { TableReport, } from "./table-report.ts";
import { registerContentFactory, } from "../model/report-content.ts";

export class MaterialListRE extends TableReport {
  constructor(report: Report,) {
    super(report,);
    // TableReport define `report.content = this`; aqui criamos a tabela
    // intermediária real (14.6) que acumulará linhas e colunas.
    this.table = new ReportTable();
    this.table.selfcontained = !!this.a("selfcontained",);
    this.table.auxDir = (this.a("auxdir",) as string | undefined) ?? "";
  }

  /** Constrói o formato intermediário (tabela) linha a linha. */
  override generateIntermediateFormat(): void {
    // Propaga o Query corrente aos blocos de RichText (ReportBase).
    super.generateIntermediateFormat();

    // Lista de materiais na ordenação do relatório (`sortby`). Sem `sortby`
    // mantém a ordem determinística do PropertySet (`seqno`).
    const materialList = new PropertyList<Material>(this.project.materials,);
    const sortBy = this.a("sortBy",) as
      | Array<[string, boolean, number,]>
      | null;
    if (sortBy && sortBy.length > 0) materialList.setSorting(sortBy,);
    materialList.query = this.currentQuery();
    materialList.sort();

    // Cabeçalho (uma coluna de cada vez). Materiais não derivam período de
    // tarefas: `adjustColumnPeriod` usa só o relatório.
    for (const columnDef of this.columnList()) {
      this.adjustColumnPeriod(columnDef,);
      this.generateHeaderCell(columnDef,);
    }

    // Gera a lista em si.
    this.generateMaterialList(materialList, 0,);
  }
}

// Registra o conteúdo de `materialreport` na fábrica (14.11).
registerContentFactory(
  "materialreport",
  (report: unknown,): MaterialListRE => new MaterialListRE(report as Report,),
);

import { parseProject } from "/home/aarvati/github/syntaxmesh/packages/core/tests/parser/parse-helper.ts";
import type { Project } from "/home/aarvati/github/syntaxmesh/packages/core/src/model/project.ts";
const tjp = `
project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {
  timezone "UTC"
}
account acct "Conta" { }
material steel "Aço" {
  unit "kg"
  unitprice 2.5
  totalquantity 100
}
resource team "Equipe" { }
task t1 "Tarefa 1" {
  start 2026-02-01
  effort 5d
  journalentry 2026-02-10 "E1" {
    summary "S1"
    alert red
    picture "img/a.png" { caption "Cap" align left width 320 alt "A" }
    format markdown
  }
  journalentry 2026-03-03 "E2" { details "![B](img/b.png)" alert green }
}
taskreport tr "T" { formats html }
rdoreport rdo "R" {
  period 2026-02-01 - 2026-03-31
  groupby date
  formats html, json
}
`;
const out = parseProject(tjp);
const project = out.result as Project;
console.log("msgs", out.messageIds, out.threw);
for (const e of project.journal.entries) {
  console.log(e.date.to_s("%Y-%m-%d"), e.headline, "prop=", e.property?.id, "alert=", e.alertLevel, "pics=", e.pictures.map(p=>[p.path,p.alt,p.caption,p.align,p.width]), "details=", e.details);
}
console.log("reports", project.reports.toArray().map((r:any)=>[r.id, r.typeSpec]));

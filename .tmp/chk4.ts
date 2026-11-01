import { parseProject } from "/home/aarvati/github/syntaxmesh/packages/core/tests/parser/parse-helper.ts";
import type { Project } from "/home/aarvati/github/syntaxmesh/packages/core/src/model/project.ts";
for (const decl of ["charge 200 perday", "charge 200", "charge 200 perhour"]) {
  const H = `project prj "T" "1.0" 2026-01-01 - 2026-12-31 {\n timezone "UTC"\n}\naccount acct "A" {}\nmaterial steel "A" { unit "kg" unitprice 2.5 totalquantity 100 }\ntask t1 "T1" { start 2026-02-01 effort 5d chargeset acct 100% ${decl} }\n`;
  const out = parseProject(H);
  const p = out.result as Project;
  const t: any = p.tasks.get("t1");
  const c = (t.getForScenario("charge", 0) as any[])[0];
  console.log(decl, "=> amount", c.amount, "mode", c.mode, "msgs", out.messageIds);
}

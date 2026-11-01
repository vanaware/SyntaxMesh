import { parseProject } from "/home/aarvati/github/syntaxmesh/packages/core/tests/parser/parse-helper.ts";
import type { Project } from "/home/aarvati/github/syntaxmesh/packages/core/src/model/project.ts";
const H = `project prj "T" "1.0" 2026-01-01 - 2026-12-31 {\n timezone "UTC"\n}\ntask t1 "T1" { start 2026-02-01 effort 5d }\n`;
for (const expr of ["1", "isleaf()", "~(id = \"t1\")"]) {
  const out = parseProject(H + `taskreport tr "R" {\n columns bsi\n hidetask ${expr}\n}\n`);
  const p = out.result as Project;
  const r = p.reports.get("tr") as any;
  console.log(expr, "=>", r?.get("hideTask")?.toString?.(), "msgs", out.messageIds, out.threw?.message);
}

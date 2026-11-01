import { parseProject } from "/home/aarvati/github/syntaxmesh/packages/core/tests/parser/parse-helper.ts";
import type { Project } from "/home/aarvati/github/syntaxmesh/packages/core/src/model/project.ts";
const H = `project prj "T" "1.0" 2026-01-01 - 2026-12-31 {\n timezone "UTC"\n}\nresource team "Equipe" {}\ntask t1 "T1" { start 2026-02-01 effort 5d responsible team }\n`;
const out = parseProject(H);
const p = out.result as Project;
const t: any = p.tasks.get("t1");
const v = t.getForScenario("responsible", 0);
console.log("isArray", Array.isArray(v), "len", (v as any)?.length, "first", (v as any)?.[0]?.name);

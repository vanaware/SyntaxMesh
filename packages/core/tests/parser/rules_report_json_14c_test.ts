/**
 * 14C.0.2 — `formats json` aceito pelo parser de reports.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";
import type { Project, } from "../../src/model/project.ts";

function project(out: ReturnType<typeof parseProject>,): Project {
  assert(out.threw === null, `threw=${out.threw?.message}`,);
  assert(out.result !== false, `msgs=${out.messageIds.join(",",)}`,);
  return out.result as Project;
}

describe("formats json (14C.0.2)", () => {
  it("formats json é aceito e registrado", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'taskreport r "R" {\nformats json\n}\n',
      ),
    );
    assertEquals(p.report("r",)!.get("formats",), ["json",],);
  });

  it("formats html, json aceita a lista mista", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'taskreport r "R" {\nformats html, json\n}\n',
      ),
    );
    assertEquals(p.report("r",)!.get("formats",), ["html", "json",],);
  });
});

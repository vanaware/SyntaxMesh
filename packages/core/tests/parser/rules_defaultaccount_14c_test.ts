/**
 * 14C.9.3–14C.9.5 — Parser de `defaultaccount` (universal e por tipo) e i18n.
 *
 * Extensão SyntaxMesh (adendo §10): `defaultaccount <id>` define a conta da
 * regra 4 de `resolveAccount`; as formas `material`/`resource`/`charge`
 * restringem a conta a um `CostType` (`charge` → `task`). O ID é guardado cru
 * porque o bloco `project` precede as declarações de `account`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §11.2
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { Project, } from "../../src/model/project.ts";
import { globalRegistry, } from "../../src/i18n/mod.ts";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";

/** Parseia e devolve o Project, exigindo ausência de mensagens. */
function parseOk(text: string,): Project {
  const out = parseProject(text,);
  assertEquals(out.threw, null,);
  assertEquals(
    out.messageIds,
    [],
    out.messages.map((m,) => m.text).join("|",),
  );
  assert(out.result instanceof Project, "resultado deve ser um Project",);
  return out.result as Project;
}

const ACCOUNTS = 'account custos "Custos"\n' +
  'account macc "Materiais"\n' +
  'account racc "Recursos"\n' +
  'account tacc "Tarefas"\n';

describe("defaultaccount no bloco project (14C.9.3 / 14C.9.4)", () => {
  it("forma universal guarda o ID e resolve por tipo", () => {
    const project = parseOk(
      PROJECT_HEADER +
        "{\n  defaultaccount custos\n}\n" +
        ACCOUNTS,
    );
    assertEquals(project.defaultAccountId, "custos",);
    assertEquals(project.defaultAccountIds.size, 0,);
    assertEquals(project.defaultAccountFor("material",)?.id, "custos",);
    assertEquals(project.defaultAccountFor("task",)?.id, "custos",);
  });

  it("variante material restringe a conta ao tipo material", () => {
    const project = parseOk(
      PROJECT_HEADER +
        "{\n  defaultaccount custos\n  defaultaccount material macc\n}\n" +
        ACCOUNTS,
    );
    assertEquals(project.defaultAccountIds.get("material",), "macc",);
    assertEquals(project.defaultAccountFor("material",)?.id, "macc",);
    assertEquals(project.defaultAccountFor("resource",)?.id, "custos",);
  });

  it("variantes resource e charge mapeiam para resource e task", () => {
    const project = parseOk(
      PROJECT_HEADER +
        "{\n" +
        "  defaultaccount resource racc\n" +
        "  defaultaccount charge tacc\n}\n" +
        ACCOUNTS,
    );
    assertEquals(project.defaultAccountIds.get("resource",), "racc",);
    assertEquals(project.defaultAccountIds.get("task",), "tacc",);
    assertEquals(project.defaultAccountFor("resource",)?.id, "racc",);
    assertEquals(project.defaultAccountFor("task",)?.id, "tacc",);
  });

  it("aceita referência futura a conta declarada depois", () => {
    // O bloco `project` vem antes das declarações: nenhum erro de parse.
    const project = parseOk(
      PROJECT_HEADER + "{\n  defaultaccount tardia\n}\n" +
        'account tardia "Tardia"\n',
    );
    assertEquals(project.defaultAccountId, "tardia",);
    assertEquals(project.defaultAccountFor(null,)?.id, "tardia",);
  });

  it("conta desconhecida não falha o parse e resolve para null", () => {
    const project = parseOk(
      PROJECT_HEADER + "{\n  defaultaccount fantasma\n}\n",
    );
    assertEquals(project.defaultAccountId, "fantasma",);
    assertEquals(project.defaultAccountFor("material",), null,);
  });
});

describe("i18n de defaultaccount (14C.9.5)", () => {
  it("registry resolve os sinônimos pt-BR e es", () => {
    assertEquals(
      globalRegistry.resolve("contapadrao", "pt-BR",),
      "defaultaccount",
    );
    assertEquals(
      globalRegistry.resolve("cuentapredeterminada", "es",),
      "defaultaccount",
    );
  });

  it("mesma AST em en, pt-BR e es", () => {
    const en = parseOk(
      PROJECT_HEADER +
        "{\n  defaultaccount custos\n  defaultaccount material macc\n}\n" +
        ACCOUNTS,
    );
    const pt = parseOk(
      'language "pt-BR"\nprojeto prj "Teste" "1.0" 2026-01-01 - 2026-12-31\n' +
        "{\n  contapadrao custos\n  contapadrao material macc\n}\n" +
        'conta custos "Custos"\nconta macc "Materiais"\n',
    );
    const es = parseOk(
      'language "es"\nproyecto prj "Test" "1.0" 2026-01-01 - 2026-12-31\n' +
        "{\n  cuentapredeterminada custos\n  cuentapredeterminada material macc\n}\n" +
        'cuenta custos "Custos"\ncuenta macc "Materiais"\n',
    );
    assertEquals(pt.defaultAccountId, en.defaultAccountId,);
    assertEquals(es.defaultAccountId, en.defaultAccountId,);
    assertEquals(
      pt.defaultAccountIds.get("material",),
      en.defaultAccountIds.get("material",),
    );
    assertEquals(
      es.defaultAccountIds.get("material",),
      en.defaultAccountIds.get("material",),
    );
  });
});

/**
 * Snapshot determinístico da expansão de `template` (Fase 23, 23.7.2).
 *
 * TS-only: não há oracle no TaskJuggler Ruby para o elemento `template`
 * (ADR 033). A fonte de verdade é este snapshot, gerado por
 * `generate_template_expansion_golden.ts` e comparado byte-a-byte por
 * `template_golden_test.ts`.
 *
 * Os seis fixtures vivem em `tests/fixtures/templates/` (ver o README de
 * índice) e cobrem: expansão básica, matriz de tipos de argumento, composição
 * (`expandTemplate`/`expandTemplateList`), macro dentro do corpo, a tabela de
 * erros do §5 e listas + `{{ for }}` (23.10).
 *
 * Regras de determinismo:
 *   • insertion-order do `PropertySet` (ordem de expansão no stream);
 *   • só campos estáveis (id/nome/effort/alocações; nada de datas de agenda);
 *   • `effort` em segundos, como o modelo guarda.
 *
 * @see docs/syntaxmesh/fases/fase-23-template-tarefas.md (23.3.10, 23.4.10,
 *      23.6.9, 23.7.2, 23.10)
 */
import { parseProject, } from "../parser/parse-helper.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Task, } from "../../src/model/task.ts";
import type { Resource, } from "../../src/model/resource.ts";
import type { Allocation, } from "../../src/scheduling/allocation.ts";

/** Fixture de expansão básica. */
export const TEMPLATE_EXPANSION_FIXTURE = "basic";

/** Fixture da matriz de tipos de argumento (23.4.10). */
export const TEMPLATE_ARGS_FIXTURE = "args-matrix";

/** Fixture dos cenários de composição (23.6.9). */
export const TEMPLATE_COMPOSE_FIXTURE = "composition";

/** Fixture de macro dentro de corpo de template (§4.4). */
export const TEMPLATE_MACROS_FIXTURE = "macros-in-template";

/** Fixture de erro da tabela §5 (23.7.9). */
export const TEMPLATE_ERRORS_FIXTURE = "errors";

/** Fixture de listas como argumento e `{{ for }}` (23.10). */
export const TEMPLATE_LISTS_FIXTURE = "lists-for";

/** Lê um fixture de template pelo nome (sem extensão). */
export function loadTemplateFixture(name: string,): string {
  return Deno.readTextFileSync(
    new URL(`../fixtures/templates/${name}.tjp`, import.meta.url,),
  );
}

/**
 * Estrutura comparada pelo golden: registro do namespace + mensagens +
 * entidades que só existem se a expansão de fato produziu texto TaskJuggler
 * válido.
 */
export function buildTemplateExpansionSnapshot(fixture: string,) {
  const out = parseProject(loadTemplateFixture(fixture,),);

  const templates = out.parser.scannerRef!.macroTable.templates().map((t,) => ({
    name: t.name,
    params: t.params,
    body: t.body,
  }));

  const project = out.result instanceof Object && out.result !== false
    ? out.result as Project
    : null;

  const tasks = project
    ? (project.tasks.toArray() as Task[]).map((t,) => ({
      id: t.id,
      name: t.name,
      effort: (t.getForScenario("effort", 0,) as number | null) ?? null,
      allocate:
        ((t.getForScenario("allocate", 0,) as Allocation[] | null) ?? [])
          .flatMap((a,) => a.candidates.map((r,) => r.fullId)),
    }))
    : [];

  const resources = project
    ? (project.resources.toArray() as Resource[]).map((r,) => ({
      id: r.id,
      name: r.name,
    }))
    : [];

  return {
    fixture,
    messages: out.messages.map((m,) => `${m.id}:${m.text}`),
    templates,
    tasks,
    resources,
  };
}

/** Snapshot consolidado dos seis fixtures (arquivo único do golden). */
export function buildTemplateGolden() {
  return {
    expansion: buildTemplateExpansionSnapshot(TEMPLATE_EXPANSION_FIXTURE,),
    args: buildTemplateExpansionSnapshot(TEMPLATE_ARGS_FIXTURE,),
    compose: buildTemplateExpansionSnapshot(TEMPLATE_COMPOSE_FIXTURE,),
    macros: buildTemplateExpansionSnapshot(TEMPLATE_MACROS_FIXTURE,),
    errors: buildTemplateExpansionSnapshot(TEMPLATE_ERRORS_FIXTURE,),
    lists: buildTemplateExpansionSnapshot(TEMPLATE_LISTS_FIXTURE,),
  };
}

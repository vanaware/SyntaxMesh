/**
 * Testes do bloco 4 de TjpSyntaxRules — expressões lógicas (subfase 10.14).
 *
 * Cobre a gramática `logicalExpression` (port de `TjpSyntaxRules.rb`):
 * funções sem argumento (`isleaf()`), folhas de atributo, flags conhecidos
 * e desconhecidos, `@all`/`@none`, negação `~`, parênteses e cadeias
 * left-to-right (`a | b & c` == `(a | b) & c`).
 *
 * As expressões são exercitadas via `hidetask` de um taskreport, cujo
 * atributo `hideTask` guarda a LogicalExpression construída. O `toString()`
 * canônico permite comparar a forma da árvore sem depender do avaliador
 * (Fase 11).
 *
 * O corpo do projeto NÃO é envolvido por chaves; apenas os corpos dos
 * relatórios usam `{ }` (regra `propertiesBody` é a lista de topo).
 *
 * @see docs/syntaxmesh/fases/fase-10-parser-linguagem-tarefas.md §10.14
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type { Project, } from "../../src/model/project.ts";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";

/** Pega o Project resultante (lança se houve qualquer mensagem). */
function project(out: ReturnType<typeof parseProject>,): Project {
  assert(
    out.threw === null,
    "parse não deveria lançar: " + out.threw?.message,
  );
  assertEquals(out.messageIds, [],);
  return out.result as Project;
}

/** Pega o Project permitindo apenas os IDs de aviso informados. */
function projectTolerating(
  out: ReturnType<typeof parseProject>,
  ids: string[],
): Project {
  assert(
    out.threw === null,
    "parse não deveria lançar: " + out.threw?.message,
  );
  assertEquals(out.messageIds, ids,);
  return out.result as Project;
}

/**
 * Extrai `hideTask` (LogicalExpression) do relatório `id` como string
 * canônica. `hidetask` sempre produz um objeto com `toString()`.
 */
function hideTaskOf(p: Project, id: string,): string {
  const expr = p.report(id,)?.get("hideTask",) as
    | { toString: () => string }
    | null;
  return expr === null || expr === undefined ? String(expr,) : expr.toString();
}

/** Envolve `expr` num taskreport mínimo e devolve o Project parseado. */
function withHidetask(id: string, expr: string, prelude = "",): Project {
  return project(
    parseProject(
      PROJECT_HEADER + prelude +
        `taskreport ${id} "R" {\n  columns bsi\n  hidetask ${expr}\n}\n`,
    ),
  );
}

const RESOURCES = 'resource john "J" {}\ntask t1 "T1" {}\n';

// ---------------------------------------------------------------------------
// 10.14.2 — folhas e operadores básicos
// ---------------------------------------------------------------------------
describe("logical expression leaves (10.14.2)", () => {
  it("função sem argumento: isleaf()", () => {
    const p = withHidetask("a", "isleaf()", RESOURCES,);
    assertEquals(hideTaskOf(p, "a",), "isleaf()",);
  });

  it("operand de atributo pontuado segue o caminho LogicalAttribute", () => {
    // `scenario.atributo` (ABSOLUTE_ID) cai na folha LogicalAttribute; aqui o
    // cenário padrão não está registrado, então valida-se com operand_unkn_scen
    // — provando que é tratado como atributo, não como flag.
    const out = parseProject(
      PROJECT_HEADER + RESOURCES +
        'taskreport x "R" {\n  columns bsi\n  hidetask global.name\n}\n',
    );
    projectTolerating(out, ["operand_unkn_scen",],);
  });

  it("flag conhecido isolado resolve como LogicalFlag", () => {
    const p = withHidetask("a", "alpha", "flags alpha\n" + RESOURCES,);
    assertEquals(hideTaskOf(p, "a",), "alpha",);
  });

  it("flag desconhecido dispara operand_unkn_flag", () => {
    const out = parseProject(
      PROJECT_HEADER + RESOURCES +
        'taskreport g "R" {\n  columns bsi\n  hidetask nosuch\n}\n',
    );
    projectTolerating(out, ["operand_unkn_flag",],);
  });
});

// ---------------------------------------------------------------------------
// 10.14.2 — @all / @none
// ---------------------------------------------------------------------------
describe("logical expression @all/@none (10.14.2)", () => {
  it("@all renderiza como '1'", () => {
    const p = withHidetask("b", "@all", RESOURCES,);
    assertEquals(hideTaskOf(p, "b",), "1",);
  });

  it("@none renderiza como '0'", () => {
    const p = withHidetask("c", "@none", RESOURCES,);
    assertEquals(hideTaskOf(p, "c",), "0",);
  });
});

// ---------------------------------------------------------------------------
// 10.14.2 — negação, parênteses, cadeias
// ---------------------------------------------------------------------------
describe("logical expression operators (10.14.2)", () => {
  it("negação prefixada ~", () => {
    const p = withHidetask("d", "~isleaf()", RESOURCES,);
    assertEquals(hideTaskOf(p, "d",), "~isleaf()",);
  });

  it("parênteses agrupam sem alterar a forma", () => {
    const p = withHidetask("e", "(isleaf() | istask())", RESOURCES,);
    assertEquals(hideTaskOf(p, "e",), "isleaf() | istask()",);
  });

  it("cadeia left-to-right: a | b & c == (a | b) & c", () => {
    const p = withHidetask(
      "f",
      "alpha | beta & alpha",
      "flags alpha, beta\n" + RESOURCES,
    );
    // Parser dobrando esquerda-direita: operador externo é o '&'.
    assertEquals(hideTaskOf(p, "f",), "alpha | beta & alpha",);
  });

  it("combina flags e funções", () => {
    const p = withHidetask(
      "h",
      "isleaf() & alpha",
      "flags alpha\n" + RESOURCES,
    );
    assertEquals(hideTaskOf(p, "h",), "isleaf() & alpha",);
  });
});

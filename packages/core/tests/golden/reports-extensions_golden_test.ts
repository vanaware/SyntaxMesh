/**
 * 14C.0.12 — Regressão do snapshot de extensões (Fase 14 Complemento).
 *
 * Re-gera o snapshot em memória e compara byte-a-byte com o golden
 * `reports-extensions.golden.json` commitado. Se a saída de qualquer
 * fundação do complemento mudar (json/table, picture html, galeria, índices
 * do Journal, fixture base), o teste falha — atualize o golden
 * conscientemente com `deno task golden:generate:extensions`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, } from "@std/assert";
import { buildExtensionSnapshot, } from "./extension-snapshot.ts";

describe("reports-extensions golden (14C.0.12)", () => {
  it("snapshot rebuilt é byte-idêntico ao golden commitado", () => {
    const goldenUrl = new URL(
      "./reports-extensions.golden.json",
      import.meta.url,
    );
    const committed = Deno.readTextFileSync(goldenUrl,);
    const rebuilt = JSON.stringify(buildExtensionSnapshot(), null, 2,) + "\n";
    assert(
      committed === rebuilt,
      "reports-extensions.golden.json desatualizado — rode " +
        "`deno task golden:generate:extensions` e revise o diff",
    );
  });
});

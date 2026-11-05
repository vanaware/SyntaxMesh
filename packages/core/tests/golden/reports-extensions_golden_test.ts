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
import { assert, assertEquals, } from "@std/assert";
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

  /**
   * 14C.5.11 — o snapshot do markdown nos relatórios precisa continuar
   * exercitando os três caminhos (`query`, `reportlink`, `report`) e os dois
   * dialetos; sem isto, um golden regenerado poderia "passar" com o bloco
   * vazio e esconder a regressão.
   */
  it("bloco markdownReports cobre query/reportlink/report nos dois dialetos", () => {
    const snapshot = buildExtensionSnapshot() as unknown as {
      markdownReports: Array<
        {
          id: string;
          format: string;
          header: string | null;
          footer: string | null;
        }
      >;
    };
    const byId = new Map(snapshot.markdownReports.map((r,) => [r.id, r,]),);
    assertEquals([...byId.keys(),], ["mdfuncs", "rtquery", "mddefault",],);

    const md = byId.get("mdfuncs",)!;
    assertEquals(md.format, "markdown",);
    const header = md.header ?? "";
    // `[[query:]]` resolvido no contexto do relatório.
    assert(header.includes("<span>2026-03-02</span>",), header,);
    // `[[reportlink:]]` para o nome do relatório alvo + `.html`.
    assert(header.includes('href="md-default.html"',), header,);
    // `[[report:]]` embute o HTML do alvo (título richtext do mddefault).
    assert(header.includes("<b>Forte</b> e //itálico//",), header,);
    // Açúcar `<-end->` no rodapé.
    assert(
      (md.footer ?? "").includes("<span>2026-03-31</span>",),
      md.footer ?? "",
    );

    // Mesmo `query` em MediaWiki: valor igual, sem o `<p>` do bloco markdown.
    const rt = byId.get("rtquery",)!;
    assertEquals(rt.format, "richtext",);
    assertEquals(rt.header, "<div><span>2026-03-02</span></div>",);

    // Default richtext (14C.5.10): `'''…'''` continua sendo o dialeto.
    const plain = byId.get("mddefault",)!;
    assertEquals(plain.format, "richtext",);
    assertEquals(plain.header, "<div>\n <b>Forte</b> e //itálico//</div>",);
  });
});

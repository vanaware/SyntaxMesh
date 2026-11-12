/**
 * Testes do `resolveLocale` (22.1.6): a diretiva `language "..."` do arquivo
 * é soberana; sem diretiva (ou idioma desconhecido) o default é `"en"`.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import { assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { resolveLocale, } from "../../src/lsp/locale.ts";

describe("resolveLocale (22.1.6)", () => {
  it("sem diretiva devolve en", () => {
    assertEquals(
      resolveLocale(
        "file:///a.tjp",
        'project p "P" "1.0" 2026-01-01 - 2026-02-01 {}',
      ),
      "en",
    );
  });

  it('language "en" devolve en', () => {
    assertEquals(
      resolveLocale(
        "file:///a.tjp",
        'language "en"\nproject p "P" "1.0" 2026-01-01 - 2026-02-01 {}',
      ),
      "en",
    );
  });

  it('language "pt-BR" devolve pt-br (normalizado)', () => {
    assertEquals(
      resolveLocale(
        "file:///a.tjp",
        'language "pt-BR"\nprojeto p "P" "1.0" 2026-01-01 - 2026-02-01 {}',
      ),
      "pt-br",
    );
    // Variante com underscore também normaliza.
    assertEquals(
      resolveLocale("file:///a.tjp", 'language "pt_BR"\n',),
      "pt-br",
    );
  });

  it('language "es" devolve es', () => {
    assertEquals(
      resolveLocale(
        "file:///a.tjp",
        'language "es"\nproyecto p "P" "1.0" 2026-01-01 - 2026-02-01 {}',
      ),
      "es",
    );
  });

  it("idioma desconhecido cai no default en", () => {
    assertEquals(resolveLocale("file:///a.tjp", 'language "fr"\n',), "en",);
  });
});

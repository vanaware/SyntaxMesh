/**
 * Contrato de versão do pacote.
 *
 * `version.ts` é gerado pelo buildit: o fonte declara `__APP_VERSION__` e cai em
 * `""`; só o bundle (montado a partir do `deno.jsonc` da raiz) expõe a versão
 * definitiva. Por isso nenhum teste aqui fixa número nem exige valor não vazio
 * — o que importa é a **derivação**: o barril publica exatamente o que o
 * arquivo gerado exporta, e `AppConfig` lê do barril.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.6.6)
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { AppConfig, VERSION, } from "../mod.ts";
import { APP_VERSION, } from "../src/version.ts";

describe("VERSION", () => {
  it("é o APP_VERSION do arquivo gerado, reexportado pelo barril", () => {
    assertEquals(VERSION, APP_VERSION,);
  });

  it("AppConfig.version deriva do barril", () => {
    assertEquals(AppConfig.version, VERSION,);
  });
});

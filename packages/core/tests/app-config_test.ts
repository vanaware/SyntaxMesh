import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { AppConfig, } from "../src/app-config.ts";

describe("AppConfig", () => {
  it("version armazena versão", () => {
    assertEquals(AppConfig.version, "0.0.0",);
  });

  it("packageName armazena nome do pacote", () => {
    assertEquals(AppConfig.packageName, "@syntaxmesh/core",);
  });

  it("softwareName armazena nome do software", () => {
    assertEquals(AppConfig.softwareName, "TaskJuggler 3",);
  });

  it("dataDirs retorna array vazio por padrão", () => {
    assertEquals(AppConfig.dataDirs("",), [],);
  });

  it("dataSearchDirs retorna array vazio por padrão", () => {
    assertEquals(AppConfig.dataSearchDirs("",), [],);
  });

  it("dataFiles retorna array vazio por padrão", () => {
    assertEquals(AppConfig.dataFiles("test.tjp",), [],);
  });

  it("dataFile retorna null por padrão", () => {
    assertEquals(AppConfig.dataFile("test.tjp",), null,);
  });
});

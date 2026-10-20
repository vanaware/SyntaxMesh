import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { AppConfig, } from "../src/app-config.ts";

describe("AppConfig", () => {
  it("packageName armazena nome do pacote", () => {
    assertEquals(AppConfig.packageName, "@vanaware/syntaxmesh",);
  });

  it("softwareName armazena nome do software", () => {
    assertEquals(AppConfig.softwareName, "SyntaxMesh",);
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

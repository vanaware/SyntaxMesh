/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Core Tests — Testes unitários do núcleo
// ============================================================================

import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { createProject, Project } from "../mod.ts";

describe("@syntaxmesh/core", () => {
  describe("createProject", () => {
    it("deve criar um projeto com nome válido", () => {
      const project = createProject("Projeto de Teste");
      
      assertEquals(project.name, "Projeto de Teste");
      assertEquals(typeof project.id.value, "string");
      assertEquals(project.id.value.length > 0, true);
      assertEquals(project.createdAt instanceof Date, true);
      assertEquals(project.updatedAt instanceof Date, true);
    });

    it("deve suportar descrição opcional", () => {
      const project = createProject("Projeto Sem Descricao");
      assertEquals(project.description, undefined);

      const projectComDesc = createProject(
        "Projeto Com Descricao",
        "Descricao teste",
      );
      assertEquals(projectComDesc.description, "Descricao teste");
    });
  });
});
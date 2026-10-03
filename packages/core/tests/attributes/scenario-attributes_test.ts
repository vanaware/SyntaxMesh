import { beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assert } from "@std/assert";
import { AttributeBase } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition } from "../../src/attributes/attribute-definition.ts";
import { AttributeType } from "../../src/attributes/attribute-type.ts";
import { MockContainer } from "./mock-container.ts";
import { MockProject } from "../model/mock-project.ts";
import { PropertySet } from "../../src/model/property-set.ts";

describe("ScenarioAttributes", () => {
  let container: MockContainer;
  let property: { id: string; name: string };
  let project: MockProject;

  beforeEach(async () => {
    AttributeBase.setMode(0);
    container = new MockContainer();
    project = new MockProject();
    property = { id: "test.attr", name: "Test Attr" };
  });

  describe("registerScenarioAttributes", () => {
    let ps: PropertySet;

    beforeEach(async () => {
      ps = new PropertySet(project, false);
    });

    it("registra 3 atributos específicos (excluindo base id, name, seqno, index)", async () => {
      const { registerScenarioAttributes } = await import(
        "../../src/model/attributes/scenario-attributes.ts",
      );
      registerScenarioAttributes(ps);

      let count = 0;
      ps.eachAttributeDefinition((attrDef) => {
        if (!["id", "name", "seqno", "index"].includes(attrDef.id)) {
          count++;
        }
      });
      assertEquals(count, 3);
    });

    it("registra active com atributos corretos", async () => {
      const { registerScenarioAttributes } = await import(
        "../../src/model/attributes/scenario-attributes.ts",
      );
      registerScenarioAttributes(ps);

      const attrDef = ps.attributeDefinition("active");
      assert(attrDef !== undefined, "active deve estar registrado");
      assertEquals(attrDef.id, "active");
      assertEquals(attrDef.name, "Enabled");
      assertEquals(attrDef.type, AttributeType.Boolean);
      assertEquals(attrDef.defaultValue, true);
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, false);
      assertEquals(attrDef.inheritedFromParent, true);
      assertEquals(attrDef.inheritedFromProject, false);
    });

    it("registra ownbookings com atributos corretos", async () => {
      const { registerScenarioAttributes } = await import(
        "../../src/model/attributes/scenario-attributes.ts",
      );
      registerScenarioAttributes(ps);

      const attrDef = ps.attributeDefinition("ownbookings");
      assert(attrDef !== undefined, "ownbookings deve estar registrado");
      assertEquals(attrDef.id, "ownbookings");
      assertEquals(attrDef.name, "Own Bookings");
      assertEquals(attrDef.type, AttributeType.Boolean);
      assertEquals(attrDef.defaultValue, true);
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, false);
      assertEquals(attrDef.inheritedFromParent, false);
      assertEquals(attrDef.inheritedFromProject, false);
    });

    it("registra projection com atributos corretos", async () => {
      const { registerScenarioAttributes } = await import(
        "../../src/model/attributes/scenario-attributes.ts",
      );
      registerScenarioAttributes(ps);

      const attrDef = ps.attributeDefinition("projection");
      assert(attrDef !== undefined, "projection deve estar registrado");
      assertEquals(attrDef.id, "projection");
      assertEquals(attrDef.name, "Projection Mode");
      assertEquals(attrDef.type, AttributeType.Boolean);
      assertEquals(attrDef.defaultValue, false);
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, false);
      assertEquals(attrDef.inheritedFromParent, true);
      assertEquals(attrDef.inheritedFromProject, false);
    });
  });
});
import { beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assert } from "@std/assert";
import { AttributeBase } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition } from "../../src/attributes/attribute-definition.ts";
import { AttributeType } from "../../src/attributes/attribute-type.ts";
import { MockContainer } from "./mock-container.ts";
import { MockProject } from "../model/mock-project.ts";
import { PropertySet } from "../../src/model/property-set.ts";

describe("ShiftAttributes", () => {
  let container: MockContainer;
  let property: { id: string; name: string };
  let project: MockProject;

  beforeEach(async () => {
    AttributeBase.setMode(0);
    container = new MockContainer();
    project = new MockProject();
    property = { id: "test.attr", name: "Test Attr" };
  });

  describe("registerShiftAttributes", () => {
    let ps: PropertySet;

    beforeEach(async () => {
      ps = new PropertySet(project, false);
    });

    it("registra 6 atributos específicos (excluindo base id, name, seqno, index)", async () => {
      const { registerShiftAttributes } = await import(
        "../../src/model/attributes/shift-attributes.ts",
      );
      registerShiftAttributes(ps);

      let count = 0;
      ps.eachAttributeDefinition((attrDef) => {
        if (!["id", "name", "seqno", "index"].includes(attrDef.id)) {
          count++;
        }
      });
      assertEquals(count, 6);
    });

    it("registra index com default -1 (sobrescreve base 0)", async () => {
      const { registerShiftAttributes } = await import(
        "../../src/model/attributes/shift-attributes.ts",
      );
      registerShiftAttributes(ps);

      const attrDef = ps.attributeDefinition("index");
      assert(attrDef !== undefined, "index deve estar registrado");
      assertEquals(attrDef.id, "index");
      assertEquals(attrDef.name, "Index");
      assertEquals(attrDef.type, AttributeType.Integer);
      assertEquals(attrDef.defaultValue, -1);
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, false);
      assertEquals(attrDef.inheritedFromParent, false);
      assertEquals(attrDef.inheritedFromProject, false);
    });

    it("registra bsi com atributos corretos", async () => {
      const { registerShiftAttributes } = await import(
        "../../src/model/attributes/shift-attributes.ts",
      );
      registerShiftAttributes(ps);

      const attrDef = ps.attributeDefinition("bsi");
      assert(attrDef !== undefined, "bsi deve estar registrado");
      assertEquals(attrDef.id, "bsi");
      assertEquals(attrDef.name, "BSI");
      assertEquals(attrDef.type, AttributeType.String);
      assertEquals(attrDef.defaultValue, "");
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, false);
      assertEquals(attrDef.inheritedFromParent, false);
      assertEquals(attrDef.inheritedFromProject, false);
    });

    it("registra leaves com atributos corretos", async () => {
      const { registerShiftAttributes } = await import(
        "../../src/model/attributes/shift-attributes.ts",
      );
      registerShiftAttributes(ps);

      const attrDef = ps.attributeDefinition("leaves");
      assert(attrDef !== undefined, "leaves deve estar registrado");
      assertEquals(attrDef.id, "leaves");
      assertEquals(attrDef.name, "Leaves");
      assertEquals(attrDef.type, AttributeType.LeaveList);
      assertEquals(attrDef.defaultValue, []);
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, true);
      assertEquals(attrDef.inheritedFromParent, true);
      assertEquals(attrDef.inheritedFromProject, true);
    });

    it("registra replace com atributos corretos", async () => {
      const { registerShiftAttributes } = await import(
        "../../src/model/attributes/shift-attributes.ts",
      );
      registerShiftAttributes(ps);

      const attrDef = ps.attributeDefinition("replace");
      assert(attrDef !== undefined, "replace deve estar registrado");
      assertEquals(attrDef.id, "replace");
      assertEquals(attrDef.name, "Replace");
      assertEquals(attrDef.type, AttributeType.Boolean);
      assertEquals(attrDef.defaultValue, false);
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, true);
      assertEquals(attrDef.inheritedFromParent, true);
      assertEquals(attrDef.inheritedFromProject, false);
    });

    it("registra timezone com atributos corretos", async () => {
      const { registerShiftAttributes } = await import(
        "../../src/model/attributes/shift-attributes.ts",
      );
      registerShiftAttributes(ps);

      const attrDef = ps.attributeDefinition("timezone");
      assert(attrDef !== undefined, "timezone deve estar registrado");
      assertEquals(attrDef.id, "timezone");
      assertEquals(attrDef.name, "Time Zone");
      assertEquals(attrDef.type, AttributeType.String);
      assertEquals(attrDef.defaultValue, "UTC");
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, true);
      assertEquals(attrDef.inheritedFromParent, true);
      assertEquals(attrDef.inheritedFromProject, true);
    });

    it("registra tree com atributos corretos", async () => {
      const { registerShiftAttributes } = await import(
        "../../src/model/attributes/shift-attributes.ts",
      );
      registerShiftAttributes(ps);

      const attrDef = ps.attributeDefinition("tree");
      assert(attrDef !== undefined, "tree deve estar registrado");
      assertEquals(attrDef.id, "tree");
      assertEquals(attrDef.name, "Tree Index");
      assertEquals(attrDef.type, AttributeType.String);
      assertEquals(attrDef.defaultValue, "");
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, false);
      assertEquals(attrDef.inheritedFromParent, false);
      assertEquals(attrDef.inheritedFromProject, false);
    });

    it("registra workinghours com atributos corretos", async () => {
      const { registerShiftAttributes } = await import(
        "../../src/model/attributes/shift-attributes.ts",
      );
      registerShiftAttributes(ps);

      const attrDef = ps.attributeDefinition("workinghours");
      assert(attrDef !== undefined, "workinghours deve estar registrado");
      assertEquals(attrDef.id, "workinghours");
      assertEquals(attrDef.name, "Working Hours");
      assertEquals(attrDef.type, AttributeType.WorkingHours);
      assertEquals(attrDef.defaultValue, null);
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, true);
      assertEquals(attrDef.inheritedFromParent, true);
      assertEquals(attrDef.inheritedFromProject, true);
    });
  });
});
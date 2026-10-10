import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { AttributeBase, } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition, } from "../../src/attributes/attribute-definition.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";
import { MockContainer, } from "./mock-container.ts";
import { MockProject, } from "../model/mock-project.ts";
import { PropertySet, } from "../../src/model/property-set.ts";

describe("AccountAttributes", () => {
  let container: MockContainer;
  let property: { id: string; name: string };
  let project: MockProject;

  beforeEach(() => {
    AttributeBase.setMode(0,);
    container = new MockContainer();
    project = new MockProject();
    property = { id: "test.attr", name: "Test Attr", };
  },);

  describe("registerAccountAttributes", () => {
    let ps: PropertySet;

    beforeEach(() => {
      ps = new PropertySet(project, false,);
    },);

    it("registra 5 atributos específicos (excluindo base id, name, seqno, index)", async () => {
      const { registerAccountAttributes, } = await import(
        "../../src/model/attributes/account-attributes.ts"
      );
      registerAccountAttributes(ps,);

      let count = 0;
      ps.eachAttributeDefinition((attrDef,) => {
        if (!["id", "name", "seqno", "index",].includes(attrDef.id,)) {
          count++;
        }
      },);
      assertEquals(count, 5,);
    });

    it("registra bsi com atributos corretos", async () => {
      const { registerAccountAttributes, } = await import(
        "../../src/model/attributes/account-attributes.ts"
      );
      registerAccountAttributes(ps,);

      const attrDef = ps.attributeDefinition("bsi",);
      assert(attrDef !== undefined, "bsi deve estar registrado",);
      assertEquals(attrDef.id, "bsi",);
      assertEquals(attrDef.name, "BSI",);
      assertEquals(attrDef.type, AttributeType.String,);
      assertEquals(attrDef.defaultValue, "",);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, false,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra index com default -1 (sobrescreve base 0)", async () => {
      const { registerAccountAttributes, } = await import(
        "../../src/model/attributes/account-attributes.ts"
      );
      registerAccountAttributes(ps,);

      const attrDef = ps.attributeDefinition("index",);
      assert(attrDef !== undefined, "index deve estar registrado",);
      assertEquals(attrDef.id, "index",);
      assertEquals(attrDef.name, "Index",);
      assertEquals(attrDef.type, AttributeType.Integer,);
      assertEquals(attrDef.defaultValue, -1,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, false,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra aggregate com atributos corretos", async () => {
      const { registerAccountAttributes, } = await import(
        "../../src/model/attributes/account-attributes.ts"
      );
      registerAccountAttributes(ps,);

      const attrDef = ps.attributeDefinition("aggregate",);
      assert(attrDef !== undefined, "aggregate deve estar registrado",);
      assertEquals(attrDef.id, "aggregate",);
      assertEquals(attrDef.name, "Aggregate",);
      assertEquals(attrDef.type, AttributeType.Symbol,);
      assertEquals(attrDef.defaultValue, "tasks",);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, false,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra credits com atributos corretos", async () => {
      const { registerAccountAttributes, } = await import(
        "../../src/model/attributes/account-attributes.ts"
      );
      registerAccountAttributes(ps,);

      const attrDef = ps.attributeDefinition("credits",);
      assert(attrDef !== undefined, "credits deve estar registrado",);
      assertEquals(attrDef.id, "credits",);
      assertEquals(attrDef.name, "Credits",);
      assertEquals(attrDef.type, AttributeType.AccountCreditList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra flags com atributos corretos", async () => {
      const { registerAccountAttributes, } = await import(
        "../../src/model/attributes/account-attributes.ts"
      );
      registerAccountAttributes(ps,);

      const attrDef = ps.attributeDefinition("flags",);
      assert(attrDef !== undefined, "flags deve estar registrado",);
      assertEquals(attrDef.id, "flags",);
      assertEquals(attrDef.name, "Flags",);
      assertEquals(attrDef.type, AttributeType.FlagList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra tree com atributos corretos", async () => {
      const { registerAccountAttributes, } = await import(
        "../../src/model/attributes/account-attributes.ts"
      );
      registerAccountAttributes(ps,);

      const attrDef = ps.attributeDefinition("tree",);
      assert(attrDef !== undefined, "tree deve estar registrado",);
      assertEquals(attrDef.id, "tree",);
      assertEquals(attrDef.name, "Tree Index",);
      assertEquals(attrDef.type, AttributeType.String,);
      assertEquals(attrDef.defaultValue, "",);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, false,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });
  });
});

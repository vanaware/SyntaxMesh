import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, assert, } from "@std/assert";
import { AttributeBase, } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition, } from "../../src/attributes/attribute-definition.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";
import { MockContainer, } from "./mock-container.ts";
import { MockProject, } from "../model/mock-project.ts";
import { PropertySet, } from "../../src/model/property-set.ts";

describe("ReportAttributes", () => {
  let container: MockContainer;
  let property: { id: string; name: string };
  let project: MockProject;

  beforeEach(async () => {
    AttributeBase.setMode(0,);
    container = new MockContainer();
    project = new MockProject();
    property = { id: "test.attr", name: "Test Attr", };
  },);

  describe("registerReportAttributes", () => {
    let ps: PropertySet;

    beforeEach(async () => {
      ps = new PropertySet(project, false);
    },);

    it("registra 35 atributos específicos (excluindo base id, name, seqno, index)", async () => {
      const { registerReportAttributes } = await import(
        "../../src/model/attributes/report-attributes.ts",
      );
      registerReportAttributes(ps,);

      let count = 0;
      ps.eachAttributeDefinition((attrDef,) => {
        if (!["id", "name", "seqno", "index",].includes(attrDef.id,)) {
          count++;
        }
      },);
      assertEquals(count, 59,);
    },);

    it("registra accountroot com atributos corretos", async () => {
      const { registerReportAttributes } = await import(
        "../../src/model/attributes/report-attributes.ts",
      );
      registerReportAttributes(ps,);

      const attrDef = ps.attributeDefinition("accountroot");
      assert(attrDef !== undefined, "accountroot deve estar registrado");
      assertEquals(attrDef.id, "accountroot");
      assertEquals(attrDef.name, "Account Root");
      assertEquals(attrDef.type, AttributeType.String);
      assertEquals(attrDef.defaultValue, "");
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, false);
      assertEquals(attrDef.inheritedFromParent, false);
      assertEquals(attrDef.inheritedFromProject, false);
    },);

    it("registra bsi com atributos corretos", async () => {
      const { registerReportAttributes } = await import(
        "../../src/model/attributes/report-attributes.ts",
      );
      registerReportAttributes(ps,);

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
    },);

    it("registra flags (FlagList) com atributos corretos", async () => {
      const { registerReportAttributes } = await import(
        "../../src/model/attributes/report-attributes.ts",
      );
      registerReportAttributes(ps,);

      const attrDef = ps.attributeDefinition("flags");
      assert(attrDef !== undefined, "flags deve estar registrado");
      assertEquals(attrDef.id, "flags");
      assertEquals(attrDef.name, "Flags");
      assertEquals(attrDef.type, AttributeType.FlagList);
      assertEquals(attrDef.defaultValue, []);
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, false);
      assertEquals(attrDef.inheritedFromParent, false);
      assertEquals(attrDef.inheritedFromProject, false);
    },);

    it("registra scenarios (ScenarioList) com atributos corretos", async () => {
      const { registerReportAttributes } = await import(
        "../../src/model/attributes/report-attributes.ts",
      );
      registerReportAttributes(ps,);

      const attrDef = ps.attributeDefinition("scenarios");
      assert(attrDef !== undefined, "scenarios deve estar registrado");
      assertEquals(attrDef.id, "scenarios");
      assertEquals(attrDef.name, "Scenarios");
      assertEquals(attrDef.type, AttributeType.ScenarioList);
      assertEquals(attrDef.defaultValue, []);
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, false);
      assertEquals(attrDef.inheritedFromParent, false);
      assertEquals(attrDef.inheritedFromProject, false);
    },);

    it("registra height (Integer) com atributos corretos", async () => {
      const { registerReportAttributes } = await import(
        "../../src/model/attributes/report-attributes.ts",
      );
      registerReportAttributes(ps,);

      const attrDef = ps.attributeDefinition("height");
      assert(attrDef !== undefined, "height deve estar registrado");
      assertEquals(attrDef.id, "height");
      assertEquals(attrDef.name, "Height");
      assertEquals(attrDef.type, AttributeType.Integer);
      assertEquals(attrDef.defaultValue, 0);
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, false);
      assertEquals(attrDef.inheritedFromParent, false);
      assertEquals(attrDef.inheritedFromProject, false);
    },);

    it("registra width (Integer) com atributos corretos", async () => {
      const { registerReportAttributes } = await import(
        "../../src/model/attributes/report-attributes.ts",
      );
      registerReportAttributes(ps,);

      const attrDef = ps.attributeDefinition("width");
      assert(attrDef !== undefined, "width deve estar registrado");
      assertEquals(attrDef.id, "width");
      assertEquals(attrDef.name, "Width");
      assertEquals(attrDef.type, AttributeType.Integer);
      assertEquals(attrDef.defaultValue, 0);
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, false);
      assertEquals(attrDef.inheritedFromParent, false);
      assertEquals(attrDef.inheritedFromProject, false);
    },);

    it("registra title (String) com atributos corretos", async () => {
      const { registerReportAttributes } = await import(
        "../../src/model/attributes/report-attributes.ts",
      );
      registerReportAttributes(ps,);

      const attrDef = ps.attributeDefinition("title");
      assert(attrDef !== undefined, "title deve estar registrado");
      assertEquals(attrDef.id, "title");
      assertEquals(attrDef.name, "Title");
      assertEquals(attrDef.type, AttributeType.String);
      assertEquals(attrDef.defaultValue, "");
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, false);
      assertEquals(attrDef.inheritedFromParent, false);
      assertEquals(attrDef.inheritedFromProject, false);
    },);

    it("registra timezone (String) com atributos corretos", async () => {
      const { registerReportAttributes } = await import(
        "../../src/model/attributes/report-attributes.ts",
      );
      registerReportAttributes(ps,);

      const attrDef = ps.attributeDefinition("timezone");
      assert(attrDef !== undefined, "timezone deve estar registrado");
      assertEquals(attrDef.id, "timezone");
      assertEquals(attrDef.name, "Time Zone");
      assertEquals(attrDef.type, AttributeType.String);
      assertEquals(attrDef.defaultValue, "");
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, false);
      assertEquals(attrDef.inheritedFromParent, false);
      assertEquals(attrDef.inheritedFromProject, false);
    },);

    it("registra tree (String) com atributos corretos", async () => {
      const { registerReportAttributes } = await import(
        "../../src/model/attributes/report-attributes.ts",
      );
      registerReportAttributes(ps,);

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
    },);

    it("registra weekStartsMonday (Boolean) com atributos corretos", async () => {
      const { registerReportAttributes } = await import(
        "../../src/model/attributes/report-attributes.ts",
      );
      registerReportAttributes(ps,);

      const attrDef = ps.attributeDefinition("weekStartsMonday");
      assert(attrDef !== undefined, "weekStartsMonday deve estar registrado");
      assertEquals(attrDef.id, "weekStartsMonday");
      assertEquals(attrDef.name, "Week Starts Monday");
      assertEquals(attrDef.type, AttributeType.Boolean);
      assertEquals(attrDef.defaultValue, false);
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, false);
      assertEquals(attrDef.inheritedFromParent, false);
      assertEquals(attrDef.inheritedFromProject, false);
    },);

    it("registra novevents (Boolean) com atributos corretos", async () => {
      const { registerReportAttributes } = await import(
        "../../src/model/attributes/report-attributes.ts",
      );
      registerReportAttributes(ps,);

      const attrDef = ps.attributeDefinition("novevents");
      assert(attrDef !== undefined, "novevents deve estar registrado");
      assertEquals(attrDef.id, "novevents");
      assertEquals(attrDef.name, "No Events");
      assertEquals(attrDef.type, AttributeType.Boolean);
      assertEquals(attrDef.defaultValue, false);
      assertEquals(attrDef.userDefined, false);
      assertEquals(attrDef.isList, false);
      assertEquals(attrDef.isSingleton, false);
      assertEquals(attrDef.isScenarioAttribute, false);
      assertEquals(attrDef.inheritedFromParent, false);
      assertEquals(attrDef.inheritedFromProject, false);
    },);
  },);
});
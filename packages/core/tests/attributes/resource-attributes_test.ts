import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { AttributeBase, } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition, } from "../../src/attributes/attribute-definition.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";
import { MockContainer, } from "./mock-container.ts";
import { MockProject, } from "../model/mock-project.ts";
import { PropertySet, } from "../../src/model/property-set.ts";

describe("ResourceAttributes", () => {
  let container: MockContainer;
  let property: { id: string; name: string };
  let project: MockProject;

  beforeEach(() => {
    AttributeBase.setMode(0,);
    container = new MockContainer();
    project = new MockProject();
    property = { id: "test.attr", name: "Test Attr", };
  },);

  describe("registerResourceAttributes", () => {
    let ps: PropertySet;

    beforeEach(() => {
      ps = new PropertySet(project, false,);
    },);

    it("registra 22 atributos específicos (excluindo base id, name, seqno, index)", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      let count = 0;
      ps.eachAttributeDefinition((attrDef,) => {
        if (!["id", "name", "seqno", "index",].includes(attrDef.id,)) {
          count++;
        }
      },);
      assertEquals(count, 21,);
    });

    it("registra bsi com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

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
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

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

    it("registra alloctdeffort com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      const attrDef = ps.attributeDefinition("alloctdeffort",);
      assert(attrDef !== undefined, "alloctdeffort deve estar registrado",);
      assertEquals(attrDef.id, "alloctdeffort",);
      assertEquals(attrDef.name, "Alloctd. Effort",);
      assertEquals(attrDef.type, AttributeType.Float,);
      assertEquals(attrDef.defaultValue, 0.0,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra chargeset com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      const attrDef = ps.attributeDefinition("chargeset",);
      assert(attrDef !== undefined, "chargeset deve estar registrado",);
      assertEquals(attrDef.id, "chargeset",);
      assertEquals(attrDef.name, "Charge Sets",);
      assertEquals(attrDef.type, AttributeType.ChargeSetList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra criticalness com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      const attrDef = ps.attributeDefinition("criticalness",);
      assert(attrDef !== undefined, "criticalness deve estar registrado",);
      assertEquals(attrDef.id, "criticalness",);
      assertEquals(attrDef.name, "Criticalness",);
      assertEquals(attrDef.type, AttributeType.Float,);
      assertEquals(attrDef.defaultValue, 0.0,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra duties com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      const attrDef = ps.attributeDefinition("duties",);
      assert(attrDef !== undefined, "duties deve estar registrado",);
      assertEquals(attrDef.id, "duties",);
      assertEquals(attrDef.name, "Duties",);
      assertEquals(attrDef.type, AttributeType.TaskList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra directreports com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      const attrDef = ps.attributeDefinition("directreports",);
      assert(attrDef !== undefined, "directreports deve estar registrado",);
      assertEquals(attrDef.id, "directreports",);
      assertEquals(attrDef.name, "Direct Reports",);
      assertEquals(attrDef.type, AttributeType.ResourceList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra efficiency com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      const attrDef = ps.attributeDefinition("efficiency",);
      assert(attrDef !== undefined, "efficiency deve estar registrado",);
      assertEquals(attrDef.id, "efficiency",);
      assertEquals(attrDef.name, "Efficiency",);
      assertEquals(attrDef.type, AttributeType.Float,);
      assertEquals(attrDef.defaultValue, 1.0,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra effort com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      const attrDef = ps.attributeDefinition("effort",);
      assert(attrDef !== undefined, "effort deve estar registrado",);
      assertEquals(attrDef.id, "effort",);
      assertEquals(attrDef.name, "Total Effort",);
      assertEquals(attrDef.type, AttributeType.Integer,);
      assertEquals(attrDef.defaultValue, 0,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra email com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      const attrDef = ps.attributeDefinition("email",);
      assert(attrDef !== undefined, "email deve estar registrado",);
      assertEquals(attrDef.id, "email",);
      assertEquals(attrDef.name, "Email",);
      assertEquals(attrDef.type, AttributeType.String,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, false,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra flags com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

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

    it("registra leaveallowances com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      const attrDef = ps.attributeDefinition("leaveallowances",);
      assert(attrDef !== undefined, "leaveallowances deve estar registrado",);
      assertEquals(attrDef.id, "leaveallowances",);
      assertEquals(attrDef.name, "Leave Allowances",);
      assertEquals(attrDef.type, AttributeType.LeaveAllowanceList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra leaves com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      const attrDef = ps.attributeDefinition("leaves",);
      assert(attrDef !== undefined, "leaves deve estar registrado",);
      assertEquals(attrDef.id, "leaves",);
      assertEquals(attrDef.name, "Leaves",);
      assertEquals(attrDef.type, AttributeType.LeaveList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, true,);
    });

    it("registra limits com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      const attrDef = ps.attributeDefinition("limits",);
      assert(attrDef !== undefined, "limits deve estar registrado",);
      assertEquals(attrDef.id, "limits",);
      assertEquals(attrDef.name, "Limits",);
      assertEquals(attrDef.type, AttributeType.Limits,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, true,);
    });

    it("registra managers com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      const attrDef = ps.attributeDefinition("managers",);
      assert(attrDef !== undefined, "managers deve estar registrado",);
      assertEquals(attrDef.id, "managers",);
      assertEquals(attrDef.name, "Managers",);
      assertEquals(attrDef.type, AttributeType.ResourceList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra rate com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      const attrDef = ps.attributeDefinition("rate",);
      assert(attrDef !== undefined, "rate deve estar registrado",);
      assertEquals(attrDef.id, "rate",);
      assertEquals(attrDef.name, "Rate",);
      assertEquals(attrDef.type, AttributeType.Float,);
      assertEquals(attrDef.defaultValue, 0.0,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, true,);
    });

    it("registra reports com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      const attrDef = ps.attributeDefinition("reports",);
      assert(attrDef !== undefined, "reports deve estar registrado",);
      assertEquals(attrDef.id, "reports",);
      assertEquals(attrDef.name, "Reports",);
      assertEquals(attrDef.type, AttributeType.ResourceList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra shifts com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      const attrDef = ps.attributeDefinition("shifts",);
      assert(attrDef !== undefined, "shifts deve estar registrado",);
      assertEquals(attrDef.id, "shifts",);
      assertEquals(attrDef.name, "Shifts",);
      assertEquals(attrDef.type, AttributeType.ShiftAssignments,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra tree com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

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

    it("registra warn com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      const attrDef = ps.attributeDefinition("warn",);
      assert(attrDef !== undefined, "warn deve estar registrado",);
      assertEquals(attrDef.id, "warn",);
      assertEquals(attrDef.name, "Warning Condition",);
      assertEquals(attrDef.type, AttributeType.LogicalExpressionList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, false,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra workinghours com atributos corretos", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      const attrDef = ps.attributeDefinition("workinghours",);
      assert(attrDef !== undefined, "workinghours deve estar registrado",);
      assertEquals(attrDef.id, "workinghours",);
      assertEquals(attrDef.name, "Working Hours",);
      assertEquals(attrDef.type, AttributeType.WorkingHours,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, true,);
    });

    it("registra rate, leaves, workinghours, limits com inheritedFromProject=true", async () => {
      const { registerResourceAttributes, } = await import(
        "../../src/model/attributes/resource-attributes.ts"
      );
      registerResourceAttributes(ps,);

      for (const id of ["rate", "leaves", "workinghours", "limits",]) {
        const attrDef = ps.attributeDefinition(id,);
        assert(attrDef !== undefined, `${id} deve estar registrado`,);
        assertEquals(
          attrDef.inheritedFromProject,
          true,
          `${id} deve herdar do projeto`,
        );
      }
    });
  });
});

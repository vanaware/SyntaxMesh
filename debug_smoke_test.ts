//!/usr/bin/env tsx
import { createTestProject, } from "./packages/core/tests/fixtures/create-test-project.ts";
import { PropertySet, } from "./packages/core/src/model/property-set.ts";
import { PropertyTreeNode, } from "./packages/core/src/model/property-tree-node.ts";
import { AttributeBase, } from "./packages/core/src/attributes/attribute-base.ts";
import { AttributeType, } from "./packages/core/src/attributes/attribute-type.ts";

function makeMockAttrClass(defaultValue: unknown,) {
  return class MockAttribute extends AttributeBase<unknown> {
    constructor(
      property: any,
      type: any,
      container: any,
    ) {
      super(property, type, container,);
    }
    override set(value: unknown,) {
      super.set(value as never,);
    }
    override get() {
      return this._value;
    }
  };
}

console.log("=== Debugging smoke test ===");

const project = createTestProject(1,);
const propertySet = new PropertySet(project, false,);
propertySet.addAttributeType({
  id: "effort",
  name: "Effort",
  objClass: makeMockAttrClass(0,),
  inheritedFromParent: false,
  inheritedFromProject: false,
  defaultValue: 0,
  type: AttributeType.Integer,
  userDefined: false,
  isList: false,
  isSingleton: false,
  isScenarioAttribute: false, // Note: effort is NOT a scenario attribute
},);
const task = new PropertyTreeNode(propertySet, "task", "Task", null,);

console.log("\n1. After task.set('effort', 3600):");
task.set("effort", 3600,);
console.log("   task.get('effort'):", task.get("effort",),);

console.log("\n2. After project.getScenarioAttribute(0, 'effort'):");
try {
  const attr = project.getScenarioAttribute(0, "effort",);
  console.log("   Success! attr:", attr, "value:", attr?.get(),);
} catch (e) {
  console.log("   Error:", e, "message:", e.message,);
}

console.log("\n=== End debug ===");
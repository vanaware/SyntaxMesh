import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { MockProject, } from "./mock-project.ts";
import { PropertySet, } from "../../src/model/property-set.ts";
import { PropertyTreeNode, } from "../../src/model/property-tree-node.ts";
import { PTNProxy, } from "../../src/model/ptn-proxy.ts";
import {
  AttributeDefinition,
  AttributeType,
} from "../../src/attributes/attribute-definition.ts";

class TestProperty extends PropertyTreeNode {
  constructor(
    propertySet: PropertySet,
    id: string | null,
    name: string,
    parent: PropertyTreeNode | null,
  ) {
    super(propertySet, id, name, parent,);
  }
}

describe("PTNProxy", () => {
  let project: MockProject;
  let propertySet: PropertySet;
  let root: TestProperty;
  let child: TestProperty;

  beforeEach(() => {
    project = new MockProject(2,);
    propertySet = new PropertySet(project, false,);
    root = new TestProperty(propertySet, null, "root", null,);
    child = new TestProperty(propertySet, null, "child", root,);
  },);

  it("rejeita parent nulo", () => {
    assertThrows(
      () => new PTNProxy(child, null as unknown as PropertyTreeNode,),
      Error,
    );
  });

  it("logicalId respeita namespace plano", () => {
    const flatSet = new PropertySet(project, true,);
    const flatRoot = new TestProperty(flatSet, null, "root", null,);
    const flatChild = new TestProperty(flatSet, null, "child", flatRoot,);
    const proxy = new PTNProxy(flatChild, flatRoot,);
    assertEquals(proxy.logicalId(), flatChild.id,);
  });

  it("logicalId respeita namespace hierarquico", () => {
    const proxy = new PTNProxy(child, root,);
    assertEquals(proxy.logicalId(), child.id,);
  });

  it("get delega ao ptn", () => {
    const attrDef = new AttributeDefinition(
      "testAttr",
      "Test Attr",
      AttributeType.String,
      "default",
    );
    const newPropertySet = new PropertySet(project, false,);
    newPropertySet.addAttributeType(attrDef,);
    const newRoot = new TestProperty(newPropertySet, null, "root", null,);
    const newChild = new TestProperty(newPropertySet, null, "child", newRoot,);
    newChild.set("testAttr", "value",);
    const proxy = new PTNProxy(newChild, newRoot,);
    assertEquals(proxy.get("testAttr",), "value",);
  });

  it("set delega ao ptn", () => {
    const attrDef = new AttributeDefinition(
      "testAttr",
      "Test Attr",
      AttributeType.String,
      "default",
    );
    const newPropertySet = new PropertySet(project, false,);
    newPropertySet.addAttributeType(attrDef,);
    const newRoot = new TestProperty(newPropertySet, null, "root", null,);
    const newChild = new TestProperty(newPropertySet, null, "child", newRoot,);
    const proxy = new PTNProxy(newChild, newRoot,);
    proxy.set("testAttr", "value",);
    assertEquals(newChild.get("testAttr",), "value",);
  });

  it("level cacheado", () => {
    const proxy = new PTNProxy(child, root,);
    assertEquals(proxy.level, 2,);
  });

  it("isChildOf retorna true", () => {
    const proxy = new PTNProxy(child, root,);
    assertEquals(proxy.isChildOf(root,), true,);
  });

  it("isChildOf retorna false", () => {
    const proxy = new PTNProxy(child, root,);
    assertEquals(proxy.isChildOf(child,), false,);
  });

  it("getIndicies retorna array", () => {
    const proxy = new PTNProxy(child, root,);
    assertEquals(Array.isArray(proxy.getIndicies(),), true,);
  });

  it("ptn retorna PropertyTreeNode", () => {
    const proxy = new PTNProxy(child, root,);
    assertEquals(proxy.ptn(), child,);
  });
});

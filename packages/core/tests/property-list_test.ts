import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { MockProject, } from "./mock-project.ts";
import {
  PropertySet,
  PropertyTreeNode,
} from "../src/model/property-tree-node.ts";
import { PropertyList, } from "../src/model/property-list.ts";

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

describe("PropertyList", () => {
  let project: MockProject;
  let propertySet: PropertySet;

  beforeEach(() => {
    project = new MockProject("test-project",);
    propertySet = new PropertySet(project, false,);
  },);

  it("push adiciona item", () => {
    const list = new PropertyList<TestProperty>(propertySet,);
    const root = new TestProperty(propertySet, null, "root", null,);
    list.push(root,);
    assertEquals(list.length(), 1,);
    assertEquals(list.get(0,), root,);
  });

  it("get retorna item por índice", () => {
    const list = new PropertyList<TestProperty>(propertySet,);
    const root = new TestProperty(propertySet, null, "root", null,);
    list.push(root,);
    assertEquals(list.get(0,), root,);
  });

  it("includes verifica presença", () => {
    const list = new PropertyList<TestProperty>(propertySet,);
    const root = new TestProperty(propertySet, null, "root", null,);
    list.push(root,);
    assertEquals(list.includes(root,), true,);
    assertEquals(
      list.includes(new TestProperty(propertySet, null, "other", null,),),
      false,
    );
  });

  it("find retorna item correspondente", () => {
    const list = new PropertyList<TestProperty>(propertySet,);
    const root = new TestProperty(propertySet, null, "root", null,);
    const child = new TestProperty(propertySet, null, "child", root,);
    list.push(root,);
    list.push(child,);
    assertEquals(list.find((item,) => item.name === "child"), child,);
    assertEquals(list.find((item,) => item.name === "nonexistent"), null,);
  });

  it("delete remove item", () => {
    const list = new PropertyList<TestProperty>(propertySet,);
    const root = new TestProperty(propertySet, null, "root", null,);
    list.push(root,);
    assertEquals(list.length(), 1,);
    list.delete(0,);
    assertEquals(list.length(), 0,);
  });

  it("clear remove todos os itens", () => {
    const list = new PropertyList<TestProperty>(propertySet,);
    const root = new TestProperty(propertySet, null, "root", null,);
    const child = new TestProperty(propertySet, null, "child", root,);
    list.push(root,);
    list.push(child,);
    assertEquals(list.length(), 2,);
    list.clear();
    assertEquals(list.length(), 0,);
  });

  it("toArray retorna cópia do array", () => {
    const list = new PropertyList<TestProperty>(propertySet,);
    const root = new TestProperty(propertySet, null, "root", null,);
    list.push(root,);
    const array = list.toArray();
    assertEquals(array.length, 1,);
    assertEquals(array[0], root,);
    // Modificar o array original não deve afetar a PropertyList
    array.push(new TestProperty(propertySet, null, "extra", null,),);
    assertEquals(list.length(), 1,);
  });

  it("iterator itera sobre itens", () => {
    const list = new PropertyList<TestProperty>(propertySet,);
    const root = new TestProperty(propertySet, null, "root", null,);
    const child = new TestProperty(propertySet, null, "child", root,);
    list.push(root,);
    list.push(child,);
    const items = [];
    for (const item of list) {
      items.push(item,);
    }
    assertEquals(items.length, 2,);
    assertEquals(items[0], root,);
    assertEquals(items[1], child,);
  });
});

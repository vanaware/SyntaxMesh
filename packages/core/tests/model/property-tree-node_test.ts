import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { MockProject, } from "./mock-project.ts";
import { PropertyTreeNode, PropertySet, } from "../../src/model/property-tree-node.ts";
import { AttributeDefinition, AttributeType, } from "../../src/attributes/attribute-definition.ts";

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

describe("PropertyTreeNode", () => {
  let project: MockProject;
  let propertySet: PropertySet;
  let root: TestProperty;

  beforeEach(() => {
    project = new MockProject(2);
    propertySet = new PropertySet(project, false);
    root = new TestProperty(propertySet, null, "root", null,);
  },);

  // Helper to create a new PropertySet with custom attributes
  const createPropertySetWithCustomAttr = (attrDef: AttributeDefinition<string>) => {
    const newProject = new MockProject(2);
    const newPropertySet = new PropertySet(newProject, false);
    newPropertySet.addAttributeType(attrDef);
    return newPropertySet;
  };

  it("cria nó raiz com id gerado", () => {
    assertEquals(root.id, "_TestProperty_1");
    assertEquals(root.name, "root");
    assertEquals(root.level, 1);
  });

  it("cria nó filho com id completo", () => {
    const child = new TestProperty(propertySet, null, "child", root,);
    assertEquals(child.id, "_TestProperty_1.child");
    assertEquals(child.name, "child");
    assertEquals(child.level, 2);
  });

  it("usa id fornecido se não nulo", () => {
    const custom = new TestProperty(propertySet, "custom.id", "custom", root,);
    assertEquals(custom.id, "custom.id");
    assertEquals(custom.name, "custom");
  });

  it("retorna fullId correto para namespace plano", () => {
    const flatSet = new PropertySet(project, true);
    const flatRoot = new TestProperty(flatSet, null, "root", null,);
    assertEquals(flatRoot.id, "_TestProperty_1");
  });

  it("retorna fullId correto para namespace não plano", () => {
    assertEquals(root.id, "_TestProperty_1");
    const child = new TestProperty(propertySet, null, "child", root,);
    assertEquals(child.id, "_TestProperty_1.child");
    const grandchild = new TestProperty(propertySet, null, "grandchild", child,);
    assertEquals(grandchild.id, "_TestProperty_1.child.grandchild");
  });

  it("retorna nó raiz", () => {
    const child = new TestProperty(propertySet, null, "child", root,);
    const grandchild = new TestProperty(propertySet, null, "grandchild", child,);
    assertEquals(grandchild.root(), root);
  });

  it("retorna ancestros", () => {
    const child = new TestProperty(propertySet, null, "child", root,);
    const grandchild = new TestProperty(propertySet, null, "grandchild", child,);
    assertEquals(grandchild.ancestors(), [root, child]);
  });

  it("verifica se é filho de", () => {
    const child = new TestProperty(propertySet, null, "child", root,);
    assertEquals(child.isChildOf(root), true);
    assertEquals(root.isChildOf(child), false);
  });

  it("retorna true para nó folha", () => {
    assertEquals(root.leaf(), true);
    const child = new TestProperty(propertySet, null, "child", root,);
    assertEquals(child.leaf(), true);
  });

  it("retorna false para nó container", () => {
    assertEquals(root.container(), false);
    const child = new TestProperty(propertySet, null, "child", root,);
    assertEquals(child.container(), false);
  });

  it("retorna filhos e adotados", () => {
    const child1 = new TestProperty(propertySet, null, "child1", root,);
    const child2 = new TestProperty(propertySet, null, "child2", root,);
    assertEquals(root.kids().length, 2);
    assertEquals(root.children.length, 2);
    assertEquals(root.adoptees.length, 0);
  });

  it("retorna pais", () => {
    const child = new TestProperty(propertySet, null, "child", root,);
    assertEquals(child.parents(), [root]);
  });

  it("retorna todos os nós na árvore", () => {
    const child = new TestProperty(propertySet, null, "child", root,);
    const grandchild = new TestProperty(propertySet, null, "grandchild", child,);
    assertEquals(root.all().length, 3);
    assertEquals(child.all().length, 2);
    assertEquals(grandchild.all().length, 1);
  });

  it("retorna todas as folhas", () => {
    const child = new TestProperty(propertySet, null, "child", root,);
    const grandchild = new TestProperty(propertySet, null, "grandchild", child,);
    assertEquals(root.all().length, 3);
    assertEquals(child.allLeaves(true).length, 1);
  });

  it("retorna índices BS", () => {
    const child = new TestProperty(propertySet, null, "child", root,);
    const grandchild = new TestProperty(propertySet, null, "grandchild", child,);
    assertEquals(grandchild.getBSIndicies(), [1, 1]);
  });

  it("retorna índices", () => {
    const child = new TestProperty(propertySet, null, "child", root,);
    const grandchild = new TestProperty(propertySet, null, "grandchild", child,);
    assertEquals(grandchild.getIndicies(), []);
  });

  it("retorna nível seq no", () => {
    const child = new TestProperty(propertySet, null, "child", root,);
    assertEquals(root.levelSeqNo(child), 1);
  });

  it("adiciona filho", () => {
    const child = new TestProperty(propertySet, null, "child", root,);
    assertEquals(root.children.length, 1);
  });

  it("remove referências", () => {
    const child = new TestProperty(propertySet, null, "child", root,);
    root.removeReferences(child);
    assertEquals(root.children.length, 0);
  });

  it("getStoredValue retorna null para atributo não definido", () => {
    assertEquals(root.getStoredValue("nonexistent"), null);
  });

  it("setStoredValue define atributo", () => {
    root.setStoredValue("test", "value");
    assertEquals(root.getStoredValue("test"), "value");
  });

  it("attribute lança erro para atributo desconhecido", () => {
    assertThrows(() => root.attribute("unknown"), Error);
  });

  it("attribute lança erro para atributo específico de cenário", () => {
    const attrDef = new AttributeDefinition(
      "scenarioAttr",
      "Scenario Attr",
      AttributeType.String,
      "default",
      false, false, false, true,
    );
    const newPropertySet = createPropertySetWithCustomAttr(attrDef);
    const newRoot = new TestProperty(newPropertySet, null, "root", null,);
    assertThrows(() => newRoot.attribute("scenarioAttr"), Error);
  });

  it("attribute cria atributo não específico de cenário", () => {
    const attrDef = new AttributeDefinition(
      "testAttr",
      "Test Attr",
      AttributeType.String,
      "default",
    );
    const newPropertySet = createPropertySetWithCustomAttr(attrDef);
    const newRoot = new TestProperty(newPropertySet, null, "root", null,);
    const attr = newRoot.attribute("testAttr");
    assertEquals(attr, newRoot.getAttribute("testAttr"));
  });

  it("get retorna valor do atributo", () => {
    const attrDef = new AttributeDefinition(
      "testAttr",
      "Test Attr",
      AttributeType.String,
      "default",
    );
    const newPropertySet = createPropertySetWithCustomAttr(attrDef);
    const newRoot = new TestProperty(newPropertySet, null, "root", null,);
    newRoot.set("testAttr", "value");
    assertEquals(newRoot.get("testAttr"), "value");
  });

  it("getAttribute retorna atributo", () => {
    const attrDef = new AttributeDefinition(
      "testAttr",
      "Test Attr",
      AttributeType.String,
      "default",
    );
    const newPropertySet = createPropertySetWithCustomAttr(attrDef);
    const newRoot = new TestProperty(newPropertySet, null, "root", null,);
    const attr = newRoot.getAttribute("testAttr");
    assertEquals(attr, newRoot.attribute("testAttr"));
  });

  it("getForScenario retorna valor para cenário", () => {
    const attrDef = new AttributeDefinition(
      "scenarioAttr",
      "Scenario Attr",
      AttributeType.String,
      "default",
      false, false, false, true,
    );
    const newPropertySet = createPropertySetWithCustomAttr(attrDef);
    const newRoot = new TestProperty(newPropertySet, null, "root", null,);
    newRoot.setForScenario("scenarioAttr", "value", 0);
    assertEquals(newRoot.getForScenario("scenarioAttr", 0), "value");
  });

  it("set lança erro para atributo sobrescrito", () => {
    const attrDef = new AttributeDefinition(
      "testAttr",
      "Test Attr",
      AttributeType.String,
      "default",
    );
    const newPropertySet = createPropertySetWithCustomAttr(attrDef);
    const newRoot = new TestProperty(newPropertySet, null, "root", null,);
    newRoot.set("testAttr", "value1");
    assertThrows(() => newRoot.set("testAttr", "value2"), Error);
  });

  it("setForScenario lança erro para atributo sobrescrito", () => {
    const attrDef = new AttributeDefinition(
      "scenarioAttr",
      "Scenario Attr",
      AttributeType.String,
      "default",
      false, false, false, true,
    );
    const newPropertySet = createPropertySetWithCustomAttr(attrDef);
    const newRoot = new TestProperty(newPropertySet, null, "root", null,);
    newRoot.setForScenario("scenarioAttr", "value1", 0);
    assertThrows(() => newRoot.setForScenario("scenarioAttr", "value2", 0), Error);
  });

  it("provided retorna false para atributo não definido", () => {
    assertEquals(root.provided("nonexistent"), false);
  });

  it("provided retorna true para atributo definido", () => {
    const attrDef = new AttributeDefinition(
      "testAttr",
      "Test Attr",
      AttributeType.String,
      "default",
    );
    const newPropertySet = createPropertySetWithCustomAttr(attrDef);
    const newRoot = new TestProperty(newPropertySet, null, "root", null,);
    newRoot.set("testAttr", "value");
    assertEquals(newRoot.provided("testAttr"), true);
  });

  it("provided para cenário retorna false para atributo não definido", () => {
    assertEquals(root.provided("nonexistent", 0), false);
  });

  it("provided para cenário retorna true para atributo definido", () => {
    const attrDef = new AttributeDefinition(
      "scenarioAttr",
      "Scenario Attr",
      AttributeType.String,
      "default",
      false, false, false, true,
    );
    const newPropertySet = createPropertySetWithCustomAttr(attrDef);
    const newRoot = new TestProperty(newPropertySet, null, "root", null,);
    newRoot.setForScenario("scenarioAttr", "value", 0);
    assertEquals(newRoot.provided("scenarioAttr", 0), true);
  });

  it("inherited retorna false para atributo não definido", () => {
    assertEquals(root.inherited("nonexistent"), false);
  });

  it("inherited retorna true para atributo herdado", () => {
    const attrDef = new AttributeDefinition(
      "testAttr",
      "Test Attr",
      AttributeType.String,
      "default",
      false, false, false, false, true, false,
    );
    const newPropertySet = createPropertySetWithCustomAttr(attrDef);
    const parent = new TestProperty(newPropertySet, null, "parent", null,);
    const child = new TestProperty(newPropertySet, null, "child", parent,);
    parent.set("testAttr", "parentValue");
    child.inheritAttributes();
    assertEquals(child.inherited("testAttr"), true);
  });

  it("inheritAttributes herda de pai", () => {
    const attrDef = new AttributeDefinition(
      "testAttr",
      "Test Attr",
      AttributeType.String,
      "default",
      false, false, false, false, true, false,
    );
    const newPropertySet = createPropertySetWithCustomAttr(attrDef);
    const parent = new TestProperty(newPropertySet, null, "parent", null,);
    const child = new TestProperty(newPropertySet, null, "child", parent,);
    parent.set("testAttr", "parentValue");
    child.inheritAttributes();
    assertEquals(child.get("testAttr"), "parentValue");
    assertEquals(child.inherited("testAttr"), true);
  });

  it("modified retorna false para atributo não definido", () => {
    assertEquals(root.modified("nonexistent"), false);
  });

  it("modified retorna true para atributo modificado", () => {
    const attrDef = new AttributeDefinition(
      "testAttr",
      "Test Attr",
      AttributeType.String,
      "default",
    );
    const newPropertySet = createPropertySetWithCustomAttr(attrDef);
    const newRoot = new TestProperty(newPropertySet, null, "root", null,);
    newRoot.set("testAttr", "value");
    assertEquals(newRoot.modified("testAttr"), true);
  });

  it("attributeDefinition retorna undefined para id desconhecido", () => {
    assertEquals(root.attributeDefinition("unknown"), undefined);
  });

  it("attributeDefinition retorna definição para id conhecido", () => {
    const attrDef = new AttributeDefinition(
      "testAttr",
      "Test Attr",
      AttributeType.String,
      "default",
    );
    const newPropertySet = createPropertySetWithCustomAttr(attrDef);
    const newRoot = new TestProperty(newPropertySet, null, "root", null,);
    assertEquals(newRoot.attributeDefinition("testAttr"), attrDef);
  });

  it("scenarioData retorna dados para cenário", () => {
    const data = root.scenarioData(0);
    assertEquals(data, root.data[0]);
  });

  it("adopt lança erro para auto-adoção", () => {
    assertThrows(() => root.adopt(root), Error);
  });

  it("adopt lança erro para tarefa já adotada", () => {
    const attrDef = new AttributeDefinition(
      "testAttr",
      "Test Attr",
      AttributeType.String,
      "default",
    );
    const newPropertySet = createPropertySetWithCustomAttr(attrDef);
    const newRoot = new TestProperty(newPropertySet, null, "root", null,);
    const child = new TestProperty(newPropertySet, null, "child", newRoot,);
    assertThrows(() => newRoot.adopt(child), Error);
  });

  it("adopt adiciona adotado", () => {
    const attrDef = new AttributeDefinition(
      "testAttr",
      "Test Attr",
      AttributeType.String,
      "default",
    );
    const newPropertySet = createPropertySetWithCustomAttr(attrDef);
    const newRoot = new TestProperty(newPropertySet, null, "root", null,);
    const child = new TestProperty(newPropertySet, null, "child", null,);
    newRoot.adopt(child);
    assertEquals(newRoot.adoptees.length, 1);
  });

  it("getAdopted adiciona pai adotivo", () => {
    const attrDef = new AttributeDefinition(
      "testAttr",
      "Test Attr",
      AttributeType.String,
      "default",
    );
    const newPropertySet = createPropertySetWithCustomAttr(attrDef);
    const newRoot = new TestProperty(newPropertySet, null, "root", null,);
    const child = new TestProperty(newPropertySet, null, "child", newRoot,);
    child.getAdopted(newRoot);
    assertEquals(child.stepParents.length, 1);
  });

  it("backupAttributes cria cópia", () => {
    const backup = root.backupAttributes();
    assertEquals(backup[0] instanceof Map, true);
    assertEquals(backup[1] instanceof Array, true);
  });

  it("restoreAttributes restaura de backup", () => {
    const attrDef = new AttributeDefinition(
      "testAttr",
      "Test Attr",
      AttributeType.String,
      "default",
    );
    const newPropertySet = createPropertySetWithCustomAttr(attrDef);
    const newRoot = new TestProperty(newPropertySet, null, "root", null,);
    newRoot.set("testAttr", "value");
    const backup = newRoot.backupAttributes();
    newRoot.restoreAttributes(backup);
    assertEquals(newRoot.get("testAttr"), "value");
  });
});

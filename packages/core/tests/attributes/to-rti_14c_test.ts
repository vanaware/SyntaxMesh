/**
 * 14C.9.6–14C.9.7 — `to_rti` de `ReferenceAttribute` e `ListAttributeBase`.
 *
 * Fecha os quatro `to_rti` que faltavam para os relatórios (adendo §10):
 * `AttributeBase` (já pronto), `ReferenceAttribute`, `ListAttributeBase` e
 * `Query#to_rti` (que passa a repassar a própria query, como no Ruby).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ReferenceAttribute#to_rti
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ListAttributeBase#to_rti
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { AttributeBase, } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition, } from "../../src/attributes/attribute-definition.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";
import { ReferenceAttribute, } from "../../src/attributes/reference/reference-attribute.ts";
import { ResourceListAttribute, } from "../../src/attributes/list/resource-list-attribute.ts";
import { Query, } from "../../src/query/query.ts";
import { MockContainer, } from "../attributes/mock-container.ts";

interface RtiLike {
  to_s(): string;
}

describe("ReferenceAttribute#to_rti (14C.9.6)", () => {
  it("gera link RichText com label", () => {
    AttributeBase.setMode(0,);
    const container = new MockContainer();
    const type = new AttributeDefinition(
      "reference",
      "Reference",
      AttributeType.String,
      { url: "", },
    );
    const attr = new ReferenceAttribute(
      { id: "test.ref", name: "Ref", },
      type as never,
      container,
    );
    attr.set({ url: "https://example.com", label: "Docs", },);
    const rti = attr.to_rti() as RtiLike | null;
    assertEquals(rti?.to_s(), "Docs",);
  });

  it("sem valor retorna null", () => {
    AttributeBase.setMode(0,);
    const container = new MockContainer();
    const type = new AttributeDefinition(
      "reference",
      "Reference",
      AttributeType.String,
      { url: "", },
    );
    const attr = new ReferenceAttribute(
      { id: "test.ref", name: "Ref", },
      type as never,
      container,
    );
    container.setStoredValue("reference", null,);
    assertEquals(attr.to_rti(), null,);
  });
});

describe("ListAttributeBase#to_rti (14C.9.7)", () => {
  /** Monta um ResourceListAttribute com dois recursos. */
  function makeList(): ResourceListAttribute {
    AttributeBase.setMode(0,);
    const container = new MockContainer();
    const type = new AttributeDefinition(
      "resourcelist",
      "Resource List",
      AttributeType.ResourceList,
      [],
    );
    const attr = new ResourceListAttribute(
      { id: "test.res", name: "Res", },
      type as never,
      container,
    );
    attr.set([
      { id: "r1", name: "Resource 1", project: null, fullId: "r1", },
      { id: "r2", name: "Resource 2", project: null, fullId: "r2", },
    ],);
    return attr;
  }

  /** Query com `attr` já ligado (o pipeline normal vem do PropertySet). */
  function makeQuery(attr: ResourceListAttribute,): Query {
    const q = new Query({
      property: { id: "test.prop", name: "Prop", } as never,
      attributeId: "resources",
      propertyType: "Task",
    },);
    (q as unknown as { attr: unknown }).attr = attr;
    return q;
  }

  it("sem query gera um único RTI com os nomes", () => {
    const rti = makeList().to_rti() as RtiLike | null;
    assertEquals(rti?.to_s(), "Resource 1, Resource 2",);
  });

  it("com query sem listItem usa <nowiki>name</nowiki> por item", () => {
    const q = makeQuery(makeList(),);
    assertEquals(q.to_rti(), null,);
    const rti = (q as unknown as { rti: RtiLike | null }).rti;
    assertEquals(rti?.to_s(), "Resource 1, Resource 2",);
  });

  it("com listItem avalia o template por item e chama assignList", () => {
    const q = makeQuery(makeList(),);
    q.listItem = "R";
    assertEquals(q.to_rti(), null,);
    const rti = (q as unknown as { rti: RtiLike | null }).rti;
    // Um RTI por item (2) reunido por `assignList`.
    assertEquals(rti?.to_s(), "R, R",);
    assertEquals(
      (q as unknown as { string: string }).string,
      "<nowiki>R</nowiki>, <nowiki>R</nowiki>",
    );
  });
});

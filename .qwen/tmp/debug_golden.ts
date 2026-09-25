import { ChargeSetListAttribute } from "/home/aarvati/github/syntaxmesh/packages/core/src/attributes/financial/charge-set-list-attribute.ts";
import { AttributeDefinition } from "/home/aarvati/github/syntaxmesh/packages/core/src/attributes/attribute-definition.ts";
import { AttributeType } from "/home/aarvati/github/syntaxmesh/packages/core/src/attributes/attribute-type.ts";
import { type AttributeContainer } from "/home/aarvati/github/syntaxmesh/packages/core/src/attributes/attribute-container.ts";
import { type PropertyLike } from "/home/aarvati/github/syntaxmesh/packages/core/src/model/property-like.ts";

const container = {} as AttributeContainer;
const property = { id: "test.attr", name: "Test Attr" } as PropertyLike;
const type = new AttributeDefinition("chargersetlist", "ChargeSetList", AttributeType.ChargeSetList, [{ amount: 100, name: "cs1" }]);
const attr = new ChargeSetListAttribute(property, type, container);
attr.set([{ amount: 100, name: "cs1" }]);
console.log("to_tjp:", JSON.stringify(attr.to_tjp()));
console.log("to_s:", JSON.stringify(attr.to_s()));
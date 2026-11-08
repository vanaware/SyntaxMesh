/**
 * Fase 24 (24.2.34) — leituras de arquivo no pipeline de relatórios.
 *
 * Política v1 do caminho `execute`: **nenhum** provedor/store implícito. As
 * costuras herdadas ficam como estão — `CSVFile.read` segue ancorado na Fase
 * 19, a resolução de imagens sem `ImageStore` devolve `unresolved` e a
 * escrita de `XMLDocument` é no-op com warning. Assim o relatório nunca “vê”
 * um arquivo que não veio em `request.files`.
 *
 * O teste também guarda a regra English-first (plano §1.7) para as mensagens
 * dessas costuras.
 */
import {
  assert,
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { NotYetImplementedError, } from "../../src/model/errors.ts";
import { resolveImageRef, } from "../../src/markdown/extensions/images.ts";
import { CSVFile, } from "../../src/reports/csv-file.ts";
import { XMLDocument, } from "../../src/xml/xml-document.ts";
import { XMLElement, } from "../../src/xml/xml-element.ts";

describe("CSVFile.read — âncora da Fase 19 (24.2.34)", () => {
  it("lança NotYetImplementedError apontando a Fase 19", () => {
    const csv = new CSVFile([[1, 2,],],);
    // `read` é síncrono no port (o Ruby abria o `File` na hora).
    const error = assertThrows(
      () => csv.read("tabela.csv",),
      NotYetImplementedError,
    );
    assertStringIncludes(error.message, "CSVFile.read",);
    assertStringIncludes(error.message, "19",);
  });

  it("write fora de '.' continua no-op, agora em inglês", () => {
    MessageHandlerInstance.instance.reset();
    new CSVFile([[1,],],).write("tabela.csv",);

    const message = MessageHandlerInstance.instance.messages[0]!;
    assertEquals(message.id, "csv_write_noop",);
    assertStringIncludes(message.message, "is a no-op in the browser",);
    assert(!message.message.includes("é",), "mensagem fora do inglês",);
  });
});

describe("resolveImageRef — sem ImageStore não há disco (24.2.34)", () => {
  it("referência relativa fica unresolved sem store/dataDirs", async () => {
    const resolved = await resolveImageRef("img/logo.png",);
    assertEquals(resolved.origin, "unresolved",);
    assertEquals(resolved.src, "img/logo.png",);
  });

  it("URL externa passa intacta", async () => {
    const resolved = await resolveImageRef("https://example.com/a.png",);
    assertEquals(resolved.origin, "external",);
    assertEquals(resolved.src, "https://example.com/a.png",);
  });

  it("dataDirs do projeto seguem como fallback declarado, não leitura", async () => {
    const resolved = await resolveImageRef("logo.png", {
      dataDirs: ["data/",],
    },);
    // `dataDir` é **descritor**: quem materializa o blob é a camada de render.
    assertEquals(resolved.origin, "dataDir",);
    assertEquals(resolved.src, "data/logo.png",);
  });
});

describe("XMLDocument.write — escrita é do consumidor (24.2.34)", () => {
  it("'.' devolve a string do documento (sem tocar disco)", () => {
    const doc = new XMLDocument();
    doc.append(new XMLElement("a", {},),);
    assertEquals(doc.write(".",), "<a></a>\n",);
  });

  it("nome de arquivo é no-op com aviso em inglês", () => {
    MessageHandlerInstance.instance.reset();
    const doc = new XMLDocument();
    doc.append(new XMLElement("a", {},),);

    assertEquals(doc.write("saida.xml",), undefined,);
    const message = MessageHandlerInstance.instance.messages[0]!;
    assertEquals(message.id, "xml_document_write_noop",);
    assertStringIncludes(message.message, "is a no-op in the browser",);
    assert(!message.message.includes("é",), "mensagem fora do inglês",);
  });
});

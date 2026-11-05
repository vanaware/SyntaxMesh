/**
 * XMLDocument — port fiel de `XMLDocument.rb` (Fase 17.2).
 *
 * Contentor de elementos de topo. Não é um `XMLElement`: apenas acumula
 * filhos e os concatena na serialização (`to_s` chama `element.to_s(0)` de
 * cada um, sem qualquer separador).
 *
 * Diferenças entre `XMLDocument#<<` e `XMLElement#<<` que o port preserva:
 *   - `XMLDocument` **achata** o array (`arg.flatten`) e **não valida** o
 *     conteúdo — nem remove `nil` de dentro do array. No Ruby um `nil` ali
 *     vira `nil.to_s == ''`; o `to_s` daqui espelha isso (Categoria C).
 *     `XMLElement#<<` não achata e levanta para non-`XMLElement`.
 *   - `initialize(&block)` atribui o resultado do bloco **sem** qualquer
 *     processamento (o Ruby não aceita bloco que devolva elemento isolado).
 *
 * Escrita em arquivo (17.2.7): o browser não tem filesystem (ADR 027).
 * `write('.')` — que no Ruby despeja em `$stdout` — devolve a string do
 * documento; qualquer outro nome é no-op com warning, seguindo o precedente
 * de `CSVFile.write`. Escrita real fica ancorada na Fase 19 (ADR 037).
 *
 * @see docs/taskjuggler/lib/taskjuggler/XMLDocument.rb
 * @see docs/syntaxmesh/decisoes/038-substituicao-xml.md
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.2)
 */

import { MessageHandlerInstance, } from "../message-handler.ts";
import { type XmlChild, XMLElement, } from "./xml-element.ts";

/** Bloco do construtor: devolve a lista de elementos de topo. */
export type XmlDocumentBlock = (
  block: XmlDocumentBlock,
) => XMLElement[] | void;

/**
 * Argumento aceito por `append` (Ruby `<<`). Arrays aninhados são aceitos
 * porque o Ruby faz `arg.flatten` antes de acumular.
 */
export type XmlDocumentChild = XmlChild | XmlDocumentChild[];

/**
 * Ruby `arg.flatten`: só achatou sub-arrays; `null` continua na lista (ao
 * contrário de `compact`). Implementação própria porque `Array.flat(Infinity)`
 * com o tipo recursivo `XmlDocumentChild` estoura a instanciação do TS.
 */
function flattenRuby(arg: XmlDocumentChild,): XmlDocumentChild[] {
  const out: XmlDocumentChild[] = [];
  const walk = (item: XmlDocumentChild,): void => {
    if (Array.isArray(item,)) {
      for (const nested of item as XmlDocumentChild[]) walk(nested,);
    } else out.push(item,);
  };
  walk(arg,);
  return out;
}

/** Documento XML: agregador de elementos de topo. */
export class XMLDocument {
  /** Elementos de topo (`@elements`). Protegido no Ruby; idem aqui. */
  protected readonly elements: XMLElement[];

  constructor(block?: XmlDocumentBlock,) {
    this.elements = block ? ((block(block,) ?? []) as XMLElement[]) : [];
  }

  /** Ruby `<<` (17.2.4–5). */
  append(arg: XmlDocumentChild,): void {
    if (Array.isArray(arg,)) {
      // Ruby: `@elements += arg.flatten` — achatou e não valida nada.
      for (const item of flattenRuby(arg,)) {
        this.elements.push(item as XMLElement,);
      }
    } else if (arg === null || arg === undefined) {
      // Ruby: `elsif arg.nil? then # do nothing`
    } else if (arg instanceof XMLElement) {
      this.elements.push(arg,);
    } else {
      throw new Error(
        `Unsupported argument of type ${
          (arg as object).constructor?.name ?? typeof arg
        }: ${JSON.stringify(arg,)}`,
      );
    }
  }

  /** Ruby `to_s` (17.2.6) — concatena cada elemento com indentação zero. */
  to_s(): string {
    let str = "";
    for (const element of this.elements) {
      // Ruby chama `element.to_s` mesmo em `nil` → `nil.to_s == ''`.
      if (element === null || element === undefined) continue;
      str += element.to_s(0,);
    }
    return str;
  }

  /**
   * Ruby `write(filename)` (17.2.7): `'.'` vai para `$stdout`; nomes de
   * arquivo abrem e fecham um `File`. No browser devolvemos a string no caso
   * `'.'` e avisamos nos demais.
   *
   * ⚠️ O Ruby usa `f.puts element.to_s(0)` — `puts` só acrescenta `\n` quando a
   * string ainda não termina em `\n`. Isso faz `write('.')` **diferir** de
   * `to_s()`, que concatena sem separador algum. O port preserva a diferença.
   */
  write(filename: string,): string | undefined {
    if (filename === ".") {
      let str = "";
      for (const element of this.elements) {
        // `nil.to_s == ''` no Ruby, e `puts ''` imprime uma linha em branco.
        const text = element === null || element === undefined ?
          "" :
          element.to_s(0,);
        str += text.endsWith("\n",) ? text : text + "\n";
      }
      return str;
    }
    MessageHandlerInstance.instance.warning(
      "xml_document_write_noop",
      `XMLDocument.write('${filename}') é no-op no browser; use to_s()`,
      null,
    );
    return undefined;
  }
}

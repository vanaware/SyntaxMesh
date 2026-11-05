/**
 * XMLElement — port fiel de `XMLElement.rb` (Fase 17.1).
 *
 * Substitui o `XMLElement` da Fase 12 (ADR 038). A árvore é a mesma,
 * mas a **serialização** agora replica `to_s(indent)` do Ruby, inclusive os
 * detalhes que o mínimo não tinha:
 *
 *   - Atributos ordenados por chave (`@attributes.keys.sort`).
 *   - `<name/>` só quando `selfClosing` **e** sem filhos; senão `<name></name>`.
 *   - Quebra de linha + indentação entre filhos **não-`XMLText`**, apenas
 *     quando há mais de um filho e o buffer termina em `>`. A indentação é de
 *     **uma SPACE por nível** (`' ' * indent`) — não duas, como sugere o
 *     plano (§4.2). Ruby é a fonte da verdade.
 *   - `escape` trata apenas `&` e `"`; **não** escapa `<`/`>` (isso é do
 *     `XMLText#to_s`, que tem o próprio case). O plano (§4.2, tarefa 17.1.1.19)
 *     pedia `<`/`>` no `escape` — divergência registrada.
 *
 * Bugs/estranhezas do Ruby (categorias do `cheat-sheet-ruby-ts.md` §12):
 *   - **Categoria B** — `escape` emite `\"` (backslash + aspas) para `"`, em
 *     vez de `&quot;`. É o que o `tj3` escreve no HTML/XML; replicamos quando
 *     `compat.keepRubyBugs` é `true` (default). Com a flag em `false` usamos
 *     a forma correta (`&quot;`).
 *   - **Categoria C** — o parâmetro `quotes` de `escape(str, quotes = false)`
 *     é **ignorado** pelo Ruby: aspas são escapadas incondicionalmente.
 *     Mantemos o parâmetro pela assinatura.
 *   - **Categoria A (corrigida)** — `XMLElement#<<` com `Array` faz
 *     `arg.delete_if { |i| i.nil? }`, isto é, **muta o array do chamador**.
 *     O efeito na árvore é idêntico; não mutamos a entrada.
 *
 * Acréscimos exigidos pelo contrato `XMLElementLike` (Fase 12), documentados
 * no ADR 038: o getter `tag` (alias de `name`), `toHTML()` (alias de
 * `to_s(0)`) e a aceitação de `XMLElementLike` em `append` (para que a
 * assinatura realize a interface sem quebrar quem ainda entrega nós antigos).
 *
 * @see docs/taskjuggler/lib/taskjuggler/XMLElement.rb
 * @see docs/syntaxmesh/decisoes/038-substituicao-xml.md
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.1)
 */

import type { XMLElementLike, } from "./xml-element-like.ts";
import { compat, } from "../compat.ts";
import { eachUtf8Char, } from "../utils/utf8.ts";

/** Filho aceito por `append` (Ruby: `XMLElement | String | Array | nil`). */
export type XmlChild =
  | XMLElement
  | XMLElementLike
  | string
  | null
  | undefined;

/** Argumento de `append`: um filho ou uma lista de filhos (sem ninho). */
export type XmlChildArg = XmlChild | XmlChild[];

/**
 * Resultado do bloco do construtor. Diferente de `append`, o Ruby achata
 * listas aninhadas aqui (`@children.flatten!`), então o tipo é recursivo.
 */
export type XmlBlockResult = XmlChild | XmlBlockResult[] | void;

/**
 * Bloco do construtor (Ruby `&block`, invocado como `yield(block)` — o bloco
 * recebe a si próprio como argumento).
 */
export type XmlBlock = (block: XmlBlock,) => XmlBlockResult;

/** Nome de classe/tipo para mensagens de erro (aproxima `c.class`). */
function typeName(value: unknown,): string {
  if (value === null) return "NilClass";
  if (Array.isArray(value,)) return "Array";
  if (typeof value === "object" && value.constructor?.name) {
    return String(value.constructor.name,);
  }
  return typeof value;
}

/** Inspeção curta de valor (aproxima `Object#inspect` nas mensagens do Ruby). */
function inspectValue(value: unknown,): string {
  if (typeof value === "string") return `"${value}"`;
  if (value === null || value === undefined) return String(value,);
  if (typeof value === "object") {
    const keys = Object.keys(value,);
    return keys.length === 0 ?
      "{}" :
      `{${keys.slice(0, 3,).join(", ",)}${keys.length > 3 ? ", ..." : ""}}`;
  }
  return String(value,);
}

/** Elemento XML/HTML com filhos — o nó básico de toda a serialização. */
export class XMLElement implements XMLElementLike {
  /** Nome da tag (`@name` do Ruby). `null` = nó sem tag própria. */
  readonly name: string | null;
  /** Atributos chave→valor (`@attributes`). */
  readonly attrs: Record<string, string>;
  /** Se `true`, pode ser serializado como `<name/>` quando vazio. */
  readonly selfClosing: boolean;
  /** Filhos (sempre `XMLElement`; strings viraram `XMLText`). */
  readonly children: XMLElement[];

  /**
   * Ruby: `initialize(name, attributes = {}, selfClosing = false, &block)`.
   *
   * O bloco (se houver) produz os filhos: um valor solo vira lista, listas
   * são achatadas, strings viram `XMLText`, `null` são descartadas e o que
   * sobrar precisa ser `XMLElement`.
   */
  constructor(
    name: string | null,
    attrs: Record<string, string> = {},
    selfClosing = false,
    block?: XmlBlock,
  ) {
    // 17.1.1.3 — `name` deve ser string ou null; null não leva atributos.
    if (
      (name === null && Object.keys(attrs,).length > 0) ||
      (name !== null && typeof name !== "string")
    ) {
      throw new Error(
        `Name must be nil or a String: ${inspectValue(name,)}`,
      );
    }
    // 17.1.1.4 — nomes e valores de atributo não podem ser nulos nem non-String.
    for (const [key, value,] of Object.entries(attrs,)) {
      if (key === null || value === null || value === undefined) {
        throw new Error(
          `Attribute name (${key}) or value (${value}) may not be nil`,
        );
      }
      if (typeof value !== "string") {
        throw new Error(`Attribute value of ${key} must be a String`,);
      }
    }

    this.name = name;
    this.attrs = attrs;
    this.selfClosing = selfClosing;

    // 17.1.1.5–8 — mesmo pipeline do Ruby para os filhos do bloco.
    let kids: unknown[] = [];
    if (block) {
      const result: unknown = block(block,);
      kids = Array.isArray(result,) ? result.flat(Infinity,) : [result,];
    }
    const built: XMLElement[] = [];
    for (const kid of kids) {
      if (kid === null || kid === undefined) continue; // 17.1.1.7
      if (typeof kid === "string") {
        built.push(new XMLText(kid,),); // 17.1.1.6
        continue;
      }
      if (!(kid instanceof XMLElement)) {
        // 17.1.1.8
        throw new Error(
          `Element must be of type XMLElement, not ${typeName(kid,)}: ${
            inspectValue(kid,)
          }`,
        );
      }
      built.push(kid,);
    }
    this.children = built;
  }

  /** Ruby `attr_reader :name` via interface (`XMLElementLike.tag`). */
  get tag(): string | null {
    return this.name;
  }

  /** Ruby `<<` (17.1.1.9–12). Retorna `self`, como no Ruby. */
  append(arg: XmlChildArg,): this {
    if (arg instanceof XMLElement) {
      this.children.push(arg,);
    } else if (typeof arg === "string") {
      this.children.push(new XMLText(arg,),);
    } else if (Array.isArray(arg,)) {
      // Categoria A: o Ruby mutaria `arg` ao remover os nulos (`delete_if`).
      const items: XMLElement[] = [];
      for (const item of arg) {
        if (item === null || item === undefined) continue;
        if (!(item instanceof XMLElement)) {
          throw new Error(
            `Element must be of type XMLElement, not ${typeName(item,)}: ${
              inspectValue(item,)
            }`,
          );
        }
        items.push(item,);
      }
      this.children.push(...items,);
    } else if (arg === null || arg === undefined) {
      // 17.1.1.11 — inserir null é ignorado.
    } else {
      throw new Error(
        `Elements must be of type XMLElement not ${typeName(arg,)}`,
      );
    }
    return this;
  }

  /** Ruby `[]=` (17.1.1.13) — valor tem de ser String. */
  setAttr(attribute: string, value: string,): void {
    if (typeof value !== "string") {
      throw new Error(
        `Attribute value ${inspectValue(value,)} is not a String`,
      );
    }
    this.attrs[attribute] = value;
  }

  /** Ruby `[]` (17.1.1.14) — `undefined` equivale a `nil`. */
  getAttr(attribute: string,): string | undefined {
    return Object.prototype.hasOwnProperty.call(this.attrs, attribute,)
      ? this.attrs[attribute]
      : undefined;
  }

  /** Alias de `to_s(0)` exigido por `XMLElementLike` (17.1.1.15). */
  toHTML(): string {
    return this.to_s(0,);
  }

  /** Ruby `to_s(indent = 0)` (17.1.1.16–18). */
  to_s(indent = 0,): string {
    if (this.name === null) {
      // Ruby: `'<' + nil` levanta TypeError. Só as subclasses que
      // sobrescrevem `to_s` (XMLText/XMLComment/XMLBlob) podem ter nome nulo.
      throw new TypeError("no implicit conversion of nil into String",);
    }
    let out = "<" + this.name;
    for (const attrName of Object.keys(this.attrs,).sort()) {
      out += ` ${attrName}="${this.escape(this.attrs[attrName] ?? "", true,)}"`;
    }
    if (this.children.length === 0 && this.selfClosing) {
      return out + "/>";
    }
    out += ">";
    for (const child of this.children) {
      // Ruby: só inserta nova linha para múltiplos filhos e depois de `>`.
      if (
        this.children.length > 1 && !(child instanceof XMLText) &&
        out.endsWith(">",)
      ) {
        out += "\n" + this.indentation(indent + 1,);
      }
      out += child.to_s(indent + 1,);
    }
    if (this.children.length > 1 && out.endsWith(">",)) {
      out += "\n" + this.indentation(indent,);
    }
    return out + "</" + this.name + ">";
  }

  /**
   * Ruby `escape(str, quotes = false)` (17.1.1.19).
   *
   * Categoria C: o Ruby ignora `quotes` e escapa `"` sempre. Itera por code
   * point (`each_utf8_char`), como o restante do port.
   */
  protected escape(str: string, quotes = false,): string {
    void quotes; // Assinatura fiel; o Ruby não usa o parâmetro.
    let out = "";
    for (const char of eachUtf8Char(str,)) {
      if (char === "&") out += "&amp;";
      else if (char === '"') out += compat.keepRubyBugs ? '\\"' : "&quot;";
      else out += char;
    }
    return out;
  }

  /** Ruby `indentation(indent)` (17.1.1.20) — uma SPACE por nível. */
  protected indentation(indent: number,): string {
    return " ".repeat(indent,);
  }
}

/** Texto puro: escapa `<`, `>`, `&` e **não** escapa `"` (17.1.2). */
export class XMLText extends XMLElement {
  private readonly textValue: string;

  constructor(text: string,) {
    super(null, {},);
    // Ruby: `raise 'Text may not be nil' unless text` — mas `''` é truthy em
    // Ruby e falsy em JS. Verificamos só nulo/undefined para não quebrar isso.
    if (text === null || text === undefined) {
      throw new Error("Text may not be nil",);
    }
    this.textValue = text;
  }

  /**
   * Conteúdo escapado; a indentação é tratada pelo pai.
   *
   * Ruby: `to_s(indent)` — o parâmetro é declarado mas ignorado (o texto não
   * tem quebras). Aceitamos chamada sem argumento por conveniência do port.
   */
  override to_s(_indent = 0,): string {
    let out = "";
    for (const char of eachUtf8Char(this.textValue,)) {
      if (char === "<") out += "&lt;";
      else if (char === ">") out += "&gt;";
      else if (char === "&") out += "&amp;";
      else out += char;
    }
    return out;
  }
}

/** `name`/`attrs` do elemento + `text` do `XMLText` filho (17.1.3). */
export class XMLNamedText extends XMLElement {
  constructor(
    text: string,
    name: string | null,
    attrs: Record<string, string> = {},
  ) {
    super(name, attrs,);
    this.append(new XMLText(text,),);
  }
}

/** Comentário XML; `--` é canonicalizado em `-\-` (17.1.4). */
export class XMLComment extends XMLElement {
  private readonly textValue: string;

  constructor(text = "",) {
    super(null, {},);
    this.textValue = text;
  }

  override to_s(indent = 0,): string {
    return `<!-- ${canonicalizeComment(this.textValue,)} -->\n${
      " ".repeat(indent,)
    }`;
  }
}

/**
 * Blobo cru (XML/HTML já serializado). Não interpreta o conteúdo; apenas
 * reindent o que vem depois de `\n` (17.1.5).
 */
export class XMLBlob extends XMLElement {
  private readonly blob: string;

  constructor(blob = "",) {
    super(null, {},);
    if (blob === null || blob === undefined) {
      throw new Error("blob may not be nil",);
    }
    this.blob = blob;
  }

  override to_s(indent = 0,): string {
    let out = "";
    for (const char of eachUtf8Char(this.blob,)) {
      out += char === "\n" ? "\n" + " ".repeat(indent,) : char;
    }
    return out;
  }
}

/** Ruby `XMLComment#canonicalize_comment` — `--` → `-\-`. */
function canonicalizeComment(text: string,): string {
  return text.replace(/--/g, "-\\-",);
}

/**
 * Fragmento sem tag própria (acréscimo do port, ADR 038 — 17.12).
 *
 * O Ruby **não** tem fragmento: `XMLElement#to_s` com `@name` nulo levanta
 * `TypeError` (`'<' + nil`). A Fase 12, com o `SimpleXMLElement`, acostumou os
 * consumidores (RichText `func`/`report`, `ReportTableCell`, `to_html()` de
 * relatórios que devolvem **vários nós**) a agrupar filhos num nó sem tag —
 * `XMLElementLike.children`, que não tem equivalente em `XMLElement`. `Fragment`
 * preserva esse uso: serializa apenas os filhos, colados (como o `to_s(0)`).
 *
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.12)
 */
export class Fragment extends XMLElement {
  constructor(children: XmlChild[] = [],) {
    super(null, {},);
    for (const child of children) this.append(child,);
  }

  override to_s(_indent = 0,): string {
    let out = "";
    for (const child of this.children) out += child.to_s(0,);
    return out;
  }

  override toHTML(): string {
    return this.to_s();
  }
}

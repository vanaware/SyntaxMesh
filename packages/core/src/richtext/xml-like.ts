/**
 * XMLElementLike — interface mínima de elemento XML/HTML para o RichText.
 *
 * Na Fase 12 o `RichTextElement.to_html` precisa retornar uma **árvore** de
 * elementos (não uma string), porque o `XMLDocument`/relatórios (Fases 14/17)
 * manipulam essa árvore. O `XMLElement` real só nasce na **Fase 17**; até lá
 * usamos esta interface + `SimpleXMLElement` (implementação mínima). A Fase 17
 * fornece um `XMLElement` que também satisfaz `XMLElementLike`, substituindo
 * esta implementação sem quebrar chamadas.
 *
 * Port fiel de `XMLElement.rb` (`to_s`/`escape`):
 *   - Atributos escapam `&` e `"` (Ruby `escape(v, true)`).
 *   - Texto escapam `&`, `<`, `>` (Ruby `XMLText#to_s`).
 *   - Filhos que são `XMLElementLike` são renderizados crus (markup já válido).
 *
 * @see docs/taskjuggler/lib/taskjuggler/XMLElement.rb:112-150
 * @see ADR 025 (RichText e function handlers)
 */

/** Interface de nó XML/HTML usada pelo RichText (substituída na Fase 17). */
export interface XMLElementLike {
  /** Nome da tag (ex.: `div`). `null` = fragmento (sem tag própria). */
  readonly tag: string | null;
  /** Atributos chave→valor. */
  readonly attrs: Record<string, string>;
  /** Filhos: nós XML ou texto puro. */
  readonly children: Array<XMLElementLike | string>;
  /** Anexa um filho (nó ou texto). */
  append(child: XMLElementLike | string,): void;
  /** Serializa para HTML com indentação mínima. */
  toHTML(): string;
}

/** Elementos void (auto-fechados): não têm conteúdo nem tag de fechamento. */
const VOID_ELEMENTS: ReadonlySet<string> = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
],);

/** Escapa texto para uso em **atributo** (Ruby `escape(v, true)`). */
function escapeAttr(str: string,): string {
  return str.replace(/&/g, "&amp;",).replace(/"/g, "&quot;",);
}

/** Escapa texto para uso em **conteúdo** (Ruby `XMLText#to_s`). */
function escapeText(str: string,): string {
  return str
    .replace(/&/g, "&amp;",)
    .replace(/</g, "&lt;",)
    .replace(/>/g, "&gt;",);
}

/** Detecta se um valor satisfaz `XMLElementLike` (tem `toHTML`). */
function isElement(value: unknown,): value is XMLElementLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toHTML?: unknown }).toHTML === "function"
  );
}

/**
 * Implementação mínima de `XMLElementLike`. Suficiente para o RichText desta
 * fase; substituída pelo `XMLElement` real na Fase 17.
 */
export class SimpleXMLElement implements XMLElementLike {
  readonly tag: string | null;
  readonly attrs: Record<string, string>;
  readonly children: Array<XMLElementLike | string>;

  constructor(tag: string | null, attrs: Record<string, string> = {},) {
    if (tag === null && Object.keys(attrs,).length > 0) {
      throw new Error("Fragment (tag null) não pode ter atributos",);
    }
    this.tag = tag;
    this.attrs = attrs;
    this.children = [];
  }

  append(child: XMLElementLike | string,): void {
    if (child !== null && child !== undefined) this.children.push(child,);
  }

  toHTML(): string {
    // Fragmento: apenas os filhos concatenados.
    if (this.tag === null) return this.renderChildren();

    let out = "<" + this.tag;
    for (const name of Object.keys(this.attrs,).sort()) {
      out += ` ${name}="${escapeAttr(this.attrs[name] ?? "",)}"`;
    }

    if (this.children.length === 0 && VOID_ELEMENTS.has(this.tag,)) {
      return out + " />";
    }

    out += ">";
    out += this.renderChildren();
    out += `</${this.tag}>`;
    return out;
  }

  private renderChildren(): string {
    let out = "";
    for (const child of this.children) {
      out += isElement(child,) ? child.toHTML() : escapeText(child,);
    }
    return out;
  }
}

/** Cria um nó de texto simples (renderiza escapado ao ser anexado). */
export function createText(content: string,): string {
  return content;
}

/** Cria um comentário HTML (`<!-- ... -->`). */
export function createComment(content: string,): XMLElementLike {
  // `--` não é permitido dentro de um comentário; neutraliza como o Ruby.
  const safe = content.replace(/--/g, "-\\-",);
  return new RawHTMLNode(`<!-- ${safe} -->`,);
}

/** Cria um blob de HTML cru (injetado sem escape). */
export function createBlob(content: string,): XMLElementLike {
  return new RawHTMLNode(content,);
}

/**
 * Nó que renderiza HTML cru já serializado (comentários/blobs). Interno —
 * exposto apenas via {@link createComment}/{@link createBlob}.
 */
class RawHTMLNode implements XMLElementLike {
  readonly tag = null;
  readonly attrs: Record<string, string> = {};
  readonly children: Array<XMLElementLike | string> = [];
  constructor(private readonly raw: string,) {}
  append(): void {
    /* blob não aceita filhos */
  }
  toHTML(): string {
    return this.raw;
  }
}

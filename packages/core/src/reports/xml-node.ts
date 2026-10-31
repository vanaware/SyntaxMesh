/**
 * Nós XML mínimos para `MspXmlRE` (Fase 14.18).
 *
 * Porta fiel do subconjunto de `XMLElement`/`XMLDocument`/`XMLNamedText`/
 * `XMLComment`/`XMLBlob` que o exportador de Microsoft Project XML usa. O
 * `XMLElement` completo é Fase 17; aqui só precisamos de serialização compacta
 * (sem indentação), exatamente como o `to_s` de Ruby produz para o MSP XML.
 *
 * Escaping (análogo a `XMLElement.rb`):
 *   - Texto escapa `&`, `<`, `>`.
 *   - Atributos escapam `&` e `"`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/XMLElement.rb
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.18.3)
 */

/** Escapa texto para conteúdo de elemento. */
function escapeText(str: string,): string {
  return str
    .replace(/&/g, "&amp;",)
    .replace(/</g, "&lt;",)
    .replace(/>/g, "&gt;",);
}

/**
 * Escapa valor de atributo. Fiél a `XMLElement#escape(str, true)` de Ruby:
 * `&` → `&amp;` e `"` → `\"` (backslash-quote, não `&quot;`).
 */
function escapeAttr(str: string,): string {
  return str.replace(/&/g, "&amp;",).replace(/"/g, '\\"',);
}

/** Nó XML serializável (`to_s`), espelhando a API usada por `MspXmlRE`. */
export interface XmlNode {
  to_s(): string;
}

/** Blobo de texto cru injetado sem escape (ex.: declaração `<?xml ...?>`). */
export class XMLBlob implements XmlNode {
  constructor(private readonly text: string,) {}
  to_s(): string {
    return this.text;
  }
}

/**
 * Comentário XML. Fiél a `XMLComment#to_s` de Ruby: `<!-- text -->` seguido de
 * quebra de linha.
 */
export class XMLComment implements XmlNode {
  constructor(private readonly text: string,) {}
  to_s(): string {
    // `--` não é permitido dentro de um comentário.
    const safe = this.text.replace(/--/g, "-\\-",);
    return `<!-- ${safe} -->\n`;
  }
}

/**
 * Elemento com um único filho de texto (`<name>text</name>`).
 *
 * Ordem dos argumentos fiel a Ruby: `XMLNamedText.new(text, name)`.
 */
export class XMLNamedText implements XmlNode {
  constructor(private readonly text: string, private readonly name: string,) {}
  to_s(): string {
    return `<${this.name}>${escapeText(this.text,)}</${this.name}>`;
  }
}

/** Elemento com atributos e filhos arbitrários. */
export class XMLElement implements XmlNode {
  readonly children: XmlNode[] = [];
  constructor(
    readonly name: string,
    readonly attrs: Record<string, string> = {},
  ) {}

  /** Anexa um filho (`@file << node` do Ruby). */
  push(child: XmlNode,): void {
    this.children.push(child,);
  }

  to_s(): string {
    let out = `<${this.name}`;
    for (const key of Object.keys(this.attrs,)) {
      out += ` ${key}="${escapeAttr(this.attrs[key] ?? "",)}"`;
    }
    if (this.children.length === 0) return out + "/>";
    out += ">";
    for (const child of this.children) out += child.to_s();
    out += `</${this.name}>`;
    return out;
  }
}

/** Documento: raiz que apenas concatena seus filhos. */
export class XMLDocument implements XmlNode {
  readonly children: XmlNode[] = [];
  push(child: XmlNode,): void {
    this.children.push(child,);
  }
  to_s(): string {
    let out = "";
    for (const child of this.children) out += child.to_s();
    return out;
  }
}

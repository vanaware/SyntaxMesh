/**
 * Sanitização de HTML inline (Fase 13.5).
 *
 * Markdown/GFM aceita HTML cru. O SyntaxMesh permite só tags de formatação:
 * as da **allow-list** passam com os atributos seguros; as da **block-list**
 * (`script`, `style`, `iframe`, `object`, `embed`) têm tag **e conteúdo**
 * removidos; tags desconhecidas perdem a tag e mantêm o conteúdo. Atributos de
 * evento (`on*`) e URLs `javascript:`/`vbscript:`/`data:` são descartados.
 *
 * Não há referência TaskJuggler: é segurança do próprio SyntaxMesh
 * (conteúdo Markdown renderiza em página HTML da PWA).
 *
 * @see ADR 026 (Markdown como formato going-forward)
 */

/** Tags preservadas (13.5.2). */
export const ALLOWED_TAGS = [
  "span",
  "div",
  "a",
  "b",
  "i",
  "em",
  "strong",
  "code",
  "pre",
  "br",
  "hr",
  "p",
  "ul",
  "ol",
  "li",
  "blockquote",
];

/** Tags cuja presença elimina o elemento inteiro, conteúdo incluído (13.5.3). */
export const BLOCKED_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "style",
  "link",
  "meta",
];

/** Atributos preservados (13.5.5). */
export const ALLOWED_ATTRS = [
  "class",
  "id",
  "href",
  "title",
  "target",
  "style",
];

/** URL com esquema perigoso (OWASP: `javascript:`, `data:`, `vbscript:`). */
const DANGEROUS_URL_RE = /^\s*(javascript|vbscript|data|file)\s*:/i;

/** `style` com função/vetor conhecido de XSS. */
const DANGEROUS_STYLE_RE = /(expression|url\s*\(|@import|javascript:|<)/i;

/** Tag de abertura, fechamento, self-closing ou comentário. */
const TAG_RE =
  /<!--[\s\S]*?(-->|$)|<(\/)([a-zA-Z][\w:.-]*)\s*>|<([a-zA-Z][\w:.-]*)((?:\s+[^<>]*?)?)(\/)?>/g;

/** Par de atributo (`nome`, `nome="valor"`, `nome='valor'`, `nome=valor`). */
const ATTR_RE =
  /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;

/** Nome de tag em lower case (`fcol:red` preserva o `:` para não romper markup). */
function tagName(raw: string,): string {
  return raw.toLowerCase();
}

/** Verdadeiro se `tag` está na allow-list. */
export function isAllowedTag(tag: string,): boolean {
  return ALLOWED_TAGS.includes(tagName(tag,),);
}

/** Verdadeiro se `tag` está na block-list. */
export function isBlockedTag(tag: string,): boolean {
  return BLOCKED_TAGS.includes(tagName(tag,),);
}

/** Filtra os atributos de um tag, mantendo só os seguros (13.5.5, 13.5.6). */
function sanitizeAttributes(raw: string,): string {
  const kept: string[] = [];
  for (const match of raw.matchAll(ATTR_RE,)) {
    const name = (match[1] ?? "").toLowerCase();
    if (name === "") continue;
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if (!ALLOWED_ATTRS.includes(name,)) continue; // inclui on*, src, onerror…
    if (name.startsWith("on",)) continue;
    if (name === "href" && DANGEROUS_URL_RE.test(value,)) continue;
    if (name === "style" && DANGEROUS_STYLE_RE.test(value,)) continue;
    kept.push(`${name}="${value.replace(/"/g, "&quot;",)}"`,);
  }
  return kept.length > 0 ? " " + kept.join(" ",) : "";
}

/**
 * Sanitiza um fragmento de HTML (13.5.4).
 *
 * ```ts
 * sanitizeHtml('<script>alert(1)</script>');            // ''
 * sanitizeHtml('<a href="x" onclick="y">z</a>');        // '<a href="x">z</a>'
 * sanitizeHtml('<blink>oi</blink>');                    // 'oi'
 * ```
 */
export function sanitizeHtml(html: string,): string {
  let out = "";
  // Nome do elemento bloqueado cujo conteúdo estamos descartando, ou `null`.
  let skipping: string | null = null;
  let cursor = 0;

  for (const match of html.matchAll(TAG_RE,)) {
    const [full, , _slash, closingName, openingName, attrs = "", selfClose,] =
      match;
    const index = match.index ?? 0;
    const text = html.slice(cursor, index,);
    cursor = index + full.length;

    if (skipping) {
      // Dentro de <script>/<style>/…: só procuramos o fechamento do próprio tag.
      if (closingName && tagName(closingName,) === skipping) skipping = null;
      continue;
    }
    if (closingName) {
      const tag = tagName(closingName,);
      out += text;
      if (isBlockedTag(tag,)) continue;
      if (isAllowedTag(tag,)) out += `</${tag}>`;
      continue;
    }
    if (!openingName) {
      // Comentário `<!-- … -->` ou entrada truncada: some inteiro.
      out += text;
      continue;
    }
    const tag = tagName(openingName,);
    if (isBlockedTag(tag,)) {
      // Tags void (`link`, `meta`) só somem; as outras também levam o conteúdo.
      out += text;
      if (!selfClose && !VOID_TAGS.includes(tag,)) skipping = tag;
      continue;
    }
    out += text;
    if (isAllowedTag(tag,)) {
      out += `<${tag}${sanitizeAttributes(attrs,)}${selfClose ? " /" : ""}>`;
    }
    // Tag desconhecida: conteúdo preservado no próximo trecho, tag descartada.
  }

  out += skipping ? "" : html.slice(cursor,);
  return out;
}

/** Tags que nunca têm conteúdo (HTML void elements). */
const VOID_TAGS = ["br", "hr", "img", "input", "meta", "link",];

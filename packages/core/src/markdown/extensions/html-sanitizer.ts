/**
 * Inline HTML sanitization (phase 13.5).
 *
 * Markdown/GFM accepts raw HTML. SyntaxMesh allows formatting tags only: the
 * ones in the **allow-list** pass with the safe attributes; the ones in the
 * **block-list** (`script`, `style`, `iframe`, `object`, `embed`) have both tag
 * **and content** removed; unknown tags lose the tag and keep the content.
 * Event attributes (`on*`) and `javascript:`/`vbscript:`/`data:` URLs are
 * dropped.
 *
 * There is no TaskJuggler reference here: this is SyntaxMesh's own security
 * (Markdown content renders inside the PWA HTML page).
 *
 * @see ADR 026 (Markdown as the going-forward format)
 */

/** Preserved tags (13.5.2). */
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

/** Tags whose presence removes the whole element, content included (13.5.3). */
export const BLOCKED_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "style",
  "link",
  "meta",
];

/** Preserved attributes (13.5.5). */
export const ALLOWED_ATTRS = [
  "class",
  "id",
  "href",
  "title",
  "target",
  "style",
];

/** URL with a dangerous scheme (OWASP: `javascript:`, `data:`, `vbscript:`). */
const DANGEROUS_URL_RE = /^\s*(javascript|vbscript|data|file)\s*:/i;

/** `style` with a known XSS function/vector. */
const DANGEROUS_STYLE_RE = /(expression|url\s*\(|@import|javascript:|<)/i;

/** Opening, closing or self-closing tag, or comment. */
const TAG_RE =
  /<!--[\s\S]*?(-->|$)|<(\/)([a-zA-Z][\w:.-]*)\s*>|<([a-zA-Z][\w:.-]*)((?:\s+[^<>]*?)?)(\/)?>/g;

/** Attribute pair (`name`, `name="value"`, `name='value'`, `name=value`). */
const ATTR_RE =
  /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;

/** Lower-cased tag name (`fcol:red` keeps the `:` so markup is not broken). */
function tagName(raw: string,): string {
  return raw.toLowerCase();
}

/** True when `tag` is in the allow-list. */
export function isAllowedTag(tag: string,): boolean {
  return ALLOWED_TAGS.includes(tagName(tag,),);
}

/** True when `tag` is in the block-list. */
export function isBlockedTag(tag: string,): boolean {
  return BLOCKED_TAGS.includes(tagName(tag,),);
}

/** Filters a tag's attributes, keeping only the safe ones (13.5.5, 13.5.6). */
function sanitizeAttributes(raw: string,): string {
  const kept: string[] = [];
  for (const match of raw.matchAll(ATTR_RE,)) {
    const name = (match[1] ?? "").toLowerCase();
    if (name === "") continue;
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if (!ALLOWED_ATTRS.includes(name,)) continue; // covers on*, src, onerror…
    if (name.startsWith("on",)) continue;
    if (name === "href" && DANGEROUS_URL_RE.test(value,)) continue;
    if (name === "style" && DANGEROUS_STYLE_RE.test(value,)) continue;
    kept.push(`${name}="${value.replace(/"/g, "&quot;",)}"`,);
  }
  return kept.length > 0 ? " " + kept.join(" ",) : "";
}

/**
 * Sanitizes an HTML fragment (13.5.4).
 *
 * ```ts
 * sanitizeHtml('<script>alert(1)</script>');            // ''
 * sanitizeHtml('<a href="x" onclick="y">z</a>');        // '<a href="x">z</a>'
 * sanitizeHtml('<blink>hi</blink>');                    // 'hi'
 * ```
 */
export function sanitizeHtml(html: string,): string {
  let out = "";
  // Name of the blocked element whose content is being dropped, or `null`.
  let skipping: string | null = null;
  let cursor = 0;

  for (const match of html.matchAll(TAG_RE,)) {
    const [full, , _slash, closingName, openingName, attrs = "", selfClose,] =
      match;
    const index = match.index ?? 0;
    const text = html.slice(cursor, index,);
    cursor = index + full.length;

    if (skipping) {
      // Inside <script>/<style>/…: only look for the closing tag of that tag.
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
      // Comment `<!-- … -->` or truncated input: disappears entirely.
      out += text;
      continue;
    }
    const tag = tagName(openingName,);
    if (isBlockedTag(tag,)) {
      // Void tags (`link`, `meta`) just vanish; the others take the content.
      out += text;
      if (!selfClose && !VOID_TAGS.includes(tag,)) skipping = tag;
      continue;
    }
    out += text;
    if (isAllowedTag(tag,)) {
      out += `<${tag}${sanitizeAttributes(attrs,)}${selfClose ? " /" : ""}>`;
    }
    // Unknown tag: content preserved in the next excerpt, tag discarded.
  }

  out += skipping ? "" : html.slice(cursor,);
  return out;
}

/** Tags that never have content (HTML void elements). */
const VOID_TAGS = ["br", "hr", "img", "input", "meta", "link",];

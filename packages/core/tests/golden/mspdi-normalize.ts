/**
 * Normalização do XML MSPDI para comparação oracle (14C.4.1).
 *
 * Espelha 1:1 o walker REXML de `scripts/golden/mspdi-tj3.rb`
 * (`MspdiGolden.node`): cada elemento vira `{ tag, text, children }`, sem
 * atributos (o MSPDI só usa `xmlns` no `<Project>`) e com o texto colapsado em
 * whitespace. Elementos voláteis (`CreationDate`/`CurrentDate`/`StatusDate`,
 * derivados do relógio de geração) ficam fora dos dois lados.
 *
 * O parser é mínimo de propósito: o documento é gerado pelo próprio
 * `MspXmlRE` (tags simples, sem CDATA/entidades além de `&amp;`/`&lt;`/`&gt;`)
 * e o ADR 027 impede trazer um DOM/parser externo só para o teste.
 *
 * @see scripts/golden/mspdi-tj3.rb
 * @see docs/tj3-engine/mspdi.md
 */

/** Nó normalizado (mesma forma dos hashes do walker Ruby). */
export interface MspdiNode {
  tag: string;
  text: string | null;
  children: MspdiNode[];
}

/** Elementos dependentes do relógio de geração, ignorados na comparação. */
const VOLATILE = new Set(["CreationDate", "CurrentDate", "StatusDate",],);

/** Colapsa whitespace e devolve `null` quando o texto fica vazio. */
export function normalizeText(value: string | null,): string | null {
  if (value === null) return null;
  const collapsed = unescapeText(value,).replace(/[ \t\r\n]+/g, " ",).trim();
  return collapsed === "" ? null : collapsed;
}

/** Desfaz as entidades XML emitidas por `xml-node.ts`. */
function unescapeText(value: string,): string {
  return value
    .replace(/&lt;/g, "<",)
    .replace(/&gt;/g, ">",)
    .replace(/&amp;/g, "&",);
}

const TAG = /<(\/?)([A-Za-z_][\w.:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;

/**
 * Converte a string XML no nó raiz normalizado.
 *
 * Declaração e comentários são descartados; `<Project>` é a raiz.
 */
export function normalizeMspdi(xml: string,): MspdiNode {
  const body = xml
    .replace(/<\?[\s\S]*?\?>/g, "",)
    .replace(/<!--[\s\S]*?-->/g, "",);

  const root: MspdiNode = { tag: "#document", text: null, children: [], };
  const stack: MspdiNode[] = [root,];
  let cursor = 0;

  for (const match of body.matchAll(TAG,)) {
    const raw = match[0]!;
    const closing = match[1] ?? "";
    const tag = match[2] ?? "";
    const selfClosing = match[4] ?? "";
    const current = stack[stack.length - 1]!;

    const between = normalizeText(body.slice(cursor, match.index,),);
    if (between !== null) current.text = between;
    cursor = match.index + raw.length;

    if (closing === "/") {
      stack.pop();
      continue;
    }
    const node: MspdiNode = { tag, text: null, children: [], };
    if (!VOLATILE.has(tag,)) current.children.push(node,);
    if (selfClosing === "") stack.push(node,);
    else if (VOLATILE.has(tag,)) stack.push(node,);
  }

  const project = root.children.find((n,) => n.tag === "Project");
  if (!project) throw new Error("XML MSPDI sem elemento <Project>",);
  return project;
}

/** Filho único esperado por nome (texto). */
export function childText(node: MspdiNode, tag: string,): string | null {
  const child = node.children.find((c,) => c.tag === tag);
  return child ? child.text : null;
}

/** Todos os filhos com o nome dado. */
export function childrenTagged(node: MspdiNode, tag: string,): MspdiNode[] {
  return node.children.filter((c,) => c.tag === tag);
}

/** Texto de um neto (`<Tasks><Task>` → `childTextOf(task, "Name")`). */
export function childTextOf(
  node: MspdiNode,
  parentTag: string,
  tag: string,
): string | null {
  const parent = node.children.find((c,) => c.tag === parentTag);
  return parent ? childText(parent, tag,) : null;
}
